

const moment = require('moment-timezone');
const utils = require('./log');
const store = require('./database');

class RentScheduler {
    constructor(api) {
        this.api = api;
        this.isRunning = false;
        this.dailyInterval = null;
        this.initialTimeout = null;
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
        this.initialTimeout = setTimeout(() => {
            this.updateAllDataAndNicknames();
        }, 30000); // Chờ 30s 
        this.scheduleDaily();

        this.isRunning = true;
    }
    scheduleDaily() {
        const now = moment.tz("Asia/Ho_Chi_Minh");
        let nextRun = moment.tz("Asia/Ho_Chi_Minh").startOf('day'); // 00:00
        if (now.isAfter(nextRun)) {
            nextRun.add(1, 'day');
        }

        const msUntilNextRun = nextRun.diff(now);
        // console.log(`[RentScheduler] Next daily update in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);

        this.dailyTimeout = setTimeout(() => {
            // console.log('[RentScheduler] Running daily update at 00:00');
            this.updateAllDataAndNicknames();
            this.dailyInterval = setInterval(() => {
                //console.log('[RentScheduler] Running interval update');
                this.updateAllDataAndNicknames();
            }, 24 * 60 * 60 * 1000);
        }, msUntilNextRun);
    }
    async updateAllDataAndNicknames() {
        const isMqttConnected = this.api.ctx && this.api.ctx.mqttClient && this.api.ctx.mqttClient.connected;
        if (!isMqttConnected) {
            //console.log('[RentScheduler] MQTT not connected - Updating data only, skipping nicknames');
        }

        try {
            let rentData = this.getRentData();
            let prefixData = this.getPrefixData();

            const threads = rentData.threads || {};
            const threadList = Object.keys(threads);
            const now = moment.tz("Asia/Ho_Chi_Minh").startOf('day'); // Đầu ngày hiện tại
            let dataUpdated = false;
            let nickSuccessCount = 0;
            let nickErrorCount = 0;
            let threadsToUpdateNick = [];

            for (const threadID of threadList) {
                const data = threads[threadID];
                const endMoment = moment(data.endDate).tz("Asia/Ho_Chi_Minh").startOf('day');
                const daysLeft = endMoment.diff(now, 'days'); // Tính chênh lệch ngày (floor theo ngày)

                let daysChanged = false;

                // Trừ ngày và cập nhật data chỉ nếu khác (và >= -7)
                if (daysLeft !== data.days) {
                    if (daysLeft >= -7) {
                        rentData.threads[threadID].days = daysLeft;
                        daysChanged = true;
                        dataUpdated = true;
                        // console.log(`[RentScheduler] Updated days for ${threadID}: ${data.days} -> ${daysLeft}`);
                    } else {
                        // Xóa nếu < -7
                        delete rentData.threads[threadID];
                        dataUpdated = true;
                        utils(`[RentScheduler] Deleted expired thread ${threadID} (over 7 days)`, 'RentScheduler');
                        continue;
                    }
                }
                if (daysChanged && isMqttConnected) {
                    threadsToUpdateNick.push({ threadID, daysLeft, data });
                }
            }

            if (dataUpdated) {
                this.saveRentData(rentData);
                //console.log(`[RentScheduler] Saved rentData.json - Data updated for ${threadList.length} threads`);
            }

            for (const { threadID, daysLeft, data } of threadsToUpdateNick) {
                try {
                    const prefix = prefixData.threads?.[threadID]?.prefix || global.config.PREFIX;
                    const botName = global.config.BOTNAME || "Isenkai";

                    let nickname;
                    if (daysLeft > 0) {
                        nickname = `[ ${prefix} ] • ${botName} || Còn ${daysLeft} ngày`;
                    } else {
                        nickname = `[ ${prefix} ] • ${botName} || Hết hạn`; // daysLeft <= 0
                    }

                    await this.api.setNickname(nickname, threadID, this.api.getCurrentUserID());
                    nickSuccessCount++;
                    //console.log(`[RentScheduler] Updated nickname for ${threadID} (days changed): ${nickname}`);
                    if (threadsToUpdateNick.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5s
                    }
                } catch (error) {
                    nickErrorCount++;
                    utils(`[RentScheduler] Error updating nick for ${threadID}: ${error.message}`, 'error');
                }
            }

            //console.log(`[RentScheduler] Daily update complete - Data changes: ${dataUpdated}, Nick updates: ${nickSuccessCount}, Errors: ${nickErrorCount}`);

        } catch (error) {
            utils(`[RentScheduler] Error in updateAllDataAndNicknames: ${error}`, 'error');
        }
    }
    async updateNickname(threadID) {
        // const isMqttConnected = this.api.ctx && this.api.ctx.mqttClient && this.api.ctx.mqttClient.connected;
        // if (!isMqttConnected) {
        //     return { success: false, error: 'MQTT not connected' };
        // }

        try {
            let rentData = this.getRentData();
            let prefixData = this.getPrefixData();

            const data = rentData.threads[threadID];
            const prefix = prefixData.threads?.[threadID]?.prefix || global.config.PREFIX;
            const botName = global.config.BOTNAME || "Isenkai";

            let nickname;
            let daysLeft = 0;
            let dataUpdated = false;

            if (data) {
                const now = moment.tz("Asia/Ho_Chi_Minh").startOf('day');
                const endMoment = moment(data.endDate).tz("Asia/Ho_Chi_Minh").startOf('day');
                daysLeft = endMoment.diff(now, 'days');
                if (daysLeft !== data.days && daysLeft >= -7) {
                    rentData.threads[threadID].days = daysLeft;
                    dataUpdated = true;
                } else if (daysLeft < -7) {
                    delete rentData.threads[threadID];
                    dataUpdated = true;
                }

                if (dataUpdated) {
                    this.saveRentData(rentData);
                }

                if (daysLeft > 0) {
                    nickname = `[ ${prefix} ] • ${botName} || Còn ${daysLeft} ngày`;
                } else {
                    nickname = `[ ${prefix} ] • ${botName} || Hết hạn`;
                }
            } else {
                nickname = `[ ${prefix} ] • ${botName} || Chưa thuê bot`;
            }

            await this.api.setNickname(nickname, threadID, this.api.getCurrentUserID());

            return { success: true, daysLeft, nickname, dataUpdated };

        } catch (error) {
           // utils(`[RentScheduler] ✗ Error updating nickname for ${threadID}: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    getRentInfo(threadID) {
        try {
            let rentData = this.getRentData();
            let data = rentData.threads[threadID];

            if (!data) return null;

            const now = moment.tz("Asia/Ho_Chi_Minh").startOf('day');
            const endMoment = moment(data.endDate).tz("Asia/Ho_Chi_Minh").startOf('day');
            const daysLeft = endMoment.diff(now, 'days');
            if (daysLeft !== data.days && daysLeft >= -7) {
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
            utils(`[RentScheduler] Error getting rent info: ${error}`, 'error');
            return null;
        }
    }
    getPrefix(threadID) {
        try {
            const prefixData = this.getPrefixData();
            return prefixData.threads?.[threadID]?.prefix || global.config.PREFIX;
        } catch (error) {
            utils(`[RentScheduler] Error getting prefix: ${error}`, 'error');
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
        //console.log('[RentScheduler] Stopped');
    }
}

module.exports = RentScheduler;
