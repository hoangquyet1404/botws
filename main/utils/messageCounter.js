const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');
const utils = require('./log');

class MessageCounter {
    constructor() {
        // Bật/tắt chức năng tự động chuyển đổi từ NDJSON sang JSON
        this.enableNdjsonMigration = false;

        this.dataDir = path.join(__dirname, '../data/messages');
        this.notiFile = path.join(__dirname, '../data/notiSettings.json');
        this.timezone = 'Asia/Ho_Chi_Minh';
        this.fileExt = '.json';

        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // Auto-repair corrupted files on startup
        this.autoRepairCorruptedFiles();
    }

    getFilePath(threadID) {
        return path.join(this.dataDir, `${threadID}${this.fileExt}`);
    }

    getLegacyJsonPath(threadID) {
        return path.join(this.dataDir, `${threadID}.json`);
    }

    getLegacyNdjsonPath(threadID) {
        return path.join(this.dataDir, `${threadID}.ndjson`);
    }

    /**
     * Đọc file JSON -> object threadData chuẩn
     */
    readJsonFile(filePath, threadID) {
        const defaultData = {
            threadID,
            users: {},
            lastReset: { day: null, week: null, month: null }
        };

        if (!fs.existsSync(filePath)) {
            return defaultData;
        }

        const fileContent = fs.readFileSync(filePath, 'utf8').trim();
        if (!fileContent) {
            return defaultData;
        }

        try {
            const data = JSON.parse(fileContent);

            return {
                threadID: data.threadID || threadID,
                users: data.users || {},
                lastReset: data.lastReset || { day: null, week: null, month: null }
            };
        } catch (e) {
            throw new Error(`Invalid JSON file: ${e.message}`);
        }
    }

    /**
     * Lưu object threadData -> JSON
     */
    writeJsonFile(filePath, data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data to save');
        }

        const validData = {
            threadID: data.threadID,
            users: data.users || {},
            lastReset: data.lastReset || { day: null, week: null, month: null }
        };

        const tempPath = filePath + '.tmp';
        const content = JSON.stringify(validData, null, 2);

        fs.writeFileSync(tempPath, content, 'utf8');

        // Verify lại file JSON tạm
        const verifyContent = fs.readFileSync(tempPath, 'utf8').trim();
        if (verifyContent) {
            JSON.parse(verifyContent);
        }

        fs.renameSync(tempPath, filePath);
    }

    /**
     * Tự động chuyển đổi từ NDJSON sang JSON (nếu bật enableNdjsonMigration)
     */
    migrateLegacyJson(threadID) {
        if (!this.enableNdjsonMigration) {
            return null;
        }

        const ndjsonPath = this.getLegacyNdjsonPath(threadID);
        const jsonPath = this.getFilePath(threadID);

        if (!fs.existsSync(ndjsonPath)) {
            return null;
        }

        try {
            const fileContent = fs.readFileSync(ndjsonPath, 'utf8').trim();

            if (!fileContent) {
                const defaultData = {
                    threadID,
                    users: {},
                    lastReset: { day: null, week: null, month: null }
                };
                this.writeJsonFile(jsonPath, defaultData);
                fs.renameSync(ndjsonPath, ndjsonPath + '.migrated.' + Date.now());
                utils(`[MessageCounter] Đã migrate file NDJSON rỗng sang JSON cho thread ${threadID}`, 'MessageCounter');
                return defaultData;
            }

            // Parse NDJSON
            const lines = fileContent.split('\n').filter(l => l.trim());
            const data = {
                threadID,
                users: {},
                lastReset: { day: null, week: null, month: null }
            };

            for (const line of lines) {
                let obj;
                try {
                    obj = JSON.parse(line);
                } catch (e) {
                    utils(`[MessageCounter] Lỗi parse dòng NDJSON: ${e.message}`, 'MessageCounter');
                    continue;
                }

                if (!obj || typeof obj !== 'object') continue;

                if (obj.type === 'meta') {
                    if (obj.threadID) data.threadID = obj.threadID;
                    if (obj.lastReset && typeof obj.lastReset === 'object') {
                        data.lastReset = {
                            day: obj.lastReset.day || null,
                            week: obj.lastReset.week || null,
                            month: obj.lastReset.month || null
                        };
                    }
                } else if (obj.type === 'user' && obj.userID) {
                    data.users[obj.userID] = {
                        day: Number(obj.day) || 0,
                        week: Number(obj.week) || 0,
                        month: Number(obj.month) || 0,
                        total: Number(obj.total) || 0,
                        lastInteraction: obj.lastInteraction || null
                    };
                }
            }

            // Lưu sang JSON
            this.writeJsonFile(jsonPath, data);

            // Đổi tên file NDJSON cũ để backup
            fs.renameSync(ndjsonPath, ndjsonPath + '.migrated.' + Date.now());
            utils.log(`[MessageCounter] Đã migrate file NDJSON sang JSON cho thread ${threadID}`);

            return data;
        } catch (error) {
            utils(`[MessageCounter] Lỗi migrate NDJSON sang JSON cho thread ${threadID}: ${error.message}`, 'MessageCounter');
            return null;
        }
    }

    getThreadData(threadID) {
        const filePath = this.getFilePath(threadID);
        const defaultData = {
            threadID,
            users: {},
            lastReset: { day: null, week: null, month: null }
        };

        // Nếu file JSON chưa tồn tại, thử migrate từ NDJSON cũ
        if (!fs.existsSync(filePath)) {
            const migrated = this.migrateLegacyJson(threadID);
            if (migrated) return migrated;
            return defaultData;
        }

        try {
            return this.readJsonFile(filePath, threadID);
        } catch (error) {
            utils(`[MessageCounter] Lỗi đọc file ${threadID}${this.fileExt}: ${error.message}`, 'MessageCounter');
            utils(`[MessageCounter] Đang tạo backup và khôi phục dữ liệu mặc định...`, 'MessageCounter');
            try {
                const backupPath = filePath + '.backup.' + Date.now();
                fs.copyFileSync(filePath, backupPath);
                utils(`[MessageCounter] Đã backup file lỗi tại: ${backupPath}`, 'MessageCounter');
            } catch (backupError) {
                utils(`[MessageCounter] Không thể backup file: ${backupError.message}`, 'MessageCounter');
            }
            this.writeJsonFile(filePath, defaultData);
            return defaultData;
        }
    }

    saveThreadData(threadID, data) {
        try {
            const filePath = this.getFilePath(threadID);
            const validData = {
                threadID: data.threadID || threadID,
                users: data.users || {},
                lastReset: data.lastReset || { day: null, week: null, month: null }
            };

            this.writeJsonFile(filePath, validData);
        } catch (error) {
            utils(`[MessageCounter] Lỗi lưu file ${threadID}${this.fileExt}: ${error.message}`, 'MessageCounter');
            const tempPath = this.getFilePath(threadID) + '.tmp';
            if (fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                } catch (e) { }
            }
        }
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

    checkAndResetCounters(threadData) {
        return false;
    }

    incrementMessage(threadID, userID) {
        try {
            const threadData = this.getThreadData(threadID);
            const userData = this.getUserData(threadData, userID);
            userData.day++;
            userData.week++;
            userData.month++;
            userData.total++;
            userData.lastInteraction = Date.now();
            this.saveThreadData(threadID, threadData);
        } catch (error) {
            utils(
                `[MessageCounter] Lỗi khi tăng counter cho user ${userID} trong thread ${threadID}: ${error.message}`,
                'MessageCounter'
            );
        }
    }

    getStats(threadID, userID) {
        const threadData = this.getThreadData(threadID);
        const userData = this.getUserData(threadData, userID);

        const allUsers = Object.entries(threadData.users);

        // dùng bản copy để sort, tránh sort chồng lên nhau
        const dayRank = [...allUsers].sort((a, b) => b[1].day - a[1].day);
        const weekRank = [...allUsers].sort((a, b) => b[1].week - a[1].week);
        const monthRank = [...allUsers].sort((a, b) => b[1].month - a[1].month);

        const userDayRank = dayRank.findIndex(u => u[0] === userID) + 1;
        const userWeekRank = weekRank.findIndex(u => u[0] === userID) + 1;
        const userMonthRank = monthRank.findIndex(u => u[0] === userID) + 1;

        return {
            user: userData,
            rank: { day: userDayRank, week: userWeekRank, month: userMonthRank }
        };
    }

    getTopStats(threadID, limit = 10) {
        const threadData = this.getThreadData(threadID);
        const allUsers = Object.entries(threadData.users);

        const dayTop = [...allUsers]
            .sort((a, b) => b[1].day - a[1].day)
            .slice(0, limit)
            .map((u, i) => ({ rank: i + 1, userID: u[0], count: u[1].day }));

        const weekTop = [...allUsers]
            .sort((a, b) => b[1].week - a[1].week)
            .slice(0, limit)
            .map((u, i) => ({ rank: i + 1, userID: u[0], count: u[1].week }));

        const monthTop = [...allUsers]
            .sort((a, b) => b[1].month - a[1].month)
            .slice(0, limit)
            .map((u, i) => ({ rank: i + 1, userID: u[0], count: u[1].month }));

        const totalTop = [...allUsers]
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, limit)
            .map((u, i) => ({ rank: i + 1, userID: u[0], count: u[1].total }));

        const totalDay = allUsers.reduce((sum, u) => sum + u[1].day, 0);
        const totalWeek = allUsers.reduce((sum, u) => sum + u[1].week, 0);
        const totalMonth = allUsers.reduce((sum, u) => sum + u[1].month, 0);
        const totalAll = allUsers.reduce((sum, u) => sum + u[1].total, 0);

        const top1Day = dayTop[0] || null;
        const top1Week = weekTop[0] || null;
        const top1Month = monthTop[0] || null;
        const top1Total = totalTop[0] || null;

        return {
            day: { list: dayTop, total: totalDay, top1: top1Day },
            week: { list: weekTop, total: totalWeek, top1: top1Week },
            month: { list: monthTop, total: totalMonth, top1: top1Month },
            total: { list: totalTop, total: totalAll, top1: top1Total }
        };
    }

    resetCounter(threadID, type) {
        const threadData = this.getThreadData(threadID);
        const now = moment.tz(this.timezone);

        for (const userID in threadData.users) {
            if (type === 'day') {
                threadData.users[userID].day = 0;
                threadData.lastReset.day = now.format('YYYY-MM-DD');
            } else if (type === 'week') {
                threadData.users[userID].week = 0;
                threadData.lastReset.week = now.format('YYYY-WW');
            } else if (type === 'month') {
                threadData.users[userID].month = 0;
                threadData.lastReset.month = now.format('YYYY-MM');
            }
        }

        this.saveThreadData(threadID, threadData);
    }

    getNotiSettings() {
        if (!fs.existsSync(this.notiFile)) {
            return {};
        }

        try {
            const fileContent = fs.readFileSync(this.notiFile, 'utf8').trim();

            if (!fileContent) {
                utils(`[MessageCounter] File notiSettings.json rỗng, tạo dữ liệu mới`, 'MessageCounter');
                this.saveNotiSettings({});
                return {};
            }

            const data = JSON.parse(fileContent);

            if (!data || typeof data !== 'object') {
                throw new Error('Invalid noti settings structure');
            }

            return data;
        } catch (error) {
            utils(`[MessageCounter] Lỗi đọc notiSettings.json: ${error.message}`, 'MessageCounter');
            utils(`[MessageCounter] Đang tạo backup và khôi phục dữ liệu mặc định...`, 'MessageCounter');

            try {
                const backupPath = this.notiFile + '.backup.' + Date.now();
                fs.copyFileSync(this.notiFile, backupPath);
                utils(`[MessageCounter] Đã backup file lỗi tại: ${backupPath}`, 'MessageCounter');
            } catch (backupError) {
                utils(`[MessageCounter] Không thể backup file: ${backupError.message}`, 'MessageCounter');
            }

            this.saveNotiSettings({});
            return {};
        }
    }

    saveNotiSettings(settings) {
        try {
            if (!settings || typeof settings !== 'object') {
                throw new Error('Invalid settings to save');
            }

            const tempPath = this.notiFile + '.tmp';
            fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2), 'utf8');

            JSON.parse(fs.readFileSync(tempPath, 'utf8'));

            fs.renameSync(tempPath, this.notiFile);
        } catch (error) {
            utils(`[MessageCounter] Lỗi lưu notiSettings.json: ${error.message}`, 'MessageCounter');
            const tempPath = this.notiFile + '.tmp';
            if (fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                } catch (e) { }
            }
        }
    }

    setNotiTime(threadID, type, hour, minute) {
        const settings = this.getNotiSettings();
        if (!settings[threadID]) {
            settings[threadID] = {};
        }
        settings[threadID][type] = { hour, minute, enabled: true, lastSent: null };
        this.saveNotiSettings(settings);
    }

    getNotiTime(threadID, type) {
        const settings = this.getNotiSettings();
        return settings[threadID]?.[type] || { hour: 0, minute: 0, enabled: true, lastSent: null };
    }

    disableNoti(threadID, type) {
        const settings = this.getNotiSettings();
        if (!settings[threadID]) {
            settings[threadID] = {};
        }
        if (!settings[threadID][type]) {
            settings[threadID][type] = { hour: 0, minute: 0, enabled: false, lastSent: null };
        } else {
            settings[threadID][type].enabled = false;
        }
        this.saveNotiSettings(settings);
    }

    enableNoti(threadID, type) {
        const settings = this.getNotiSettings();
        if (!settings[threadID]) {
            settings[threadID] = {};
        }
        if (!settings[threadID][type]) {
            settings[threadID][type] = { hour: 0, minute: 0, enabled: true, lastSent: null };
        } else {
            settings[threadID][type].enabled = true;
        }
        this.saveNotiSettings(settings);
    }

    checkScheduledNoti() {
        const now = moment.tz(this.timezone);
        const currentHour = now.hour();
        const currentMinute = now.minute();
        const currentDate = now.format('YYYY-MM-DD');
        const currentWeek = now.format('YYYY-WW');
        const currentMonth = now.format('YYYY-MM');
        const dayOfWeek = now.isoWeekday(); // 1 = Thứ 2, 7 = Chủ nhật
        const dayOfMonth = now.date(); // 1-31

        const settings = this.getNotiSettings();
        const toSend = [];

        const allThreadFiles = fs.readdirSync(this.dataDir);
        const allThreadIDs = Array.from(new Set(
            allThreadFiles
                .filter(f => f.endsWith('.json'))
                .map(f => f.replace(/\.json$/, ''))
        ));

        for (const threadID of allThreadIDs) {
            const threadSettings = settings[threadID];
            const defaultTime = { hour: 0, minute: 0, enabled: true, lastSent: null };
            for (const type of ['day', 'week', 'month']) {
                const noti = threadSettings?.[type] || defaultTime;
                if (
                    !noti.enabled ||
                    noti.hour !== currentHour ||
                    noti.minute !== currentMinute
                ) {
                    continue;
                }
                if (type === 'week' && dayOfWeek !== 1) {
                    continue;
                }

                if (type === 'month' && dayOfMonth !== 1) {
                    continue;
                }

                let shouldSend = false;
                const lastSent = noti.lastSent;

                if (type === 'day') {
                    shouldSend = !lastSent || lastSent !== currentDate;
                } else if (type === 'week') {
                    shouldSend = !lastSent || lastSent !== currentWeek;
                } else if (type === 'month') {
                    shouldSend = !lastSent || lastSent !== currentMonth;
                }

                if (shouldSend) {
                    toSend.push({ threadID, type });
                }
            }
        }

        return toSend;
    }

    markNotiAsSent(threadID, type) {
        const now = moment.tz(this.timezone);
        const settings = this.getNotiSettings();

        if (!settings[threadID]) {
            settings[threadID] = {};
        }

        if (!settings[threadID][type]) {
            settings[threadID][type] = { hour: 0, minute: 0, enabled: true, lastSent: null };
        }
        if (type === 'day') {
            settings[threadID][type].lastSent = now.format('YYYY-MM-DD');
        } else if (type === 'week') {
            settings[threadID][type].lastSent = now.format('YYYY-WW');
        } else if (type === 'month') {
            settings[threadID][type].lastSent = now.format('YYYY-MM');
        }

        this.saveNotiSettings(settings);
    }

    async initializeAllMembers(threadID, participantIDs) {
        const threadData = this.getThreadData(threadID);
        let needSave = false;

        for (const userID of participantIDs) {
            if (!threadData.users[userID]) {
                threadData.users[userID] = {
                    day: 0,
                    week: 0,
                    month: 0,
                    total: 0,
                    lastInteraction: null
                };
                needSave = true;
            }
        }

        if (needSave) {
            this.saveThreadData(threadID, threadData);
            return true;
        }
        return false;
    }

    syncWithParticipants(threadID, participantIDs) {
        const threadData = this.getThreadData(threadID);
        let needSave = false;
        const currentUserIDs = Object.keys(threadData.users);

        for (const userID of currentUserIDs) {
            if (!participantIDs.includes(userID)) {
                delete threadData.users[userID];
                needSave = true;
            }
        }
        for (const userID of participantIDs) {
            if (!threadData.users[userID]) {
                threadData.users[userID] = {
                    day: 0,
                    week: 0,
                    month: 0,
                    total: 0,
                    lastInteraction: null
                };
                needSave = true;
            }
        }

        if (needSave) {
            this.saveThreadData(threadID, threadData);
        }

        return needSave;
    }

    deleteUserFromThread(threadID, userID) {
        try {
            const threadData = this.getThreadData(threadID);

            if (threadData.users[userID]) {
                delete threadData.users[userID];
                this.saveThreadData(threadID, threadData);
                utils(`[MessageCounter] Đã xóa data user ${userID} khỏi thread ${threadID}`, 'MessageCounter');
                return true;
            }

            return false;
        } catch (error) {
            utils(`[MessageCounter] Lỗi khi xóa user ${userID} khỏi thread ${threadID}: ${error.message}`, 'MessageCounter');
            return false;
        }
    }

    deleteThreadData(threadID) {
        try {
            const jsonPath = this.getFilePath(threadID);
            let deleted = false;

            if (fs.existsSync(jsonPath)) {
                fs.unlinkSync(jsonPath);
                deleted = true;
            }

            if (deleted) {
                utils(`[MessageCounter] Đã xóa dữ liệu message counter cho nhóm: ${threadID}`, 'MessageCounter');
            }
            return deleted;
        } catch (error) {
            utils(`[MessageCounter] Lỗi khi xóa dữ liệu nhóm ${threadID}: ${error}`, 'MessageCounter');
            return false;
        }
    }

    deleteNotiSettings(threadID) {
        try {
            const settings = this.getNotiSettings();
            if (settings[threadID]) {
                delete settings[threadID];
                this.saveNotiSettings(settings);
                utils(`[MessageCounter] Đã xóa cài đặt thông báo cho nhóm: ${threadID}`, 'MessageCounter');
                return true;
            }
            return false;
        } catch (error) {
            utils(`[MessageCounter] Lỗi khi xóa cài đặt thông báo nhóm ${threadID}: ${error}`, 'MessageCounter');
            return false;
        }
    }

    deleteAllThreadData(threadID) {
        const deletedData = this.deleteThreadData(threadID);
        const deletedNoti = this.deleteNotiSettings(threadID);
        return { deletedData, deletedNoti };
    }

    autoRepairCorruptedFiles() {
        try {
            let repairedCount = 0;

            if (fs.existsSync(this.dataDir)) {
                const files = fs.readdirSync(this.dataDir);

                for (const file of files) {
                    if (
                        file.includes('.backup.') ||
                        file.includes('.tmp') ||
                        file.includes('.legacy.') ||
                        file.includes('.migrated.')
                    ) {
                        continue;
                    }

                    // Nếu là file NDJSON và bật migration, thử migrate
                    if (file.endsWith('.ndjson') && this.enableNdjsonMigration) {
                        const threadID = file.replace(/\.ndjson$/, '');
                        const migrated = this.migrateLegacyJson(threadID);
                        if (migrated) {
                            repairedCount++;
                        }
                        continue;
                    }

                    // Chỉ xử lý file JSON
                    if (!file.endsWith('.json')) {
                        continue;
                    }

                    const filePath = path.join(this.dataDir, file);
                    const threadID = file.replace(/\.json$/, '');

                    try {
                        const content = fs.readFileSync(filePath, 'utf8').trim();

                        if (!content) {
                            utils(`[MessageCounter] Phát hiện file rỗng: ${file}`, 'MessageCounter');
                            const defaultData = {
                                threadID,
                                users: {},
                                lastReset: { day: null, week: null, month: null }
                            };
                            this.writeJsonFile(filePath, defaultData);
                            repairedCount++;
                            continue;
                        }

                        JSON.parse(content);
                    } catch (error) {
                        utils(
                            `[MessageCounter] Phát hiện file JSON lỗi: ${file} - ${error.message}`,
                            'MessageCounter'
                        );

                        try {
                            const backupPath = filePath + '.backup.' + Date.now();
                            fs.copyFileSync(filePath, backupPath);
                        } catch (e) { }

                        const defaultData = {
                            threadID,
                            users: {},
                            lastReset: { day: null, week: null, month: null }
                        };
                        this.writeJsonFile(filePath, defaultData);
                        repairedCount++;
                    }
                }
            }

            // Kiểm tra file notiSettings.json
            if (fs.existsSync(this.notiFile)) {
                try {
                    const content = fs.readFileSync(this.notiFile, 'utf8').trim();
                    if (!content) {
                        utils(`[MessageCounter] File notiSettings.json rỗng, đang sửa...`, 'MessageCounter');
                        this.saveNotiSettings({});
                        repairedCount++;
                    } else {
                        JSON.parse(content);
                    }
                } catch (error) {
                    utils(`[MessageCounter] File notiSettings.json lỗi, đang sửa...`, 'MessageCounter');
                    try {
                        const backupPath = this.notiFile + '.backup.' + Date.now();
                        fs.copyFileSync(this.notiFile, backupPath);
                    } catch (e) { }
                    this.saveNotiSettings({});
                    repairedCount++;
                }
            }

            if (repairedCount > 0) {
                utils(`[MessageCounter] Đã sửa ${repairedCount} file JSON lỗi`, 'MessageCounter');
            } else {
                utils(`[MessageCounter] Tất cả file JSON đều OK`, 'MessageCounter');
            }
        } catch (error) {
            utils(`[MessageCounter] Lỗi khi auto-repair: ${error.message}`, 'MessageCounter');
        }
    }
}

module.exports = new MessageCounter();
