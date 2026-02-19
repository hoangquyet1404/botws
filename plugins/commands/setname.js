
module.exports = {
    config: {
        name: "setname",
        aliases: ["biendanh", "setn"],
        version: "2.0.0",
        role: 0,
        author: "",
        info: "Đổi biệt danh, kiểm tra và gọi người chưa đặt biệt danh",
        Category: "Box",
        guides: "[text] - Đổi biệt danh cho bản thân\n" +
                "[text] + reply - Đổi cho người được reply\n" +
                "[text] + tag - Đổi cho người được tag\n" +
                "check - Xem ai chưa đặt biệt danh\n" +
                "call - Tag những người chưa đặt biệt danh",
        cd: 3,
        hasPrefix: true
    },

    onRun: async function({ api, event, args, utils }) {
        const { threadID, messageID, senderID, mentions, messageReply } = event;

        try {
            const query = args[0] ? args[0].toLowerCase() : '';
            const threadInfo = await api.getThreadInfo(threadID);
            const nicknames = threadInfo.nicknames || {};
            if (query === 'check') {
                const noNicknameUsers = [];
                
                for (const user of threadInfo.userInfo) {
                    if (!nicknames[user.id] || nicknames[user.id].trim() === '') {
                        noNicknameUsers.push({
                            id: user.id,
                            name: user.name || 'Facebook User'
                        });
                    }
                }

                if (noNicknameUsers.length === 0) {
                    return api.sendMessage(
                        '✅ Tất cả thành viên đã đặt biệt danh',
                        threadID,
                        messageID
                    );
                }

                let message = `━━ Chưa đặt biệt danh ━━\n`;
                message += `Tổng: ${noNicknameUsers.length} người\n\n`;

                for (let i = 0; i < noNicknameUsers.length; i++) {
                    message += `${i + 1}. ${noNicknameUsers[i].name}\n`;
                }

                message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
                message += `➤ Dùng "${global.config.PREFIX}setn call" để tag họ`;

                return api.sendMessage(message, threadID, messageID);
            }
            if (query === 'call') {
                const noNicknameUsers = [];
                
                for (const user of threadInfo.userInfo) {
                    if (!nicknames[user.id] || nicknames[user.id].trim() === '') {
                        noNicknameUsers.push({
                            id: user.id,
                            name: user.name || 'Facebook User'
                        });
                    }
                }

                if (noNicknameUsers.length === 0) {
                    return api.sendMessage(
                        '✅ Tất cả thành viên đã đặt biệt danh',
                        threadID,
                        messageID
                    );
                }

                let message = '📣 Dậy đặt biệt danh đi mấy bé:\n\n';
                const mentionsList = [];
                let currentOffset = message.length;

                for (let i = 0; i < noNicknameUsers.length; i++) {
                    const user = noNicknameUsers[i];
                    const prefix = `${i + 1}. `;
                    message += prefix;
                    currentOffset += prefix.length;

                    mentionsList.push({
                        tag: user.name,
                        id: user.id,
                        fromIndex: currentOffset
                    });

                    message += user.name;
                    currentOffset += user.name.length;

                    message += '\n';
                    currentOffset += 1;
                }

                return api.sendMessage({
                    body: message,
                    mentions: mentionsList
                }, threadID);
            }
            let nickname = "";
            let targetID = senderID;
            let targetName = "bạn";
            if (Object.keys(mentions).length > 0) {
                targetID = Object.keys(mentions)[0];
                targetName = mentions[targetID];
                nickname = args.join(' ').replace(mentions[targetID], '').trim();
            } 
            else if (messageReply) {
                targetID = messageReply.senderID;
                const userInfo = threadInfo.userInfo.find(u => u.id === targetID);
                targetName = userInfo?.name || 'User';
                nickname = args.join(" ").trim();
            }
            else {
                nickname = args.join(" ").trim();
            }

            if (!nickname) {
                return api.sendMessage(
                    `⚠️ Vui lòng nhập biệt danh!\n\n` +
                    `Cách dùng:\n` +
                    `• ${global.config.PREFIX}setn [text] - Đổi cho bản thân\n` +
                    `• ${global.config.PREFIX}setn [text] + tag - Đổi cho người được tag\n` +
                    `• ${global.config.PREFIX}setn [text] + reply - Đổi cho người được reply`,
                    threadID,
                    messageID
                );
            }
            await new Promise((resolve, reject) => {
                api.setNickname(nickname,threadID,targetID,(err) => {if (err) { reject(err);} else { resolve();}});
            });

            return api.sendMessage(`✅ Đã đổi biệt danh cho ${targetName} thành: "${nickname}"`, threadID,messageID);
        } catch (error) {
            console.error(`[${this.config.name}] Error:`, error);
            return api.sendMessage(
                `❌ Lỗi: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
