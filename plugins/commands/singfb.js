const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
    config: {
        name: "singfb",
        aliases: ["musicfb", "nhacfb"],
        version: "1.0.0",
        role: 0,
        author: "qh",
        info: "Tìm và phát nhạc từ Facebook Music",
        Category: "Media",
        guides: "[tên bài hát]",
        cd: 5,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args, permssion, money }) {
        const { threadID, messageID, senderID } = event;

        try {
            if (args.length === 0) {
                return api.sendMessage(
                    "Vui lòng nhập tên bài hát!\nVí dụ: sing em là",
                    threadID,
                    null,
                    messageID
                );
            }

            const searchText = args.join(' ');
            const loadingMsg = await new Promise((resolve) => {
                api.sendMessage(
                    `Đang tìm kiếm "${searchText}"...`,
                    threadID,
                    (err, info) => {
                        if (!err) resolve(info);
                    },
                    messageID
                );
            });
            api.musicFb2(searchText, (err, data) => {
                if (err) {
                    console.error('[sing] Error:', err);
                    return api.sendMessage(
                        `Lỗi khi tìm kiếm: ${err.message}`,
                        threadID,
                        null,
                        messageID
                    );
                }
                if (loadingMsg && loadingMsg.messageID) {
                    api.unsendMessage(loadingMsg.messageID);
                }

                if (!Array.isArray(data) || data.length === 0) {
                    console.log("MusicFb2 Raw Data:", JSON.stringify(data, null, 2));
                    return api.sendMessage(
                        `Không tìm thấy bài hát nào (Data: ${typeof data === 'object' ? JSON.stringify(data).substring(0, 200) + '...' : 'Unknown'})`,
                        threadID,
                        null,
                        messageID
                    );
                }
                let message = `Kết quả tìm kiếm: ${searchText}\n\n`;

                // Limit to 10 results if necessary
                const tracks = data.slice(0, 10);

                tracks.forEach((track, index) => {
                    const duration = Math.floor(track.duration_ms / 1000);
                    const minutes = Math.floor(duration / 60);
                    const seconds = duration % 60;
                    const timeFormat = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                    message += `${index + 1}. ${track.title}\n`;
                    message += `   ${track.artist}\n`;
                    message += `   ${timeFormat}\n\n`;
                });

                message += `Reply tin nhắn này với số để chọn bài hát`;

                api.sendMessage(message, threadID, (err, info) => {
                    if (err) return console.error(err);
                    global.concac.onReply.push({
                        name: this.config.name,
                        messageID: info.messageID,
                        author: senderID,
                        data: {
                            tracks: tracks,
                            searchText: searchText
                        }
                    });
                }, messageID);
            });

        } catch (error) {
            console.error('[sing] Error:', error);
            return api.sendMessage(
                `Lỗi: ${error.message}`,
                threadID,
                null,
                messageID
            );
        }
    },

    onReply: async function ({ api, event, onReply: $, cleanup }) {
        const { threadID, messageID, senderID, body } = event;

        try {
            if (String(senderID) !== String($.author)) {
                return;
            }

            const choice = parseInt(body);

            if (isNaN(choice) || choice < 1 || choice > $.data.tracks.length) {
                return api.sendMessage(
                    `Vui lòng reply số từ 1 đến ${$.data.tracks.length}`,
                    threadID,
                    null,
                    messageID
                );
            }

            const selectedTrack = $.data.tracks[choice - 1];
            api.unsendMessage($.messageID);
            const loadingMsg = await new Promise((resolve) => {
                api.sendMessage(
                    `Đang tải bài hát "${selectedTrack.title}"...`,
                    threadID,
                    (err, info) => {
                        if (!err) resolve(info);
                    },
                    messageID
                );
            });

            if (!selectedTrack.url) {
                if (loadingMsg && loadingMsg.messageID) {
                    api.unsendMessage(loadingMsg.messageID);
                }
                return api.sendMessage(
                    `Không tìm thấy link tải cho bài hát này`,
                    threadID,
                    null,
                    messageID
                );
            }
            const cacheDir = path.join(process.cwd(), 'plugins', 'commands', 'cache');
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            const tempFileName = `temp_${Date.now()}.mp4`;
            const tempFilePath = path.join(cacheDir, tempFileName);
            const finalFileName = `${Date.now()}.mp3`;
            const finalFilePath = path.join(cacheDir, finalFileName);

            const response = await axios({
                method: 'GET',
                url: selectedTrack.url,
                responseType: 'arraybuffer'
            });

            const base64Audio = Buffer.from(response.data, 'binary').toString('base64');
            const apiUrl = global.config.api.url + (global.config.api.url.endsWith('/') ? '' : '/') + 'api/media/convert';

            const convertResponse = await axios({
                method: 'POST',
                url: apiUrl,
                data: {
                    audio: base64Audio,
                    ext: 'mp4'
                }
            });

            if (!convertResponse.data.success && !convertResponse.data.data) {
                throw new Error(convertResponse.data.error || "Conversion failed at API");
            }

            const mp3Buffer = Buffer.from(convertResponse.data.data, 'base64');
            fs.writeFileSync(finalFilePath, mp3Buffer);

            if (loadingMsg && loadingMsg.messageID) {
                api.unsendMessage(loadingMsg.messageID);
            }
            const duration = Math.floor(selectedTrack.duration_ms / 1000);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const timeFormat = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            api.sendMessage({
                body: `${selectedTrack.title}\n${selectedTrack.artist}\n${timeFormat}`,
                attachment: fs.createReadStream(finalFilePath)
            }, threadID, (err) => {
                // Cleanup files
                try {
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                    if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
                } catch (e) {
                    console.error('[sing] Cleanup error:', e);
                }

                if (err) {
                    console.error('[sing] Send error:', err);
                    return api.sendMessage(
                        `Lỗi khi gửi bài hát: ${err.message}`,
                        threadID,
                        null,
                        messageID
                    );
                }
            }, messageID);

        } catch (error) {
            console.error('[sing] onReply Error:', error);
            return api.sendMessage(
                `Lỗi: ${error.message}`,
                threadID,
                null,
                messageID
            );
        }
    }
};
