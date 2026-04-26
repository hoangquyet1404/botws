"use strict";

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { downloadMediaBuffer } = require("../../main/utils/mediaDownload");

const CATEGORY = "shortcutData";
const CACHE_DIR = path.join(__dirname, "cache", "shortcut");
const EFFECTS = Object.freeze({
    "1": { name: "LOVE", label: "Love" },
    "2": { name: "GIFTWRAP", label: "Giftwrap" },
    "3": { name: "CELEBRATION", label: "Celebration" },
    "4": { name: "FIRE", label: "Fire" }
});

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function send(api, message, threadID, replyToMessageID) {
    return new Promise((resolve, reject) => {
        api.sendMessage(message, threadID, (error, info) => {
            if (error) return reject(error);
            resolve(info || null);
        }, replyToMessageID);
    });
}

function safeSend(api, message, threadID, replyToMessageID) {
    return send(api, message, threadID, replyToMessageID).catch(error => ({ error }));
}

function pushReply(state) {
    if (!global.concac.onReply) global.concac.onReply = [];
    global.concac.onReply.push({ name: "shortcut", ...state });
}

function getThreadPrefix(threadID, database) {
    if (global.rentScheduler && typeof global.rentScheduler.getPrefix === "function") {
        return global.rentScheduler.getPrefix(threadID) || global.config.PREFIX || "!";
    }
    return database.get.threadSetting("prefixData", threadID, null)?.prefix || global.config.PREFIX || "!";
}

function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeTrigger(value) {
    return normalizeText(value).toLowerCase();
}

function createID() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getStore(database, threadID) {
    const data = database.get.threadSetting(CATEGORY, threadID, null);
    if (data && Array.isArray(data.shortcuts)) return data;
    return { shortcuts: [] };
}

function saveStore(database, threadID, data) {
    return database.update.threadSetting(CATEGORY, threadID, {
        shortcuts: Array.isArray(data.shortcuts) ? data.shortcuts : [],
        updatedAt: Date.now()
    });
}

function upsertShortcut(database, threadID, shortcut) {
    const data = getStore(database, threadID);
    const removed = [];
    const shortcuts = data.shortcuts.filter(item => {
        const shouldRemove = shortcut.type === "tag"
            ? item.type === "tag"
            : item.type === "keyword" && normalizeTrigger(item.trigger) === normalizeTrigger(shortcut.trigger);
        if (shouldRemove) removed.push(item);
        return !shouldRemove;
    });

    shortcuts.push({
        ...shortcut,
        id: shortcut.id || createID(),
        createdAt: shortcut.createdAt || Date.now(),
        updatedAt: Date.now()
    });
    data.shortcuts = shortcuts;
    saveStore(database, threadID, data);
    removed.forEach(cleanupShortcutFiles);
    return shortcuts[shortcuts.length - 1];
}

function deleteShortcutByIndex(database, threadID, index) {
    const data = getStore(database, threadID);
    const list = data.shortcuts;
    const target = list[index];
    if (!target) return null;
    data.shortcuts = list.filter((_, itemIndex) => itemIndex !== index);
    saveStore(database, threadID, data);
    cleanupShortcutFiles(target);
    return target;
}

function cleanupShortcutFiles(shortcut) {
    for (const media of shortcut?.media || []) {
        if (!media?.path) continue;
        try {
            if (fs.existsSync(media.path)) fs.unlinkSync(media.path);
        } catch {}
    }
}

function hasBotMention(api, event) {
    const botID = String(api.getCurrentUserID?.() || "");
    if (!botID) return false;
    const mentions = event?.mentions && typeof event.mentions === "object" ? event.mentions : {};
    return Object.keys(mentions).some(id => String(id) === botID);
}

function getAttachmentUrl(attachment) {
    if (!attachment || typeof attachment !== "object") return "";
    return attachment.url
        || attachment.largePreviewUrl
        || attachment.previewUrl
        || attachment.facebookUrl
        || attachment.fallbackUrl
        || attachment.playableUrl
        || attachment.thumbnailUrl
        || "";
}

function inferMediaType(attachment, contentType = "") {
    const type = String(attachment?.type || attachment?.mediaType || "").toLowerCase();
    const mime = String(contentType || attachment?.contentType || attachment?.mimeType || "").toLowerCase();
    if (type === "photo" || type === "image" || mime.startsWith("image/")) return "image";
    if (type === "animated_image" || type === "gif" || mime.includes("gif")) return "gif";
    if (type === "video" || mime.startsWith("video/")) return "video";
    if (type === "audio" || mime.startsWith("audio/")) return "audio";
    return "file";
}

function inferExt(mediaType, contentType = "", url = "") {
    const pathname = (() => {
        try {
            return new URL(url).pathname;
        } catch {
            return url || "";
        }
    })();
    const urlExt = path.extname(pathname).toLowerCase().replace(/^\./, "");
    if (urlExt && /^[a-z0-9]{2,5}$/i.test(urlExt)) return urlExt;

    const mime = String(contentType || "").toLowerCase();
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("gif")) return "gif";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    if (mime.includes("mp4")) return "mp4";
    if (mime.includes("quicktime")) return "mov";
    if (mime.includes("mpeg")) return mediaType === "audio" ? "mp3" : "mpeg";
    if (mime.includes("ogg")) return "ogg";
    if (mediaType === "image") return "jpg";
    if (mediaType === "gif") return "gif";
    if (mediaType === "video") return "mp4";
    if (mediaType === "audio") return "mp3";
    return "bin";
}

function sanitizePathPart(value) {
    return String(value || "")
        .replace(/[^\w.-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80) || "file";
}

function execFilePromise(file, args, timeout = 120000) {
    return new Promise((resolve, reject) => {
        execFile(file, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
            }
            resolve({ stdout, stderr });
        });
    });
}

async function compressWithFfmpeg(inputPath, mediaType) {
    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, path.extname(inputPath));
    let outputPath;
    let args;

    if (mediaType === "image") {
        outputPath = path.join(dir, `${base}_min.jpg`);
        args = ["-y", "-i", inputPath, "-vf", "scale=w='min(1280,iw)':h=-2", "-frames:v", "1", "-q:v", "5", outputPath];
    } else if (mediaType === "video") {
        outputPath = path.join(dir, `${base}_min.mp4`);
        args = ["-y", "-i", inputPath, "-vf", "scale=w='min(1280,iw)':h=-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-c:a", "aac", "-b:a", "96k", outputPath];
    } else if (mediaType === "audio") {
        outputPath = path.join(dir, `${base}_min.mp3`);
        args = ["-y", "-i", inputPath, "-b:a", "96k", outputPath];
    } else {
        return inputPath;
    }

    try {
        await execFilePromise("ffmpeg", args);
        if (!fs.existsSync(outputPath)) return inputPath;
        const originalSize = fs.statSync(inputPath).size;
        const compressedSize = fs.statSync(outputPath).size;
        if (compressedSize > 0 && compressedSize < originalSize) {
            try { fs.unlinkSync(inputPath); } catch {}
            return outputPath;
        }
        try { fs.unlinkSync(outputPath); } catch {}
        return inputPath;
    } catch {
        try {
            if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch {}
        return inputPath;
    }
}

async function saveAttachment(threadID, attachment) {
    const url = getAttachmentUrl(attachment);
    const threadDir = path.join(CACHE_DIR, sanitizePathPart(threadID));
    ensureDir(threadDir);

    let buffer;
    let contentType = attachment?.contentType || attachment?.mimeType || "";
    if (Buffer.isBuffer(attachment?.buffer)) {
        buffer = attachment.buffer;
    } else if (attachment?.path && fs.existsSync(attachment.path)) {
        buffer = fs.readFileSync(attachment.path);
    } else if (url) {
        const downloaded = await downloadMediaBuffer(url);
        buffer = downloaded.buffer;
        contentType = downloaded.contentType || contentType;
    } else {
        throw new Error("Không tìm thấy URL media để lưu.");
    }

    const mediaType = inferMediaType(attachment, contentType);
    const ext = inferExt(mediaType, contentType, url);
    const fileName = `shortcut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const filePath = path.join(threadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const finalPath = await compressWithFfmpeg(filePath, mediaType);
    const finalName = path.basename(finalPath);
    const finalSize = fs.statSync(finalPath).size;
    const finalType = finalPath.endsWith(".mp4") ? "video"
        : finalPath.endsWith(".mp3") ? "audio"
            : mediaType;

    return {
        path: finalPath,
        filename: finalName,
        mediaType: finalType,
        contentType,
        size: finalSize
    };
}

function getCurrentAttachments(event) {
    return Array.isArray(event?.attachments) ? event.attachments.filter(Boolean) : [];
}

function parseEffect(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw || raw === "s" || raw === "skip" || raw === "bo" || raw === "bỏ") return null;
    return EFFECTS[raw] || null;
}

function buildListMessage(shortcuts) {
    if (!shortcuts.length) return "Nhóm này chưa có shortcut nào.";
    const lines = ["[ SHORTCUT LIST ]", ""];
    shortcuts.forEach((item, index) => {
        const label = item.type === "tag" ? "Tag bot" : `Text: ${item.trigger}`;
        const media = item.media?.length ? ` | media: ${item.media.length}` : "";
        const effect = item.effect ? ` | effect: ${item.effect}` : "";
        const preview = normalizeText(item.responseText).slice(0, 80);
        lines.push(`${index + 1}. ${label}${media}${effect}`);
        lines.push(`   -> ${preview || "(không text)"}`);
    });
    lines.push("", `Reply số thứ tự để xóa.`);
    return lines.join("\n");
}

function buildSavedMessage(shortcut) {
    const target = shortcut.type === "tag" ? "khi bot được tag" : `khi chat: ${shortcut.trigger}`;
    return [
        "Đã lưu shortcut.",
        `Điều kiện: ${target}`,
        `Media: ${shortcut.media?.length ? "có" : "không"}`,
        `Effect: ${shortcut.effect || "không"}`
    ].join("\n");
}

function createStreamAttachment(mediaList) {
    const streams = [];
    for (const media of mediaList || []) {
        if (!media?.path || !fs.existsSync(media.path)) continue;
        const stream = fs.createReadStream(media.path);
        stream.filename = media.filename || path.basename(media.path);
        stream.name = stream.filename;
        stream.contentType = media.contentType;
        stream.mediaType = media.mediaType;
        streams.push(stream);
    }
    if (!streams.length) return null;
    return streams.length === 1 ? streams[0] : streams;
}

async function sendShortcutResponse(api, event, shortcut) {
    const media = shortcut.media || [];
    const attachment = createStreamAttachment(media);
    const body = shortcut.responseText || "";
    const effect = event.isE2EE || /^AVATAR_/i.test(String(shortcut.effect || "")) ? null : shortcut.effect;

    const message = { body };
    if (effect) message.effect = effect;
    if (attachment) message.attachment = attachment;
    return safeSend(api, message, event.threadID, event.messageID);
}

function findKeywordShortcut(shortcuts, body) {
    const normalizedBody = normalizeTrigger(body);
    if (!normalizedBody) return null;
    return shortcuts.find(item => item.type === "keyword" && normalizeTrigger(item.trigger) === normalizedBody) || null;
}

function startWizard(api, event, draft) {
    return api.sendMessage("Nhập text phản hồi cho shortcut này.", event.threadID, (error, info) => {
        if (error || !info?.messageID) return;
        pushReply({
            type: "responseText",
            author: String(event.senderID),
            threadID: String(event.threadID),
            messageID: info.messageID,
            draft
        });
    }, event.messageID);
}

module.exports = {
    config: {
        name: "shortcut",
        aliases: ["sc"],
        version: "1.0.0",
        role: 1,
        author: "",
        info: "Tạo phản hồi tự động theo tag bot hoặc từ khóa",
        Category: "Box",
        guides: [
            "shortcut tag",
            "shortcut + <từ khóa>",
            "shortcut <từ khóa>",
            "shortcut list"
        ].join("\n"),
        cd: 3,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args, database }) {
        const { threadID, messageID, senderID } = event;
        const action = String(args[0] || "").toLowerCase();

        if (action === "list" || action === "ls") {
            const shortcuts = getStore(database, threadID).shortcuts;
            return api.sendMessage(buildListMessage(shortcuts), threadID, (error, info) => {
                if (error || !info?.messageID || !shortcuts.length) return;
                pushReply({
                    type: "deleteShortcut",
                    author: String(senderID),
                    threadID: String(threadID),
                    messageID: info.messageID
                });
            }, messageID);
        }

        if (action === "tag") {
            return startWizard(api, event, {
                type: "tag",
                createdBy: String(senderID)
            });
        }

        const trigger = normalizeText(args[0] === "+" ? args.slice(1).join(" ") : args.join(" "));
        if (!trigger) {
            return api.sendMessage(
                [
                    "Cách dùng:",
                    "shortcut tag - tạo phản hồi khi bot được tag",
                    "shortcut + <từ khóa> - tạo phản hồi khi chat đúng từ khóa",
                    "shortcut list - xem danh sách, reply số để xóa"
                ].join("\n"),
                threadID,
                null,
                messageID
            );
        }

        return startWizard(api, event, {
            type: "keyword",
            trigger,
            createdBy: String(senderID)
        });
    },

    onReply: async function ({ api, event, onReply, cleanup, database }) {
        const { threadID, messageID, senderID, body } = event;
        if (String(senderID) !== String(onReply.author)) {
            return api.sendMessage("Tin này không phải lượt thiết lập của bạn.", threadID, null, messageID);
        }

        if (onReply.type === "deleteShortcut") {
            const indexes = (String(body || "").match(/\d+/g) || [])
                .map(item => Number.parseInt(item, 10) - 1)
                .filter(index => Number.isInteger(index) && index >= 0)
                .sort((a, b) => b - a);

            if (!indexes.length) return api.sendMessage("Reply số thứ tự cần xóa.", threadID, null, messageID);

            const deleted = [];
            for (const index of indexes) {
                const item = deleteShortcutByIndex(database, threadID, index);
                if (item) deleted.push(item);
            }

            cleanup?.();
            return api.sendMessage(
                deleted.length ? `Đã xóa ${deleted.length} shortcut.` : "Không tìm thấy shortcut tương ứng.",
                threadID,
                null,
                messageID
            );
        }

        if (onReply.type === "responseText") {
            const responseText = normalizeText(body);
            if (!responseText) {
                return api.sendMessage("Text phản hồi không được trống.", threadID, null, messageID);
            }

            cleanup?.();
            return api.sendMessage("Reply kèm ảnh/video/audio/gif để lưu media, hoặc nhập s để bỏ qua.", threadID, (error, info) => {
                if (error || !info?.messageID) return;
                pushReply({
                    type: "media",
                    author: String(senderID),
                    threadID: String(threadID),
                    messageID: info.messageID,
                    draft: {
                        ...onReply.draft,
                        responseText
                    }
                });
            }, messageID);
        }

        if (onReply.type === "media") {
            const raw = String(body || "").trim().toLowerCase();
            const attachments = getCurrentAttachments(event);
            const media = [];

            if (attachments.length) {
                const saved = await saveAttachment(threadID, attachments[0]);
                media.push(saved);
            } else if (/^https?:\/\//i.test(raw)) {
                const saved = await saveAttachment(threadID, { url: raw });
                media.push(saved);
            } else if (!["s", "skip", "bo", "bỏ"].includes(raw)) {
                return api.sendMessage("Hãy reply kèm media, gửi URL media, hoặc nhập s để bỏ qua.", threadID, null, messageID);
            }

            cleanup?.();
            return api.sendMessage(
                [
                    "Có dùng effect không?",
                    "1. Love",
                    "2. Giftwrap",
                    "3. Celebration",
                    "4. Fire",
                    "s. Bỏ qua"
                ].join("\n"),
                threadID,
                (error, info) => {
                    if (error || !info?.messageID) return;
                    pushReply({
                        type: "effect",
                        author: String(senderID),
                        threadID: String(threadID),
                        messageID: info.messageID,
                        draft: {
                            ...onReply.draft,
                            media
                        }
                    });
                },
                messageID
            );
        }

        if (onReply.type === "effect") {
            const effect = parseEffect(body);
            const raw = String(body || "").trim().toLowerCase();
            if (!effect && !["s", "skip", "bo", "bỏ", ""].includes(raw)) {
                return api.sendMessage("Reply 1, 2, 3, 4 hoặc s để bỏ qua.", threadID, null, messageID);
            }

            const shortcut = upsertShortcut(database, threadID, {
                ...onReply.draft,
                effect: effect?.name || null
            });
            cleanup?.();
            return api.sendMessage(buildSavedMessage(shortcut), threadID, null, messageID);
        }
    },

    onEvent: async function ({ api, event, database }) {
        if (!event || !["message", "message_reply"].includes(event.type)) return;
        if (!event.body && !event.mentions) return;
        if (String(event.senderID) === String(api.getCurrentUserID?.())) return;

        const body = String(event.body || "").trim();
        const prefix = getThreadPrefix(String(event.threadID || ""), database);
        if (body.startsWith(prefix)) return;

        const shortcuts = getStore(database, event.threadID).shortcuts;
        if (!shortcuts.length) return;

        const tagShortcut = hasBotMention(api, event)
            ? shortcuts.find(item => item.type === "tag")
            : null;
        const keywordShortcut = tagShortcut ? null : findKeywordShortcut(shortcuts, body);
        const shortcut = tagShortcut || keywordShortcut;
        if (!shortcut) return;

        return sendShortcutResponse(api, event, shortcut);
    }
};
