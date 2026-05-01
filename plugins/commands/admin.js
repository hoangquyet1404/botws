const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

const ADMIN_DATA = "adminData";
const TZ = "Asia/Ho_Chi_Minh";

function isNDH(userID) {
    return (global.config?.NDH || []).map(String).includes(String(userID || ""));
}

function isBotAdmin(userID) {
    const id = String(userID || "");
    return isNDH(id) || (global.config?.ADMINBOT || []).map(String).includes(id);
}

function getConfigPath() {
    return global.concac?.configPath || path.join(process.cwd(), "config.json");
}

function readConfigFile() {
    try {
        return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
    } catch {
        return {};
    }
}

function writeConfigFile(next) {
    fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 4));
}

function updateConfig(mutator) {
    const fileConfig = readConfigFile();
    const next = { ...fileConfig };
    mutator(next);
    writeConfigFile(next);
    Object.assign(global.config, next);
    return next;
}

function loadAdminData(database) {
    const data = database.get.json(ADMIN_DATA, "default", { admins: {} });
    if (!data.admins || typeof data.admins !== "object") data.admins = {};
    return data;
}

function saveAdminData(database, data) {
    database.update.json(ADMIN_DATA, "default", data || { admins: {} });
}

function formatTime(ms) {
    return ms ? moment(ms).tz(TZ).format("HH:mm:ss DD/MM/YYYY") : "Vĩnh viễn";
}

function addAdmin(database, uid, addedBy, days = null, name = "") {
    const userID = String(uid || "").trim();
    if (!/^\d{5,}$/.test(userID)) throw new Error("UID không hợp lệ.");

    const now = Date.now();
    const expiresAt = days ? now + Number(days) * 86400000 : null;
    const data = loadAdminData(database);
    data.admins[userID] = {
        ...(data.admins[userID] || {}),
        name: String(name || data.admins[userID]?.name || "").trim(),
        addedBy: String(addedBy || ""),
        addedAt: now,
        expiresAt,
        days: days || null
    };
    saveAdminData(database, data);

    updateConfig((config) => {
        const admins = new Set((config.ADMINBOT || []).map(String));
        admins.add(userID);
        config.ADMINBOT = Array.from(admins);
    });

    return data.admins[userID];
}

function removeAdmin(database, uid) {
    const userID = String(uid || "").trim();
    const data = loadAdminData(database);
    delete data.admins[userID];
    saveAdminData(database, data);

    updateConfig((config) => {
        config.ADMINBOT = (config.ADMINBOT || []).map(String).filter(id => id !== userID);
    });
}

function cleanupExpiredAdmins(database) {
    const data = loadAdminData(database);
    const now = Date.now();
    const expired = Object.entries(data.admins || {})
        .filter(([, info]) => Number(info?.expiresAt || 0) > 0 && Number(info.expiresAt) <= now)
        .map(([uid]) => uid);

    if (!expired.length) return expired;
    for (const uid of expired) delete data.admins[uid];
    saveAdminData(database, data);

    updateConfig((config) => {
        const expiredSet = new Set(expired.map(String));
        config.ADMINBOT = (config.ADMINBOT || []).map(String).filter(id => !expiredSet.has(id));
    });
    return expired;
}

function ensureAdminExpiryTimer(database) {
    if (global.__adminExpiryInterval) return;
    cleanupExpiredAdmins(database);
    global.__adminExpiryInterval = setInterval(() => {
        try {
            const expired = cleanupExpiredAdmins(database);
            if (expired.length) console.log(`[admin] Removed expired admins: ${expired.join(", ")}`);
        } catch (error) {
            console.error("[admin] expiry cleanup failed:", error.message);
        }
    }, 60 * 1000);
}

function getAdminList(database) {
    cleanupExpiredAdmins(database);
    const data = loadAdminData(database);
    const admins = (global.config?.ADMINBOT || []).map(String);
    return admins.map(uid => ({
        uid,
        info: data.admins?.[uid] || null
    }));
}

async function getThreadNameMap(api, threadID, userIDs) {
    const ids = new Set((userIDs || []).map(String).filter(Boolean));
    const names = new Map();
    if (!ids.size || typeof api.getThreadInfo !== "function") return names;
    try {
        const info = await api.getThreadInfo(threadID);
        const users = Array.isArray(info?.userInfo) ? info.userInfo : [];
        for (const user of users) {
            const id = String(user?.id || "");
            const name = String(user?.name || "").trim();
            if (ids.has(id) && name) names.set(id, name);
        }
    } catch { }
    return names;
}

function saveKnownAdminNames(database, nameMap) {
    if (!(nameMap instanceof Map) || nameMap.size === 0) return;
    const data = loadAdminData(database);
    let changed = false;
    for (const [uid, name] of nameMap.entries()) {
        if (!data.admins[uid]) data.admins[uid] = {};
        if (data.admins[uid].name !== name) {
            data.admins[uid].name = name;
            changed = true;
        }
    }
    if (changed) saveAdminData(database, data);
}

function getTargetFromAdd(event, args) {
    const reply = event.messageReply || {};
    const replyID = reply.senderID || reply.author || reply.userID;
    if (replyID) {
        return {
            uid: String(replyID),
            days: args[1] && /^\d+$/.test(String(args[1])) ? Number(args[1]) : null,
            name: String(reply.senderName || reply.name || reply.authorName || "").trim()
        };
    }
    return {
        uid: String(args[1] || "").trim(),
        days: args[2] && /^\d+$/.test(String(args[2])) ? Number(args[2]) : null,
        name: ""
    };
}

function setQtvOnly(database, threadID, enabled) {
    const data = database.get.json("dataAdbox", "default", { adminbox: {} });
    if (!data.adminbox || typeof data.adminbox !== "object") data.adminbox = {};
    data.adminbox[String(threadID)] = Boolean(enabled);
    database.update.json("dataAdbox", "default", data);
}

function toggleGlobalFlag(flag, enabled) {
    updateConfig((config) => {
        config[flag] = Boolean(enabled);
    });
}

function parseOnOff(value, current = false) {
    const raw = String(value || "").toLowerCase();
    if (["on", "bat", "bật", "true", "1"].includes(raw)) return true;
    if (["off", "tat", "tắt", "false", "0"].includes(raw)) return false;
    return !current;
}

function safeCommandFileName(name) {
    const file = String(name || "").trim();
    if (!/^[\w.-]+\.js$/i.test(file)) return "";
    if (file.includes("..") || file.includes("/") || file.includes("\\")) return "";
    return file;
}

function commandFilePath(name) {
    const safe = safeCommandFileName(name);
    if (!safe) return "";
    return path.join(global.concac?.commandsPath || path.join(process.cwd(), "plugins/commands"), safe);
}

module.exports = {
    config: {
        name: "admin",
        aliases: ["ad"],
        version: "1.0.0",
        role: 1,
        author: "HoangDev",
        info: "Quản lý admin bot và chế độ dùng bot",
        Category: "Admin",
        guides: "admin list | admin add <uid> [days] | reply admin add [days] | admin qtv only on/off | admin only on/off | admin ndh on/off | admin echo <text> | admin create <file.js> | admin delete <file.js>",
        cd: 3,
        hasPrefix: true
    },

    onLoad: async function ({ database }) {
        ensureAdminExpiryTimer(database);
    },

    onRun: async function ({ api, event, args, database }) {
        ensureAdminExpiryTimer(database);
        const { threadID, messageID, senderID } = event;
        const action = String(args[0] || "").toLowerCase();

        if (!action) {
            return api.sendMessage(this.config.guides, threadID, null, messageID);
        }

        if (action === "list") {
            if (!isNDH(senderID)) return api.sendMessage("Chỉ NDH được xem danh sách admin.", threadID, null, messageID);
            const list = getAdminList(database);
            if (!list.length) return api.sendMessage("Chưa có admin bot nào.", threadID, null, messageID);
            const nameMap = await getThreadNameMap(api, threadID, list.map(item => item.uid));
            saveKnownAdminNames(database, nameMap);

            const body = [
                "[ ADMIN BOT LIST ]",
                ...list.map((item, index) => {
                    const exp = item.info?.expiresAt ? `Hết hạn: ${formatTime(item.info.expiresAt)}` : "Hết hạn: Vĩnh viễn";
                    const name = nameMap.get(item.uid) || item.info?.name || item.uid;
                    return `${index + 1}. ${name}\n- UID: ${item.uid}\n- ${exp}`;
                }),
                "",
                "Reply STT để xóa admin."
            ].join("\n");

            return api.sendMessage(body, threadID, (err, info) => {
                if (err || !info?.messageID) return;
                global.concac.onReply.push({
                    name: this.config.name,
                    type: "adminListDelete",
                    messageID: info.messageID,
                    threadID: String(threadID),
                    author: String(senderID),
                    list
                });
            }, messageID);
        }

        if (action === "add") {
            if (!isNDH(senderID)) return api.sendMessage("Chỉ NDH được thêm admin bot.", threadID, null, messageID);
            const target = getTargetFromAdd(event, args);
            if (!target.uid) return api.sendMessage("Dùng: admin add <uid> [ngày] hoặc reply người cần thêm: admin add [ngày]", threadID, null, messageID);
            if (!target.name) {
                const nameMap = await getThreadNameMap(api, threadID, [target.uid]);
                target.name = nameMap.get(target.uid) || "";
            }
            const info = addAdmin(database, target.uid, senderID, target.days, target.name);
            return api.sendMessage(
                `Đã thêm admin: ${info.name || target.uid}\nUID: ${target.uid}\nHết hạn: ${formatTime(info.expiresAt)}`,
                threadID,
                null,
                messageID
            );
        }

        if (action === "qtv" && String(args[1] || "").toLowerCase() === "only") {
            try {
                const threadInfo = await api.getThreadInfo(threadID);
                const listQTV = threadInfo.adminIDs.map(i => String(i.id));
                const isQTV = listQTV.includes(String(senderID));
                if (!isBotAdmin(senderID) && !isQTV) {
                    return api.sendMessage("Chỉ QTV nhóm hoặc Admin Bot mới có quyền chỉnh chế độ này.", threadID, null, messageID);
                }

                const current = Boolean(database.get.json("dataAdbox", "default", { adminbox: {} }).adminbox?.[threadID]);
                const enabled = parseOnOff(args[2], current);
                
                setQtvOnly(database, threadID, enabled);
                return api.sendMessage(`[ QTV ONLY ] - Đã ${enabled ? "bật" : "tắt"} chế độ chỉ QTV nhóm mới có thể dùng bot.`, threadID, null, messageID);
            } catch (e) {
                return api.sendMessage("Không thể lấy danh sách QTV nhóm. Vui lòng thử lại sau.", threadID, null, messageID);
            }
        }

        if (action === "only") {
            if (!isBotAdmin(senderID)) return api.sendMessage("Chỉ Admin Bot/NDH được chỉnh chế độ này.", threadID, null, messageID);
            const enabled = parseOnOff(args[1], Boolean(global.config.adminOnly));
            toggleGlobalFlag("adminOnly", enabled);
            if (enabled) toggleGlobalFlag("ndhOnly", false);
            return api.sendMessage(`Đã ${enabled ? "bật" : "tắt"} chế độ chỉ Admin Bot dùng bot.`, threadID, null, messageID);
        }

        if (action === "ndh") {
            if (!isNDH(senderID)) return api.sendMessage("Chỉ NDH được bật/tắt NDH only.", threadID, null, messageID);
            const enabled = parseOnOff(args[1], Boolean(global.config.ndhOnly));
            toggleGlobalFlag("ndhOnly", enabled);
            if (enabled) toggleGlobalFlag("adminOnly", false);
            return api.sendMessage(`Đã ${enabled ? "bật" : "tắt"} chế độ chỉ NDH dùng bot.`, threadID, null, messageID);
        }

        if (action === "echo") {
            if (!isNDH(senderID)) return api.sendMessage("Chỉ NDH được dùng echo.", threadID, null, messageID);
            const text = args.slice(1).join(" ");
            if (!text) return api.sendMessage("Dùng: admin echo <nội dung>", threadID, null, messageID);
            return api.sendMessage(text, threadID, null, messageID);
        }

        if (action === "create") {
            if (!isNDH(senderID)) return api.sendMessage("Chỉ NDH được tạo file lệnh.", threadID, null, messageID);
            const filePath = commandFilePath(args[1]);
            if (!filePath) return api.sendMessage("Tên file không hợp lệ. Ví dụ: admin create abc.js", threadID, null, messageID);
            if (fs.existsSync(filePath)) return api.sendMessage("File đã tồn tại.", threadID, null, messageID);
            const commandName = path.basename(filePath, ".js");
            const template = `module.exports = {
    config: {
        name: "${commandName}",
        aliases: [],
        version: "1.0.0",
        role: 0,
        author: "",
        info: "",
        Category: "Tiện ích",
        guides: "${commandName}",
        cd: 3,
        hasPrefix: true
    },
    onRun: async function ({ api, event }) {
        return api.sendMessage("Lệnh ${commandName} chưa có nội dung.", event.threadID, null, event.messageID);
    }
};
`;
            fs.writeFileSync(filePath, template);
            return api.sendMessage(`Đã tạo file: ${path.basename(filePath)}`, threadID, null, messageID);
        }

        if (action === "delete") {
            if (!isNDH(senderID)) return api.sendMessage("Chỉ NDH được xóa file lệnh.", threadID, null, messageID);
            const filePath = commandFilePath(args[1]);
            if (!filePath) return api.sendMessage("Tên file không hợp lệ. Ví dụ: admin delete abc.js", threadID, null, messageID);
            if (!fs.existsSync(filePath)) return api.sendMessage("File không tồn tại.", threadID, null, messageID);
            fs.unlinkSync(filePath);
            return api.sendMessage(`Đã xóa file: ${path.basename(filePath)}`, threadID, null, messageID);
        }

        return api.sendMessage(this.config.guides, threadID, null, messageID);
    },

    onReply: async function ({ api, event, onReply, cleanup, database }) {
        const { threadID, messageID, senderID, body } = event;
        if (!onReply || onReply.type !== "adminListDelete") return;
        if (!isNDH(senderID)) return api.sendMessage("Chỉ NDH được xóa admin.", threadID, null, messageID);
        if (String(onReply.threadID) !== String(threadID)) return;

        const indexes = String(body || "")
            .split(/\s+/)
            .map(item => Number(item))
            .filter(num => Number.isInteger(num) && num >= 1 && num <= onReply.list.length);
        if (!indexes.length) return api.sendMessage("Reply STT admin cần xóa.", threadID, null, messageID);

        const removed = [];
        for (const index of Array.from(new Set(indexes))) {
            const item = onReply.list[index - 1];
            if (!item?.uid) continue;
            removeAdmin(database, item.uid);
            removed.push(item.uid);
        }

        cleanup?.();
        return api.sendMessage(`Đã xóa admin:\n${removed.join("\n")}`, threadID, null, messageID);
    }
};
