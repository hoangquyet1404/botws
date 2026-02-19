const messageCounter = require('../../main/utils/messageCounter');
const moment = require('moment-timezone');

module.exports = {
    config: {
        name: "check",
        aliases: ["checktt", "thongke", "tk", "count", "cou"],
        version: "2.0.0",
        role: 0,
        author: "",
        info: "Xem thống kê tin nhắn, quản lý thành viên và cấu hình tự động",
        Category: "Box",
        guides: "[tag/reply] - Xem thống kê user\n" +
                "day/week/month/all - Xem top nhóm (toàn bộ)\n" +
                "settime [giờ] [phút] - Đặt lịch (QTV)\n" +
                "  • Ngày: Gửi mỗi ngày\n" +
                "  • Tuần: Chỉ gửi Thứ 2\n" +
                "  • Tháng: Chỉ gửi ngày 1\n" +
                "on/off - Bật/tắt thông báo (QTV)\n" +
                "time - Xem lịch đã đặt\n" +
                "hd - Xem hoạt động thành viên\n" +
                "loc [số] - Lọc thành viên dưới X tin nhắn (QTV)\n" +
                "call - Gọi người ít tương tác (QTV)\n" +
                "die - Xóa user Facebook (QTV)\n" +
                "box - Xem thông tin box\n" +
                "reset - Reset toàn bộ data (QTV)",
        cd: 3,
        hasPrefix: true
    },

    onRun: async function({ api, event, args, permssion }) {
        const { threadID, messageID, senderID, mentions, messageReply } = event;

        try {
            const query = args[0] ? args[0].toLowerCase() : '';
            if (query === 'loc' || query === 'lọc') {
                if (permssion < 1) {
                    return api.sendMessage(' Chỉ QTV mới dùng được lệnh này', threadID, messageID);
                }

                const threadInfo = await api.getThreadInfo(threadID);
                const botIsAdmin = threadInfo.adminIDs.some(item => item.id == api.getCurrentUserID());
                
                if (!botIsAdmin) {
                    return api.sendMessage(' Bot cần quyền QTV!', threadID, messageID);
                }

                if (!args[1] || isNaN(args[1]) || parseInt(args[1]) < 0) {
                    return api.sendMessage(" Vui lòng nhập số tin nhắn tối thiểu\nVí dụ: .check loc 10", threadID, messageID);
                }

                const minCount = parseInt(args[1]);
                const threadData = messageCounter.getThreadData(threadID);
                const allUser = threadInfo.participantIDs;
                const id_rm = [];

                for (const user of allUser) {
                    if (user == api.getCurrentUserID()) continue;
                    
                    const userData = threadData.users[user];
                    if (!userData || userData.total <= minCount) {
                        await new Promise(resolve => setTimeout(async () => {
                            try {
                                await api.removeFromGroup(user, threadID);
                                id_rm.push(user);
                            } catch (error) {
                                console.log(`Lỗi khi xóa user ${user}:`, error);
                            }
                            resolve();
                        }, 1000));
                    }
                }

                if (id_rm.length > 0) {
                    let removedMsg = '';
                    for (let i = 0; i < id_rm.length; i++) {
                        const userInfo = threadInfo.userInfo.find(u => u.id === id_rm[i]);
                        const name = userInfo?.name || 'Facebook User';
                        removedMsg += `${i + 1}. ${name}\n`;
                    }
                    return api.sendMessage(
                        `✅ Đã xóa ${id_rm.length} thành viên dưới ${minCount} tin nhắn:\n\n${removedMsg}`,
                        threadID,
                        messageID
                    );
                } else {
                    return api.sendMessage(`✅ Không có thành viên nào dưới ${minCount} tin nhắn`, threadID, messageID);
                }
            }
            if (query === 'hd') {
                const threadData = messageCounter.getThreadData(threadID);
                const threadInfo = await api.getThreadInfo(threadID);
                
                const getTimeAgo = (timestamp) => {
                    if (!timestamp) return 'Chưa có';
                    
                    const now = Date.now();
                    const diff = now - timestamp;
                    
                    const minutes = Math.floor(diff / 60000);
                    const hours = Math.floor(diff / 3600000);
                    const days = Math.floor(diff / 86400000);
                    
                    if (minutes < 1) return 'Vừa xong';
                    if (minutes < 60) return `${minutes} phút trước`;
                    if (hours < 24) {
                        const remainMinutes = minutes % 60;
                        return remainMinutes > 0 ? `${hours} giờ ${remainMinutes} phút trước` : `${hours} giờ trước`;
                    }
                    if (days < 30) {
                        const remainHours = hours % 24;
                        return remainHours > 0 ? `${days} ngày ${remainHours} giờ trước` : `${days} ngày trước`;
                    }
                    return moment(timestamp).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY');
                };

                const allUsers = [];
                for (const userID of threadInfo.participantIDs) {
                    const data = threadData.users[userID];
                    const userInfo = threadInfo.userInfo.find(u => u.id === userID);
                    
                    if (userInfo) {
                        allUsers.push({
                            id: userID,
                            name: userInfo.name || 'Facebook User',
                            lastInteraction: data?.lastInteraction || null,
                            timeAgo: getTimeAgo(data?.lastInteraction)
                        });
                    }
                }

                allUsers.sort((a, b) => {
                    if (!a.lastInteraction) return 1;
                    if (!b.lastInteraction) return -1;
                    return b.lastInteraction - a.lastInteraction;
                });

                if (allUsers.length === 0) {
                    return api.sendMessage('⚠️ Chưa có dữ liệu', threadID, messageID);
                }

                let message = '⏱️ HOẠT ĐỘNG THÀNH VIÊN\n';
                message += '━━━━━━━━━━━━━━━━━━━━\n\n';

                for (let i = 0; i < allUsers.length; i++) {
                    const user = allUsers[i];
                    message += `${i + 1}. ${user.name}\n`;
                    message += `   └─ ${user.timeAgo}\n`;
                }

                message += '\n━━━━━━━━━━━━━━━━━━━━';
                message += `\n➤ Tổng: ${allUsers.length} thành viên`;

                return api.sendMessage(message, threadID, messageID);
            }

            if (query === 'call') {
                if (permssion < 1) {
                    return api.sendMessage(' Chỉ QTV mới dùng được lệnh này', threadID, messageID);
                }

                const threadData = messageCounter.getThreadData(threadID);
                const threadInfo = await api.getThreadInfo(threadID);
                
                const lowInteractionUsers = [];
                for (const userID of threadInfo.participantIDs) {
                    const data = threadData.users[userID];
                    const dayCount = data?.day || 0;
                    
                    if (dayCount < 10) {
                        const userInfo = threadInfo.userInfo.find(u => u.id === userID);
                        if (userInfo) {
                            lowInteractionUsers.push({
                                id: userID,
                                name: userInfo.name || 'Facebook User'
                            });
                        }
                    }
                }

                if (lowInteractionUsers.length === 0) {
                    return api.sendMessage('✅ Tất cả thành viên đều tương tác tốt', threadID, messageID);
                }
                let message = '📣 Dậy tương tác đi mấy bé:\n\n';
                const mentions = [];
                let currentOffset = message.length;

                for (let i = 0; i < lowInteractionUsers.length; i++) {
                    const user = lowInteractionUsers[i];
                    const prefix = `${i + 1}. `;
                    message += prefix;
                    currentOffset += prefix.length;
                    mentions.push({
                        tag: user.name,
                        id: user.id,
                        fromIndex: currentOffset
                    });

                    message += user.name;
                    currentOffset += user.name.length;

                    message += '\n';
                    currentOffset += 1;
                }

                return api.sendMessageMqtt({
                    body: message,
                    mentions: mentions
                }, threadID);
            }

            if (query === 'die') {
                if (permssion < 1) {
                    return api.sendMessage(' Chỉ QTV mới dùng được lệnh này', threadID, messageID);
                }

                const threadInfo = await api.getThreadInfo(threadID);
                const botIsAdmin = threadInfo.adminIDs.some(item => item.id == api.getCurrentUserID());
                
                if (!botIsAdmin) {
                    return api.sendMessage(' Bot cần quyền QTV!', threadID, messageID);
                }

                const fbUsers = threadInfo.participantIDs.filter(id => {
                    const userInfo = threadInfo.userInfo.find(u => u.id === id);
                    return userInfo && userInfo.gender === undefined;
                });

                if (fbUsers.length === 0) {
                    return api.sendMessage("🔎 Nhóm không có người dùng Facebook", threadID, messageID);
                }

                api.sendMessage(`🔎 Phát hiện ${fbUsers.length} người dùng Facebook, đang xóa...`, threadID, async () => {
                    let success = 0, fail = 0;
                    for (const id of fbUsers) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        api.removeFromGroup(id, threadID, err => err ? fail++ : success++);
                    }
                    api.sendMessage(`✅ Đã xóa ${success} người dùng Facebook, thất bại: ${fail}`, threadID);
                }, messageID);
                return;
            }
            if (query === 'box') {
                const threadInfo = await api.getThreadInfo(threadID);
                messageCounter.syncWithParticipants(threadID, threadInfo.participantIDs);               
                const threadData = messageCounter.getThreadData(threadID);               
                const totalDay = threadInfo.participantIDs.reduce((sum, id) => sum + (threadData.users[id]?.day || 0), 0);
                const totalWeek = threadInfo.participantIDs.reduce((sum, id) => sum + (threadData.users[id]?.week || 0), 0);
                const totalMonth = threadInfo.participantIDs.reduce((sum, id) => sum + (threadData.users[id]?.month || 0), 0);
                const totalAll = threadInfo.participantIDs.reduce((sum, id) => sum + (threadData.users[id]?.total || 0), 0);

                const gendernam = threadInfo.userInfo.filter(u => u.gender === "MALE").length;
                const gendernu = threadInfo.userInfo.filter(u => u.gender === "FEMALE").length;
                const adminNames = [];
                for (const admin of threadInfo.adminIDs) {
                    const userInfo = threadInfo.userInfo.find(u => u.id === admin.id);
                    adminNames.push(userInfo?.name || 'Facebook User');
                }

                const threadMem = threadInfo.participantIDs.length;
                const icon = threadInfo.emoji || "👍";
                const threadName = threadInfo.threadName || "Không có tên";
                const pd = threadInfo.approvalMode ? "Bật" : "Tắt";

                return api.sendMessage(
                    `⭐ Box: ${threadName}\n` +
                    `🎮 ID: ${threadID}\n` +
                    `📱 Phê duyệt: ${pd}\n` +
                    `🐰 Emoji: ${icon}\n` +
                    `📌 Thành viên: ${threadMem}\n` +
                    `👨 Nam: ${gendernam} | 👩 Nữ: ${gendernu}\n` +
                    `🕵️ QTV: ${adminNames.join(', ')}\n\n` +
                    `💬 Tổng tin nhắn:\n` +
                    `📅 Hôm nay: ${totalDay}\n` +
                    `📆 Tuần này: ${totalWeek}\n` +
                    `🗓️ Tháng này: ${totalMonth}\n` +
                    `📈 Tổng cộng: ${totalAll}`,
                    threadID,
                    messageID
                );
            }
            if (query === 'reset') {
                if (permssion < 1) {
                    return api.sendMessage(' Chỉ QTV mới dùng được lệnh này', threadID, messageID);
                }

                messageCounter.resetCounter(threadID, 'day');
                messageCounter.resetCounter(threadID, 'week');
                messageCounter.resetCounter(threadID, 'month');
                
                const threadData = messageCounter.getThreadData(threadID);
                for (const userID in threadData.users) {
                    threadData.users[userID].total = 0;
                }
                messageCounter.saveThreadData(threadID, threadData);

                return api.sendMessage("✅ Đã reset tất cả tương tác của nhóm!", threadID, messageID);
            }
            if (query === 'time' || query === 'list') {
                const dayNoti = messageCounter.getNotiTime(threadID, 'day');
                const weekNoti = messageCounter.getNotiTime(threadID, 'week');
                const monthNoti = messageCounter.getNotiTime(threadID, 'month');

                let message = `⏰ LỊCH THỐNG KÊ TỰ ĐỘNG\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n`;

                if (dayNoti) {
                    message += `📅 Ngày (mỗi ngày):\n`;
                    message += `   ${String(dayNoti.hour).padStart(2, '0')}:${String(dayNoti.minute).padStart(2, '0')} ${dayNoti.enabled ? '✅' : '❌'}\n`;
                } else {
                    message += `📅 Ngày: Chưa đặt\n`;
                }

                if (weekNoti) {
                    message += `📆 Tuần (chỉ Thứ 2):\n`;
                    message += `   ${String(weekNoti.hour).padStart(2, '0')}:${String(weekNoti.minute).padStart(2, '0')} ${weekNoti.enabled ? '✅' : '❌'}\n`;
                } else {
                    message += `📆 Tuần: Chưa đặt\n`;
                }

                if (monthNoti) {
                    message += `🗓️ Tháng (chỉ ngày 1):\n`;
                    message += `   ${String(monthNoti.hour).padStart(2, '0')}:${String(monthNoti.minute).padStart(2, '0')} ${monthNoti.enabled ? '✅' : '❌'}\n`;
                } else {
                    message += `🗓️ Tháng: Chưa đặt\n`;
                }

                message += `━━━━━━━━━━━━━━━━━━━━\n`;
                message += `💡 Set cùng giờ cho cả 3 OK!\n`;
                message += `   Bot sẽ tự biết gửi đúng lúc`;
                return api.sendMessage(message, threadID, messageID);
            }
            if (args[0] === 'settime' || args[0] === 'set') {
                if (permssion < 1) {
                    return api.sendMessage(' Chỉ QTV mới dùng được lệnh này', threadID, messageID);
                }

                const hour = parseInt(args[1]);
                const minute = parseInt(args[2]);

                if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                    return api.sendMessage(
                        ` Giờ (0-23), phút (0-59)\n` +
                        `Ví dụ: ${global.config.PREFIX}check settime 20 0`,
                        threadID,
                        messageID
                    );
                }
                messageCounter.setNotiTime(threadID, 'day', hour, minute);
                messageCounter.setNotiTime(threadID, 'week', hour, minute);
                messageCounter.setNotiTime(threadID, 'month', hour, minute);

                const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

                return api.sendMessage(
                    `✅ Đặt lịch thống kê lúc ${timeStr}\n\n` +
                    `📅 Ngày: Gửi mỗi ngày lúc ${timeStr}\n` +
                    `📆 Tuần: Gửi Thứ 2 lúc ${timeStr}\n` +
                    `🗓️ Tháng: Gửi ngày 1 lúc ${timeStr}\n\n` +
                    `💡 Sau khi gửi sẽ tự động reset bộ đếm`,
                    threadID,
                    messageID
                );
            }
            if (args[0] === 'off' || args[0] === 'on') {
                if (permssion < 1) {
                    return api.sendMessage(' Chỉ QTV mới dùng được lệnh này', threadID, messageID);
                }

                const isEnable = args[0] === 'on';
                messageCounter.enableNoti(threadID, 'day');
                messageCounter.enableNoti(threadID, 'week');
                messageCounter.enableNoti(threadID, 'month');
                
                if (!isEnable) {
                    messageCounter.disableNoti(threadID, 'day');
                    messageCounter.disableNoti(threadID, 'week');
                    messageCounter.disableNoti(threadID, 'month');
                }

                const dayNoti = messageCounter.getNotiTime(threadID, 'day');
                const weekNoti = messageCounter.getNotiTime(threadID, 'week');
                const monthNoti = messageCounter.getNotiTime(threadID, 'month');
                const action = isEnable ? 'Bật' : 'Tắt';
                const dayTime = `${String(dayNoti.hour).padStart(2, '0')}:${String(dayNoti.minute).padStart(2, '0')}`;
                const weekTime = `${String(weekNoti.hour).padStart(2, '0')}:${String(weekNoti.minute).padStart(2, '0')}`;
                const monthTime = `${String(monthNoti.hour).padStart(2, '0')}:${String(monthNoti.minute).padStart(2, '0')}`;
                
                return api.sendMessage(
                    `✅ ${action} thông báo thống kê tự động\n` +
                    `📅 Ngày (${dayTime}): ${isEnable ? '✅' : '❌'}\n` +
                    `📆 Tuần (${weekTime}): ${isEnable ? '✅' : '❌'}\n` +
                    `🗓️ Tháng (${monthTime}): ${isEnable ? '✅' : '❌'}`,
                    threadID,
                    messageID
                );
            }
            if (['day', 'week', 'month', 'all'].includes(query)) {
                const type = query;
                const threadInfo = await api.getThreadInfo(threadID);
                messageCounter.syncWithParticipants(threadID, threadInfo.participantIDs);

                const topStats = messageCounter.getTopStats(threadID, 999);
                const stats = type === 'all' ? topStats.total : topStats[type];
                
                // Chệ lấy users trong participantIDs
                if (stats && stats.list) {
                    stats.list = stats.list.filter(item => threadInfo.participantIDs.includes(item.userID));
                    // Cập nhật lại rank và total
                    stats.list.forEach((item, index) => item.rank = index + 1);
                    stats.total = stats.list.reduce((sum, item) => sum + item.count, 0);
                    if (stats.list.length > 0) {
                        stats.top1 = stats.list[0];
                    }
                }

                if (!stats || stats.list.length === 0) {
                    return api.sendMessage(
                        `📊 Chưa có dữ liệu ${type === 'day' ? 'ngày' : type === 'week' ? 'tuần' : type === 'month' ? 'tháng' : 'tổng'} này`,
                        threadID,
                        messageID
                    );
                }

                const userRank = stats.list.findIndex(item => item.userID === senderID);
                const userMessages = stats.list[userRank]?.count || 0;

                let message = `🏆 TOP TIN NHẮN ${type === 'day' ? 'NGÀY' : type === 'week' ? 'TUẦN' : type === 'month' ? 'THÁNG' : 'TỔNG'}\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

                const total = stats.total;
                const displayList = stats.list; 
                for (let i = 0; i < displayList.length; i++) {
                    const item = displayList[i];
                    const userInfo = threadInfo.userInfo.find(u => u.id === item.userID);
                    const userName = userInfo?.name || 'Facebook User';
                    
                    const symbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                    message += `${symbol} ${item.rank}. ${userName} - ${item.count}\n`;
                }

                message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
                message += `💬 Tổng: ${stats.total}\n`;
                message += `🏆 Bạn đứng thứ ${userRank + 1}/${stats.list.length} với ${userMessages} tin nhắn\n`;
                
                if (stats.top1) {
                    const top1Info = threadInfo.userInfo.find(u => u.id === stats.top1.userID);
                    const top1Name = top1Info?.name || 'Facebook User';
                    message += `👑 Top 1: ${top1Name} (${stats.top1.count})\n`;
                }
                
                message += `\n📌 Reply + STT để xóa thành viên (QTV)`;

                return api.sendMessage(message, threadID, (err, info) => {
                    if (!err) {
                        global.concac.onReply.push({
                            name: this.config.name,
                            messageID: info.messageID,
                            author: senderID,
                            type: 'kick',
                            storage: stats.list
                        });
                    }
                }, messageID);
            }
            let targetID = senderID;
            let targetName = "Bạn";

            const threadInfo = await api.getThreadInfo(threadID);
            
            if (messageReply) {
                targetID = messageReply.senderID;
                const userInfo = threadInfo.userInfo.find(u => u.id === targetID);
                targetName = userInfo?.name || "User";
            } else if (Object.keys(mentions).length > 0) {
                targetID = Object.keys(mentions)[0];
                targetName = mentions[targetID];
            } else {
                const userInfo = threadInfo.userInfo.find(u => u.id === senderID);
                targetName = userInfo?.name || "Bạn";
            }
            
            messageCounter.syncWithParticipants(threadID, threadInfo.participantIDs);
            const stats = messageCounter.getStats(threadID, targetID);
            const threadData = messageCounter.getThreadData(threadID);
            const totalDay = threadInfo.participantIDs.reduce((sum, id) => sum + (threadData.users[id]?.day || 0), 0);
            const userInteractionRate = totalDay > 0 ? ((stats.user.day / totalDay) * 100).toFixed(2) : 0;

            let permission = "Thành viên";
            if (global.config.NDH && global.config.NDH.includes(targetID)) {
                permission = "Người Điều Hành";
            } else if (global.config.ADMINBOT && global.config.ADMINBOT.includes(targetID)) {
                permission = "Admin Bot";
            } else if (threadInfo.adminIDs.some(i => i.id == targetID)) {
                permission = "Quản Trị Viên";
            }

            const lastInteraction = threadData.users[targetID]?.lastInteraction 
                ? moment(threadData.users[targetID].lastInteraction).tz('Asia/Ho_Chi_Minh').format('HH:mm:ss | DD/MM/YYYY')
                : 'Chưa có';

            let message = `➤ Tương tác của ${targetName} \n`;
            message += `✦ Chức vụ: ${permission}\n`;
            message += `• Hôm nay: ${stats.user.day} (#${stats.rank.day})\n`;
            message += `• Tuần này: ${stats.user.week} (#${stats.rank.week})\n`;
            message += `• Tháng này: ${stats.user.month} (#${stats.rank.month})\n`;
            message += `✓ Tổng cộng: ${stats.user.total}\n`;
            message += `⌚ Lần cuối: ${lastInteraction}\n`;
            message += `⚡ Tỉ lệ: ${userInteractionRate}%\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `➤ Thả "😆" để xem top tổng`;

            return api.sendMessage(message, threadID, (err, info) => {
                if (!err) {
                    global.concac.onReaction.push({
                        name: this.config.name,
                        messageID: info.messageID,
                        author: senderID,
                        targetID: targetID
                    });
                }
            }, messageID);

        } catch (error) {
            console.error(`[${this.config.name}] Error:`, error);
            return api.sendMessage(` Lỗi: ${error.message}`, threadID, messageID);
        }
    },
    onReply: async function({ api, event, onReply: $ }) {
        const { senderID, threadID, body, messageID } = event;

        try {
            if ($.type !== 'kick') return;
            
            const threadInfo = await api.getThreadInfo(threadID);
            const botIsAdmin = threadInfo.adminIDs.some(item => item.id == api.getCurrentUserID());
            const userIsAdmin = threadInfo.adminIDs.some(item => item.id == senderID);

            if (!botIsAdmin) {
                return api.sendMessage(' Bot cần quyền QTV!', threadID, messageID);
            }

            if (!userIsAdmin) {
                return api.sendMessage(' Bạn không đủ quyền hạn!', threadID, messageID);
            }

            const split = body.split(" ").filter(item => !isNaN(item) && item.trim() !== "");
            
            if (split.length === 0) {
                return api.sendMessage('⚠️ Vui lòng nhập STT cần xóa\nVí dụ: 1 3 5', threadID, messageID);
            }

            let msgReply = [], countErr = 0;
            
            for (const num of split) {
                const index = parseInt(num) - 1;
                const user = $.storage[index];
                
                if (user && user.userID) {
                    try {
                        const userInfo = threadInfo.userInfo.find(u => u.id === user.userID);
                        const userName = userInfo?.name || 'User';
                        
                        await api.removeFromGroup(user.userID, threadID);
                        msgReply.push(`${num}. ${userName}`);
                    } catch (e) {
                        countErr++;
                    }
                }
            }

            const successMsg = `✅ Đã xóa ${split.length - countErr} người, thất bại ${countErr}\n\n${msgReply.join('\n')}`;
            api.sendMessage(successMsg, threadID, messageID);

        } catch (error) {
            console.error('onReply Error:', error);
        }
    },
    onReaction: async function({ api, event, onReaction: $ }) {
        const { userID, threadID, messageID, reaction } = event;

        try {
            if (userID !== $.author) return;
            if (reaction !== "😆") return;
            const threadInfo = await api.getThreadInfo(threadID);
            messageCounter.syncWithParticipants(threadID, threadInfo.participantIDs);

            const topStats = messageCounter.getTopStats(threadID, 999);
            const stats = topStats.total;
            
            // Chỉ lấy users trong participantIDs
            if (stats && stats.list) {
                stats.list = stats.list.filter(item => threadInfo.participantIDs.includes(item.userID));
                stats.list.forEach((item, index) => item.rank = index + 1);
                stats.total = stats.list.reduce((sum, item) => sum + item.count, 0);
                if (stats.list.length > 0) {
                    stats.top1 = stats.list[0];
                }
            }

            if (!stats || stats.list.length === 0) {
                return api.sendMessage('📊 Chưa có dữ liệu', threadID, messageID);
            }

            const targetUserInfo = threadInfo.userInfo.find(u => u.id === $.targetID);
            const targetName = targetUserInfo?.name || 'User';
            const userRank = stats.list.findIndex(item => item.userID === $.targetID);
            const userMessages = stats.list[userRank]?.count || 0;

            let message = `🏆 TOP TIN NHẮN TỔNG\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            const total = stats.total;
            const displayList = stats.list;
            for (let i = 0; i < displayList.length; i++) {
                const item = displayList[i];
                const userInfo = threadInfo.userInfo.find(u => u.id === item.userID);
                const userName = userInfo?.name || 'Facebook User';
                
                const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                message += `${emoji} ${item.rank}. ${userName} - ${item.count}\n`;
            }

            message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
            message += `💬 Tổng: ${stats.total}\n`;
            message += `🏆 ${targetName} đứng thứ ${userRank + 1} với ${userMessages} tin nhắn\n`;
            message += `📌 Reply + STT để xóa thành viên (QTV)`;

            api.sendMessage(message, threadID, (err, info) => {
                if (!err) {
                    global.concac.onReply.push({
                        name: this.config.name,
                        messageID: info.messageID,
                        author: userID,
                        type: 'kick',
                        storage: stats.list
                    });
                }
            }, messageID);
            api.unsendMessage($.messageID);

        } catch (error) {
            console.error('onReaction Error:', error);
        }
    }
};
