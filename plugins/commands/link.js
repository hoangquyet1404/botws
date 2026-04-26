module.exports = {
    config: {
        name: "link",
        aliases: ["joinlink", "viewlink"],
        version: "1.0.0",
        role: 2,
        author: "Admin",
        info: "Test join/view group links API (joinLink)",
        Category: "Admin",
        guides: "[view/join] <url>",
        cd: 3,
        hasPrefix: true
    },

    onRun: async ({ api, event, args }) => {
        const { threadID, messageID } = event;
        const action = args[0]?.toLowerCase();
        const url = args[1];

        if (!action || !url) {
            return api.sendMessage("Hướng dẫn: link [view/join] <url>", threadID, messageID);
        }

        try {
            if (action === 'view') {
                const result = await api.joinLink.view(url);
                api.sendMessage(JSON.stringify(result, null, 2), threadID, messageID);
            } else if (action === 'join') {
                const result = await api.joinLink.join(url);
                api.sendMessage(JSON.stringify(result, null, 2), threadID, messageID);
            } else {
                api.sendMessage("Hành động không hợp lệ. Dùng 'view' hoặc 'join'.", threadID, messageID);
            }
        } catch (error) {
            console.error("Link command error:", error);
            api.sendMessage(`Lỗi: ${error.message || JSON.stringify(error)}`, threadID, messageID);
        }
    }
};
