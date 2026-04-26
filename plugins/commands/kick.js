"use strict";

function getMentionTarget(event) {
    const mentions = event?.mentions && typeof event.mentions === "object" ? event.mentions : {};
    const id = Object.keys(mentions)[0];
    if (!id) return null;
    return {
        id: String(id),
        name: String(mentions[id] || id).replace(/^@/, "")
    };
}

function getReplyTarget(event) {
    const reply = event?.messageReply;
    if (!reply?.senderID) return null;
    return {
        id: String(reply.senderID),
        name: reply.senderName || reply.name || String(reply.senderID)
    };
}

function getThreadUserName(threadInfo, userID, fallback) {
    const user = (threadInfo?.userInfo || []).find(item => String(item.id) === String(userID));
    return user?.name || fallback || String(userID);
}

function isThreadAdmin(threadInfo, userID) {
    return (threadInfo?.adminIDs || []).some(item => String(item.id || item) === String(userID));
}

module.exports = {
    config: {
        name: "kick",
        aliases: ["kickuser"],
        version: "1.0.0",
        role: 1,
        author: "",
        info: "Kick thành viên bằng tag hoặc reply",
        Category: "Box",
        guides: "kick @tag | reply tin nhắn rồi dùng kick",
        cd: 3,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, permssion }) {
        const { threadID, messageID, senderID } = event;

        if (!event.isGroup && String(threadID) === String(senderID)) {
            return api.sendMessage("Lệnh này chỉ dùng trong nhóm.", threadID, null, messageID);
        }

        const target = getMentionTarget(event) || getReplyTarget(event);
        if (!target?.id) {
            return api.sendMessage("Vui lòng tag hoặc reply người cần kick.", threadID, null, messageID);
        }

        const botID = String(api.getCurrentUserID?.() || "");
        if (String(target.id) === botID) {
            return api.sendMessage("Không thể kick bot bằng lệnh này.", threadID, null, messageID);
        }
        if (String(target.id) === String(senderID)) {
            return api.sendMessage("Không thể tự kick chính mình.", threadID, null, messageID);
        }

        const threadInfo = await api.getThreadInfo(threadID);
        if (!isThreadAdmin(threadInfo, botID)) {
            return api.sendMessage("Bot cần quyền quản trị viên nhóm để kick thành viên.", threadID, null, messageID);
        }

        const targetName = getThreadUserName(threadInfo, target.id, target.name);
        if (isThreadAdmin(threadInfo, target.id) && Number(permssion || 0) < 2) {
            return api.sendMessage("Chỉ Admin Bot/NDH mới được kick quản trị viên nhóm.", threadID, null, messageID);
        }

        try {
            await api.removeFromGroup(target.id, threadID);
            return api.sendMessage(`Đã kick ${targetName} khỏi nhóm.`, threadID, null, messageID);
        } catch (error) {
            return api.sendMessage(`Kick thất bại: ${error.message || error}`, threadID, null, messageID);
        }
    }
};
