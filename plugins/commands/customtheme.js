const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "customtheme",
        aliases: ["ctt"],
        version: "1.0.0",
        role: 1,
        author: "",
        info: "Tạo custom theme từ ảnh",
        Category: "Box",
        guides: "Reply ảnh",
        cd: 5,
        hasPrefix: true,
        images: []
    },

    onRun: async function({ api, event }) {
        const { threadID, messageID, messageReply } = event;

        try {
            if (!messageReply?.attachments?.[0] || messageReply.attachments[0].type !== 'photo') {
                return api.sendMessage( "> Reply tin nhắn có ảnh để tạo theme",threadID, null,messageID);
            }

            const imageUrl = messageReply.attachments[0].url ||  messageReply.attachments[0].largePreviewUrl || messageReply.attachments[0].previewUrl;

            if (!imageUrl) {
                return api.sendMessage("> Không tìm thấy URL ảnh", threadID, null, messageID);
            }
            await api.sendMessage("> Đang xử lý...", threadID, null, messageID);
            const tempDir = path.join(process.cwd(), 'plugins/commands/cache');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const tempFile = path.join(tempDir, `customtheme_${Date.now()}.jpg`);
            const { data } = await axios({ method: 'get', url: imageUrl, responseType: 'arraybuffer' });
            fs.writeFileSync(tempFile, Buffer.from(data));
            api.customtheme(tempFile, threadID, (err, result) => {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

                if (err) {
                    return api.sendMessage(`> Lỗi: ${err.message}`,threadID,null,messageID);
                }
                const theme = result.themeData?.theme;
                let msg = `> Theme đã được tạo và áp dụng\n`;
                msg += `> ID: ${result.themeId}\n`;
                if (theme?.gradient_colors?.[0]) {
                    msg += `> Màu: #${theme.gradient_colors[0]}`;
                }

                api.sendMessage(msg, threadID, null, messageID);
            });

        } catch (error) {
            return api.sendMessage(`> Lỗi: ${error.message}`, threadID,null, messageID);
        }
    }
};
