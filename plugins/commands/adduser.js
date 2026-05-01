const axios = require("axios");

function send(api, message, threadID, replyTo) {
    return api.sendMessage(message, threadID, null, replyTo);
}

function isThreadAdmin(threadInfo, userID) {
    return (threadInfo?.adminIDs || []).some(admin => String(admin.id || admin) === String(userID));
}

function getMentionIDs(mentions) {
    if (!mentions || typeof mentions !== "object") return [];
    return Object.keys(mentions).map(String).filter(Boolean);
}

function normalizeInput(input) {
    return String(input || "").trim();
}

async function getUserIDFromLink(link) {
    const normalizedLink = normalizeInput(link).startsWith("http")
        ? normalizeInput(link)
        : `https://${normalizeInput(link)}`;

    const response = await axios.post(
        "https://id.traodoisub.com/api.php",
        `link=${encodeURIComponent(normalizedLink)}`,
        {
            headers: {
                accept: "application/json, text/javascript, */*; q=0.01",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                origin: "https://id.traodoisub.com",
                referer: "https://id.traodoisub.com/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                "x-requested-with": "XMLHttpRequest"
            },
            timeout: 10000,
            validateStatus: () => true
        }
    );

    const data = response.data || {};
    if (response.status < 400 && data.success === 200 && data.id) return String(data.id);
    throw new Error(data.error || data.code || `HTTP ${response.status}`);
}

function extractIDFromLinkManual(input) {
    const text = normalizeInput(input);
    const idMatch = text.match(/[?&]id=(\d+)/);
    if (idMatch?.[1]) return idMatch[1];

    const numericMatch = text.match(/(?:facebook\.com\/|fb\.com\/)(\d{5,})(?:[/?#]|$)/i);
    if (numericMatch?.[1]) return numericMatch[1];

    return "";
}

async function extractUserID(input) {
    const text = normalizeInput(input);
    if (!text) return "";
    if (/^\d{5,}$/.test(text)) return text;

    const manualID = extractIDFromLinkManual(text);
    if (manualID) return manualID;

    if (/facebook\.com|fb\.com/i.test(text)) {
        try {
            return await getUserIDFromLink(text);
        } catch {
            return "";
        }
    }

    return "";
}

function getTargetInputs(event, args) {
    const mentionIDs = getMentionIDs(event.mentions);
    if (mentionIDs.length) return mentionIDs;

    if (event.messageReply?.senderID) return [String(event.messageReply.senderID)];

    const body = normalizeInput(args.join(" "));
    if (body) return [body];

    const replyBody = normalizeInput(event.messageReply?.body);
    return replyBody ? [replyBody] : [];
}

function formatAddError(error) {
    const message = String(error?.message || error || "");
    const normalized = message.toLowerCase();
    if (normalized.includes("cannot add users") || normalized.includes("not authorized")) {
        return "Không thể thêm người này vào nhóm. Có thể do quyền riêng tư hoặc nhóm chặn thêm thành viên.";
    }
    if (normalized.includes("not found")) return "Không tìm thấy người dùng.";
    if (normalized.includes("spam")) return "Thao tác bị Facebook chặn spam, thử lại sau.";
    return message || "Không rõ lỗi.";
}

module.exports = {
    config: {
        name: "adduser",
        aliases: ["add", "them", "invite"],
        version: "1.1.0",
        role: 1,
        author: "",
        info: "Thêm người dùng vào nhóm bằng UID, link Facebook, tag hoặc reply",
        Category: "Box",
        guides: [
            "adduser <uid/link>",
            "adduser @tag",
            "reply người cần thêm rồi dùng adduser",
            "reply tin có UID/link rồi dùng adduser"
        ].join("\n"),
        cd: 5,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args }) {
        const { threadID, messageID, senderID } = event;

        try {
            const threadInfo = await api.getThreadInfo(threadID);
            const botID = String(api.getCurrentUserID?.() || "");

            if (!isThreadAdmin(threadInfo, senderID)) {
                return send(api, "Bạn không có quyền thêm thành viên.", threadID, messageID);
            }

            if (!isThreadAdmin(threadInfo, botID)) {
                return send(api, "Bot cần quyền QTV để thêm thành viên.", threadID, messageID);
            }

            const inputs = getTargetInputs(event, args);
            if (!inputs.length) {
                return send(api, this.config.guides, threadID, messageID);
            }

            const participantSet = new Set((threadInfo.participantIDs || []).map(String));
            const targets = [];
            for (const input of inputs) {
                const userID = await extractUserID(input);
                if (userID && !targets.includes(userID)) targets.push(userID);
            }

            if (!targets.length) {
                return send(api, "Không lấy được UID. Hãy dùng UID, tag, link profile có id hoặc reply người cần thêm.", threadID, messageID);
            }

            const results = [];
            for (const userID of targets) {
                if (participantSet.has(String(userID))) {
                    results.push(`- ${userID}: đã có trong nhóm`);
                    continue;
                }

                try {
                    await api.addToGroup(String(userID), threadID);
                    results.push(`- ${userID}: đã thêm`);
                } catch (error) {
                    results.push(`- ${userID}: ${formatAddError(error)}`);
                }
            }

            return send(api, `Kết quả thêm thành viên:\n${results.join("\n")}`, threadID, messageID);
        } catch (error) {
            console.error("[adduser] Error:", error);
            return send(api, `Lỗi adduser: ${formatAddError(error)}`, threadID, messageID);
        }
    }
};
