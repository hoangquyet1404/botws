const fs = require('fs');
const path = require('path');

const Database = require('better-sqlite3');

const dataDir = path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'bot.sqlite');
const COUNTER_COLUMNS = new Set(['day', 'week', 'month', 'total']);
const RESET_COLUMNS = new Set(['day', 'week', 'month']);

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function safeJsonParse(text, fallback) {
    try {
        if (!text || !String(text).trim()) return fallback;
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

function readJsonFile(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return safeJsonParse(fs.readFileSync(filePath, 'utf8'), fallback);
    } catch {
        return fallback;
    }
}

class BotDatabase {
    constructor() {
        ensureDir(dataDir);
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.initSchema();
        this.bindApi();
        this.migrateLegacyJsonFiles();
        this.migrateNestedJsonFiles();
    }

    bindApi() {
        this.get = {
            json: this.getJson.bind(this),
            mapItem: this.getMapItem.bind(this),
            threadSetting: this.getThreadSetting.bind(this),
            afk: this.getAfk.bind(this),
            afkMany: this.getAfkMany.bind(this),
            checkttThread: this.getCheckttThreadData.bind(this),
            checkttTopList: this.getCheckttTopList.bind(this),
            checkttTotal: this.getCheckttTotal.bind(this),
            checkttThreadIDs: this.getCheckttThreadIDs.bind(this),
            money: this.getMoneyBalance.bind(this),
            moneyThread: this.getMoneyThread.bind(this)
        };

        this.create = {
            json: this.setJson.bind(this),
            mapItem: this.setMapItem.bind(this),
            threadSetting: this.setThreadSetting.bind(this),
            afk: this.setAfk.bind(this),
            checkttThread: this.ensureCheckttThread.bind(this),
            moneyUser: this.ensureMoneyUser.bind(this)
        };

        this.update = {
            json: this.setJson.bind(this),
            mapItem: this.setMapItem.bind(this),
            threadSetting: this.setThreadSetting.bind(this),
            afk: this.setAfk.bind(this),
            checkttThread: this.saveCheckttThreadData.bind(this),
            checkttIncrement: this.incrementCheckttMessage.bind(this),
            checkttReset: this.resetCheckttCounter.bind(this),
            money: this.setMoneyBalance.bind(this),
            moneyAdd: this.addMoneyBalance.bind(this),
            moneySubtract: this.subtractMoneyBalance.bind(this),
            moneyPay: this.payMoney.bind(this)
        };

        this.delete = {
            json: this.deleteJson.bind(this),
            mapItem: this.deleteMapItem.bind(this),
            threadSetting: this.deleteThreadSetting.bind(this),
            afk: this.clearAfk.bind(this),
            checkttUser: this.deleteCheckttUser.bind(this),
            checkttThread: this.deleteCheckttThread.bind(this),
            moneyThread: this.resetMoneyThread.bind(this),
            moneyAll: this.resetAllMoney.bind(this)
        };

        this.afk = {
            get: this.getAfk.bind(this),
            getMany: this.getAfkMany.bind(this),
            set: this.setAfk.bind(this),
            clear: this.clearAfk.bind(this)
        };

        this.checktt = {
            ensureThread: this.ensureCheckttThread.bind(this),
            importThread: this.importCheckttThread.bind(this),
            getThread: this.getCheckttThreadData.bind(this),
            saveThread: this.saveCheckttThreadData.bind(this),
            incrementMessage: this.incrementCheckttMessage.bind(this),
            getTopList: this.getCheckttTopList.bind(this),
            getTotal: this.getCheckttTotal.bind(this),
            resetCounter: this.resetCheckttCounter.bind(this),
            getThreadIDs: this.getCheckttThreadIDs.bind(this),
            initializeMembers: this.initializeCheckttMembers.bind(this),
            syncParticipants: this.syncCheckttParticipants.bind(this),
            deleteUser: this.deleteCheckttUser.bind(this),
            deleteThread: this.deleteCheckttThread.bind(this)
        };

        this.money = {
            importThread: this.importMoneyData.bind(this),
            ensureUser: this.ensureMoneyUser.bind(this),
            get: this.getMoneyBalance.bind(this),
            add: this.addMoneyBalance.bind(this),
            subtract: this.subtractMoneyBalance.bind(this),
            set: this.setMoneyBalance.bind(this),
            pay: this.payMoney.bind(this),
            getThread: this.getMoneyThread.bind(this),
            resetThread: this.resetMoneyThread.bind(this),
            resetAll: this.resetAllMoney.bind(this)
        };
    }

    initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bot_kv (
                category TEXT NOT NULL,
                key TEXT NOT NULL,
                value_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (category, key)
            );

            CREATE TABLE IF NOT EXISTS checktt_threads (
                thread_id TEXT PRIMARY KEY,
                last_reset_day TEXT,
                last_reset_week TEXT,
                last_reset_month TEXT,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS checktt_users (
                thread_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                day INTEGER NOT NULL DEFAULT 0,
                week INTEGER NOT NULL DEFAULT 0,
                month INTEGER NOT NULL DEFAULT 0,
                total INTEGER NOT NULL DEFAULT 0,
                last_interaction INTEGER,
                PRIMARY KEY (thread_id, user_id)
            );

            CREATE INDEX IF NOT EXISTS idx_checktt_day ON checktt_users(thread_id, day DESC);
            CREATE INDEX IF NOT EXISTS idx_checktt_week ON checktt_users(thread_id, week DESC);
            CREATE INDEX IF NOT EXISTS idx_checktt_month ON checktt_users(thread_id, month DESC);
            CREATE INDEX IF NOT EXISTS idx_checktt_total ON checktt_users(thread_id, total DESC);

            CREATE TABLE IF NOT EXISTS money_users (
                thread_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                balance INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (thread_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS afk_users (
                thread_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                reason TEXT,
                since INTEGER NOT NULL,
                last_message_id TEXT,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (thread_id, user_id)
            );

            CREATE INDEX IF NOT EXISTS idx_afk_thread ON afk_users(thread_id);
        `);
    }

    getMeta(key, fallback = null) {
        const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
        return row ? row.value : fallback;
    }

    setMeta(key, value) {
        this.db.prepare(`
            INSERT INTO meta(key, value) VALUES(?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(key, String(value));
    }

    getJson(category, key = 'default', fallback = {}) {
        const row = this.db.prepare(
            'SELECT value_json FROM bot_kv WHERE category = ? AND key = ?'
        ).get(category, key);
        if (!row) return fallback;
        return safeJsonParse(row.value_json, fallback);
    }

    setJson(category, key = 'default', value = {}) {
        this.db.prepare(`
            INSERT INTO bot_kv(category, key, value_json, updated_at)
            VALUES(?, ?, ?, ?)
            ON CONFLICT(category, key) DO UPDATE SET
                value_json = excluded.value_json,
                updated_at = excluded.updated_at
        `).run(category, key, JSON.stringify(value), Date.now());
    }

    deleteJson(category, key = 'default') {
        this.db.prepare('DELETE FROM bot_kv WHERE category = ? AND key = ?').run(category, key);
    }

    listJsonKeys(category) {
        return this.db.prepare('SELECT key FROM bot_kv WHERE category = ? ORDER BY key').all(category).map(row => row.key);
    }

    getMapItem(category, itemKey, fallback = undefined, key = 'default') {
        const data = this.getJson(category, key, {});
        const normalizedKey = String(itemKey);
        return Object.prototype.hasOwnProperty.call(data, normalizedKey) ? data[normalizedKey] : fallback;
    }

    setMapItem(category, itemKey, value, key = 'default') {
        const data = this.getJson(category, key, {});
        data[String(itemKey)] = value;
        this.setJson(category, key, data);
        return data;
    }

    deleteMapItem(category, itemKey, key = 'default') {
        const data = this.getJson(category, key, {});
        const normalizedKey = String(itemKey);
        const existed = Object.prototype.hasOwnProperty.call(data, normalizedKey);
        if (existed) {
            delete data[normalizedKey];
            this.setJson(category, key, data);
        }
        return existed;
    }

    getThreadSetting(category, threadID, fallback = undefined, key = 'default') {
        const data = this.getJson(category, key, { threads: {} });
        if (!data.threads || typeof data.threads !== 'object') return fallback;
        const normalizedThreadID = String(threadID);
        return Object.prototype.hasOwnProperty.call(data.threads, normalizedThreadID)
            ? data.threads[normalizedThreadID]
            : fallback;
    }

    setThreadSetting(category, threadID, value, key = 'default') {
        const data = this.getJson(category, key, { threads: {} });
        if (!data.threads || typeof data.threads !== 'object') data.threads = {};
        data.threads[String(threadID)] = value;
        this.setJson(category, key, data);
        return data;
    }

    deleteThreadSetting(category, threadID, key = 'default') {
        const data = this.getJson(category, key, { threads: {} });
        if (!data.threads || typeof data.threads !== 'object') data.threads = {};
        const normalizedThreadID = String(threadID);
        const existed = Object.prototype.hasOwnProperty.call(data.threads, normalizedThreadID);
        if (existed) {
            delete data.threads[normalizedThreadID];
            this.setJson(category, key, data);
        }
        return existed;
    }

    migrateLegacyJsonFiles() {
        if (this.getMeta('legacy_json_migrated') === '1') return;

        const migrateFile = (category, key, filePath, fallback) => {
            if (!fs.existsSync(filePath)) return;
            const existing = this.getJson(category, key, null);
            if (existing !== null) return;
            this.setJson(category, key, readJsonFile(filePath, fallback));
        };

        const topLevelFiles = [
            ['antiSettings', 'default', path.join(dataDir, 'antiSettings.json'), { threads: {} }],
            ['autodownSettings', 'default', path.join(dataDir, 'autodownSettings.json'), {}],
            ['keyData', 'default', path.join(dataDir, 'keyData.json'), { keys: {} }],
            ['notiSettings', 'default', path.join(dataDir, 'notiSettings.json'), {}],
            ['prefixData', 'default', path.join(dataDir, 'prefixData.json'), { threads: {} }],
            ['rentData', 'default', path.join(dataDir, 'rentData.json'), { threads: {} }],
            ['unsendSettings', 'default', path.join(dataDir, 'unsendSettings.json'), {}],
            ['databan', 'default', path.join(dataDir, 'databan.json'), { users: {}, threads: {} }],
            ['dataAdbox', 'default', path.join(dataDir, 'dataAdbox.json'), { adminbox: {} }],
            ['commandBanned', 'default', path.join(dataDir, 'commandBanned.json'), {}],
            ['commands-banned', 'default', path.join(dataDir, 'commands-banned.json'), {}],
            ['disable-command', 'default', path.join(dataDir, 'disable-command.json'), {}],
            ['threadAllowNSFW', 'default', path.join(dataDir, 'threadAllowNSFW.json'), { threads: [] }]
        ];

        for (const [category, key, filePath, fallback] of topLevelFiles) {
            migrateFile(category, key, filePath, fallback);
        }

        const moneyDir = path.join(dataDir, 'money');
        if (fs.existsSync(moneyDir)) {
            for (const file of fs.readdirSync(moneyDir)) {
                if (!file.endsWith('.json')) continue;
                const threadID = file.replace(/\.json$/, '');
                this.importMoneyData(threadID, readJsonFile(path.join(moneyDir, file), {}));
            }
        }

        this.setMeta('legacy_json_migrated', '1');
    }

    migrateNestedJsonFiles() {
        if (this.getMeta('legacy_nested_json_migrated') === '1') return;
        if (!fs.existsSync(dataDir)) {
            this.setMeta('legacy_nested_json_migrated', '1');
            return;
        }

        const skip = new Set(['messages', 'money']);
        for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
            if (!entry.isDirectory() || skip.has(entry.name)) continue;
            const category = entry.name;
            const dirPath = path.join(dataDir, category);
            for (const file of fs.readdirSync(dirPath)) {
                if (!file.endsWith('.json')) continue;
                const key = file.replace(/\.json$/, '');
                if (this.getJson(category, key, null) !== null) continue;
                this.setJson(category, key, readJsonFile(path.join(dirPath, file), {}));
            }
        }

        this.setMeta('legacy_nested_json_migrated', '1');
    }

    ensureCheckttThread(threadID, lastReset = {}) {
        const now = Date.now();
        this.db.prepare(`
            INSERT INTO checktt_threads(thread_id, last_reset_day, last_reset_week, last_reset_month, updated_at)
            VALUES(?, ?, ?, ?, ?)
            ON CONFLICT(thread_id) DO UPDATE SET
                last_reset_day = COALESCE(excluded.last_reset_day, checktt_threads.last_reset_day),
                last_reset_week = COALESCE(excluded.last_reset_week, checktt_threads.last_reset_week),
                last_reset_month = COALESCE(excluded.last_reset_month, checktt_threads.last_reset_month),
                updated_at = excluded.updated_at
        `).run(
            String(threadID),
            lastReset.day || null,
            lastReset.week || null,
            lastReset.month || null,
            now
        );
    }

    getCheckttThreadRow(threadID) {
        return this.db.prepare('SELECT * FROM checktt_threads WHERE thread_id = ?').get(String(threadID));
    }

    getCheckttThreadData(threadID) {
        threadID = String(threadID);
        this.ensureCheckttThread(threadID);
        const thread = this.getCheckttThreadRow(threadID) || {};
        const rows = this.db.prepare(`
            SELECT user_id, day, week, month, total, last_interaction
            FROM checktt_users
            WHERE thread_id = ?
        `).all(threadID);

        const users = {};
        for (const row of rows) {
            users[row.user_id] = {
                day: Number(row.day) || 0,
                week: Number(row.week) || 0,
                month: Number(row.month) || 0,
                total: Number(row.total) || 0,
                lastInteraction: row.last_interaction || null
            };
        }

        return {
            threadID,
            users,
            lastReset: {
                day: thread.last_reset_day || null,
                week: thread.last_reset_week || null,
                month: thread.last_reset_month || null
            }
        };
    }

    saveCheckttThreadData(threadID, data = {}) {
        threadID = String(threadID);
        const nextData = {
            users: data.users || {},
            lastReset: data.lastReset || { day: null, week: null, month: null }
        };

        const tx = this.db.transaction(() => {
            this.ensureCheckttThread(threadID, nextData.lastReset);
            this.db.prepare('DELETE FROM checktt_users WHERE thread_id = ?').run(threadID);
            const insert = this.db.prepare(`
                INSERT INTO checktt_users(thread_id, user_id, day, week, month, total, last_interaction)
                VALUES(?, ?, ?, ?, ?, ?, ?)
            `);
            for (const [userID, stats] of Object.entries(nextData.users)) {
                insert.run(
                    threadID,
                    String(userID),
                    Number(stats.day) || 0,
                    Number(stats.week) || 0,
                    Number(stats.month) || 0,
                    Number(stats.total) || 0,
                    stats.lastInteraction || null
                );
            }
        });

        tx();
    }

    importCheckttThread(threadID, threadData = {}) {
        const users = threadData.users || {};
        const tx = this.db.transaction(() => {
            this.ensureCheckttThread(threadID, threadData.lastReset || {});
            const upsert = this.db.prepare(`
                INSERT INTO checktt_users(thread_id, user_id, day, week, month, total, last_interaction)
                VALUES(?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(thread_id, user_id) DO UPDATE SET
                    day = excluded.day,
                    week = excluded.week,
                    month = excluded.month,
                    total = excluded.total,
                    last_interaction = excluded.last_interaction
            `);
            for (const [userID, stats] of Object.entries(users)) {
                upsert.run(
                    String(threadID),
                    String(userID),
                    Number(stats.day) || 0,
                    Number(stats.week) || 0,
                    Number(stats.month) || 0,
                    Number(stats.total) || 0,
                    stats.lastInteraction || null
                );
            }
        });
        tx();
    }

    incrementCheckttMessage(threadID, userID) {
        this.ensureCheckttThread(threadID);
        this.db.prepare(`
            INSERT INTO checktt_users(thread_id, user_id, day, week, month, total, last_interaction)
            VALUES(?, ?, 1, 1, 1, 1, ?)
            ON CONFLICT(thread_id, user_id) DO UPDATE SET
                day = day + 1,
                week = week + 1,
                month = month + 1,
                total = total + 1,
                last_interaction = excluded.last_interaction
        `).run(String(threadID), String(userID), Date.now());
    }

    getCheckttTopList(threadID, column, limit = 10) {
        if (!COUNTER_COLUMNS.has(column)) return [];
        return this.db.prepare(`
            SELECT user_id, ${column} AS count
            FROM checktt_users
            WHERE thread_id = ?
            ORDER BY ${column} DESC
            LIMIT ?
        `).all(String(threadID), Number(limit) || 10).map((row, index) => ({
            rank: index + 1,
            userID: row.user_id,
            count: Number(row.count) || 0
        }));
    }

    getCheckttTotal(threadID, column) {
        if (!COUNTER_COLUMNS.has(column)) return 0;
        const row = this.db.prepare(`SELECT COALESCE(SUM(${column}), 0) AS total FROM checktt_users WHERE thread_id = ?`)
            .get(String(threadID));
        return Number(row?.total) || 0;
    }

    resetCheckttCounter(threadID, type, period) {
        if (!RESET_COLUMNS.has(type)) return false;
        this.ensureCheckttThread(threadID);
        const tx = this.db.transaction(() => {
            this.db.prepare(`UPDATE checktt_users SET ${type} = 0 WHERE thread_id = ?`).run(String(threadID));
            this.db.prepare(`
                UPDATE checktt_threads
                SET last_reset_${type} = ?, updated_at = ?
                WHERE thread_id = ?
            `).run(period || null, Date.now(), String(threadID));
        });
        tx();
        return true;
    }

    getCheckttThreadIDs() {
        return this.db.prepare('SELECT thread_id FROM checktt_threads').all().map(row => row.thread_id);
    }

    initializeCheckttMembers(threadID, participantIDs = []) {
        threadID = String(threadID);
        let inserted = 0;
        const tx = this.db.transaction(() => {
            this.ensureCheckttThread(threadID);
            const insert = this.db.prepare(`
                INSERT OR IGNORE INTO checktt_users(thread_id, user_id, day, week, month, total, last_interaction)
                VALUES(?, ?, 0, 0, 0, 0, NULL)
            `);
            for (const userID of participantIDs || []) {
                const result = insert.run(threadID, String(userID));
                inserted += result.changes || 0;
            }
        });
        tx();
        return inserted > 0;
    }

    syncCheckttParticipants(threadID, participantIDs = []) {
        threadID = String(threadID);
        const keep = new Set((participantIDs || []).map(String));
        let changed = false;
        const tx = this.db.transaction(() => {
            this.ensureCheckttThread(threadID);
            for (const row of this.db.prepare('SELECT user_id FROM checktt_users WHERE thread_id = ?').all(threadID)) {
                if (!keep.has(row.user_id)) {
                    this.db.prepare('DELETE FROM checktt_users WHERE thread_id = ? AND user_id = ?').run(threadID, row.user_id);
                    changed = true;
                }
            }
            const insert = this.db.prepare(`
                INSERT OR IGNORE INTO checktt_users(thread_id, user_id, day, week, month, total, last_interaction)
                VALUES(?, ?, 0, 0, 0, 0, NULL)
            `);
            for (const userID of keep) {
                const result = insert.run(threadID, userID);
                if (result.changes > 0) changed = true;
            }
        });
        tx();
        return changed;
    }

    deleteCheckttUser(threadID, userID) {
        const result = this.db.prepare('DELETE FROM checktt_users WHERE thread_id = ? AND user_id = ?')
            .run(String(threadID), String(userID));
        return result.changes > 0;
    }

    deleteCheckttThread(threadID) {
        const tx = this.db.transaction(() => {
            this.db.prepare('DELETE FROM checktt_users WHERE thread_id = ?').run(String(threadID));
            return this.db.prepare('DELETE FROM checktt_threads WHERE thread_id = ?').run(String(threadID));
        });
        return tx().changes > 0;
    }

    importMoneyData(threadID, data = {}) {
        const tx = this.db.transaction(() => {
            const upsert = this.db.prepare(`
                INSERT INTO money_users(thread_id, user_id, balance, updated_at)
                VALUES(?, ?, ?, ?)
                ON CONFLICT(thread_id, user_id) DO UPDATE SET
                    balance = excluded.balance,
                    updated_at = excluded.updated_at
            `);
            for (const [userID, balance] of Object.entries(data || {})) {
                upsert.run(String(threadID), String(userID), Number(balance) || 0, Date.now());
            }
        });
        tx();
    }

    normalizeMoneyAmount(amount) {
        const value = parseInt(amount, 10);
        return Number.isFinite(value) ? value : 0;
    }

    ensureMoneyUser(threadID, userID) {
        this.db.prepare(`
            INSERT OR IGNORE INTO money_users(thread_id, user_id, balance, updated_at)
            VALUES(?, ?, 0, ?)
        `).run(String(threadID), String(userID), Date.now());
    }

    getMoneyBalance(threadID, userID) {
        const row = this.db.prepare('SELECT balance FROM money_users WHERE thread_id = ? AND user_id = ?')
            .get(String(threadID), String(userID));
        return Number(row?.balance) || 0;
    }

    addMoneyBalance(threadID, userID, amount) {
        this.ensureMoneyUser(threadID, userID);
        this.db.prepare(`
            UPDATE money_users
            SET balance = balance + ?, updated_at = ?
            WHERE thread_id = ? AND user_id = ?
        `).run(this.normalizeMoneyAmount(amount), Date.now(), String(threadID), String(userID));
        return this.getMoneyBalance(threadID, userID);
    }

    subtractMoneyBalance(threadID, userID, amount) {
        this.ensureMoneyUser(threadID, userID);
        this.db.prepare(`
            UPDATE money_users
            SET balance = balance - ?, updated_at = ?
            WHERE thread_id = ? AND user_id = ?
        `).run(this.normalizeMoneyAmount(amount), Date.now(), String(threadID), String(userID));
        return this.getMoneyBalance(threadID, userID);
    }

    setMoneyBalance(threadID, userID, amount) {
        this.db.prepare(`
            INSERT INTO money_users(thread_id, user_id, balance, updated_at)
            VALUES(?, ?, ?, ?)
            ON CONFLICT(thread_id, user_id) DO UPDATE SET
                balance = excluded.balance,
                updated_at = excluded.updated_at
        `).run(String(threadID), String(userID), this.normalizeMoneyAmount(amount), Date.now());
        return this.getMoneyBalance(threadID, userID);
    }

    payMoney(threadID, senderID, receiverID, amount) {
        const value = this.normalizeMoneyAmount(amount);
        this.ensureMoneyUser(threadID, senderID);
        this.ensureMoneyUser(threadID, receiverID);
        if (this.getMoneyBalance(threadID, senderID) < value) return false;

        const tx = this.db.transaction(() => {
            this.db.prepare(`
                UPDATE money_users SET balance = balance - ?, updated_at = ?
                WHERE thread_id = ? AND user_id = ?
            `).run(value, Date.now(), String(threadID), String(senderID));
            this.db.prepare(`
                UPDATE money_users SET balance = balance + ?, updated_at = ?
                WHERE thread_id = ? AND user_id = ?
            `).run(value, Date.now(), String(threadID), String(receiverID));
        });
        tx();
        return true;
    }

    getMoneyThread(threadID) {
        const rows = this.db.prepare('SELECT user_id, balance FROM money_users WHERE thread_id = ? ORDER BY balance DESC')
            .all(String(threadID));
        return Object.fromEntries(rows.map(row => [row.user_id, Number(row.balance) || 0]));
    }

    resetMoneyThread(threadID) {
        return this.db.prepare('DELETE FROM money_users WHERE thread_id = ?').run(String(threadID)).changes;
    }

    resetAllMoney() {
        return this.db.prepare('DELETE FROM money_users').run().changes;
    }

    getAfk(threadID, userID) {
        return this.db.prepare(`
            SELECT thread_id, user_id, reason, since, last_message_id
            FROM afk_users
            WHERE thread_id = ? AND user_id = ?
        `).get(String(threadID), String(userID));
    }

    setAfk(threadID, userID, reason = '', messageID = null) {
        const now = Date.now();
        this.db.prepare(`
            INSERT INTO afk_users(thread_id, user_id, reason, since, last_message_id, updated_at)
            VALUES(?, ?, ?, ?, ?, ?)
            ON CONFLICT(thread_id, user_id) DO UPDATE SET
                reason = excluded.reason,
                since = excluded.since,
                last_message_id = excluded.last_message_id,
                updated_at = excluded.updated_at
        `).run(String(threadID), String(userID), reason || '', now, messageID || null, now);
        return now;
    }

    clearAfk(threadID, userID) {
        return this.db.prepare('DELETE FROM afk_users WHERE thread_id = ? AND user_id = ?')
            .run(String(threadID), String(userID)).changes > 0;
    }

    getAfkMany(threadID, userIDs = []) {
        const ids = Array.from(new Set((userIDs || []).map(String).filter(Boolean)));
        if (!ids.length) return [];
        const placeholders = ids.map(() => '?').join(',');
        return this.db.prepare(`
            SELECT thread_id, user_id, reason, since
            FROM afk_users
            WHERE thread_id = ? AND user_id IN (${placeholders})
        `).all(String(threadID), ...ids);
    }
}

module.exports = new BotDatabase();
