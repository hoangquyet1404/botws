const moment = require("moment-timezone");
const messageCounter = require('./utils/messageCounter'), RentScheduler = require('./utils/rentScheduler');
const performAutoLogin = require('./utils/autolog');
const isAutologEnabled = performAutoLogin.isAutologEnabled;
const store = require('./utils/database');

function getLogoutSignal(message) {
    if (!message || typeof message !== 'object') return null;

    const data = message.data || message.payload || message.logout || message.logoutEvent || message.mqttDetails || {};
    const error = message.error || data.error || {};
    const topic = message.topic || data.topic;
    const type = String(message.type || '').toLowerCase();
    const dataType = String(message.dataType || data.dataType || '').toLowerCase();
    const logMessageType = String(message.logMessageType || data.logMessageType || '').toLowerCase();
    const authState = String(message.authState || data.authState || '').toLowerCase();
    const code = Number(message.code ?? data.code ?? error.code);
    const text = [  message.reason, message.error, data.reason,  data.error, error.message, error.name, data.message, authState ].map(value => typeof value === 'string' ? value : '').join(' ').toLowerCase();
    const logoutDetected = message.logoutDetected === true || message.isLogout === true || data.logoutDetected === true || data.isLogout === true || topic === '/mqtt_logout' || authState === 'logged_out' ||(type === 'system_event' && dataType === 'logout') || logMessageType === 'log:logout';
    const criticalDetected = type === 'system_event' && dataType === 'error_critical';
    const mqttDetected = type === 'mqtt_error' && ( code === 3 || text.includes('logged out') || text.includes('logout') || text.includes('not authorized') || text.includes('connection refused'));

    if (!logoutDetected && !criticalDetected && !mqttDetected) return null;

    return {
        data,
        logoutDetected: logoutDetected || mqttDetected,
        reason: message.reason || data.reason || error.message || message.error || data.error || dataType || type
    };
}

function toTimestampMs(value) {
    if (value === undefined || value === null || value === '') return 0;
    const raw = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(raw)) {
        return raw < 10_000_000_000 ? raw * 1000 : raw;
    }

    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
}

function getEventTimestampMs(message) {
    if (!message || typeof message !== 'object') return 0;
    return toTimestampMs( message.timestamp || message.serverTimestamp ||  message.messageTimestamp || message.createdAt || message.sentAt );
}

function isHistoryReplayEvent(message) {
    if (!message || typeof message !== 'object') return false;
    const data = message.data || message.payload || {};
    return Boolean(  message.isHistory ||message.isReplay ||  message.isPreloaded || message.preloaded || message.replay || message.__history || message.__replay || data.isHistory || data.isReplay || data.isPreloaded || data.preloaded || data.replay || data.__history || data.__replay);
}

function isGenericUserName(name) {
    const text = String(name || '').trim().toLowerCase();
    return !text || text === 'facebook user' || text === 'user' || text === 'unknown user' || text === 'người dùng facebook' || text === 'người dùng';
}

function collectFetchedUsers(value, output) {
    if (!value) return;
    if (Array.isArray(value)) {
        value.forEach(item => collectFetchedUsers(item, output));
        return;
    }
    if (typeof value !== 'object') return;

    if (value.id && value.name) {
        output.set(String(value.id), value);
    }

    for (const [key, item] of Object.entries(value)) {
        if (item && typeof item === 'object') {
            const user = { id: item.id || key, ...item };
            if (user.id && user.name) output.set(String(user.id), user);
        }
    }
}

async function hydrateTopUserNames(api, threadInfo, userIDs) {
    const nameMap = new Map();
    const users = Array.isArray(threadInfo?.userInfo) ? threadInfo.userInfo : [];
    const threadUsers = new Map();
    collectFetchedUsers(threadInfo, threadUsers);

    for (const rawID of userIDs) {
        const id = String(rawID || '').trim();
        if (!id) continue;
        const user = users.find(item => String(item.id) === id);
        if (user?.name && !isGenericUserName(user.name)) {
            nameMap.set(id, user.name);
        } else if (threadUsers.get(id)?.name && !isGenericUserName(threadUsers.get(id).name)) {
            nameMap.set(id, threadUsers.get(id).name);
        }
    }

    const nicknames = threadInfo?.nicknames || threadInfo?.nickNames || {};
    for (const rawID of userIDs) {
        const id = String(rawID || '').trim();
        if (!id || nameMap.has(id)) continue;
        const nickname = nicknames[id];
        if (nickname && String(nickname).trim()) nameMap.set(id, String(nickname).trim());
    }

    return nameMap;
}

function loadThreadNameCache(threadID) {
    return store.getJson('threadUserNames', String(threadID), {});
}

function saveThreadNameCache(threadID, threadInfo) {
    const cache = loadThreadNameCache(threadID);
    let changed = false;

    const users = new Map();
    collectFetchedUsers(threadInfo, users);
    for (const [id, user] of users) {
        if (!user?.name || isGenericUserName(user.name)) continue;
        if (cache[id] !== user.name) {
            cache[id] = user.name;
            changed = true;
        }
    }

    const nicknames = threadInfo?.nicknames || threadInfo?.nickNames || {};
    for (const [id, nickname] of Object.entries(nicknames)) {
        const name = String(nickname || '').trim();
        if (!name || cache[id]) continue;
        cache[id] = name;
        changed = true;
    }

    if (changed) store.setJson('threadUserNames', String(threadID), cache);
    return cache;
}

function isGroupThreadInfo(threadInfo) {
    if (!threadInfo || typeof threadInfo !== 'object') return false;
    if (threadInfo.isGroup === true) return true;
    if (threadInfo.isGroup === false) return false;

    const participantIDs = normalizeIDList(threadInfo.participantIDs);
    return participantIDs.length > 2;
}

function getDisplayName(displayNameMap, threadInfo, userID, cachedNames = {}) {
    const id = String(userID || '');
    if (!id) return 'Facebook User';

    const fromMap = displayNameMap.get(id);
    if (fromMap && !isGenericUserName(fromMap)) return fromMap;

    const users = Array.isArray(threadInfo?.userInfo) ? threadInfo.userInfo : [];
    const user = users.find(item => String(item.id) === id);
    if (user?.name && !isGenericUserName(user.name)) return user.name;

    const nicknames = threadInfo?.nicknames || threadInfo?.nickNames || {};
    const nickname = nicknames[id];
    if (nickname && String(nickname).trim()) return String(nickname).trim();

    const cachedName = cachedNames[id];
    if (cachedName && !isGenericUserName(cachedName)) return cachedName;

    return 'Facebook User';
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function filterStatsToParticipants(stats, threadInfo) {
    const participantIDs = Array.isArray(threadInfo?.participantIDs)
        ? threadInfo.participantIDs.map(String).filter(Boolean)
        : [];
    if (!stats || !Array.isArray(stats.list) || participantIDs.length === 0) return stats;

    const participantSet = new Set(participantIDs);
    const list = stats.list
        .filter(item => participantSet.has(String(item.userID)))
        .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
        ...stats,
        list,
        total: list.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
        top1: list[0] || null
    };
}

function normalizeIDList(values) {
    return Array.from(new Set(
        (Array.isArray(values) ? values : [])
            .map(value => String(value || '').trim())
            .filter(Boolean)
    ));
}

function getStoredUserIDs(threadData) {
    return normalizeIDList(Object.keys((threadData && threadData.users) || {}));
}

function shouldTrustParticipantList(threadInfo, threadData) {
    const participantIDs = normalizeIDList(threadInfo && threadInfo.participantIDs);
    const storedUserIDs = getStoredUserIDs(threadData);

    if (participantIDs.length === 0) return false;
    if (!threadInfo || !threadInfo.isGroup || storedUserIDs.length === 0) return true;

    return participantIDs.length + 5 >= storedUserIDs.length;
}

function getEffectiveParticipantIDs(threadInfo, threadData) {
    const participantIDs = normalizeIDList(threadInfo && threadInfo.participantIDs);
    const storedUserIDs = getStoredUserIDs(threadData);

    if (shouldTrustParticipantList(threadInfo, threadData)) {
        return participantIDs.length > 0 ? participantIDs : storedUserIDs;
    }

    return Array.from(new Set(storedUserIDs.concat(participantIDs)));
}

function filterStatsToUserIDs(stats, userIDs, limit = 10) {
    if (!stats || !Array.isArray(stats.list)) return stats;
    if (!Array.isArray(userIDs) || userIDs.length === 0) return stats;

    const userIDSet = new Set(userIDs.map(String));
    const list = stats.list
        .filter(item => userIDSet.has(String(item.userID)))
        .slice(0, limit)
        .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
        ...stats,
        list,
        total: list.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
        top1: list[0] || null
    };
}

function extractIdFromJid(value) {
    const match = String(value || '').match(/^(\d+)/);
    return match ? match[1] : '';
}

function normalizeIncomingEvent(input) {
    if (!input || typeof input !== 'object') return input;

    const message = { ...input };
    if (!message.body) {
        const bodyCandidate = message.text || message.message || message.content || message.messageText || message.snippet;
        if (typeof bodyCandidate === 'string') message.body = bodyCandidate;
    }

    if (!message.threadID) {
        const threadID = message.threadId || message.thread_id || extractIdFromJid(message.chatJid || message.threadJid);
        if (threadID) message.threadID = String(threadID);
    }
    if (!message.senderID) {
        const senderID = message.senderId || message.sender_id || message.author || message.from || extractIdFromJid(message.senderJid || message.userJid);
        if (senderID) message.senderID = String(senderID);
    }
    if (!message.messageID) {
        const messageID = message.messageId || message.message_id || message.mid || message.id;
        if (messageID) message.messageID = String(messageID);
    }

    const normalizedType = String(message.type || '').toLowerCase();
    if (
        ['e2eemessage', 'e2ee_message', 'new_message', 'message_new', 'messaging_message'].includes(normalizedType) ||
        (!message.type && message.threadID && message.senderID && message.body)
    ) {
        message.type = message.messageReply ? 'message_reply' : 'message';
    }

    return message;
}

module.exports = function ({ api }) {
    const [hEvent, hReaction, hReply, hCmdEvent, hCmd, hRefresh] = ['Event', 'Reaction', 'Reply', 'CommandEvent', 'Command', 'Refresh'].map(t => require(`./handle/handle${t}`)({ api }));
    const rentScheduler = new RentScheduler(api); rentScheduler.start(); global.rentScheduler = rentScheduler;
    let logoutExitStarted = false;
    const listenStartedAt = Date.now();
    const historyCutoffAt = listenStartedAt - 5000;

    async function exitAfterLogout(restartMessage) {
        if (logoutExitStarted) return;
        logoutExitStarted = true;

        if (isAutologEnabled(global.config)) {
            console.log(restartMessage || '[Listen] Auto-login enabled. Restarting...');
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`[Listen] Auto-login attempt ${attempt}/3...`);
                    const autoData = await performAutoLogin(global.config);
                    await performAutoLogin.saveSession(global.config, autoData);
                    process.exit(1);
                    return;
                } catch (error) {
                    console.error(`[Listen] Auto-login attempt ${attempt}/3 failed:`, error.message);
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                }
            }

            console.error('[Listen] Auto-login failed after 3 attempts. Stopping worker.');
            process.exit(0);
        } else {
            console.error('[Listen] Auto-login disabled. Exiting process.');
            process.exit(0);
        }
    }

    if (global.__topttInterval) clearInterval(global.__topttInterval);
    global.__topttInterval = setInterval(async () => {
        try {
            const toSend = messageCounter.checkScheduledNoti();
            for (const { threadID, type, slotKey } of toSend) {
                try {
                    if (messageCounter.markNotiAsSending && !messageCounter.markNotiAsSending(threadID, type, slotKey)) continue;
                    const threadInfo = await api.getThreadInfo({ threadID, forceRefresh: true }).catch(() => api.getThreadInfo(threadID));
                    if (!isGroupThreadInfo(threadInfo)) {
                        messageCounter.markNotiAsSent(threadID, type, slotKey);
                        await delay(1000);
                        continue;
                    }
                    const cachedNames = saveThreadNameCache(threadID, threadInfo);
                    const threadData = messageCounter.getThreadData(threadID);
                    const participantIDs = getEffectiveParticipantIDs(threadInfo, threadData);
                    if (participantIDs.length > 0) {
                        try { messageCounter.initializeAllMembers(threadID, participantIDs); } catch (_) { }
                    }
                    const topStats = messageCounter.getTopStats(threadID, 999);
                    const stats = filterStatsToUserIDs(topStats[type], participantIDs, 10);
                    if (!stats || stats.list.length === 0 || Number(stats.total || 0) <= 0) { messageCounter.markNotiAsSent(threadID, type, slotKey); await delay(1000); continue; }
                    let message = `━━ Top tương tác ${type === 'day' ? 'ngày' : type === 'week' ? 'tuần' : 'tháng'} ━━\n`, total = stats.total;
                    const displayNameMap = await hydrateTopUserNames(api, threadInfo, stats.list.map(item => item.userID));
                    for (let i = 0; i < stats.list.length; i++) {
                        const item = stats.list[i], userName = getDisplayName(displayNameMap, threadInfo, item.userID, cachedNames);
                        const percent = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0, symbol = i === 0 ? '★' : i === 1 ? '✦' : i === 2 ? '✧' : '•';
                        message += `${symbol} ${item.rank}. ${userName}: ${item.count}(${percent}%)\n`;
                    }
                    message += `━━━━━━━━━━━━━━━━━━━━\n➤ Tổng: ${stats.total} tin\n`;
                    if (stats.top1) {
                        const top1Name = getDisplayName(displayNameMap, threadInfo, stats.top1.userID, cachedNames);
                        message += `★ Top1: ${top1Name} (${stats.top1.count})\n`;
                    }
                    await api.sendMessage(message, threadID);
                    messageCounter.resetCounter(threadID, type); messageCounter.markNotiAsSent(threadID, type, slotKey);
                    await delay(1000);
                } catch (error) {
                    if (messageCounter.markNotiAsFailed) messageCounter.markNotiAsFailed(threadID, type, slotKey, error);
                    const errorCode = error && error.code ? ` (${error.code})` : '';
                    const errorMessage = error && error.message ? error.message : String(error || '');
                    console.error(`[TopTT] Send failed for ${threadID}/${type}: ${errorMessage}${errorCode}`);
                    await delay(1000);
                }
            }
        } catch (e) { console.error("Error in stats interval:", e); }
    }, 60000);

    api.ws.on('*', async (rawMessage) => {
        const message = normalizeIncomingEvent(rawMessage);
        const event = message;
        try {
            if (['connected', 'api_response'].includes(message.type)) return;
            const logoutSignal = getLogoutSignal(message);
            if (logoutSignal) {
                console.error('[Listen] Detected FCA logout/error:', logoutSignal.reason);
                await exitAfterLogout('[Listen] Auto-login enabled. Restarting...');
                return;
            }
            if (message.type === 'system_event' && ['logout', 'error_critical'].includes(message.dataType)) {
                console.error('[Listen] Received system logout/error:', message.data);
                await exitAfterLogout('[Listen] Auto-login enabled. Restarting...'); return;
            }
            if (message.type === 'mqtt_error' && (message.error.includes('Connection refused') || message.error.includes('Logged out') || message.code === 3)) {
                console.error('[Listen] MQTT Error/Logged Out');
                await exitAfterLogout('[Listen] Restarting...'); return;
            }
            if (message.logMessageType === 'log:logout') {
                console.error('[Listen] Received API logout event. Reason:', message.reason);
                await exitAfterLogout('[Listen] Auto-login enabled. Restarting...');
                return;
            }
            const isReplay = isHistoryReplayEvent(message);
            if (!isReplay) {
               // console.log(event);
            }
            const eventTimestamp = getEventTimestampMs(message);
            if (isReplay || (eventTimestamp > 0 && eventTimestamp < historyCutoffAt)) {
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
                        const keyData = store.getJson('keyData', 'default', { keys: {} });
                        const rentData = store.getJson('rentData', 'default', { threads: {} });
                        const key = body.trim();
                        if (keyData.keys[key]) {
                            const keyInfo = keyData.keys[key];
                            if (keyInfo.used) return api.sendMessage(`✗ Key đã dùng!\n• Nhóm: ${keyInfo.usedThread}\n• Thời gian: ${keyInfo.usedTime}`, threadID, messageID);
                            let threadName = "Unknown";
                            try { const ti = await api.getThreadInfo(threadID); threadName = ti.threadName || ti.name || "Nhóm"; } catch (e) { }
                            const now = Date.now(), daysInMs = keyInfo.days * 86400000, timeFmt = "HH:mm:ss DD/MM/YYYY";

                            if (!rentData.threads[threadID]) {
                                rentData.threads[threadID] = { startDate: now, endDate: now + daysInMs, days: keyInfo.days, threadName, addedBy: senderID, addedTime: moment.tz("Asia/Ho_Chi_Minh").format(timeFmt) };
                                Object.assign(keyData.keys[key], { used: true, usedBy: senderID, usedTime: moment.tz("Asia/Ho_Chi_Minh").format(timeFmt), usedThread: threadName });
                                store.setJson('rentData', 'default', rentData);
                                store.setJson('keyData', 'default', keyData);
                                if (global.rentScheduler) await global.rentScheduler.updateNickname(threadID);
                                return api.sendMessage(`✓ Kích hoạt!\n• Nhóm: ${threadName}\n• Hạn: ${keyInfo.days} ngày\n• Hết: ${moment(now + daysInMs).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY HH:mm:ss")}`, threadID, messageID);
                            } else {
                                const newEnd = rentData.threads[threadID].endDate + daysInMs, totalDays = Math.ceil((newEnd - now) / 86400000);
                                Object.assign(rentData.threads[threadID], { endDate: newEnd, days: totalDays, threadName });
                                Object.assign(keyData.keys[key], { used: true, usedBy: senderID, usedTime: moment.tz("Asia/Ho_Chi_Minh").format(timeFmt), usedThread: threadName });
                                store.setJson('rentData', 'default', rentData);
                                store.setJson('keyData', 'default', keyData);
                                if (global.rentScheduler) await global.rentScheduler.updateNickname(threadID);
                                return api.sendMessage(`✓ Gia hạn!\n• Nhóm: ${threadName}\n• Thêm: ${keyInfo.days} ngày\n• Tổng: ${totalDays} ngày\n• Hết: ${moment(newEnd).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY HH:mm:ss")}`, threadID, messageID);
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
