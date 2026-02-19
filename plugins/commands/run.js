module.exports = {
    config: {
        name: "run",
        aliases: ["eval", "execute"],
        version: "1.0.0",
        role: 3, // Admin only
        author: "Neo",
        info: "Execute raw JavaScript code",
        Category: "Admin",
        guides: "<code>",
        cd: 1,
        hasPrefix: true
    },

    onRun: async ({ api, event, args }) => {
        const { threadID, messageID, senderID } = event;
        const { ADMINBOT, NDH } = global.config;
        if (!ADMINBOT.includes(senderID) && !NDH.includes(senderID)) {
            return api.sendMessage("⚠️ Bạn không có quyền sử dụng lệnh này!", threadID, messageID);
        }

        const code = args.join(" ");
        if (!code) return api.sendMessage("⚠️ Vui lòng nhập code để chạy!", threadID, messageID);
        const send = (msg) => {
            if (msg === undefined || msg === null) return api.sendMessage("undefined", threadID);
            if (typeof msg === 'object' && !msg.body && !msg.attachment && !Buffer.isBuffer(msg) && !msg.readable) {
                try { msg = JSON.stringify(msg, null, 2); } catch (e) { }
            }
            // if (typeof msg === 'string' && msg.length > 15000) {
            //     msg = msg.slice(0, 15000) + "\n... (TRUNCATED DUE TO LENGTH)";
            // }
            return api.sendMessage(msg, threadID);
        };

        try {
            let result = await eval(`(async () => { return ${code} })()`);

            if (result === undefined) {
            }

            if (typeof result !== 'string') {
                result = require('util').inspect(result, { depth: 1 });
            }
            api.sendMessage(result, threadID, messageID);

        } catch (e) {
            try {
                await eval(`(async () => { ${code} })()`);
            } catch (e2) {
                api.sendMessage(` Error:\n${e.message}`, threadID, messageID);
            }
        }
    }
};
