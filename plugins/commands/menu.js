"use strict";

const UNSEND_DELAY_MS = 60 * 1000;
const ROLE_LABELS = {
    0: "Thanh vien",
    1: "Quan tri vien",
    2: "Admin Bot",
    3: "Nguoi ho tro"
};

function send(api, message, threadID, callbackOrReply, replyToMessage) {
    const sender = api.sendMessageMqttv2 || api.sendMessage;
    return sender.call(api, message, threadID, callbackOrReply, replyToMessage);
}

function scheduleUnsend(api, messageID, delayMs = UNSEND_DELAY_MS) {
    if (!messageID) {
        return;
    }

    setTimeout(() => {
        api.unsendMessage(messageID, () => { });
    }, delayMs);
}

function sendAutoDelete(api, message, threadID, replyToMessageID, callback) {
    return send(api, message, threadID, (error, info) => {
        if (!error && info && info.messageID) {
            scheduleUnsend(api, info.messageID);
        }

        if (typeof callback === "function") {
            callback(error, info);
        }
    }, replyToMessageID);
}

function getThreadPrefix(threadID, database) {
    if (global.rentScheduler && typeof global.rentScheduler.getPrefix === "function") {
        const customPrefix = global.rentScheduler.getPrefix(String(threadID));
        if (customPrefix) {
            return customPrefix;
        }
    }

    try {
        const setting = database.get.threadSetting("prefixData", threadID, null);
        const customPrefix = setting && setting.prefix;
        if (customPrefix) {
            return customPrefix;
        }
    } catch {
        // Fall back to global prefix.
    }

    return global.config.PREFIX || "!";
}

function normalizeGuide(guides) {
    if (Array.isArray(guides)) {
        return guides.filter(Boolean).join("\n");
    }

    return String(guides || "").trim();
}

function formatConfigValue(key, value) {
    if (key === "role") {
        const numericRole = Number(value || 0);
        return `${numericRole} (${ROLE_LABELS[numericRole] || "Khong gioi han"})`;
    }

    if (Array.isArray(value)) {
        return value.length > 0 ? value.map((item) => String(item)).join(", ") : "[]";
    }

    if (value && typeof value === "object") {
        return JSON.stringify(value, null, 2);
    }

    if (typeof value === "string") {
        return value.trim() || '""';
    }

    if (value === undefined) {
        return "undefined";
    }

    return String(value);
}

function buildConfigLines(rawConfig) {
    const orderedKeys = [
        "name",
        "aliases",
        "version",
        "role",
        "author",
        "credits",
        "info",
        "Category",
        "guides",
        "cd",
        "hasPrefix",
        "images"
    ];
    const keys = Array.from(new Set([
        ...orderedKeys,
        ...Object.keys(rawConfig || {})
    ])).filter((key) => rawConfig && rawConfig[key] !== undefined);

    const lines = [];
    for (const key of keys) {
        const formatted = formatConfigValue(key, rawConfig[key]);
        if (String(formatted).includes("\n")) {
            lines.push(`${key}:`);
            lines.push(String(formatted));
        } else {
            lines.push(`${key}: ${formatted}`);
        }
    }

    return lines;
}

function getCommands() {
    const commandMap = global.concac && global.concac.commands;
    if (!commandMap || typeof commandMap.values !== "function") {
        return [];
    }

    const uniqueCommands = new Map();
    for (const command of commandMap.values()) {
        if (!command || !command.config || !command.config.name) {
            continue;
        }

        const name = String(command.config.name).trim();
        const key = name.toLowerCase();
        if (uniqueCommands.has(key)) {
            continue;
        }

        const aliases = Array.isArray(command.config.aliases)
            ? command.config.aliases.map((alias) => String(alias).trim()).filter(Boolean)
            : [];

        uniqueCommands.set(key, {
            name,
            category: String(command.config.Category || command.config.category || "Khac").trim() || "Khac",
            info: String(command.config.info || "").trim() || "Chua co mo ta",
            guides: normalizeGuide(command.config.guides),
            role: Number(command.config.role || 0),
            cooldown: Number(command.config.cd || 0),
            hasPrefix: command.config.hasPrefix !== false,
            aliases: Array.from(new Set(aliases.filter((alias) => alias.toLowerCase() !== key))),
            version: String(command.config.version || "").trim(),
            author: String(command.config.author || command.config.credits || "").trim(),
            rawConfig: { ...command.config }
        });
    }

    return Array.from(uniqueCommands.values()).sort((left, right) =>
        left.name.localeCompare(right.name, "vi", { sensitivity: "base" })
    );
}

function getCategories(commands) {
    return Array.from(new Set(commands.map((command) => command.category)))
        .sort((left, right) => left.localeCompare(right, "vi", { sensitivity: "base" }));
}

function getCommandsByCategory(commands, category) {
    return commands
        .filter((command) => command.category.toLowerCase() === String(category || "").toLowerCase())
        .sort((left, right) => left.name.localeCompare(right.name, "vi", { sensitivity: "base" }));
}

function findCommand(commands, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) {
        return null;
    }

    return commands.find((command) =>
        command.name.toLowerCase() === normalizedQuery
        || command.aliases.some((alias) => alias.toLowerCase() === normalizedQuery)
    ) || null;
}

function findCategory(categories, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) {
        return null;
    }

    return categories.find((category) => category.toLowerCase() === normalizedQuery) || null;
}

function buildCategoryMessage(categories, commands, prefix) {
    const lines = categories.map((category, index) => {
        const total = commands.filter((command) => command.category === category).length;
        return `${index + 1}. ${category} (${total} lenh)`;
    });

    return [
        "[ MENU ]",
        "",
        ...lines,
        "",
        `⩺ Reply tu 1 den ${categories.length} de chon`,
        "⩺ Reply all de xem tat ca lenh",
        `⩺ Tu dong go tin nhan sau: ${UNSEND_DELAY_MS / 1000}s`,
        `⩺ Dung ${prefix}help + ten lenh de xem chi tiet cach su dung lenh`
    ].join("\n");
}

function buildCommandsMessage(category, commands, prefix) {
    const lines = commands.map((command, index) => `${index + 1}. ${command.name}: ${command.info}`);

    return [
        `[ ${category} ]`,
        "",
        ...lines,
        "",
        `⩺ Reply tu 1 den ${commands.length} de chon`,
        "⩺ Reply 0 de quay lai",
        `⩺ Tu dong go tin nhan sau: ${UNSEND_DELAY_MS / 1000}s`,
        `⩺ Dung ${prefix}help + ten lenh de xem chi tiet cach su dung lenh`
    ].join("\n");
}

function buildCommandDetailMessage(command, category, prefix, commandIndex, totalCommands) {
    const configLines = buildConfigLines(command.rawConfig || {});

    return [
        `[ ${command.name} ]`,
        `nhom: ${category}`,
        `vi tri: ${commandIndex}/${totalCommands}`,
        "",
        ...configLines,
        "",
        "⩺ Reply so khac de xem lenh khac cung nhom",
        "⩺ Reply 0 de quay lai",
        `⩺ Tu dong go tin nhan sau: ${UNSEND_DELAY_MS / 1000}s`,
        `⩺ Dung ${prefix}help ${command.name} de mo lai nhanh`
    ].join("\n");
}

function buildAllCommandsMessage(categories, commands, prefix) {
    const sections = categories.map((category) => {
        const categoryCommands = getCommandsByCategory(commands, category);
        const names = categoryCommands.map((command) => `${command.name}${command.hasPrefix ? "" : "*"}`).join(", ");
        return `[ ${category} ]\n${names}`;
    });

    return [
        "[ ALL COMMANDS ]",
        `tong lenh: ${commands.length}`,
        `dau * la lenh khong can prefix`,
        `prefix hien tai: ${prefix}`,
        "",
        ...sections,
        "",
        `⩺ Tu dong go tin nhan sau: ${UNSEND_DELAY_MS / 1000}s`
    ].join("\n\n");
}

function createReplyState(base) {
    return {
        name: "menu",
        ...base
    };
}

function sendInteractiveState({
    api,
    threadID,
    replyToMessageID,
    author,
    stage,
    categories,
    selectedCategory,
    commandNames,
    selectedCommand,
    prefix,
    cleanup,
    previousMessageID
}) {
    const commands = getCommands();
    const resolvedCategories = Array.isArray(categories) && categories.length > 0 ? categories : getCategories(commands);
    let nextStage = stage;
    let body = "";

    if (nextStage === "commands") {
        const categoryCommands = getCommandsByCategory(commands, selectedCategory)
            .filter((command) => Array.isArray(commandNames) ? commandNames.includes(command.name) : true);
        body = buildCommandsMessage(selectedCategory, categoryCommands, prefix);
    } else if (nextStage === "detail") {
        const categoryCommands = getCommandsByCategory(commands, selectedCategory)
            .filter((command) => Array.isArray(commandNames) ? commandNames.includes(command.name) : true);
        const selected = categoryCommands.find((command) => command.name === selectedCommand);
        if (!selected) {
            nextStage = "commands";
            body = buildCommandsMessage(selectedCategory, categoryCommands, prefix);
        } else {
            body = buildCommandDetailMessage(
                selected,
                selectedCategory,
                prefix,
                Math.max(1, categoryCommands.findIndex((command) => command.name === selected.name) + 1),
                categoryCommands.length
            );
        }
    } else {
        nextStage = "categories";
        body = buildCategoryMessage(resolvedCategories, commands, prefix);
    }

    return sendAutoDelete(api, body, threadID, replyToMessageID, (error, info) => {
        if (error || !info) {
            return;
        }

        if (typeof cleanup === "function") {
            cleanup();
        }
        if (previousMessageID) {
            api.unsendMessage(previousMessageID, () => { });
        }

        global.concac.onReply.push(createReplyState({
            messageID: info.messageID,
            author,
            stage: nextStage,
            categories: resolvedCategories,
            selectedCategory: selectedCategory || null,
            commandNames: Array.isArray(commandNames) ? commandNames : [],
            selectedCommand: selectedCommand || null,
            prefix
        }));
    });
}

module.exports = {
    config: {
        name: "menu",
        aliases: ["help"],
        version: "1.1.0",
        role: 0,
        author: "",
        info: "Xem danh sach lenh theo nhom va full config tung lenh",
        Category: "Box",
        guides: "menu | menu all | menu <ten lenh> | help <ten lenh>",
        cd: 2,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args, database }) {
        const { threadID, messageID, senderID } = event;
        const prefix = getThreadPrefix(threadID, database);
        const commands = getCommands();
        const categories = getCategories(commands);
        const query = String((args || []).join(" ") || "").trim();

        if (commands.length === 0) {
            return send(api, "Hien tai khong co lenh nao duoc tai.", threadID, messageID);
        }

        if (!query) {
            return sendInteractiveState({
                api,
                threadID,
                replyToMessageID: messageID,
                author: senderID,
                stage: "categories",
                categories,
                prefix
            });
        }

        if (query.toLowerCase() === "all") {
            return sendAutoDelete(api, buildAllCommandsMessage(categories, commands, prefix), threadID, messageID);
        }

        const matchedCommand = findCommand(commands, query);
        if (matchedCommand) {
            const categoryCommands = getCommandsByCategory(commands, matchedCommand.category);
            return sendInteractiveState({
                api,
                threadID,
                replyToMessageID: messageID,
                author: senderID,
                stage: "detail",
                categories,
                selectedCategory: matchedCommand.category,
                commandNames: categoryCommands.map((command) => command.name),
                selectedCommand: matchedCommand.name,
                prefix
            });
        }

        const matchedCategory = findCategory(categories, query);
        if (matchedCategory) {
            const categoryCommands = getCommandsByCategory(commands, matchedCategory);
            return sendInteractiveState({
                api,
                threadID,
                replyToMessageID: messageID,
                author: senderID,
                stage: "commands",
                categories,
                selectedCategory: matchedCategory,
                commandNames: categoryCommands.map((command) => command.name),
                prefix
            });
        }

        return send(
            api,
            `Khong tim thay nhom hoac lenh "${query}".\nDung ${prefix}menu de xem danh sach.`,
            threadID,
            messageID
        );
    },

    onReply: async function ({ api, event, onReply, cleanup, database }) {
        const { threadID, messageID, senderID, body } = event;
        const input = String(body || "").trim();
        const prefix = onReply.prefix || getThreadPrefix(threadID, database);
        const commands = getCommands();
        const categories = Array.isArray(onReply.categories) && onReply.categories.length > 0
            ? onReply.categories
            : getCategories(commands);

        try {
            if (String(senderID) !== String(onReply.author)) {
                return send(api, "Chi nguoi goi menu moi reply duoc.", threadID, messageID);
            }

            if (!input) {
                return send(api, "Vui long reply so hop le.", threadID, messageID);
            }

            if (input.toLowerCase() === "all" && onReply.stage === "categories") {
                cleanup?.();
                if (onReply.messageID) {
                    api.unsendMessage(onReply.messageID, () => { });
                }
                return sendAutoDelete(api, buildAllCommandsMessage(categories, commands, prefix), threadID, messageID);
            }

            if (["0", "back", "b"].includes(input.toLowerCase())) {
                if (onReply.stage === "categories") {
                    cleanup?.();
                    if (onReply.messageID) {
                        api.unsendMessage(onReply.messageID, () => { });
                    }
                    return send(api, "Da dong menu.", threadID, messageID);
                }

                if (onReply.stage === "commands") {
                    return sendInteractiveState({
                        api,
                        threadID,
                        replyToMessageID: messageID,
                        author: senderID,
                        stage: "categories",
                        categories,
                        prefix,
                        cleanup,
                        previousMessageID: onReply.messageID
                    });
                }

                return sendInteractiveState({
                    api,
                    threadID,
                    replyToMessageID: messageID,
                    author: senderID,
                    stage: "commands",
                    categories,
                    selectedCategory: onReply.selectedCategory,
                    commandNames: onReply.commandNames,
                    prefix,
                    cleanup,
                    previousMessageID: onReply.messageID
                });
            }

            const selectedIndex = Number.parseInt(input, 10);
            if (!Number.isInteger(selectedIndex) || selectedIndex <= 0) {
                return send(api, "Vui long reply so hop le.", threadID, messageID);
            }

            if (onReply.stage === "categories") {
                if (selectedIndex > categories.length) {
                    return send(api, `Chi co ${categories.length} nhom lenh.`, threadID, messageID);
                }

                const selectedCategory = categories[selectedIndex - 1];
                const categoryCommands = getCommandsByCategory(commands, selectedCategory);
                return sendInteractiveState({
                    api,
                    threadID,
                    replyToMessageID: messageID,
                    author: senderID,
                    stage: "commands",
                    categories,
                    selectedCategory,
                    commandNames: categoryCommands.map((command) => command.name),
                    prefix,
                    cleanup,
                    previousMessageID: onReply.messageID
                });
            }

            const categoryCommands = getCommandsByCategory(commands, onReply.selectedCategory)
                .filter((command) => Array.isArray(onReply.commandNames) ? onReply.commandNames.includes(command.name) : true);

            if (selectedIndex > categoryCommands.length) {
                return send(api, `Chi co ${categoryCommands.length} lenh trong nhom nay.`, threadID, messageID);
            }

            const selectedCommand = categoryCommands[selectedIndex - 1];
            return sendInteractiveState({
                api,
                threadID,
                replyToMessageID: messageID,
                author: senderID,
                stage: "detail",
                categories,
                selectedCategory: onReply.selectedCategory,
                commandNames: categoryCommands.map((command) => command.name),
                selectedCommand: selectedCommand.name,
                prefix,
                cleanup,
                previousMessageID: onReply.messageID
            });
        } catch (error) {
            console.error("[menu] onReply Error:", error);
            cleanup?.();
            return send(api, `Loi menu: ${error.message}`, threadID, messageID);
        }
    }
};
