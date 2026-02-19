
const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "setprefix",
        aliases: ["prefix", "doiprefix"],
        version: "1.0.0",
        role: 1,
        author: "Isenkai",
        info: "Đổi prefix riêng cho nhóm",
        Category: "Box",
        guides: "setprefix <prefix mới>",
        cd: 3,
        hasPrefix: true,
        images: []
    },

    onRun: async function({ api, event, args, permssion }) {
        const { threadID, messageID, senderID } = event;
        const prefixDataPath = path.join(process.cwd(), 'main/data/prefixData.json');

        try {
            let prefixData = { threads: {} };
            
            if (fs.existsSync(prefixDataPath)) {
                prefixData = JSON.parse(fs.readFileSync(prefixDataPath, 'utf8'));
            }

            const newPrefix = args[0];
            if (!newPrefix) {
                const currentPrefix = prefixData.threads[threadID]?.prefix || global.config.PREFIX;
                return api.sendMessage(
                    `📌 PREFIX HIỆN TẠI\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Prefix: ${currentPrefix}\n\n` +
                    `💡 Để đổi prefix, dùng: setprefix <prefix mới>\n` +
                    `Ví dụ: setprefix !`,
                    threadID,
                    messageID
                );
            }
            if (newPrefix.length > 5) {
                return api.sendMessage(" Prefix không được dài quá 5 ký tự!", threadID, messageID);
            }
            prefixData.threads[threadID] = {
                prefix: newPrefix,
                setBy: senderID,
                setTime: Date.now()
            };

            fs.writeFileSync(prefixDataPath, JSON.stringify(prefixData, null, 2), 'utf8');
            if (global.rentScheduler) {
                global.rentScheduler.updateNickname(threadID);
            }

            return api.sendMessage(
                `✅ Đã đổi prefix thành công!\n\n` +
                `Prefix mới: ${newPrefix}\n` +
                `Ví dụ: ${newPrefix}help`,
                threadID,
                messageID
            );

        } catch (error) {
            console.error(`[setprefix] Error:`, error);
            return api.sendMessage(` Lỗi: ${error.message}`, threadID, messageID);
        }
    }
};
