const axios = require('axios');

module.exports = {
    config: {
        name: "summary",
        aliases: ["sum"],
        version: "1.0.0",
        role: 0,
        author: "",
        info: "Tóm tắt cuộc trò chuyện",
        Category: "Box",
        guides: "[hours]",
        cd: 10,
        hasPrefix: true,
        images: []
    },

    onRun: async function({ api, event, args }) {
        const { threadID, messageID } = event;

        try {
            await api.sendMessage("> Đang tóm tắt...", threadID, null, messageID);

            const hours = parseInt(args[0]) || 24;
            const startTimestamp = Date.now() - (hours * 60 * 60 * 1000);

            api.summarizeThread(threadID, { startTimestamp: startTimestamp, maxMessages: 100, usecaseName: "UNREAD_MESSAGES",threadType: "GROUP"
            }, (err, result) => {
                if (err) {
                    console.error("Summary error:", err);
                    return api.sendMessage(`> Lỗi: ${err.message}`, threadID,null, messageID);
                }
                let msg = `📝 Tóm tắt ${hours}h gần đây:\n\n`;            
                if (result.summary) {
                    msg += result.summary;
                } else {
                    msg += `> Không lấy được nội dung tóm tắt`;
                }

                return api.sendMessage(msg, threadID, null, messageID);
            });

        } catch (error) {
            console.error(`[${this.config.name}] Error:`, error);
            return api.sendMessage(`> Lỗi: ${error.message}`, threadID, null,messageID);
        }
    }
};
