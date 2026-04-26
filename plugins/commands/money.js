module.exports = {
    config: {
        name: "money",
        aliases: ["mn"],
        version: "1.2.0",
        role: 0,
        author: "",
        info: "Quản lý tiền tệ",
        Category: "Game",
        guides: "[check/pay/add/set/reset/top]",
        cd: 5
    },

    onRun: async function ({ api, event, args, permssion, money }) {
        const { threadID, messageID, senderID, messageReply, mentions } = event;
        const { ADMINBOT, NDH } = global.config;
        let subCommand = args[0] ? args[0].toLowerCase() : 'check';
        const keywords = ['pay', 'transfer', 'add', 'set', 'reset', 'top'];
        if (Object.keys(mentions).length > 0 && !keywords.includes(subCommand)) {
            subCommand = 'check';
        }
        let targetID = senderID;
        if (messageReply) {
            targetID = messageReply.senderID;
        } else if (Object.keys(mentions).length > 0) {
            targetID = Object.keys(mentions)[0];
        }

        const isBotAdmin = ADMINBOT.includes(senderID) || NDH.includes(senderID);
        const isGroupAdmin = permssion >= 1;

        async function getName(uid) {
            try {
                const info = await api.getUserInfo(uid);
                return info[uid]?.name || "Người dùng";
            } catch { return "Người dùng Facebook"; }
        }

        switch (subCommand) {
            // === CHECK TIỀN ===
            case 'check':
            case 'me':
                try {
                    const balance = await money.checkMoney(targetID); 
                    const name = await getName(targetID);
                    return api.sendMessage(`👤 ${name}\n💰 Số dư: ${balance.toLocaleString()}$`, threadID, messageID);
                } catch (e) {
                    return api.sendMessage(`Lỗi: ${e.message}`, threadID, messageID);
                }

            // === CHUYỂN TIỀN (PAY) ===
            case 'pay':
            case 'transfer':
                {
                    let receiverID;
                    if (messageReply) receiverID = messageReply.senderID;
                    else if (Object.keys(mentions).length > 0) receiverID = Object.keys(mentions)[0];
                    else return api.sendMessage("⚠️ Vui lòng tag hoặc reply người nhận!", threadID, messageID);

                    if (receiverID === senderID) return api.sendMessage("⚠️ Không thể tự chuyển cho mình!", threadID, messageID);
                    const amountStr = args.find(arg => !isNaN(arg) && !arg.startsWith('<') && !arg.startsWith('@'));
                    const amountPay = parseInt(amountStr);

                    if (!amountPay || amountPay <= 0) return api.sendMessage("⚠️ Số tiền không hợp lệ!", threadID, messageID);
                    const isSuccess = await money.pay(senderID, receiverID, amountPay);
                    
                    if (isSuccess) {
                        const senderName = await getName(senderID);
                        const receiverName = await getName(receiverID);
                        return api.sendMessage(
                            `✅ Giao dịch thành công!\n💸 ${senderName} đã chuyển ${amountPay.toLocaleString()}$ cho ${receiverName}.`,
                            threadID, messageID
                        );
                    } else {
                        return api.sendMessage("⚠️ Số dư không đủ để thực hiện giao dịch!", threadID, messageID);
                    }
                }

            // === CỘNG TIỀN (ADD) ===
            case 'add':
                if (!isBotAdmin) return api.sendMessage("⚠️ Chỉ Admin Bot mới được dùng!", threadID, messageID);
                const amountAdd = parseInt(args.find(arg => !isNaN(arg) && !arg.startsWith('<')));
                if (!amountAdd) return api.sendMessage("⚠️ Nhập số tiền!", threadID, messageID);

                await money.addMoney(targetID, amountAdd); // Wrapper tự điền threadID
                return api.sendMessage(`✅ Đã cộng ${amountAdd.toLocaleString()}$ cho ${await getName(targetID)}`, threadID, messageID);

            // === SET TIỀN ===
            case 'set':
                if (!isBotAdmin) return api.sendMessage("⚠️ Chỉ Admin Bot mới được dùng!", threadID, messageID);
                const amountSet = parseInt(args.find(arg => !isNaN(arg) && !arg.startsWith('<')));
                if (isNaN(amountSet)) return api.sendMessage("⚠️ Nhập số tiền!", threadID, messageID);

                await money.setMoney(targetID, amountSet); // Wrapper tự điền threadID
                return api.sendMessage(`✅ Đã set ${amountSet.toLocaleString()}$ cho ${await getName(targetID)}`, threadID, messageID);

            // === RESET (Xóa dữ liệu) ===
            case 'reset':
                const type = args[1]; // box hoặc all
                
                if (type === 'box') {
                    if (!isGroupAdmin && !isBotAdmin) return api.sendMessage("⚠️ Chỉ QTV nhóm mới được reset!", threadID, messageID);
                    const changed = await money.resetThread();
                    return api.sendMessage(
                        changed > 0 ? "✅ Đã reset toàn bộ tiền của nhóm này về 0!" : "⚠️ Nhóm này chưa có dữ liệu tiền tệ!",
                        threadID,
                        messageID
                    );

                } else if (type === 'all') {
                    if (!NDH.includes(senderID)) return api.sendMessage("⚠️ Chỉ Admin chính mới được reset all!", threadID, messageID);
                    await money.resetAll();
                    return api.sendMessage("✅ Đã reset toàn bộ hệ thống tiền tệ server!", threadID, messageID);

                } else {
                    return api.sendMessage("⚠️ Dùng: money reset box HOẶC money reset all", threadID, messageID);
                }

            // === TOP (BXH) ===
            case 'top':
                try {
                     const data = await money.getBoxData();
                     const sorted = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 10);
                     
                     if (sorted.length === 0) return api.sendMessage("⚠️ Không có dữ liệu!", threadID, messageID);

                     let msg = "👑 BẢNG XẾP HẠNG (BOX)\n━━━━━━━━━━━━━━\n";
                     for (let i = 0; i < sorted.length; i++) {
                         const userName = await getName(sorted[i][0]);
                         msg += `${i + 1}. ${userName}: ${sorted[i][1].toLocaleString()}$\n`;
                     }
                     return api.sendMessage(msg, threadID, messageID);
                } catch (e) {
                    return api.sendMessage(" Lỗi khi đọc BXH.", threadID, messageID);
                }

            default:
                return api.sendMessage(
                    "📝 HƯỚNG DẪN SỬ DỤNG:\n" +
                    "────────────────\n" +
                    "• money [tag]: Xem tiền người khác\n" +
                    "• money pay [số tiền] [tag]: Chuyển tiền\n" +
                    "• money add [tiền] [tag]: Cộng tiền (Admin)\n" +
                    "• money set [tiền] [tag]: Chỉnh tiền (Admin)\n" +
                    "• money reset box: Xóa tiền nhóm (QTV)\n" +
                    "• money top: Xem người giàu nhất nhóm",
                    threadID, messageID
                );
        }
    }
};
