module.exports = {
    config: {
        name: "stickersong",
        aliases: ["stsong", "musics"],
        version: "1.0.0",
        role: 0,
        author: "Admin",
        info: "Gửi music sticker vào nhóm",
        Category: "Media",
        guides: "[search text] hoặc reply số thứ tự",
        cd: 3,
        hasPrefix: true,
        images: []
    },

    onRun: async function({ api, event, args }) {
        const { threadID, messageID, senderID } = event;

        try {
            if (!api.stikerSong) {
                return api.sendMessage(
                    "API stikerSong chưa được load. Vui lòng kiểm tra lại!",
                    threadID,
                    null,
                    messageID
                );
            }

            const searchText = args.join(' ').trim();
            let loadingMsg;

            if (searchText) {
                loadingMsg = await api.sendMessage(
                    `🔍 Đang tìm kiếm: "${searchText}"...`,
                    threadID
                );

                api.stikerSong.search(searchText, { limit: 20 }, async (err, result) => {
                    if (err) {
                        api.unsendMessage(loadingMsg.messageID);
                        return api.sendMessage(
                            ` Lỗi tìm kiếm: ${err.message}`,
                            threadID,
                            null,
                            messageID
                        );
                    }

                    if (!result.stickers || result.stickers.length === 0) {
                        api.unsendMessage(loadingMsg.messageID);
                        return api.sendMessage(
                            ` Không tìm thấy kết quả cho: "${searchText}"`,
                            threadID,
                            null,
                            messageID
                        );
                    }
                    let message = `🎵 Kết quả tìm kiếm: "${searchText}"\n`;
                    message += `━━━━━━━━━━━━━━━━━━━\n\n`;

                    result.stickers.slice(0, 15).forEach((song, index) => {
                        const duration = Math.floor(song.duration_ms / 1000);
                        const minutes = Math.floor(duration / 60);
                        const seconds = duration % 60;
                        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        
                        message += `${index + 1}. ${song.title}\n`;
                        message += `   👤 ${song.artist}\n`;
                        message += `   ⏱️ ${durationStr}${song.is_explicit ? ' 🔞' : ''}\n\n`;
                    });

                    message += `━━━━━━━━━━━━━━━━━━━\n`;
                    message += `📝 Reply STT để gửi sticker`;

                    api.unsendMessage(loadingMsg.messageID);

                    return api.sendMessage(message, threadID, (err, info) => {
                        if (err) return;
                        global.concac.onReply.push({
                            name: this.config.name,
                            messageID: info.messageID,
                            author: senderID,
                            data: {
                                songs: result.stickers.slice(0, 15),
                                searchText: searchText
                            }
                        });
                    }, messageID);
                });

            } else {
                loadingMsg = await api.sendMessage(
                    "🎵 Đang tải danh sách music sticker...",
                    threadID
                );

                api.stikerSong.list({ limit: 20 }, async (err, result) => {
                    if (err) {
                        api.unsendMessage(loadingMsg.messageID);
                        return api.sendMessage(
                            ` Lỗi tải danh sách: ${err.message}`,
                            threadID,
                            null,
                            messageID
                        );
                    }

                    if (!result.stickers || result.stickers.length === 0) {
                        api.unsendMessage(loadingMsg.messageID);
                        return api.sendMessage(
                            " Không có music sticker nào",
                            threadID,
                            null,
                            messageID
                        );
                    }
                    let message = `🎵 Danh sách Music Sticker\n`;
                    message += `━━━━━━━━━━━━━━━━━━━\n\n`;

                    result.stickers.slice(0, 15).forEach((song, index) => {
                        const duration = Math.floor(song.duration_ms / 1000);
                        const minutes = Math.floor(duration / 60);
                        const seconds = duration % 60;
                        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        
                        message += `${index + 1}. ${song.title}\n`;
                        message += `   👤 ${song.artist}\n`;
                        message += `   ⏱️ ${durationStr}${song.is_explicit ? ' 🔞' : ''}\n\n`;
                    });

                    message += `━━━━━━━━━━━━━━━━━━━\n`;
                    message += `📝 Reply STT để gửi sticker`;

                    api.unsendMessage(loadingMsg.messageID);

                    return api.sendMessage(message, threadID, (err, info) => {
                        if (err) return;
                        global.concac.onReply.push({
                            name: this.config.name,
                            messageID: info.messageID,
                            author: senderID,
                            data: {
                                songs: result.stickers.slice(0, 15)
                            }
                        });
                    }, messageID);
                });
            }

        } catch (error) {
            console.error(`[${this.config.name}] Error:`, error);
            return api.sendMessage(
                ` Lỗi: ${error.message}`,
                threadID,
                null,
                messageID
            );
        }
    },

    onReply: async function({ api, event, onReply: $ }) {
        const { threadID, messageID, senderID, body } = event;

        try {
            if (String(senderID) !== String($.author)) {
                return api.sendMessage(
                    " Chỉ người dùng lệnh mới reply được",
                    threadID,
                    null,
                    messageID
                );
            }

            const { songs, searchText } = $.data;
            const choice = parseInt(body.trim());
            if (isNaN(choice) || choice < 1 || choice > songs.length) {
                return api.sendMessage(
                    ` Vui lòng reply số từ 1 đến ${songs.length}`,
                    threadID,
                    null,
                    messageID
                );
            }

            const selectedSong = songs[choice - 1];
            api.unsendMessage($.messageID);
            const loadingMsg = await api.sendMessage(
                `⏳ Đang gửi: ${selectedSong.title}...`,
                threadID
            );
            const startTimeMs = Math.floor(selectedSong.duration_ms / 2);            
            api.stikerSong.send( selectedSong.audio_cluster_id,threadID,
                {
                    title: selectedSong.title,
                    artist: selectedSong.artist,
                    is_explicit: selectedSong.is_explicit,
                    start_time: startTimeMs.toString()
                },
                (err, result) => {
                    api.unsendMessage(loadingMsg.messageID);

                    if (err) {
                        return api.sendMessage(
                            ` Lỗi gửi sticker: ${err.message}`,
                            threadID,
                            null,
                            messageID
                        );
                    }
                    const duration = Math.floor(selectedSong.duration_ms / 1000);
                    const minutes = Math.floor(duration / 60);
                    const seconds = duration % 60;
                    const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                    // api.sendMessage(
                    //     `✅ Đã gửi music sticker!\n\n` +
                    //     `🎵 ${selectedSong.title}\n` +
                    //     `👤 ${selectedSong.artist}\n` +
                    //     `⏱️ ${durationStr}${selectedSong.is_explicit ? ' 🔞' : ''}`,
                    //     threadID,
                    //     null,
                    //     messageID
                    // );
                }
            );

        } catch (error) {
            console.error(`[${this.config.name}] onReply Error:`, error);
            return api.sendMessage(
                ` Lỗi: ${error.message}`,
                threadID,
                null,
                messageID
            );
        }
    }
};
