"use strict";

function send(api, message, threadID, replyTo) {
    return api.sendMessage(message, threadID, null, replyTo);
}

function getMentionIDs(mentions) {
    return Object.keys(mentions || {}).map(String).filter(Boolean);
}

function parseAmount(args) {
    const raw = [...args].reverse().find(arg => /^-?\d+$/.test(String(arg || "").replace(/,/g, "")));
    if (!raw) return NaN;
    return parseInt(String(raw).replace(/,/g, ""), 10);
}

function isAdmin(senderID) {
    const id = String(senderID || "");
    const { ADMINBOT = [], NDH = [] } = global.config || {};
    return ADMINBOT.map(String).includes(id) || NDH.map(String).includes(id);
}

async function getName(api, threadID, userID) {
    try {
        const info = await api.getThreadInfo(threadID);
        const user = (info?.userInfo || []).find(item => String(item.id) === String(userID));
        if (user?.name) return user.name;
    } catch { }
    return `User ${userID}`;
}

function getTargetID(event, args) {
    const mentionIDs = getMentionIDs(event.mentions);
    if (event.messageReply?.senderID) return String(event.messageReply.senderID);
    if (mentionIDs.length > 0) return mentionIDs[0];

    const idArg = args.find(arg => /^\d{5,}$/.test(String(arg || "")));
    return idArg ? String(idArg) : String(event.senderID);
}

module.exports = {
    config: {
        name: "money",
        aliases: ["mn"],
        version: "1.3.0",
        role: 0,
        author: "",
        info: "Quản lý tiền trong nhóm",
        Category: "Game",
        guides: "money [check/pay/top/add/set/sub/delete/clear/reset]",
        cd: 5,
        hasPrefix: true
    },

    onRun: async function ({ api, event, args, money }) {
        const { threadID, messageID, senderID } = event;
        const subCommand = String(args[0] || "check").toLowerCase();
        const admin = isAdmin(senderID);

        const targetID = getTargetID(event, args);
        const targetName = await getName(api, threadID, targetID);

        switch (subCommand) {
            case "check":
            case "me":
            case "bal":
            case "balance": {
                const balance = await money.checkMoney(targetID);
                return send(api, `👤 ${targetName}\n💰 Số dư: ${balance.toLocaleString()}$`, threadID, messageID);
            }

            case "pay":
            case "transfer": {
                const receiverID = getTargetID(event, args);
                const amount = parseAmount(args);
                if (!receiverID || receiverID === String(senderID)) {
                    return send(api, "⚠️ Hãy tag hoặc reply người nhận.", threadID, messageID);
                }
                if (!Number.isFinite(amount) || amount <= 0) {
                    return send(api, "⚠️ Số tiền không hợp lệ.", threadID, messageID);
                }

                const ok = await money.pay(senderID, receiverID, amount);
                if (!ok) return send(api, "⚠️ Số dư không đủ.", threadID, messageID);

                const senderName = await getName(api, threadID, senderID);
                const receiverName = await getName(api, threadID, receiverID);
                return send(api, `✅ ${senderName} đã chuyển ${amount.toLocaleString()}$ cho ${receiverName}.`, threadID, messageID);
            }

            case "add": {
                if (!admin) return send(api, "⚠️ Chỉ Admin bot được dùng.", threadID, messageID);
                const amount = parseAmount(args);
                if (!Number.isFinite(amount) || amount <= 0) return send(api, "⚠️ Nhập số tiền cần cộng.", threadID, messageID);
                const next = await money.addMoney(targetID, amount);
                return send(api, `✅ Đã cộng ${amount.toLocaleString()}$ cho ${targetName}.\n💰 Số dư: ${next.toLocaleString()}$`, threadID, messageID);
            }

            case "sub":
            case "subtract":
            case "delete":
            case "del": {
                if (!admin) return send(api, "⚠️ Chỉ Admin bot được dùng.", threadID, messageID);
                const amount = parseAmount(args);
                if (!Number.isFinite(amount) || amount <= 0) return send(api, "⚠️ Nhập số tiền cần trừ.", threadID, messageID);
                const next = await money.subtractMoney(targetID, amount);
                return send(api, `✅ Đã trừ ${amount.toLocaleString()}$ của ${targetName}.\n💰 Số dư: ${next.toLocaleString()}$`, threadID, messageID);
            }

            case "set": {
                if (!admin) return send(api, "⚠️ Chỉ Admin bot được dùng.", threadID, messageID);
                const amount = parseAmount(args);
                if (!Number.isFinite(amount)) return send(api, "⚠️ Nhập số tiền cần set.", threadID, messageID);
                const next = await money.setMoney(targetID, amount);
                return send(api, `✅ Đã set tiền của ${targetName} thành ${next.toLocaleString()}$.`, threadID, messageID);
            }

            case "clear": {
                if (!admin) return send(api, "⚠️ Chỉ Admin bot được dùng.", threadID, messageID);
                const next = await money.setMoney(targetID, 0);
                return send(api, `✅ Đã xóa tiền của ${targetName}.\n💰 Số dư: ${next.toLocaleString()}$`, threadID, messageID);
            }

            case "reset": {
                if (!admin) return send(api, "⚠️ Chỉ Admin bot được dùng.", threadID, messageID);
                const type = String(args[1] || "box").toLowerCase();
                if (type === "all") {
                    const changed = await money.resetAll();
                    return send(api, `✅ Đã reset toàn bộ money.\nĐã xóa: ${changed} dòng`, threadID, messageID);
                }
                const changed = await money.resetThread();
                return send(api, `✅ Đã reset money nhóm này.\nĐã xóa: ${changed} dòng`, threadID, messageID);
            }

            case "top": {
                const data = await money.getBoxData();
                const sorted = Object.entries(data)
                    .sort(([, a], [, b]) => Number(b) - Number(a))
                    .slice(0, 10);

                if (sorted.length === 0) return send(api, "⚠️ Nhóm này chưa có dữ liệu money.", threadID, messageID);

                const lines = ["👑 TOP MONEY"];
                for (let i = 0; i < sorted.length; i++) {
                    const [uid, balance] = sorted[i];
                    lines.push(`${i + 1}. ${await getName(api, threadID, uid)}: ${Number(balance).toLocaleString()}$`);
                }
                return send(api, lines.join("\n"), threadID, messageID);
            }

            default:
                return send(api,
                    "📌 MONEY\n" +
                    "money [tag/reply]: xem tiền\n" +
                    "money pay <số> @tag: chuyển tiền\n" +
                    "money top: bảng xếp hạng\n" +
                    "Admin: add/set/sub/delete/clear/reset",
                    threadID,
                    messageID
                );
        }
    }
};
