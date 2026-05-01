"use strict";

function normalizeID(value) {
    return String(value || "").trim();
}

function isGroupID(id) {
    const value = normalizeID(id);
    return /^\d{8,}$/.test(value);
}

function addThreadIDsFromThreadBucket(output, bucket) {
    if (!bucket || typeof bucket !== "object") return;
    for (const id of Object.keys(bucket)) {
        if (isGroupID(id)) output.add(String(id));
    }
}

function getThreadIDsFromDatabase(database) {
    const ids = new Set();

    try {
        for (const id of database.checktt.getThreadIDs()) {
            if (isGroupID(id)) ids.add(String(id));
        }
    } catch { }

    for (const category of ["rentData", "antiSettings", "notiSettings", "prefixData", "pokemon"]) {
        try {
            const data = database.get.json(category, "default", { threads: {} });
            addThreadIDsFromThreadBucket(ids, data.threads);
        } catch { }
    }

    return Array.from(ids);
}

async function getThreadName(api, threadID) {
    try {
        const info = await api.getThreadInfo(threadID);
        if (info?.isGroup === false) return null;
        const participantCount = Array.isArray(info?.participantIDs) ? info.participantIDs.length : 0;
        if (info?.isGroup !== true && participantCount <= 2) return null;
        return info?.threadName || info?.name || `Nhóm ${threadID}`;
    } catch {
        return null;
    }
}

async function getUserName(api, threadID, userID) {
    try {
        const info = await api.getThreadInfo(threadID);
        const user = (info?.userInfo || []).find(item => String(item.id) === String(userID));
        return user?.name || `User ${userID}`;
    } catch {
        return `User ${userID}`;
    }
}

function pushReplyState(state) {
    if (!global.concac.onReply) global.concac.onReply = [];
    global.concac.onReply.push({ name: "sendnoti", ...state });
}

function sendMessage(api, message, threadID, replyTo) {
    return new Promise((resolve, reject) => {
        api.sendMessage(message, threadID, (error, info) => {
            if (error) reject(error);
            else resolve(info || {});
        }, replyTo);
    });
}

function isAdminUser(userID) {
    const id = String(userID || "");
    const { ADMINBOT = [], NDH = [] } = global.config || {};
    return ADMINBOT.map(String).includes(id) || NDH.map(String).includes(id);
}

module.exports = {
    config: {
        name: "sendnoti",
        aliases: ["sendnoti", "thongbao", "broadcast", "notiall"],
        version: "1.0.0",
        author: "bot",
        role: 2,
        info: "Gửi thông báo đến tất cả nhóm trong DB và nhận phản hồi",
        Category: "Admin",
        guides: "sendnoti <nội dung>",
        cd: 5,
        hasPrefix: true
    },

    onRun: async function ({ api, event, args, database }) {
        const { threadID, senderID, messageID } = event;
        const content = args.join(" ").trim();
        if (!content) {
            return api.sendMessage("Dùng: sendnoti <nội dung thông báo>", threadID, null, messageID);
        }

        const threadIDs = getThreadIDsFromDatabase(database);
        if (threadIDs.length === 0) {
            return api.sendMessage("Không có nhóm nào trong DB.", threadID, null, messageID);
        }

        let sent = 0;
        let failed = 0;
        const failedList = [];

        for (const targetThreadID of threadIDs) {
            try {
                const threadName = await getThreadName(api, targetThreadID);
                if (!threadName) continue;

                const notice = [
                    "📢 THÔNG BÁO TỪ ADMIN",
                    "",
                    content,
                    "",
                    "Reply tin nhắn này để phản hồi admin."
                ].join("\n");

                const info = await sendMessage(api, notice, targetThreadID);
                if (info.messageID) {
                    pushReplyState({
                        type: "userReply",
                        messageID: info.messageID,
                        adminID: String(senderID),
                        adminThreadID: String(threadID),
                        sourceThreadID: String(targetThreadID),
                        sourceThreadName: threadName,
                        notice: content
                    });
                }
                sent++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                failed++;
                failedList.push(`${targetThreadID}: ${error.message || error}`);
            }
        }

        const summary = [
            "📨 Đã gửi thông báo.",
            `Thành công: ${sent}`,
            `Lỗi: ${failed}`
        ];
        if (failedList.length > 0) summary.push("", failedList.slice(0, 5).join("\n"));
        return api.sendMessage(summary.join("\n"), threadID, null, messageID);
    },

    onReply: async function ({ api, event, onReply }) {
        const { threadID, senderID, messageID, body } = event;
        const text = String(body || "").trim();
        if (!text) return;

        if (onReply.type === "userReply") {
            if (String(threadID) !== String(onReply.sourceThreadID)) return;

            const userName = await getUserName(api, threadID, senderID);
            const forward = [
                "📩 PHẢN HỒI THÔNG BÁO",
                `Nhóm: ${onReply.sourceThreadName}`,
                `Người gửi: ${userName}`,
                `UID: ${senderID}`,
                "",
                text,
                "",
                "Reply tin này để trả lời lại nhóm đó."
            ].join("\n");

            const info = await sendMessage(api, forward, onReply.adminThreadID);
            if (info.messageID) {
                pushReplyState({
                    type: "adminReply",
                    messageID: info.messageID,
                    adminID: onReply.adminID,
                    targetThreadID: String(threadID),
                    targetMessageID: String(messageID),
                    targetUserID: String(senderID),
                    targetUserName: userName,
                    sourceThreadName: onReply.sourceThreadName
                });
            }
            return;
        }

        if (onReply.type === "adminReply") {
            if (!isAdminUser(senderID) && String(senderID) !== String(onReply.adminID)) return;

            const reply = [
                "📢 ADMIN PHẢN HỒI",
                "",
                text
            ].join("\n");

            const sent = await sendMessage(api, reply, onReply.targetThreadID, onReply.targetMessageID);
            if (sent.messageID) {
                pushReplyState({
                    type: "userReply",
                    messageID: sent.messageID,
                    adminID: onReply.adminID,
                    adminThreadID: String(threadID),
                    sourceThreadID: onReply.targetThreadID,
                    sourceThreadName: onReply.sourceThreadName,
                    notice: text
                });
            }

            return api.sendMessage(`Đã trả lời ${onReply.targetUserName} tại ${onReply.sourceThreadName}.`, threadID, null, messageID);
        }
    }
};
