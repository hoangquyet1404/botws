module.exports = {
    config: {
        name: "getmessage",
        aliases: ["getmsg", "checkmsg"],
        version: "1.0.0",
        role: 1, // Admin
        author: "qh",
        info: "Lấy thông tin chi tiết của tin nhắn thông qua messageID",
        Category: "Box",
        guides: "[reply] hoặc [messageID]",
        cd: 5,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args }) {
        const { threadID, messageID, messageReply } = event;

        let targetMessageID;

        if (messageReply) {
            targetMessageID = messageReply.messageID;
        }
        else if (args[0]) {
            targetMessageID = args[0];
        }
        else {
            return api.sendMessage(
                "> Vui lòng reply một tin nhắn hoặc nhập messageID để kiểm tra.",
                threadID,
                messageID
            );
        }

        try {
            const result = await api.getMessage(threadID, targetMessageID);

            const formattedResult = JSON.stringify(result, null, 2);

            return api.sendMessage(
                `> Message Info:\n${formattedResult}`,
                threadID,
                messageID
            );

        } catch (error) {
            console.error("[getmessage] Error:", error);
            return api.sendMessage(
                `> Lỗi khi lấy thông tin tin nhắn: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
