"use strict";

const DATA_CATEGORY = "exampleData";

module.exports = {
    config: {
        name: "example",
        aliases: ["vddata"],
        version: "1.0.0",
        role: 2,
        author: "",
        info: "Vi du cau truc command dung database context",
        Category: "Dev",
        guides: [
            "example get",
            "example create <noi dung>",
            "example update <noi dung>",
            "example delete"
        ].join("\n"),
        cd: 1,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args, database }) {
        const { threadID, messageID, senderID } = event;
        const action = String(args[0] || "get").toLowerCase();
        const content = args.slice(1).join(" ").trim();

        if (action === "get") {
            const data = database.get.threadSetting(DATA_CATEGORY, threadID, null);
            if (!data) {
                return api.sendMessage("Chua co data example cho nhom nay.", threadID, messageID);
            }

            return api.sendMessage(
                [
                    "[ EXAMPLE DATA ]",
                    `Text: ${data.text || ""}`,
                    `Created by: ${data.createdBy || "unknown"}`,
                    `Updated at: ${new Date(data.updatedAt || data.createdAt || Date.now()).toLocaleString("vi-VN")}`
                ].join("\n"),
                threadID,
                messageID
            );
        }

        if (action === "create") {
            if (!content) {
                return api.sendMessage("Dung: example create <noi dung>", threadID, messageID);
            }

            database.create.threadSetting(DATA_CATEGORY, threadID, {
                text: content,
                createdBy: senderID,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            return api.sendMessage("Da tao data example.", threadID, messageID);
        }

        if (action === "update") {
            if (!content) {
                return api.sendMessage("Dung: example update <noi dung>", threadID, messageID);
            }

            const current = database.get.threadSetting(DATA_CATEGORY, threadID, {});
            database.update.threadSetting(DATA_CATEGORY, threadID, {
                ...current,
                text: content,
                updatedBy: senderID,
                updatedAt: Date.now()
            });

            return api.sendMessage("Da cap nhat data example.", threadID, messageID);
        }

        if (action === "delete" || action === "del") {
            const deleted = database.delete.threadSetting(DATA_CATEGORY, threadID);
            return api.sendMessage(
                deleted ? "Da xoa data example." : "Khong co data example de xoa.",
                threadID,
                messageID
            );
        }

        return api.sendMessage(
            [
                "Dung:",
                "example get",
                "example create <noi dung>",
                "example update <noi dung>",
                "example delete"
            ].join("\n"),
            threadID,
            messageID
        );
    }
};
