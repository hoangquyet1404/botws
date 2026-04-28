const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const store = require('./database');
const utils = require('./log');

const COUNTER_COLUMNS = new Set(['day', 'week', 'month', 'total']);

class MessageCounter {
    constructor() {
        this.dataDir = path.join(__dirname, '../data/messages');
        this.timezone = 'Asia/Ho_Chi_Minh';
        this.notiSendingLockMs = 2 * 60 * 1000;
        this.notiFailedRetryMs = 30 * 60 * 1000;
        this.notiMaxFailedAttempts = 3;
        this.migrateLegacyMessages();
    }

    migrateLegacyMessages() {
        if (store.getMeta('checktt_json_migrated') === '1') {
            utils('[MessageCounter] SQLite checktt ready', 'MessageCounter');
            return;
        }

        let migrated = 0;
        if (fs.existsSync(this.dataDir)) {
            for (const file of fs.readdirSync(this.dataDir)) {
                if (!file.endsWith('.json') || file.includes('.backup.') || file.includes('.tmp')) continue;
                const threadID = file.replace(/\.json$/, '');
                try {
                    const content = fs.readFileSync(path.join(this.dataDir, file), 'utf8').trim();
                    if (!content) continue;
                    store.importCheckttThread(threadID, JSON.parse(content));
                    migrated++;
                } catch (error) {
                    utils(`[MessageCounter] Bỏ qua file lỗi ${file}: ${error.message}`, 'MessageCounter');
                }
            }
        }

        store.setMeta('checktt_json_migrated', '1');
        utils(`[MessageCounter] Đã migrate ${migrated} file message JSON sang SQLite`, 'MessageCounter');
    }

    getThreadRow(threadID) {
        return store.getCheckttThreadRow(threadID);
    }

    getThreadData(threadID) {
        return store.checktt.getThread(threadID);
    }

    saveThreadData(threadID, data) {
        store.checktt.saveThread(threadID, data);
    }

    getUserData(threadData, userID) {
        if (!threadData.users[userID]) {
            threadData.users[userID] = {
                day: 0,
                week: 0,
                month: 0,
                total: 0,
                lastInteraction: null
            };
        }
        return threadData.users[userID];
    }

    checkAndResetCounters() {
        return false;
    }

    incrementMessage(threadID, userID) {
        try {
            threadID = String(threadID);
            userID = String(userID);
            store.checktt.incrementMessage(threadID, userID);
        } catch (error) {
            utils(`[MessageCounter] Lỗi tăng counter ${threadID}/${userID}: ${error.message}`, 'MessageCounter');
        }
    }

    getStats(threadID, userID) {
        const threadData = this.getThreadData(threadID);
        const userData = this.getUserData(threadData, userID);
        const allUsers = Object.entries(threadData.users);
        const rankBy = (column) => [...allUsers].sort((a, b) => b[1][column] - a[1][column]).findIndex(u => u[0] === String(userID)) + 1;

        return {
            user: userData,
            rank: {
                day: rankBy('day'),
                week: rankBy('week'),
                month: rankBy('month')
            }
        };
    }

    getTopList(threadID, column, limit) {
        return store.checktt.getTopList(threadID, column, limit);
    }

    getTotal(threadID, column) {
        return store.checktt.getTotal(threadID, column);
    }

    getTopStats(threadID, limit = 10) {
        const make = (column) => {
            const list = this.getTopList(threadID, column, limit);
            return {
                list,
                total: this.getTotal(threadID, column),
                top1: list[0] || null
            };
        };

        return {
            day: make('day'),
            week: make('week'),
            month: make('month'),
            total: make('total')
        };
    }

    resetCounter(threadID, type) {
        if (!['day', 'week', 'month'].includes(type)) return;
        const now = moment.tz(this.timezone);
        const period = type === 'day'
            ? now.format('YYYY-MM-DD')
            : type === 'week'
                ? now.format('GGGG-[W]WW')
                : now.format('YYYY-MM');

        store.checktt.resetCounter(threadID, type, period);
    }

    getNotiSettings() {
        const settings = store.getJson('notiSettings', 'default', { threads: {} });
        if (!settings.threads || typeof settings.threads !== 'object') {
            settings.threads = {};
        }
        return settings;
    }

    saveNotiSettings(settings) {
        store.setJson('notiSettings', 'default', settings || {});
    }

    isTopNotiBucket(value) {
        if (!value || typeof value !== 'object') return false;
        return ['day', 'week', 'month'].some(type => value[type] && typeof value[type] === 'object');
    }

    getThreadNotiBucket(settings, threadID) {
        const id = String(threadID);
        const top = settings[id] && typeof settings[id] === 'object' ? settings[id] : null;
        const nested = settings.threads?.[id] && typeof settings.threads[id] === 'object'
            ? settings.threads[id]
            : null;
        const bucket = {};

        for (const type of ['day', 'week', 'month']) {
            if (top?.[type] && typeof top[type] === 'object') {
                bucket[type] = top[type];
            } else if (nested?.[type] && typeof nested[type] === 'object') {
                bucket[type] = nested[type];
            }
        }

        return bucket;
    }

    getThreadNotiValue(settings, threadID, type) {
        const bucket = this.getThreadNotiBucket(settings, threadID);
        return bucket[type] && typeof bucket[type] === 'object' ? bucket[type] : null;
    }

    setThreadNotiValue(settings, threadID, type, value) {
        const id = String(threadID);
        if (!settings[id] || typeof settings[id] !== 'object') settings[id] = {};
        settings[id][type] = value;

        if (!settings.threads || typeof settings.threads !== 'object') settings.threads = {};
        if (!settings.threads[id] || typeof settings.threads[id] !== 'object') settings.threads[id] = {};
        settings.threads[id][type] = value;
    }

    createDefaultNoti(hour = 0, minute = 0, enabled = false) {
        return {
            hour,
            minute,
            enabled,
            lastSent: null,
            lastSentSlot: null,
            delivery: null
        };
    }

    createDefaultAutoTopNoti() {
        return this.createDefaultNoti(0, 0, true);
    }

    seedCurrentSlotIfPassed(type, noti, nowInput) {
        const now = nowInput || moment.tz(this.timezone);
        const slot = this.getNotiSlot(type, noti, now);
        if (!slot) return noti;
        const nowMs = now.valueOf();
        return {
            ...noti,
            lastSent: slot.periodKey,
            lastSentSlot: slot.slotKey,
            delivery: {
                slotKey: slot.slotKey,
                status: 'sent',
                seeded: true,
                sentAt: nowMs,
                updatedAt: nowMs
            }
        };
    }

    normalizeNoti(noti, fallback) {
        const base = fallback || this.createDefaultNoti();
        const source = noti && typeof noti === 'object' ? noti : {};
        return {
            ...source,
            hour: Number.isInteger(source.hour) ? source.hour : base.hour,
            minute: Number.isInteger(source.minute) ? source.minute : base.minute,
            enabled: source.enabled !== undefined ? Boolean(source.enabled) : Boolean(base.enabled),
            lastSent: source.lastSent || null,
            lastSentSlot: source.lastSentSlot || null,
            delivery: source.delivery && typeof source.delivery === 'object' ? source.delivery : null
        };
    }

    ensureDefaultThreadNoti(settings, threadID, nowInput) {
        const now = nowInput || moment.tz(this.timezone);
        const bucket = this.getThreadNotiBucket(settings, threadID);
        let changed = false;

        for (const type of ['day', 'week', 'month']) {
            if (bucket[type] && typeof bucket[type] === 'object') continue;
            this.setThreadNotiValue(
                settings,
                threadID,
                type,
                this.seedCurrentSlotIfPassed(type, this.createDefaultAutoTopNoti(), now)
            );
            changed = true;
        }

        return {
            changed,
            bucket: this.getThreadNotiBucket(settings, threadID)
        };
    }

    getPeriodKey(type, now) {
        if (type === 'week') return now.format('GGGG-[W]WW');
        if (type === 'month') return now.format('YYYY-MM');
        return now.format('YYYY-MM-DD');
    }

    getLegacyPeriodKey(type, now) {
        if (type === 'week') return now.format('YYYY-WW');
        return this.getPeriodKey(type, now);
    }

    getPeriodKeyFromSlotKey(type, slotKey, now) {
        const prefix = `${type}:`;
        const value = String(slotKey || '');
        if (value.startsWith(prefix)) {
            const body = value.slice(prefix.length);
            const separatorIndex = body.lastIndexOf('@');
            if (separatorIndex > 0) return body.slice(0, separatorIndex);
        }
        return this.getPeriodKey(type, now);
    }

    getScheduleMoment(type, noti, now) {
        const hour = Number(noti.hour) || 0;
        const minute = Number(noti.minute) || 0;
        const base = now.clone().second(0).millisecond(0);
        if (type === 'week') return base.isoWeekday(1).hour(hour).minute(minute);
        if (type === 'month') return base.date(1).hour(hour).minute(minute);
        return base.hour(hour).minute(minute);
    }

    getNotiSlot(type, noti, nowInput) {
        const now = nowInput || moment.tz(this.timezone);
        const scheduleAt = this.getScheduleMoment(type, noti, now);
        if (now.isBefore(scheduleAt)) return null;
        const periodKey = this.getPeriodKey(type, now);
        return {
            legacyPeriodKey: this.getLegacyPeriodKey(type, now),
            periodKey,
            scheduledAt: scheduleAt.valueOf(),
            slotKey: `${type}:${periodKey}@${String(noti.hour).padStart(2, '0')}:${String(noti.minute).padStart(2, '0')}`
        };
    }

    hasNotiSlotBeenSent(noti, slot) {
        if (!slot) return true;
        if (noti.lastSentSlot) return noti.lastSentSlot === slot.slotKey;
        if (noti.delivery?.slotKey && noti.delivery.status === 'sent') {
            return noti.delivery.slotKey === slot.slotKey;
        }
        return Boolean(noti.lastSent && (noti.lastSent === slot.periodKey || noti.lastSent === slot.legacyPeriodKey));
    }

    hasActiveNotiLock(noti, slot, nowMs) {
        if (!noti.delivery || !slot || noti.delivery.slotKey !== slot.slotKey) return false;
        if (noti.delivery.status === 'failed_final' || noti.delivery.status === 'skipped') return true;
        if (noti.delivery.status === 'failed') {
            const attempts = Number(noti.delivery.attempts || 1);
            if (attempts >= this.notiMaxFailedAttempts) return true;
            const nextRetryAt = Number(noti.delivery.nextRetryAt || 0);
            return nextRetryAt > 0 && nowMs < nextRetryAt;
        }
        if (noti.delivery.status !== 'sending') return false;
        const updatedAt = Number(noti.delivery.updatedAt || noti.delivery.startedAt || 0);
        return updatedAt > 0 && nowMs - updatedAt < this.notiSendingLockMs;
    }

    isPermanentNotiSendError(error) {
        const code = String(error?.code || '');
        const message = String(error?.message || error || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\u0111/g, 'd')
            .replace(/\u0110/g, 'D')
            .toLowerCase();
        return code === 'SERVER_WRITE_ERROR' || message.includes('khong gui duoc');
    }

    setNotiTime(threadID, type, hour, minute) {
        const settings = this.getNotiSettings();
        this.setThreadNotiValue(settings, threadID, type, this.seedCurrentSlotIfPassed(
            type,
            this.createDefaultNoti(hour, minute, true)
        ));
        this.saveNotiSettings(settings);
    }

    getNotiTime(threadID, type) {
        const settings = this.getNotiSettings();
        const raw = this.getThreadNotiValue(settings, threadID, type);
        if (!raw || typeof raw !== 'object') {
            return this.getThreadRow(threadID)
                ? this.normalizeNoti(null, this.createDefaultAutoTopNoti())
                : null;
        }
        return this.normalizeNoti(raw, this.createDefaultAutoTopNoti());
    }

    disableNoti(threadID, type) {
        const settings = this.getNotiSettings();
        const raw = this.getThreadNotiValue(settings, threadID, type);
        this.setThreadNotiValue(settings, threadID, type, {
            ...this.normalizeNoti(raw, this.createDefaultNoti()),
            enabled: false
        });
        this.saveNotiSettings(settings);
    }

    enableNoti(threadID, type) {
        const settings = this.getNotiSettings();
        const nextNoti = {
            ...this.normalizeNoti(this.getThreadNotiValue(settings, threadID, type), this.createDefaultNoti()),
            enabled: true
        };
        this.setThreadNotiValue(settings, threadID, type, this.seedCurrentSlotIfPassed(type, nextNoti));
        this.saveNotiSettings(settings);
    }

    getAllThreadIDs() {
        const rows = store.checktt.getThreadIDs();
        const settings = this.getNotiSettings();
        const topLevelThreadIDs = Object.keys(settings || {})
            .filter(key => key !== 'threads' && this.isTopNotiBucket(settings[key]));
        const nestedThreadIDs = Object.entries(settings.threads || {})
            .filter(([, value]) => this.isTopNotiBucket(value))
            .map(([key]) => key);
        return Array.from(new Set([...rows, ...topLevelThreadIDs, ...nestedThreadIDs]));
    }

    checkScheduledNoti() {
        const now = moment.tz(this.timezone);
        const nowMs = now.valueOf();
        const settings = this.getNotiSettings();
        const toSend = [];
        let settingsChanged = false;

        for (const threadID of this.getAllThreadIDs()) {
            const ensured = this.ensureDefaultThreadNoti(settings, threadID, now);
            if (ensured.changed) settingsChanged = true;
            const threadSettings = ensured.bucket;
            if (!this.isTopNotiBucket(threadSettings)) continue;
            const defaultTime = this.createDefaultAutoTopNoti();
            for (const type of ['day', 'week', 'month']) {
                if (!threadSettings[type] || typeof threadSettings[type] !== 'object') continue;
                const noti = this.normalizeNoti(threadSettings[type], defaultTime);
                if (!noti.enabled) continue;
                const slot = this.getNotiSlot(type, noti, now);
                if (!slot || this.hasNotiSlotBeenSent(noti, slot) || this.hasActiveNotiLock(noti, slot, nowMs)) continue;
                toSend.push({
                    threadID,
                    type,
                    slotKey: slot.slotKey,
                    periodKey: slot.periodKey,
                    scheduledAt: slot.scheduledAt
                });
            }
        }

        if (settingsChanged) this.saveNotiSettings(settings);
        return toSend;
    }

    markNotiAsSending(threadID, type, slotKey) {
        const now = moment.tz(this.timezone);
        const settings = this.getNotiSettings();
        const noti = this.normalizeNoti(this.getThreadNotiValue(settings, threadID, type), this.createDefaultAutoTopNoti());
        const slot = slotKey ? { slotKey } : this.getNotiSlot(type, noti, now);
        const nowMs = now.valueOf();
        if (slot && this.hasActiveNotiLock(noti, slot, nowMs)) return false;
        const previous = noti.delivery || {};
        const attempts = previous.slotKey === (slot && slot.slotKey) && previous.status === 'failed'
            ? Number(previous.attempts || 1) + 1
            : 1;

        this.setThreadNotiValue(settings, threadID, type, {
            ...noti,
            delivery: {
                slotKey: slot ? slot.slotKey : null,
                status: 'sending',
                attempts,
                startedAt: nowMs,
                updatedAt: nowMs
            }
        });
        this.saveNotiSettings(settings);
        return true;
    }

    markNotiAsSent(threadID, type, slotKey) {
        const now = moment.tz(this.timezone);
        const settings = this.getNotiSettings();
        const noti = this.normalizeNoti(this.getThreadNotiValue(settings, threadID, type), this.createDefaultAutoTopNoti());
        const slot = slotKey ? { slotKey, periodKey: this.getPeriodKeyFromSlotKey(type, slotKey, now) } : this.getNotiSlot(type, noti, now);
        const periodKey = slot?.periodKey || this.getPeriodKey(type, now);
        const nowMs = now.valueOf();
        this.setThreadNotiValue(settings, threadID, type, {
            ...noti,
            lastSent: periodKey,
            lastSentSlot: slot ? slot.slotKey : null,
            delivery: {
                slotKey: slot ? slot.slotKey : null,
                status: 'sent',
                sentAt: nowMs,
                updatedAt: nowMs
            }
        });
        this.saveNotiSettings(settings);
    }

    markNotiAsFailed(threadID, type, slotKey, error) {
        const nowMs = moment.tz(this.timezone).valueOf();
        const settings = this.getNotiSettings();
        const noti = this.normalizeNoti(this.getThreadNotiValue(settings, threadID, type), this.createDefaultAutoTopNoti());
        const attempts = Number(noti.delivery?.attempts || 1);
        const permanent = this.isPermanentNotiSendError(error);
        const finalFailure = permanent || attempts >= this.notiMaxFailedAttempts;
        this.setThreadNotiValue(settings, threadID, type, {
            ...noti,
            delivery: {
                slotKey: slotKey || noti.delivery?.slotKey || null,
                status: finalFailure ? 'failed_final' : 'failed',
                attempts,
                code: error?.code ? String(error.code) : undefined,
                permanent: permanent || undefined,
                error: error?.message || String(error || ''),
                failedAt: nowMs,
                nextRetryAt: finalFailure ? null : nowMs + this.notiFailedRetryMs,
                updatedAt: nowMs
            }
        });
        this.saveNotiSettings(settings);
    }

    initializeAllMembers(threadID, participantIDs) {
        return store.checktt.initializeMembers(threadID, participantIDs);
    }

    syncWithParticipants(threadID, participantIDs) {
        return store.checktt.syncParticipants(threadID, participantIDs);
    }

    deleteUserFromThread(threadID, userID) {
        return store.checktt.deleteUser(threadID, userID);
    }

    deleteThreadData(threadID) {
        return store.checktt.deleteThread(threadID);
    }

    deleteNotiSettings(threadID) {
        const settings = this.getNotiSettings();
        const id = String(threadID);
        const existed = Boolean(settings[id] || settings.threads?.[id]);
        if (!existed) return false;
        delete settings[id];
        if (settings.threads && typeof settings.threads === 'object') {
            delete settings.threads[id];
        }
        this.saveNotiSettings(settings);
        return true;
    }

    deleteAllThreadData(threadID) {
        return {
            deletedData: this.deleteThreadData(threadID),
            deletedNoti: this.deleteNotiSettings(threadID)
        };
    }

    autoRepairCorruptedFiles() {
        this.migrateLegacyMessages();
    }
}

module.exports = new MessageCounter();
