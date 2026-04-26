const AFK_COMMANDS = new Set(['afk', 'away']);

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (days) parts.push(`${days} ngày`);
    if (hours) parts.push(`${hours} giờ`);
    if (minutes) parts.push(`${minutes} phút`);
    if (!parts.length) parts.push(`${seconds} giây`);
    return parts.join(' ');
}

function getThreadPrefix(threadID, database) {
    const config = global.config || {};
    if (global.rentScheduler && typeof global.rentScheduler.getPrefix === 'function') {
        return global.rentScheduler.getPrefix(threadID) || config.PREFIX || '!';
    }
    return database.get.threadSetting('prefixData', threadID, null)?.prefix || config.PREFIX || '!';
}

function isAfkCommand(event, database) {
    const body = String(event?.body || '').trim();
    if (!body) return false;
    const prefix = getThreadPrefix(String(event.threadID || ''), database);
    if (!body.startsWith(prefix)) return false;
    const name = body.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
    return AFK_COMMANDS.has(name);
}

function getActive(database, threadID, userID) {
    return database.afk.get(threadID, userID);
}

function setAfk(database, threadID, userID, reason, messageID) {
    return database.afk.set(threadID, userID, reason, messageID);
}

function clearAfk(database, threadID, userID) {
    return database.afk.clear(threadID, userID);
}

function getMentionIDs(event) {
    const mentions = event?.mentions && typeof event.mentions === 'object' ? event.mentions : {};
    return Object.keys(mentions).map(String).filter(Boolean);
}

function getAfkMentions(database, threadID, userIDs) {
    return database.afk.getMany(threadID, userIDs);
}

function summarizeThread(api, event, startTimestamp) {
    if (typeof api.summarizeThread !== 'function') return Promise.resolve('');
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(''), 20000);
        try {
            api.summarizeThread(event.threadID, {
                startTimestamp,
                maxMessages: 120,
                usecaseName: 'UNREAD_MESSAGES',
                threadType: event.isGroup ? 'GROUP' : 'ONE_TO_ONE'
            }, (error, result) => {
                clearTimeout(timer);
                if (error || !result?.summary) return resolve('');
                resolve(String(result.summary).trim());
            });
        } catch {
            clearTimeout(timer);
            resolve('');
        }
    });
}

module.exports = {
    config: {
        name: 'afk',
        aliases: ['away'],
        version: '1.1.0',
        role: 0,
        author: '',
        info: 'Bật trạng thái AFK, tự tóm tắt khi quay lại',
        Category: 'Box',
        guides: 'afk [lý do]',
        cd: 3,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args, database }) {
        const reason = args.join(' ').trim();
        const since = setAfk(database, event.threadID, event.senderID, reason, event.messageID);
        const msg = reason
            ? `⏳ Đã bật AFK.\n• Lý do: ${reason}`
            : '⏳ Đã bật AFK.\n• Không có lý do';

        return api.sendMessage(
            `${msg}\n• Bắt đầu: ${new Date(since).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
            event.threadID,
            null,
            event.messageID
        );
    },

    onEvent: async function ({ api, event, database }) {
        if (!event || !['message', 'message_reply'].includes(event.type)) return;
        if (!event.threadID || !event.senderID) return;
        if (String(event.senderID) === String(api.getCurrentUserID?.())) return;

        const active = getActive(database, event.threadID, event.senderID);
        if (active && !isAfkCommand(event, database)) {
            clearAfk(database, event.threadID, event.senderID);
            const durationText = formatDuration(Date.now() - Number(active.since || Date.now()));
            let msg = `✅ Bạn đã online lại sau ${durationText}.`;
            const summary = await summarizeThread(api, event, Number(active.since || Date.now()));
            if (summary) {
                msg += `\n\n📝 Tóm tắt lúc bạn AFK:\n${summary}`;
            }
            await api.sendMessage(msg, event.threadID, null, event.messageID);
        }

        const mentions = event.mentions && typeof event.mentions === 'object' ? event.mentions : {};
        const senderID = String(event.senderID || '');
        const rows = getAfkMentions(
            database,
            event.threadID,
            getMentionIDs(event).filter(id => id !== senderID)
        );
        if (!rows.length) return;

        const lines = rows.map((row) => {
            const displayName = String(mentions[row.user_id] || row.user_id).replace(/^@/, '');
            const reason = row.reason ? `\n• Lý do: ${row.reason}` : '\n• Không có lý do';
            return `⏳ ${displayName} đang AFK${reason}\n• Đã AFK: ${formatDuration(Date.now() - Number(row.since || Date.now()))}`;
        });

        return api.sendMessage(lines.join('\n\n'), event.threadID, null, event.messageID);
    }
};
