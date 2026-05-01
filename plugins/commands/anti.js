const spamBuckets = new Map();

const SPAM_LIMIT = 5;
const SPAM_WINDOW_MS = 2000;
const SPAM_COOLDOWN_MS = 10000;

function loadAntiSettings(database) {
    const data = database.get.json("antiSettings", "default", { threads: {} });
    if (!data.threads || typeof data.threads !== "object") data.threads = {};
    return data;
}

function saveAntiSettings(database, data) {
    database.update.json("antiSettings", "default", data || { threads: {} });
}

function getDefaultThreadSettings() {
    return {
        enabled: false,
        antiName: false,
        antiColor: false,
        antiEmoji: false,
        antiNickname: false,
        antiImage: false,
        antiAdmin: false,
        antiJoin: false,
        antiLeave: false,
        antiSpam: false,
        allowGroupAdmin: false,
        data: {}
    };
}

function ensureThreadSettings(antiSettings, threadID) {
    const id = String(threadID);
    if (!antiSettings.threads[id] || typeof antiSettings.threads[id] !== "object") {
        antiSettings.threads[id] = getDefaultThreadSettings();
    }

    antiSettings.threads[id] = {
        ...getDefaultThreadSettings(),
        ...antiSettings.threads[id],
        data: antiSettings.threads[id].data || {}
    };
    return antiSettings.threads[id];
}

function statusText(value) {
    return value ? "Bật" : "Tắt";
}

function isThreadAdmin(threadInfo, userID) {
    return (threadInfo?.adminIDs || []).some(admin => String(admin.id || admin) === String(userID));
}

function isBotAdmin(userID) {
    const id = String(userID || "");
    const { ADMINBOT = [], NDH = [] } = global.config || {};
    return ADMINBOT.map(String).includes(id) || NDH.map(String).includes(id);
}

function isProtectedUser(threadInfo, userID) {
    return isBotAdmin(userID) || isThreadAdmin(threadInfo, userID);
}

async function captureThreadData(api, threadID) {
    const handleRefresh = require("../../main/handle/handleRefresh");
    return await handleRefresh.getThreadData(api, threadID);
}

async function refreshAntiData(api, database, antiSettings, threadID, settings) {
    const currentData = await captureThreadData(api, threadID);
    if (currentData) {
        settings.data = { ...currentData, lastUpdate: Date.now() };
        saveAntiSettings(database, antiSettings);
    }
}

function renderStatus(settings) {
    return [
        "CÀI ĐẶT ANTI",
        `Tổng: ${statusText(settings.enabled)}`,
        "",
        `1. Đổi tên: ${statusText(settings.antiName)}`,
        `2. Đổi màu: ${statusText(settings.antiColor)}`,
        `3. Đổi emoji: ${statusText(settings.antiEmoji)}`,
        `4. Biệt danh: ${statusText(settings.antiNickname)}`,
        `5. Ảnh nhóm: ${statusText(settings.antiImage)}`,
        `6. QTV: ${statusText(settings.antiAdmin)}`,
        `7. Thêm thành viên: ${statusText(settings.antiJoin)}`,
        `8. Rời nhóm: ${statusText(settings.antiLeave)}`,
        `9. Spam: ${statusText(settings.antiSpam)} (5 tin/2s)`,
        "",
        "Reply số 1-9 để bật/tắt nhanh.",
        "Dùng: anti spam on/off"
    ].join("\n");
}

function parseOnOff(value) {
    const raw = String(value || "").toLowerCase();
    if (["on", "bat", "bật", "true", "1"].includes(raw)) return true;
    if (["off", "tat", "tắt", "false", "0"].includes(raw)) return false;
    return null;
}

function getOption(action) {
    const map = {
        name: { key: "antiName", name: "Đổi tên", capture: true },
        color: { key: "antiColor", name: "Đổi màu", capture: true },
        colour: { key: "antiColor", name: "Đổi màu", capture: true },
        emoji: { key: "antiEmoji", name: "Đổi emoji", capture: true },
        icon: { key: "antiEmoji", name: "Đổi emoji", capture: true },
        nickname: { key: "antiNickname", name: "Biệt danh", capture: true },
        nick: { key: "antiNickname", name: "Biệt danh", capture: true },
        image: { key: "antiImage", name: "Ảnh nhóm", capture: true },
        img: { key: "antiImage", name: "Ảnh nhóm", capture: true },
        avatar: { key: "antiImage", name: "Ảnh nhóm", capture: true },
        admin: { key: "antiAdmin", name: "QTV", capture: true },
        qtv: { key: "antiAdmin", name: "QTV", capture: true },
        quantrivien: { key: "antiAdmin", name: "QTV", capture: true },
        join: { key: "antiJoin", name: "Thêm thành viên", capture: true },
        add: { key: "antiJoin", name: "Thêm thành viên", capture: true },
        leave: { key: "antiLeave", name: "Rời nhóm", capture: true },
        kick: { key: "antiLeave", name: "Rời nhóm", capture: true },
        remove: { key: "antiLeave", name: "Rời nhóm", capture: true },
        spam: { key: "antiSpam", name: "Spam", capture: false }
    };
    return map[String(action || "").toLowerCase()] || null;
}

async function handleAntiSpam({ api, event, database }) {
    if (!event || !["message", "message_reply"].includes(event.type)) return;
    if (!event.threadID || !event.senderID || String(event.threadID) === String(event.senderID)) return;
    if (String(event.senderID) === String(api.getCurrentUserID?.())) return;

    const antiSettings = loadAntiSettings(database);
    const settings = ensureThreadSettings(antiSettings, event.threadID);
    if (!settings.enabled || !settings.antiSpam) return;

    const key = `${event.threadID}:${event.senderID}`;
    const now = Date.now();
    const bucket = spamBuckets.get(key) || { hits: [], kickedUntil: 0 };
    if (bucket.kickedUntil > now) return;

    bucket.hits = bucket.hits.filter(time => now - time <= SPAM_WINDOW_MS);
    bucket.hits.push(now);
    spamBuckets.set(key, bucket);
    if (bucket.hits.length < SPAM_LIMIT) return;

    bucket.hits = [];
    bucket.kickedUntil = now + SPAM_COOLDOWN_MS;
    spamBuckets.set(key, bucket);

    let threadInfo = null;
    try {
        threadInfo = await api.getThreadInfo(event.threadID);
    } catch {
        return;
    }

    if (isProtectedUser(threadInfo, event.senderID)) return;
    if (!isThreadAdmin(threadInfo, api.getCurrentUserID?.())) {
        return api.sendMessage("Phát hiện spam nhưng bot cần quyền QTV để kick.", event.threadID).catch?.(() => {});
    }

    const user = (threadInfo.userInfo || []).find(item => String(item.id) === String(event.senderID));
    const name = user?.name || event.senderName || event.senderID;
    try {
        await api.removeFromGroup(event.senderID, event.threadID);
        return api.sendMessage(`${name} spam quá nhiều nên đã bị kick.`, event.threadID);
    } catch (error) {
        return api.sendMessage(`Không kick được người spam: ${error.message || error}`, event.threadID).catch?.(() => {});
    }
}

module.exports = {
    config: {
        name: "anti",
        aliases: ["antichange", "antiedit"],
        version: "1.1.0",
        role: 1,
        credits: "Isenkai",
        info: "Quản lý anti nhóm và anti spam",
        Category: "Box",
        guides: [
            "anti status",
            "anti on/off",
            "anti all on/off",
            "anti spam on/off",
            "anti name/color/emoji/nickname/image/admin/join/leave on/off",
            "anti allowadmin on/off"
        ].join("\n"),
        cd: 5
    },

    onRun: async function ({ api, event, args, database }) {
        try {
            const { threadID, messageID, senderID } = event;
            const threadInfo = await api.getThreadInfo(threadID);
            if (!isThreadAdmin(threadInfo, senderID) && !isBotAdmin(senderID)) {
                return api.sendMessage("Bạn không có quyền dùng lệnh này.", threadID, null, messageID);
            }

            const antiSettings = loadAntiSettings(database);
            const settings = ensureThreadSettings(antiSettings, threadID);
            const action = String(args[0] || "status").toLowerCase();

            if (action === "status" || args.length === 0) {
                saveAntiSettings(database, antiSettings);
                return api.sendMessage(renderStatus(settings), threadID, (err, info) => {
                    if (err || !info?.messageID) return;
                    global.concac.onReply.push({
                        name: this.config.name,
                        messageID: info.messageID,
                        author: String(senderID),
                        threadID: String(threadID),
                        type: "toggleAnti"
                    });
                }, messageID);
            }

            const enable = parseOnOff(args[args.length - 1]);
            if (enable === null) {
                return api.sendMessage(`Dùng on/off. Ví dụ: ${global.config.PREFIX || "!"}anti spam on`, threadID, null, messageID);
            }

            if (action === "on" || action === "off") {
                settings.enabled = enable;
                saveAntiSettings(database, antiSettings);
                if (enable) await refreshAntiData(api, database, antiSettings, threadID, settings);
                return api.sendMessage(`Anti: ${statusText(enable)}`, threadID, null, messageID);
            }

            if (action === "all") {
                Object.assign(settings, {
                    enabled: enable,
                    antiName: enable,
                    antiColor: enable,
                    antiEmoji: enable,
                    antiNickname: enable,
                    antiImage: enable,
                    antiAdmin: enable,
                    antiJoin: enable,
                    antiLeave: enable,
                    antiSpam: enable
                });
                saveAntiSettings(database, antiSettings);
                if (enable) await refreshAntiData(api, database, antiSettings, threadID, settings);
                return api.sendMessage(`Tất cả anti: ${statusText(enable)}`, threadID, null, messageID);
            }

            if (["allowadmin", "allowqtv", "groupadmin", "adminallow"].includes(action)) {
                settings.allowGroupAdmin = enable;
                saveAntiSettings(database, antiSettings);
                return api.sendMessage(`Cho phép QTV nhóm thay đổi: ${statusText(enable)}`, threadID, null, messageID);
            }

            const option = getOption(action);
            if (!option) {
                return api.sendMessage("Tùy chọn không hợp lệ. Dùng: anti status", threadID, null, messageID);
            }

            settings[option.key] = enable;
            settings.enabled = true;
            saveAntiSettings(database, antiSettings);
            if (enable && option.capture) await refreshAntiData(api, database, antiSettings, threadID, settings);

            return api.sendMessage(`${option.name}: ${statusText(enable)}`, threadID, null, messageID);
        } catch (error) {
            console.error("Error in anti command:", error);
            return api.sendMessage(`Lỗi: ${error.message}`, event.threadID, null, event.messageID);
        }
    },

    onReply: async function ({ api, event, onReply, database }) {
        try {
            const { threadID, messageID, senderID, body } = event;
            if (String(senderID) !== String(onReply.author)) {
                return api.sendMessage("Bạn không có quyền thao tác.", threadID, null, messageID);
            }

            const choice = Number(String(body || "").trim());
            if (!Number.isInteger(choice) || choice < 1 || choice > 9) {
                return api.sendMessage("Reply số từ 1 đến 9.", threadID, null, messageID);
            }

            const antiSettings = loadAntiSettings(database);
            const settings = ensureThreadSettings(antiSettings, threadID);
            const antiMap = {
                1: { key: "antiName", name: "Đổi tên", capture: true },
                2: { key: "antiColor", name: "Đổi màu", capture: true },
                3: { key: "antiEmoji", name: "Đổi emoji", capture: true },
                4: { key: "antiNickname", name: "Biệt danh", capture: true },
                5: { key: "antiImage", name: "Ảnh nhóm", capture: true },
                6: { key: "antiAdmin", name: "QTV", capture: true },
                7: { key: "antiJoin", name: "Thêm thành viên", capture: true },
                8: { key: "antiLeave", name: "Rời nhóm", capture: true },
                9: { key: "antiSpam", name: "Spam", capture: false }
            };

            const selected = antiMap[choice];
            const enabled = !settings[selected.key];
            settings[selected.key] = enabled;
            settings.enabled = true;
            saveAntiSettings(database, antiSettings);
            if (enabled && selected.capture) await refreshAntiData(api, database, antiSettings, threadID, settings);

            return api.sendMessage(`${selected.name}: ${statusText(enabled)}`, threadID, null, messageID);
        } catch (error) {
            console.error("Error in anti onReply:", error);
        }
    },

    onEvent: async function ({ api, event, database }) {
        return handleAntiSpam({ api, event, database });
    }
};
