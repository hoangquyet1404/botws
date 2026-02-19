const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "rupload",
        aliases: ["rup"],
        version: "1.0.0",
        role: 3,
        author: "",
        info: "Test upload media lên rupload.facebook.com",
        Category: "Admin",
        guides: "[type] - Reply ảnh/video/audio/gif\nType: image|video|audio|gif",
        cd: 5,
        hasPrefix: true,
        images: []
    },

    onRun: async function({ api, event, args }) {
        const { threadID, messageID, messageReply } = event;

        try {
            if (!messageReply?.attachments?.[0]) {
                return api.sendMessage(
                    "> Reply tin nhắn có media để upload\n> Dùng: rupload [type]\n> Type: image, video, audio, gif",
                    threadID,
                    null,
                    messageID
                );
            }

            const attachment = messageReply.attachments[0];
            const mediaType = args[0] || attachment.type || 'image';
            
            if (!['image', 'video', 'audio', 'gif', 'photo'].includes(attachment.type)) {
                return api.sendMessage(
                    "> Attachment không hợp lệ",
                    threadID,
                    null,
                    messageID
                );
            }

            await api.sendMessage("> Đang upload...", threadID, null, messageID);

            const mediaUrl = attachment.url;
            const tempDir = path.join(process.cwd(), 'plugins/commands/cache');
            
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const ext = attachment.type === 'video' ? 'mp4' : attachment.type === 'audio' ? 'mp3' : 'jpg';
            const tempFile = path.join(tempDir, `rupload_${Date.now()}.${ext}`);

            // Download media
            const { data } = await axios({
                method: 'get',
                url: mediaUrl,
                responseType: 'arraybuffer'
            });

            fs.writeFileSync(tempFile, Buffer.from(data));

            // Upload without sending message
            api.rupload({
                source: tempFile,
                mediaType: mediaType === 'photo' ? 'image' : mediaType
            }, (err, result) => {
                // Cleanup
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }

                if (err) {
                    console.error("Upload error:", err);
                    return api.sendMessage(
                        `> Lỗi: ${err.message}`,
                        threadID,
                        null,
                        messageID
                    );
                }

                let msg = `✓ Upload ${result.type} thành công\n\n`;
                msg += `> Upload ID: ${result.uploadId}\n`;
                msg += `> Attachment ID: ${result.offlineAttachmentId}\n`;
                if (result.mediaId) msg += `> Media ID: ${result.mediaId}\n`;
                if (result.mediaHash) msg += `> Hash: ${result.mediaHash.substring(0, 16)}...\n`;
                msg += `> File: ${result.fileName}\n`;
                msg += `> Size: ${(result.fileSize / 1024).toFixed(2)} KB`;
                
                if (result.response) {
                    msg += `\n\n> Response:\n${JSON.stringify(result.response, null, 2)}`;
                }

                return api.sendMessage(msg, threadID, null, messageID);
            });

        } catch (error) {
            console.error(`[${this.config.name}] Error:`, error);
            return api.sendMessage(
                `> Lỗi: ${error.message}`,
                threadID,
                null,
                messageID
            );
        }
    }
};
