module.exports = {
    config: {
        name: "setunsend",
        aliases: ["setun", "reactunsend", "uns"],
        version: "1.0.0",
        credits: "Isenkai",
        info: "Set icon reaction để tự động gỡ tin nhắn",
        usage: "[icon] hoặc 'off' để tắt hoặc 'list' xem danh sách",
        Category: "Box",
        cd: 5,
        role: 1 
    },

    onRun: async function({ api, event, args, permssion, database }) {
        const { threadID, messageID, senderID } = event;

        try {
            let settings = database.get.json('unsendSettings', 'default', { threads: {} });
            if (args.length === 0) {
                const currentIcon = settings.threads[threadID]?.icon;
                if (currentIcon) {
                    return api.sendMessage(
                        `⚙️ Settings hiện tại:\n` +
                        `Icon: ${currentIcon}\n` +
                        `Status: Bật\n\n` +
                        `Dùng: setunsend off - để tắt\n` +
                        `Dùng: setunsend [icon] - để đổi icon`,
                        threadID,
                        messageID
                    );
                } else {
                    return api.sendMessage(
                        `⚙️ Chưa set icon unsend\n\n` +
                        `Dùng: setunsend [icon]\n` +
                        `Ví dụ: setunsend 👍`,
                        threadID,
                        messageID
                    );
                }
            }

            const input = args.join(' ').trim();
            if (input.toLowerCase() === 'list' || input.toLowerCase() === 'all') {
                const permssion = global.config.ADMINBOT.includes(senderID) ? 2 : global.config.NDH.includes(senderID) ? 3 : 0;               
                if (permssion < 2) {
                    return api.sendMessage(
                        ` Chỉ admin bot mới xem được list`,
                        threadID,
                        messageID
                    );
                }

                const allThreads = Object.keys(settings.threads);
                if (allThreads.length === 0) {
                    return api.sendMessage(
                        ` Chưa có thread nào set auto unsend`,
                        threadID,
                        messageID
                    );
                }

                let msg = `📋 DANH SÁCH AUTO UNSEND\n`;
                msg += `━━━━━━━━━━━━━━━━━━\n\n`;
                
                for (const tid of allThreads) {
                    try {
                        const threadInfo = await api.getThreadInfo(tid);
                        const threadName = threadInfo.threadName || threadInfo.name || 'Unknown';
                        const icon = settings.threads[tid].icon;
                        msg += `${icon} ${threadName}\n`;
                        msg += `ID: ${tid}\n\n`;
                    } catch (e) {
                        msg += `${settings.threads[tid].icon} Thread ${tid}\n\n`;
                    }
                }

                msg += `Tổng: ${allThreads.length} threads`;
                return api.sendMessage(msg, threadID, messageID);
            }
            if (input.toLowerCase() === 'off') {
                if (settings.threads[threadID]) {
                    database.delete.threadSetting('unsendSettings', threadID);
                    return api.sendMessage(
                        `✅ Đã tắt auto unsend reaction`,
                        threadID,
                        messageID
                    );
                } else {
                    return api.sendMessage(
                        ` Chưa có settings để tắt`,
                        threadID,
                        messageID
                    );
                }
            }
            const icon = input;
            if (icon.length > 10) {
                return api.sendMessage(
                    ` Icon quá dài! Chỉ dùng 1 emoji`,
                    threadID,
                    messageID
                );
            }
            database.update.threadSetting('unsendSettings', threadID, {
                icon: icon,
                setBy: senderID,
                setAt: new Date().toISOString()
            });

            return api.sendMessage(
                `✅ Đã set auto unsend\n` +
                `Icon: ${icon}\n\n` +
                `Bất kỳ ai react ${icon} vào tin nhắn sẽ tự động gỡ tin nhắn đó`,
                threadID,
                messageID
            );

        } catch (error) {
            console.error('Setunsend error:', error);
            return api.sendMessage(
                ` Lỗi: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
