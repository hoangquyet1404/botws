const fs = require("fs"), path = require("path"), moment = require("moment-timezone");
const messageCounter = require('./utils/messageCounter'), RentScheduler = require('./utils/rentScheduler');

module.exports = function ({ api }) {
    const [hEvent, hReaction, hReply, hCmdEvent, hCmd, hRefresh] = ['Event', 'Reaction', 'Reply', 'CommandEvent', 'Command', 'Refresh'].map(t => require(`./handle/handle${t}`)({ api }));
    const rentScheduler = new RentScheduler(api); rentScheduler.start(); global.rentScheduler = rentScheduler;

    setInterval(async () => {
        try {
            const toSend = messageCounter.checkScheduledNoti();
            for (const { threadID, type } of toSend) {
                try {
                    const topStats = messageCounter.getTopStats(threadID, 10), stats = topStats[type];
                    if (!stats || stats.list.length === 0) { messageCounter.markNotiAsSent(threadID, type); continue; }
                    const threadInfo = await api.getThreadInfo(threadID);
                    let message = `━━ Top tương tác ${type === 'day' ? 'ngày' : type === 'week' ? 'tuần' : 'tháng'} ━━\n`, total = stats.total;
                    for (let i = 0; i < stats.list.length; i++) {
                        const item = stats.list[i], userInfo = threadInfo.userInfo.find(u => u.id === item.userID), userName = userInfo?.name || 'Facebook User';
                        const percent = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0, symbol = i === 0 ? '★' : i === 1 ? '✦' : i === 2 ? '✧' : '•';
                        message += `${symbol} ${item.rank}. ${userName}: ${item.count}(${percent}%)\n`;
                    }
                    message += `━━━━━━━━━━━━━━━━━━━━\n➤ Tổng: ${stats.total} tin\n`;
                    if (stats.top1) {
                        const top1Info = threadInfo.userInfo.find(u => u.id === stats.top1.userID), top1Name = top1Info?.name || 'Facebook User';
                        message += `★ Top1: ${top1Name} (${stats.top1.count})\n`;
                    }
                    await api.sendMessage(message, threadID);
                    messageCounter.resetCounter(threadID, type); messageCounter.markNotiAsSent(threadID, type);
                } catch (error) { console.error(`Error sending stats for ${threadID}:`, error); }
            }
        } catch (e) { console.error("Error in stats interval:", e); }
    }, 60000);

    api.ws.on('*', async (message) => {
        const event = message;
        try {
            if (['connected', 'api_response'].includes(message.type)) return;
            if (message.type === 'system_event' && ['logout', 'error_critical'].includes(message.dataType)) {
                console.error('[Listen] Received system logout/error:', message.data);
                if (global.config.status) { console.log('[Listen] Auto-login enabled. Restarting...'); process.exit(1); }
                else console.error('[Listen] ⚠️ Auto-login disabled.'); return;
            }
            if (message.type === 'mqtt_error' && (message.error.includes('Connection refused') || message.error.includes('Logged out') || message.code === 3)) {
                console.error('[Listen] MQTT Error/Logged Out');
                if (global.config.status) { console.log('[Listen] Restarting...'); process.exit(1); } return;
            }
            if (message.logMessageType === 'log:logout') {
                console.error('[Listen] Received API logout event. Reason:', message.reason);
                if (global.config.status) {
                    console.log('[Listen] Auto-login enabled. Restarting...');
                    process.exit(1);
                } else {
                    console.error('[Listen] Auto-login disabled. Exiting process.');
                    process.exit(0);
                }
                return;
            }
            if ((message.type === "message" || message.type === "message_reply") && message.senderID && message.threadID && message.senderID != api.getCurrentUserID()) {
                try { messageCounter.incrementMessage(message.threadID, message.senderID); } catch (e) { console.error("Error counting:", e); }
            }
            const eventType = (message.type === 'event' || message.logMessageType) ? `log:${message.logMessageType}` : null;
            if (eventType === "log:subscribe" && message.threadID) {
                try { const tInfo = await api.getThreadInfo(message.threadID); await messageCounter.initializeAllMembers(message.threadID, tInfo.participantIDs || []); } catch (e) { console.error("Error init members:", e); }
            }

            if ((message.type === "message" || message.type === "message_reply") && message.body) {
                try {
                    const { body, threadID, senderID, messageID } = message, keyPrefix = global.config.RENTKEY || 'banana';
                    if (body && body.startsWith(keyPrefix)) {
                        const keyPath = path.resolve(__dirname, 'data/keyData.json'), rentPath = path.resolve(__dirname, 'data/rentData.json');
                        if (fs.existsSync(keyPath) && fs.existsSync(rentPath)) {
                            const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8')), rentData = JSON.parse(fs.readFileSync(rentPath, 'utf8')), key = body.trim();
                            if (keyData.keys[key]) {
                                const keyInfo = keyData.keys[key];
                                if (keyInfo.used) return api.sendMessage(`✗ Key đã dùng!\n• Nhóm: ${keyInfo.usedThread}\n• Thời gian: ${keyInfo.usedTime}`, threadID, messageID);
                                let threadName = "Unknown";
                                try { const ti = await api.getThreadInfo(threadID); threadName = ti.threadName || ti.name || "Nhóm"; } catch (e) { }
                                const now = Date.now(), daysInMs = keyInfo.days * 86400000, timeFmt = "HH:mm:ss DD/MM/YYYY";

                                if (!rentData.threads[threadID]) {
                                    rentData.threads[threadID] = { startDate: now, endDate: now + daysInMs, days: keyInfo.days, threadName, addedBy: senderID, addedTime: moment.tz("Asia/Ho_Chi_Minh").format(timeFmt) };
                                    fs.writeFileSync(rentPath, JSON.stringify(rentData, null, 2));
                                    Object.assign(keyData.keys[key], { used: true, usedBy: senderID, usedTime: moment.tz("Asia/Ho_Chi_Minh").format(timeFmt), usedThread: threadName });
                                    fs.writeFileSync(keyPath, JSON.stringify(keyData, null, 2));
                                    if (global.rentScheduler) await global.rentScheduler.updateNickname(threadID);
                                    return api.sendMessage(`✓ Kích hoạt!\n• Nhóm: ${threadName}\n• Hạn: ${keyInfo.days} ngày\n• Hết: ${moment(now + daysInMs).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY HH:mm:ss")}`, threadID, messageID);
                                } else {
                                    const newEnd = rentData.threads[threadID].endDate + daysInMs, totalDays = Math.ceil((newEnd - now) / 86400000);
                                    Object.assign(rentData.threads[threadID], { endDate: newEnd, days: totalDays, threadName });
                                    fs.writeFileSync(rentPath, JSON.stringify(rentData, null, 2));
                                    Object.assign(keyData.keys[key], { used: true, usedBy: senderID, usedTime: moment.tz("Asia/Ho_Chi_Minh").format(timeFmt), usedThread: threadName });
                                    fs.writeFileSync(keyPath, JSON.stringify(keyData, null, 2));
                                    if (global.rentScheduler) await global.rentScheduler.updateNickname(threadID);
                                    return api.sendMessage(`✓ Gia hạn!\n• Nhóm: ${threadName}\n• Thêm: ${keyInfo.days} ngày\n• Tổng: ${totalDays} ngày\n• Hết: ${moment(newEnd).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY HH:mm:ss")}`, threadID, messageID);
                                }
                            }
                        }
                    }
                    const prefix = rentScheduler.getPrefix(threadID);
                    if (body && body.startsWith(prefix)) {
                        const cmdName = body.slice(prefix.length).trim().split(/ +/)[0]?.toLowerCase();
                        if (!['rent', 'thue', 'thuê'].includes(cmdName)) {
                            const isAdmin = global.config.ADMINBOT?.includes(senderID) || global.config.NDH?.includes(senderID);
                            if (!isAdmin) {
                                const rentInfo = rentScheduler.getRentInfo(threadID), contactID = global.config.NDH?.[0] || global.config.ADMINBOT[0];
                                if (!rentInfo) return api.shareContact(`❎ Nhóm chưa thuê bot, liên hệ Admin`, contactID, threadID, (e, i) => !e && i && setTimeout(() => api.unsendMessage(i.messageID), 10000));
                                if (rentInfo.isExpired) return api.shareContact(`❎ Bot hết hạn, liên hệ Admin gia hạn`, contactID, threadID, (e, i) => !e && i && setTimeout(() => api.unsendMessage(i.messageID), 10000));
                            }
                        }
                    }
                } catch (error) { console.error("Error checking rent status:", error); }
            }

            if (message.logMessageType) { await hRefresh({ event: message }); await hEvent({ event: message }); }
            switch (message.type) {
                case 'message_reaction': await hReaction({ event: message }); break;
                case 'message': case 'message_reply':
                    await hCmdEvent({ event: message }); await hReply({ event: message });
                    if (message.body) await hCmd({ event: message });
                    if (global.config.listenEvents) await hEvent({ event: message }); break;
                case 'message_unsend': case 'read_receipt': case 'typ': case 'presence':
                    if (global.config.listenEvents) await hEvent({ event: message }); break;
            }
        } catch (error) { console.error('[Listen] Error:', error); }
    });
};