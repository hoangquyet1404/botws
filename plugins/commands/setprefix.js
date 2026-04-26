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

    onRun: async function({ api, event, args, permssion, database }) {
        const { threadID, messageID, senderID } = event;

        try {
            const newPrefix = args[0];
            if (!newPrefix) {
                const currentPrefix = database.get.threadSetting('prefixData', threadID, null)?.prefix || global.config.PREFIX;
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
            if (['reset', 'default', 'off'].includes(String(newPrefix).toLowerCase())) {
                const existed = database.delete.threadSetting('prefixData', threadID);
                if (global.rentScheduler) {
                    global.rentScheduler.updateNickname(threadID);
                }
                return api.sendMessage(
                    existed
                        ? `✅ Đã xoá prefix riêng, nhóm dùng lại prefix mặc định: ${global.config.PREFIX}`
                        : `Nhóm này đang dùng prefix mặc định: ${global.config.PREFIX}`,
                    threadID,
                    messageID
                );
            }
            if (newPrefix.length > 5) {
                return api.sendMessage(" Prefix không được dài quá 5 ký tự!", threadID, messageID);
            }
            database.update.threadSetting('prefixData', threadID, {
                prefix: newPrefix,
                setBy: senderID,
                setTime: Date.now()
            });
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
