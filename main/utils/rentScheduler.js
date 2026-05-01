const moment = require('moment-timezone');
const utils = require('./log');
const store = require('./database');

const TZ = 'Asia/Ho_Chi_Minh';
const DAY_MS = 24 * 60 * 60 * 1000;

class RentScheduler {
    constructor(api) {
        this.api = api;
        this.isRunning = false;
        this.initialTimeout = null;
        this.dailyTimeout = null;
        this.dailyInterval = null;
    }

    getRentData() {
        return store.getJson('rentData', 'default', { threads: {} });
    }

    saveRentData(data) {
        store.setJson('rentData', 'default', data || { threads: {} });
    }

    getPrefixData() {
        return store.getJson('prefixData', 'default', { threads: {} });
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        this.initialTimeout = setTimeout(() => {
            this.updateAllDataAndNicknames({ forceNickname: true, reason: 'startup' });
        }, 10000);

        this.scheduleDaily();
    }

    scheduleDaily() {
        if (this.dailyTimeout) clearTimeout(this.dailyTimeout);
        if (this.dailyInterval) clearInterval(this.dailyInterval);
        this.dailyTimeout = null;
        this.dailyInterval = null;

        const now = moment.tz(TZ);
        let nextRun = moment.tz(TZ).startOf('day');
        if (now.isAfter(nextRun)) nextRun.add(1, 'day');

        this.dailyTimeout = setTimeout(() => {
            this.updateAllDataAndNicknames({ forceNickname: true, reason: 'daily' });
            this.dailyInterval = setInterval(() => {
                this.updateAllDataAndNicknames({ forceNickname: true, reason: 'daily' });
            }, DAY_MS);
        }, nextRun.diff(now));
    }

    buildNickname(threadID, daysLeft, prefixData) {
        const prefix = prefixData.threads?.[threadID]?.prefix || global.config.PREFIX;
        const botName = global.config.BOTNAME || 'Isenkai';
        if (daysLeft > 0) return `[ ${prefix} ] • ${botName} || Còn ${daysLeft} ngày`;
        return `[ ${prefix} ] • ${botName} || Hết hạn`;
    }

    async updateAllDataAndNicknames(options = {}) {
        const canSetNickname = typeof this.api?.setNickname === 'function';

        try {
            const rentData = this.getRentData();
            const prefixData = this.getPrefixData();
            if (!rentData.threads || typeof rentData.threads !== 'object') rentData.threads = {};

            const now = moment.tz(TZ).startOf('day');
            const threadList = Object.keys(rentData.threads);
            const threadsToUpdateNick = [];
            let dataUpdated = false;
            let nickSuccessCount = 0;
            let nickErrorCount = 0;

            for (const threadID of threadList) {
                const data = rentData.threads[threadID];
                if (!data || !data.endDate) continue;

                const endMoment = moment(data.endDate).tz(TZ).startOf('day');
                if (!endMoment.isValid()) continue;

                const daysLeft = endMoment.diff(now, 'days');
                let daysChanged = false;

                if (daysLeft !== Number(data.days)) {
                    if (daysLeft >= -7) {
                        rentData.threads[threadID].days = daysLeft;
                        daysChanged = true;
                        dataUpdated = true;
                    } else {
                        delete rentData.threads[threadID];
                        dataUpdated = true;
                        utils(`[RentScheduler] Deleted expired thread ${threadID} (over 7 days)`, 'RentScheduler');
                        continue;
                    }
                }

                if (canSetNickname && (daysChanged || options.forceNickname)) {
                    threadsToUpdateNick.push({ threadID, daysLeft });
                }
            }

            if (dataUpdated) this.saveRentData(rentData);

            for (const { threadID, daysLeft } of threadsToUpdateNick) {
                try {
                    const nickname = this.buildNickname(threadID, daysLeft, prefixData);
                    await this.api.setNickname(nickname, threadID, this.api.getCurrentUserID());
                    nickSuccessCount++;
                    if (threadsToUpdateNick.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    nickErrorCount++;
                    utils(`[RentScheduler] Error updating nick for ${threadID}: ${error.message}`, 'error');
                }
            }

            return {
                success: true,
                dataUpdated,
                nickSuccessCount,
                nickErrorCount,
                reason: options.reason || null
            };
        } catch (error) {
            utils(`[RentScheduler] Error in updateAllDataAndNicknames: ${error.message || error}`, 'error');
            return { success: false, error: error.message || String(error) };
        }
    }

    async updateNickname(threadID) {
        try {
            const rentData = this.getRentData();
            const prefixData = this.getPrefixData();
            if (!rentData.threads || typeof rentData.threads !== 'object') rentData.threads = {};

            let data = rentData.threads[threadID];
            let daysLeft = 0;
            let dataUpdated = false;
            let nickname;

            if (data) {
                const now = moment.tz(TZ).startOf('day');
                const endMoment = moment(data.endDate).tz(TZ).startOf('day');
                daysLeft = endMoment.diff(now, 'days');

                if (daysLeft >= -7) {
                    if (daysLeft !== Number(data.days)) {
                        rentData.threads[threadID].days = daysLeft;
                        dataUpdated = true;
                    }
                    nickname = this.buildNickname(threadID, daysLeft, prefixData);
                } else {
                    delete rentData.threads[threadID];
                    data = null;
                    dataUpdated = true;
                }
            }

            if (!data) {
                const prefix = prefixData.threads?.[threadID]?.prefix || global.config.PREFIX;
                const botName = global.config.BOTNAME || 'Isenkai';
                nickname = `[ ${prefix} ] • ${botName} || Chưa thuê bot`;
            }

            if (dataUpdated) this.saveRentData(rentData);
            await this.api.setNickname(nickname, threadID, this.api.getCurrentUserID());

            return { success: true, daysLeft, nickname, dataUpdated };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getRentInfo(threadID) {
        try {
            const rentData = this.getRentData();
            const data = rentData.threads?.[threadID];
            if (!data) return null;

            const now = moment.tz(TZ).startOf('day');
            const endMoment = moment(data.endDate).tz(TZ).startOf('day');
            const daysLeft = endMoment.diff(now, 'days');

            if (daysLeft !== Number(data.days) && daysLeft >= -7) {
                rentData.threads[threadID].days = daysLeft;
                this.saveRentData(rentData);
            } else if (daysLeft < -7) {
                delete rentData.threads[threadID];
                this.saveRentData(rentData);
                return null;
            }

            return {
                ...data,
                daysLeft,
                isExpired: daysLeft <= 0,
                isWarning: daysLeft <= 3 && daysLeft > 0
            };
        } catch (error) {
            utils(`[RentScheduler] Error getting rent info: ${error.message || error}`, 'error');
            return null;
        }
    }

    getPrefix(threadID) {
        try {
            const prefixData = this.getPrefixData();
            return prefixData.threads?.[threadID]?.prefix || global.config.PREFIX;
        } catch (error) {
            utils(`[RentScheduler] Error getting prefix: ${error.message || error}`, 'error');
            return global.config.PREFIX;
        }
    }

    stop() {
        this.isRunning = false;

        if (this.initialTimeout) {
            clearTimeout(this.initialTimeout);
            this.initialTimeout = null;
        }

        if (this.dailyTimeout) {
            clearTimeout(this.dailyTimeout);
            this.dailyTimeout = null;
        }

        if (this.dailyInterval) {
            clearInterval(this.dailyInterval);
            this.dailyInterval = null;
        }
    }
}

module.exports = RentScheduler;
