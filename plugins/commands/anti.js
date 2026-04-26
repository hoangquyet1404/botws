function loadAntiSettings(database) {
    return database.get.json("antiSettings", "default", { threads: {} });
}

function saveAntiSettings(database, data) {
    try {
        database.update.json("antiSettings", "default", data || { threads: {} });
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    config: {
        name: "anti",
        aliases: ["antichange", "antiedit"],
        version: "1.0.0",
        role: 1, 
        credits: "Isenkai",
        info: "Bật/tắt chế độ anti-change (chống thay đổi) cho nhóm",
        Category: "Box",
        guides: [
            "anti on/off - Bật/tắt toàn bộ anti",
            "anti name on/off - Anti đổi tên nhóm",
            "anti color on/off - Anti đổi màu nhóm",
            "anti emoji on/off - Anti đổi emoji nhóm",
            "anti nickname on/off - Anti đổi biệt danh",
            "anti image on/off - Anti đổi ảnh nhóm",
            "anti admin on/off - Anti đổi QTV",
            "anti join on/off - Anti thêm thành viên",
            "anti leave on/off - Anti tự ý rời nhóm",
            "anti all on/off - Bật/tắt tất cả anti",
            "anti status - Xem trạng thái anti",
            "anti allowadmin on/off - Cho phép admin nhóm thay đổi"
        ].join("\n"),
        cd: 5
    },

    onRun: async function({ api, event, args, database }) {
        try {
            const { threadID, messageID, senderID } = event;
            const threadInfo = await api.getThreadInfo(threadID);
            const threadAdmins = (threadInfo.adminIDs || []).map(a => String(a.id || a));
            const { ADMINBOT = [], NDH = [] } = global.config;
            
            const isGroupAdmin = threadAdmins.includes(String(senderID));
            const isBotAdmin = ADMINBOT.includes(String(senderID)) || NDH.includes(String(senderID));

            if (!isGroupAdmin && !isBotAdmin) {
                return api.sendMessage("⚠️ Chỉ QTV/Admin mới dùng được lệnh này!", threadID, messageID);
            }

            const antiSettings = loadAntiSettings(database);
            
            if (!antiSettings.threads[threadID]) {
                antiSettings.threads[threadID] = {
                    enabled: false,
                    antiName: false,
                    antiColor: false,
                    antiEmoji: false,
                    antiNickname: false,
                    antiImage: false,
                    antiAdmin: false,
                    antiJoin: false,
                    antiLeave: false,
                    allowGroupAdmin: false,
                    data: {}
                };
            }

            const threadSettings = antiSettings.threads[threadID];
            if (args.length === 0 || args[0].toLowerCase() === "status") {
                const status = threadSettings.enabled ? "🟢 BẬT" : "🔴 TẮT";
                const statusMsg = 
                    `━━━━━━ ANTI-CHANGE ━━━━━━\n\n` +
                    `Trạng thái: ${status}\n\n` +
                    `1. Đổi tên: ${threadSettings.antiName ? "🟢 BẬT" : "🔴 TẮT"}\n` +
                    `2. Đổi nền: ${threadSettings.antiColor ? "🟢 BẬT" : "🔴 TẮT"}\n` +
                    `3. Đổi emoji: ${threadSettings.antiEmoji ? "🟢 BẬT" : "🔴 TẮT"}\n` +
                    `4. Đổi biệt danh: ${threadSettings.antiNickname ? "🟢 BẬT" : "🔴 TẮT"}\n` +
                    `5. Đổi ảnh: ${threadSettings.antiImage ? "🟢 BẬT" : "🔴 TẮT"}\n` +
                    `6. Đổi QTV: ${threadSettings.antiAdmin ? "🟢 BẬT" : "🔴 TẮT"}\n` +
                    `7. Thêm thành viên: ${threadSettings.antiJoin ? "🟢 BẬT" : "🔴 TẮT"}\n` +
                    `8. Tự ý rời nhóm: ${threadSettings.antiLeave ? "🟢 BẬT" : "🔴 TẮT"}\n\n` +
                    `Reply số 1-8 để bật/tắt nhanh`;

                return api.sendMessage(statusMsg, threadID, (err, info) => {
                    if (err) return;
                    global.concac.onReply.push({
                        name: this.config.name,
                        messageID: info.messageID,
                        author: senderID,
                        threadID: threadID,
                        type: "toggleAnti"
                    });
                }, messageID);
            }

            const action = args[args.length - 1]?.toLowerCase();
            const option = args[0]?.toLowerCase();

            if (!["on", "off"].includes(action)) {
                return api.sendMessage(
                    `⚠️ Dùng 'on' hoặc 'off'!\nVD: ${global.config.PREFIX}anti name on`,
                    threadID,
                    null,
                    messageID
                );
            }

            const enable = action === "on";

            switch (option) {
                case "on":
                case "off":
                    threadSettings.enabled = enable;
                    if (enable) {
                        const handleRefresh = require('../../main/handle/handleRefresh');
                        const currentData = await handleRefresh.getThreadData(api, threadID);
                        if (currentData) {
                            threadSettings.data = { ...currentData, lastUpdate: Date.now() };
                        }
                    }
                    
                    saveAntiSettings(database, antiSettings);
                    
                    return api.sendMessage(
                        `Anti-Change: ${enable ? "🟢 BẬT" : "🔴 TẮT"}`,
                        threadID,
                        null,
                        messageID
                    );

                case "name":
                    threadSettings.antiName = enable;
                    threadSettings.enabled = true;
                    break;

                case "color":
                case "colour":
                    threadSettings.antiColor = enable;
                    threadSettings.enabled = true;
                    break;

                case "emoji":
                case "icon":
                    threadSettings.antiEmoji = enable;
                    threadSettings.enabled = true;
                    break;

                case "nickname":
                case "nick":
                    threadSettings.antiNickname = enable;
                    threadSettings.enabled = true;
                    break;

                case "image":
                case "img":
                case "avatar":
                    threadSettings.antiImage = enable;
                    threadSettings.enabled = true;
                    break;

                case "admin":
                case "qtv":
                case "quantrivien":
                    threadSettings.antiAdmin = enable;
                    threadSettings.enabled = true;
                    break;

                case "join":
                case "add":
                case "themmember":
                    threadSettings.antiJoin = enable;
                    threadSettings.enabled = true;
                    break;

                case "leave":
                case "kick":
                case "remove":
                    threadSettings.antiLeave = enable;
                    threadSettings.enabled = true;
                    break;

                case "all":
                    threadSettings.enabled = enable;
                    threadSettings.antiName = enable;
                    threadSettings.antiColor = enable;
                    threadSettings.antiEmoji = enable;
                    threadSettings.antiNickname = enable;
                    threadSettings.antiImage = enable;
                    threadSettings.antiAdmin = enable;
                    threadSettings.antiJoin = enable;
                    threadSettings.antiLeave = enable;
                    if (enable) {
                        const handleRefresh = require('../../main/handle/handleRefresh');
                        const currentData = await handleRefresh.getThreadData(api, threadID);
                        if (currentData) {
                            threadSettings.data = { ...currentData, lastUpdate: Date.now() };
                        }
                    }
                    
                    saveAntiSettings(database, antiSettings);
                    
                    return api.sendMessage(
                        `TẤT CẢ Anti: ${enable ? "🟢 BẬT" : "🔴 TẮT"}`,
                        threadID,
                        null,
                        messageID
                    );

                case "allowadmin":
                case "allowqtv":
                case "groupadmin":
                case "adminallow":
                    threadSettings.allowGroupAdmin = enable;
                    saveAntiSettings(database, antiSettings);
                    return api.sendMessage(
                        `Admin nhóm được phép: ${enable ? "🟢 BẬT" : "🔴 TẮT"}`,
                        threadID,
                        null,
                        messageID
                    );

                default:
                    return api.sendMessage(
                        "⚠️ Tùy chọn không hợp lệ!\n\n" +
                        "name, color, emoji, nickname, image\n" +
                        "admin, join, leave, all",
                        threadID,
                        null,
                        messageID
                    );
            }
            saveAntiSettings(database, antiSettings);
            if (enable) {
                const handleRefresh = require('../../main/handle/handleRefresh');
                const currentData = await handleRefresh.getThreadData(api, threadID);
                if (currentData) {
                    threadSettings.data = { ...currentData, lastUpdate: Date.now() };
                    saveAntiSettings(database, antiSettings);
                }
            }
            const optionNames = {
                name: "Đổi tên",
                color: "Đổi màu",
                emoji: "Đổi emoji",
                nickname: "Đổi biệt danh",
                image: "Đổi ảnh",
                admin: "Đổi QTV",
                join: "Thêm thành viên",
                leave: "Tự ý rời nhóm"
            };

            return api.sendMessage(
                `${optionNames[option]}: ${enable ? "🟢 BẬT" : "🔴 TẮT"}`,
                threadID,
                null,
                messageID
            );

        } catch (error) {
            console.error("Error in anti command:", error);
            return api.sendMessage(`❌ Lỗi: ${error.message}`, event.threadID, null, event.messageID);
        }
    },

    onReply: async function({ api, event, onReply, cleanup, database }) {
        try {
            const { threadID, messageID, senderID, body } = event;
            
            if (String(senderID) !== String(onReply.author)) {
                return api.sendMessage("⚠️ Chỉ người dùng lệnh mới được thao tác!", threadID, null, messageID);
            }

            const choice = parseInt(body.trim());
            if (isNaN(choice) || choice < 1 || choice > 8) {
                return api.sendMessage("⚠️ Vui lòng reply số từ 1-8!", threadID, null, messageID);
            }

            const antiSettings = loadAntiSettings(database);
            const threadSettings = antiSettings.threads[threadID];

            if (!threadSettings) {
                antiSettings.threads[threadID] = {
                    enabled: false,
                    antiName: false,
                    antiColor: false,
                    antiEmoji: false,
                    antiNickname: false,
                    antiImage: false,
                    antiAdmin: false,
                    antiJoin: false,
                    antiLeave: false,
                    allowGroupAdmin: false,
                    data: {}
                };
            }

            const settings = antiSettings.threads[threadID];
            const antiMap = {
                1: { key: 'antiName', name: 'Đổi tên' },
                2: { key: 'antiColor', name: 'Đổi màu' },
                3: { key: 'antiEmoji', name: 'Đổi emoji' },
                4: { key: 'antiNickname', name: 'Đổi biệt danh' },
                5: { key: 'antiImage', name: 'Đổi ảnh' },
                6: { key: 'antiAdmin', name: 'Đổi QTV' },
                7: { key: 'antiJoin', name: 'Thêm thành viên' },
                8: { key: 'antiLeave', name: 'Tự ý rời nhóm' }
            };

            const selected = antiMap[choice];
            const currentStatus = settings[selected.key];
            settings[selected.key] = !currentStatus;

            settings.enabled = true;

            if (!currentStatus) {
                const handleRefresh = require('../../main/handle/handleRefresh');
                const currentData = await handleRefresh.getThreadData(api, threadID);
                if (currentData) {
                    settings.data = { ...currentData, lastUpdate: Date.now() };
                }
            }

            saveAntiSettings(database, antiSettings);

            const newStatus = !currentStatus ? "🟢 BẬT" : "🔴 TẮT";
            api.sendMessage(
                `${selected.name}: ${newStatus}`,
                threadID,
                null,
                messageID
            );

            // cleanup();

        } catch (error) {
            console.error("Error in anti onReply:", error);
        }
    }
};
