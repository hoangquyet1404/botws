"use strict";

const COOLDOWN_MS = 60 * 60 * 1000;
const DATA_CATEGORY = "workCooldown";

const JOBS = [
    "đi giao linh kiện",
    "sửa máy tính cho khách",
    "bán trà sữa",
    "chạy deadline thuê",
    "dọn kho hàng",
    "làm bảo vệ ca đêm",
    "thiết kế banner",
    "ship đồ ăn",
    "phụ quán net",
    "quay video quảng cáo",
    "code web thuê",
    "đào kho báu trong game",
    "bốc hàng ngoài chợ",
    "trông tiệm tạp hóa",
    "làm streamer một buổi"
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSenderName(event) {
    const senderID = String(event.senderID || "");
    const mentionName = event.mentions?.[senderID];
    if (mentionName) return String(mentionName).replace(/^@/, "").trim();
    return event.senderName || event.name || "Bạn";
}

function formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}p ${seconds}s`;
}

function getCooldownData(database) {
    return database.get.json(DATA_CATEGORY, "default", { users: {} });
}

function saveCooldownData(database, data) {
    database.update.json(DATA_CATEGORY, "default", data || { users: {} });
}

module.exports = {
    config: {
        name: "work",
        aliases: ["lamviec", "work"],
        version: "1.0.0",
        role: 0,
        author: "bot",
        info: "Làm việc nhận tiền ngẫu nhiên",
        Category: "Game",
        guides: "work",
        cd: 1,
        hasPrefix: true
    },

    onRun: async function ({ api, event, money, database }) {
        const { threadID, messageID, senderID } = event;
        const cooldownData = getCooldownData(database);
        if (!cooldownData.users || typeof cooldownData.users !== "object") cooldownData.users = {};

        const key = `${threadID}:${senderID}`;
        const now = Date.now();
        const lastWork = Number(cooldownData.users[key]?.lastWork || 0);
        const remain = lastWork + COOLDOWN_MS - now;
        if (remain > 0) {
            return api.sendMessage(
                `Bạn vừa làm việc rồi, quay lại sau ${formatTime(remain)}.`,
                threadID,
                null,
                messageID
            );
        }

        const job = JOBS[randomInt(0, JOBS.length - 1)];
        const reward = randomInt(10_000, 200_000);
        const name = getSenderName(event);

        await money.addMoney(senderID, reward);
        cooldownData.users[key] = {
            threadID: String(threadID),
            userID: String(senderID),
            lastWork: now,
            nextWork: now + COOLDOWN_MS
        };
        saveCooldownData(database, cooldownData);

        return api.sendMessage(
            `${name} đã ${job} và nhận được ${reward.toLocaleString()}$`,
            threadID,
            null,
            messageID
        );
    }
};
