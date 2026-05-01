"use strict";

const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.cwd();
const PAGE_SIZE = 20;
const MAX_PREVIEW_BYTES = 12000;
const TEXT_EXTENSIONS = new Set([
    ".js", ".json", ".txt", ".md", ".env", ".yml", ".yaml", ".html", ".css",
    ".xml", ".csv", ".log", ".ini", ".conf", ".config", ".bat", ".ps1", ".sh"
]);

function isMainAdmin(userID) {
    return (global.config?.NDH || []).map(String).includes(String(userID));
}

function safeResolve(inputPath = "") {
    const raw = String(inputPath || "").trim();
    const target = path.resolve(ROOT_DIR, raw || ".");
    const rootWithSep = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : ROOT_DIR + path.sep;
    if (target !== ROOT_DIR && !target.startsWith(rootWithSep)) return null;
    return target;
}

function resolveFromCurrent(dirPath, inputPath = "") {
    const raw = String(inputPath || "").trim();
    if (!raw) return null;
    const base = raw.startsWith(".") ? dirPath : ROOT_DIR;
    const target = path.resolve(base, raw);
    const rootWithSep = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : ROOT_DIR + path.sep;
    if (target !== ROOT_DIR && !target.startsWith(rootWithSep)) return null;
    return target;
}

function relativePath(absPath) {
    const rel = path.relative(ROOT_DIR, absPath);
    return rel || ".";
}

function formatSize(bytes) {
    if (!Number.isFinite(bytes)) return "-";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function getEntries(dirPath) {
    return fs.readdirSync(dirPath, { withFileTypes: true })
        .map(entry => {
            const absPath = path.join(dirPath, entry.name);
            const stat = fs.statSync(absPath);
            const isDirectory = entry.isDirectory();
            return {
                name: entry.name,
                absPath,
                isDirectory,
                size: isDirectory ? getDirectorySize(absPath) : stat.size,
                ext: isDirectory ? "" : (path.extname(entry.name) || "[không đuôi]")
            };
        })
        .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
}

function getDirectorySize(dirPath) {
    let total = 0;
    try {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            const absPath = path.join(dirPath, entry.name);
            const stat = fs.statSync(absPath);
            if (entry.isDirectory()) total += getDirectorySize(absPath);
            else total += stat.size;
        }
    } catch (_) {}
    return total;
}

function buildList(dirPath, page = 0) {
    const entries = getEntries(dirPath);
    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const pageItems = entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
    const pageSize = pageItems.reduce((sum, item) => sum + (item.size || 0), 0);
    const lines = pageItems.map((item, index) => {
        const icon = item.isDirectory ? "📁" : "📄";
        return `${index + 1}. ${icon} ${item.name} (${formatSize(item.size)})`;
    });

    return {
        entries,
        pageItems,
        safePage,
        totalPages,
        body: [
            "[ FILE PROJECT BOT ]",
            `Thư mục: ${relativePath(dirPath)}`,
            `Trang ${safePage + 1}/${totalPages} | Tổng: ${entries.length}`,
            "",
            lines.join("\n") || "Thư mục trống.",
            "",
            `Tổng dung lượng trang: ${formatSize(pageSize)}`,
            "Reply: open|send|delete + stt"
        ].join("\n")
    };
}

function openTarget(api, event, targetPath, messageID) {
    if (!targetPath || !fs.existsSync(targetPath)) {
        return api.sendMessage("Đường dẫn không hợp lệ hoặc file không còn tồn tại.", event.threadID, messageID);
    }
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) return sendDirectory(api, event, targetPath, 0, messageID);
    return api.sendMessage(previewFile(targetPath), event.threadID, messageID);
}

function isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (TEXT_EXTENSIONS.has(ext)) return true;
    if (!ext && path.basename(filePath).startsWith(".")) return true;
    return false;
}

function previewFile(filePath) {
    const stat = fs.statSync(filePath);
    if (!isTextFile(filePath)) {
        return [
            "[ FILE INFO ]",
            `Tên: ${path.basename(filePath)}`,
            `Đuôi: ${path.extname(filePath) || "[không đuôi]"}`,
            `Kích thước: ${formatSize(stat.size)}`,
            "",
            "File này không xem preview dạng text. Reply send <stt> để gửi file."
        ].join("\n");
    }

    const buffer = fs.readFileSync(filePath);
    const sliced = buffer.subarray(0, MAX_PREVIEW_BYTES).toString("utf8");
    const more = buffer.length > MAX_PREVIEW_BYTES ? "\n\n... Đã rút gọn preview, dùng send để gửi đầy đủ." : "";
    return [
        `[ FILE: ${path.basename(filePath)} ]`,
        `Đuôi: ${path.extname(filePath) || "[không đuôi]"} | Size: ${formatSize(stat.size)}`,
        "```",
        sliced.replace(/```/g, "`\u200b``"),
        `\`\`\`${more}`
    ].join("\n");
}

function sendDirectory(api, event, dirPath, page = 0, messageID = event.messageID) {
    const view = buildList(dirPath, page);
    return api.sendMessage(view.body, event.threadID, (err, info) => {
        if (!err && info?.messageID) {
            global.concac.onReply.push({
                name: "file",
                messageID: info.messageID,
                author: event.senderID,
                threadID: event.threadID,
                dirPath,
                page: view.safePage,
                itemPaths: view.pageItems.map(item => item.absPath)
            });
        }
    }, messageID);
}

function removeTarget(targetPath) {
    const stat = fs.statSync(targetPath);
    fs.rmSync(targetPath, { recursive: stat.isDirectory(), force: true });
}

module.exports = {
    config: {
        name: "file",
        aliases: ["files", "project"],
        version: "1.0.0",
        role: 3,
        author: "",
        info: "Duyệt, xem, gửi và xóa file trong thư mục bot",
        Category: "Admin",
        guides: [
            "file",
            "file <đường dẫn>",
            "Reply: open <stt> / send <stt> / delete <stt>"
        ].join("\n"),
        cd: 2,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args }) {
        const target = safeResolve(args.join(" ").trim());
        if (!target || !fs.existsSync(target)) {
            return api.sendMessage("Đường dẫn không hợp lệ hoặc nằm ngoài thư mục bot.", event.threadID, event.messageID);
        }
        const stat = fs.statSync(target);
        if (stat.isFile()) {
            return api.sendMessage(previewFile(target), event.threadID, event.messageID);
        }
        return sendDirectory(api, event, target, 0, event.messageID);
    },

    onReply: async function ({ api, event, onReply, cleanup }) {
        const { threadID, messageID, senderID } = event;
        if (String(senderID) !== String(onReply.author)) {
            return api.sendMessage("Chỉ người dùng lệnh file này mới được reply thao tác.", threadID, messageID);
        }
        if (String(threadID) !== String(onReply.threadID)) return;

        const input = String(event.body || "").trim();
        const parts = input.split(/\s+/).filter(Boolean);
        const command = String(parts[0] || "").toLowerCase();

        if (["next", "n"].includes(command)) {
            if (typeof cleanup === "function") cleanup();
            return sendDirectory(api, event, onReply.dirPath, (onReply.page || 0) + 1, messageID);
        }

        if (["back", "prev", "b"].includes(command) && parts.length === 1) {
            if (typeof cleanup === "function") cleanup();
            return sendDirectory(api, event, onReply.dirPath, (onReply.page || 0) - 1, messageID);
        }

        if (["up", ".."].includes(command)) {
            const parent = safeResolve(path.relative(ROOT_DIR, path.dirname(onReply.dirPath)));
            if (typeof cleanup === "function") cleanup();
            return sendDirectory(api, event, parent || ROOT_DIR, 0, messageID);
        }

        const action = ["open", "o", "send", "s", "delete", "del", "xoa", "xóa"].includes(command) ? command : "open";
        const pathText = action === "open" ? parts.slice(["open", "o"].includes(command) ? 1 : 0).join(" ").trim() : "";
        if (pathText && !/^\d+$/.test(pathText)) {
            const quickTarget = resolveFromCurrent(onReply.dirPath, pathText);
            if (typeof cleanup === "function") cleanup();
            return openTarget(api, event, quickTarget, messageID);
        }

        const rawIndex = action === "open" && /^\d+$/.test(command) ? command : parts[1];
        const index = parseInt(rawIndex, 10) - 1;
        const targetPath = onReply.itemPaths?.[index];

        if (!targetPath || !safeResolve(path.relative(ROOT_DIR, targetPath)) || !fs.existsSync(targetPath)) {
            return api.sendMessage("STT không hợp lệ hoặc file không còn tồn tại.", threadID, messageID);
        }

        const stat = fs.statSync(targetPath);
        if (["delete", "del", "xoa", "xóa"].includes(action)) {
            if (!isMainAdmin(senderID)) return api.sendMessage("Chỉ NDH được xóa file/thư mục.", threadID, messageID);
            removeTarget(targetPath);
            if (typeof cleanup === "function") cleanup();
            return api.sendMessage(`Đã xóa: ${relativePath(targetPath)}`, threadID, messageID);
        }

        if (["send", "s"].includes(action)) {
            if (stat.isDirectory()) return api.sendMessage("Không thể gửi thư mục. Hãy mở thư mục rồi chọn file.", threadID, messageID);
            return api.sendMessage({
                body: `File: ${relativePath(targetPath)}\nĐuôi: ${path.extname(targetPath) || "[không đuôi]"} | Size: ${formatSize(stat.size)}`,
                attachment: fs.createReadStream(targetPath)
            }, threadID, null, messageID);
        }

        if (stat.isDirectory()) {
            if (typeof cleanup === "function") cleanup();
            return sendDirectory(api, event, targetPath, 0, messageID);
        }

        return api.sendMessage(previewFile(targetPath), threadID, messageID);
    }
};
