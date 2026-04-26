// noti.js - Command quản lý thông báo events

function loadNotiSettings(database) {
    const settings = database.get.json("notiSettings", "default", { threads: {} });
    if (!settings.threads || typeof settings.threads !== "object") settings.threads = {};
    return settings;
}

function saveNotiSettings(database, data) {
    try {
        database.update.json("notiSettings", "default", data || { threads: {} });
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    config: {
        name: "noti",
        aliases: ["notification", "thongbao"],
        version: "2.0.0",
        role: 1,
        credits: "Isenkai",
        info: "Bật/tắt thông báo các sự kiện trong nhóm",
        Category: "Box",
        guides: [
            "noti status - Xem trạng thái hiện tại",
            "noti all on/off - Bật/tắt tất cả thông báo",
            "",
            "Từ khóa thông báo:",
            "• ten (name) - Đổi tên nhóm",
            "• mau (color) - Đổi màu nhóm",
            "• emoji (icon) - Đổi emoji nhóm",
            "• bietdanh (nickname) - Đổi biệt danh",
            "• anh (image) - Đổi ảnh nhóm",
            "• admin (qtv) - Thay đổi quản trị viên",
            "• pheduyet (approval) - Phê duyệt thành viên",
            "• ghim (pin) - Ghim tin nhắn",
            "• poll (bophieu) - Tạo poll/bỏ phiếu",
            "• call (cuocgoi) - Cuộc gọi nhóm",
            "• join (vao) - Thành viên vào nhóm",
            "• leave (roi) - Thành viên rời nhóm",
            "",
            "Ví dụ: noti bietdanh off"
        ].join("\n"),
        cd: 3
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

            const notiSettings = loadNotiSettings(database);
            
            if (!notiSettings.threads[threadID]) {
                notiSettings.threads[threadID] = {
                    enabled: true,
                    notiName: true,
                    notiColor: true,
                    notiEmoji: true,
                    notiNickname: true,
                    notiImage: true,
                    notiAdmin: true,
                    notiApproval: true,
                    notiPin: true,
                    notiPoll: true,
                    notiCall: true,
                    notiJoin: true,
                    notiLeave: true
                };
            }

            const threadNoti = notiSettings.threads[threadID];

            if (args.length === 0 || args[0].toLowerCase() === "status") {
                const s = (val) => val ? "🟢 BẬT" : "🔴 TẮT";
                const statusMsg = 
                    `━━━━━━ THÔNG BÁO ━━━━━━\n\n` +
                    `Trạng thái: ${threadNoti.enabled ? "🟢 BẬT" : "🔴 TẮT"}\n\n` +
                    `1. Đổi tên: ${s(threadNoti.notiName)}\n` +
                    `2. Đổi màu: ${s(threadNoti.notiColor)}\n` +
                    `3. Đổi emoji: ${s(threadNoti.notiEmoji)}\n` +
                    `4. Đổi biệt danh: ${s(threadNoti.notiNickname)}\n` +
                    `5. Đổi ảnh: ${s(threadNoti.notiImage)}\n` +
                    `6. Thay đổi QTV: ${s(threadNoti.notiAdmin)}\n` +
                    `7. Phê duyệt: ${s(threadNoti.notiApproval)}\n` +
                    `8. Ghim tin nhắn: ${s(threadNoti.notiPin)}\n` +
                    `9. Poll: ${s(threadNoti.notiPoll)}\n` +
                    `10. Cuộc gọi: ${s(threadNoti.notiCall)}\n` +
                    `11. Vào nhóm: ${s(threadNoti.notiJoin)}\n` +
                    `12. Rời nhóm: ${s(threadNoti.notiLeave)}\n\n` +
                    `Reply số 1-12 hoặc "all" để bật/tắt`;

                return api.sendMessage(statusMsg, threadID, (err, info) => {
                    if (err) return;
                    global.concac.onReply.push({
                        name: this.config.name,
                        messageID: info.messageID,
                        author: senderID,
                        threadID: threadID,
                        type: "toggleNoti"
                    });
                }, messageID);
            }

            const action = args[args.length - 1]?.toLowerCase();
            const option = args[0]?.toLowerCase();

            if (!["on", "off"].includes(action)) {
                return api.sendMessage(
                    `⚠️ Dùng 'on' hoặc 'off'!\nVD: ${global.config.PREFIX}noti bietdanh off`,
                    threadID,
                    messageID
                );
            }

            const enable = action === "on";

            switch (option) {
                case "on":
                case "off":
                    threadNoti.enabled = enable;
                    break;

                case "name":
                case "ten":
                    threadNoti.notiName = enable;
                    break;

                case "color":
                case "mau":
                    threadNoti.notiColor = enable;
                    break;

                case "emoji":
                case "icon":
                    threadNoti.notiEmoji = enable;
                    break;

                case "nickname":
                case "nick":
                case "bietdanh":
                    threadNoti.notiNickname = enable;
                    break;

                case "image":
                case "img":
                case "anh":
                    threadNoti.notiImage = enable;
                    break;

                case "admin":
                case "qtv":
                    threadNoti.notiAdmin = enable;
                    break;

                case "approval":
                case "pheduyet":
                    threadNoti.notiApproval = enable;
                    break;

                case "pin":
                case "ghim":
                    threadNoti.notiPin = enable;
                    break;

                case "poll":
                case "bophieu":
                    threadNoti.notiPoll = enable;
                    break;

                case "call":
                case "goidi":
                case "cuocgoi":
                    threadNoti.notiCall = enable;
                    break;

                case "join":
                case "vao":
                case "thamgia":
                    threadNoti.notiJoin = enable;
                    break;

                case "leave":
                case "roi":
                case "roinh":
                case "out":
                    threadNoti.notiLeave = enable;
                    break;

                case "all":
                case "tatca":
                    threadNoti.enabled = enable;
                    threadNoti.notiName = enable;
                    threadNoti.notiColor = enable;
                    threadNoti.notiEmoji = enable;
                    threadNoti.notiNickname = enable;
                    threadNoti.notiImage = enable;
                    threadNoti.notiAdmin = enable;
                    threadNoti.notiApproval = enable;
                    threadNoti.notiPin = enable;
                    threadNoti.notiPoll = enable;
                    threadNoti.notiCall = enable;
                    threadNoti.notiJoin = enable;
                    threadNoti.notiLeave = enable;
                    
                    saveNotiSettings(database, notiSettings);
                    return api.sendMessage(
                        `TẤT CẢ thông báo: ${enable ? "🟢 BẬT" : "🔴 TẮT"}`,
                        threadID,
                        messageID
                    );

                default:
                    return api.sendMessage(
                        "Từ khóa không hợp lệ!\n\n" +
                        "Từ khóa hợp lệ:\n" +
                        "ten, mau, emoji, bietdanh, anh,\n" +
                        "admin, pheduyet, ghim, poll, call,\n" +
                        "join, leave, all\n\n" +
                        `Dùng: ${global.config.PREFIX}help noti`,
                        threadID,
                        messageID
                    );
            }

            saveNotiSettings(database, notiSettings);

            const optionNames = {
                name: "đổi tên",
                ten: "đổi tên",
                color: "đổi màu",
                mau: "đổi màu",
                emoji: "đổi emoji",
                icon: "đổi emoji",
                nickname: "đổi biệt danh",
                nick: "đổi biệt danh",
                bietdanh: "đổi biệt danh",
                image: "đổi ảnh",
                img: "đổi ảnh",
                anh: "đổi ảnh",
                admin: "thay đổi admin",
                qtv: "thay đổi admin",
                approval: "phê duyệt",
                pheduyet: "phê duyệt",
                pin: "ghim tin nhắn",
                ghim: "ghim tin nhắn",
                poll: "poll",
                bophieu: "poll",
                call: "cuộc gọi",
                cuocgoi: "cuộc gọi",
                join: "vào nhóm",
                vao: "vào nhóm",
                leave: "rời nhóm",
                roi: "rời nhóm"
            };

            const optName = optionNames[option] || option;

            return api.sendMessage(
                `${optName}: ${enable ? "🟢 BẬT" : "🔴 TẮT"}`,
                threadID,
                messageID
            );

        } catch (error) {
            console.error("Error in noti command:", error);
            return api.sendMessage(`❌ Lỗi: ${error.message}`, event.threadID, event.messageID);
        }
    },

    onReply: async function({ api, event, onReply, cleanup, database }) {
        try {
            const { threadID, messageID, senderID, body } = event;
            
            if (onReply.type !== "toggleNoti") return;
            
            if (String(senderID) !== String(onReply.author)) {
                return api.sendMessage("⚠️ Chỉ người dùng lệnh mới được thao tác!", threadID, messageID);
            }

            const input = body.trim().toLowerCase();
            if (input === "all" || input === "tatca") {
                const notiSettings = loadNotiSettings(database);
                const threadNoti = notiSettings.threads[threadID];
                
                if (!threadNoti) return;
                const currentAllStatus = threadNoti.enabled;
                const newStatus = !currentAllStatus;
                
                threadNoti.enabled = newStatus;
                threadNoti.notiName = newStatus;
                threadNoti.notiColor = newStatus;
                threadNoti.notiEmoji = newStatus;
                threadNoti.notiNickname = newStatus;
                threadNoti.notiImage = newStatus;
                threadNoti.notiAdmin = newStatus;
                threadNoti.notiApproval = newStatus;
                threadNoti.notiPin = newStatus;
                threadNoti.notiPoll = newStatus;
                threadNoti.notiCall = newStatus;
                threadNoti.notiJoin = newStatus;
                threadNoti.notiLeave = newStatus;
                
                saveNotiSettings(database, notiSettings);
                
                return api.sendMessage(
                    `TẤT CẢ thông báo: ${newStatus ? "🟢 BẬT" : "🔴 TẮT"}`,
                    threadID,
                    messageID
                );
            }

            const choice = parseInt(input);
            if (isNaN(choice) || choice < 1 || choice > 12) {
                return api.sendMessage("⚠️ Reply số 1-12 hoặc 'all'!", threadID, messageID);
            }

            const notiSettings = loadNotiSettings(database);
            const threadNoti = notiSettings.threads[threadID];

            if (!threadNoti) return;

            const notiMap = {
                1: { key: 'notiName', name: 'Đổi tên' },
                2: { key: 'notiColor', name: 'Đổi màu' },
                3: { key: 'notiEmoji', name: 'Đổi emoji' },
                4: { key: 'notiNickname', name: 'Đổi biệt danh' },
                5: { key: 'notiImage', name: 'Đổi ảnh' },
                6: { key: 'notiAdmin', name: 'Thay đổi QTV' },
                7: { key: 'notiApproval', name: 'Phê duyệt' },
                8: { key: 'notiPin', name: 'Ghim tin nhắn' },
                9: { key: 'notiPoll', name: 'Poll' },
                10: { key: 'notiCall', name: 'Cuộc gọi' },
                11: { key: 'notiJoin', name: 'Vào nhóm' },
                12: { key: 'notiLeave', name: 'Rời nhóm' }
            };

            const selected = notiMap[choice];
            const currentStatus = threadNoti[selected.key];
            threadNoti[selected.key] = !currentStatus;
            threadNoti.enabled = true;

            saveNotiSettings(database, notiSettings);

            const newStatus = !currentStatus ? "🟢 BẬT" : "🔴 TẮT";
            api.sendMessage(
                `${selected.name}: ${newStatus}`,
                threadID,
                messageID
            );

        } catch (error) {
            console.error("Error in noti onReply:", error);
        }
    }
};
