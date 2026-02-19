const moment = require('moment-timezone');

module.exports = {
    config: {
        name: "join",
        version: "2.0.0",
        credits: "Isenkai",
        info: "Thông báo khi có thành viên mới tham gia nhóm với unsend sau 10s",
        eventType: ["log:subscribe"]
    },

    onEvent: async function ({ api, event }) {
        try {
            const { threadID, logMessageData, author } = event;

            if (!logMessageData || !logMessageData.addedParticipants) return;

            const fs = require('fs');
            const path = require('path');
            const notiSettingsPath = path.resolve(__dirname, '../../main/data/notiSettings.json');
            let notiSettings = { threads: {} };

            try {
                if (fs.existsSync(notiSettingsPath)) {
                    notiSettings = JSON.parse(fs.readFileSync(notiSettingsPath, 'utf8'));
                }
            } catch (err) {
                console.error("Error loading noti settings:", err);
            }

            const threadNoti = notiSettings.threads[threadID] || {};
            if (threadNoti.notiJoin === false) return;

            const addedParticipants = logMessageData.addedParticipants;
            const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
            const threadInfo = await api.getThreadInfo(threadID);

            const threadName = threadInfo.threadName || threadInfo.name || "nhóm";
            const memberCount = threadInfo.participantIDs?.length || 0;

            let adderName = "Ai đó";
            try {
                const adderInfoData = await api.getUserInfo(author);
                const adderInfo = adderInfoData[author] || (adderInfoData.id === author ? adderInfoData : null);
                if (adderInfo) {
                    adderName = adderInfo.name || "Ai đó";
                }
            } catch (err) {
                console.error("Error getting adder info:", err);
            }

            for (const participant of addedParticipants) {
                const userID = participant.userFbId;
                if (userID === api.getCurrentUserID()) {
                    if (global.rentScheduler) {
                        await global.rentScheduler.updateNickname(threadID);
                    }

                    const botMsg =
                        `=== BOT THAM GIA NHÓM ===\n\n` +
                        `Bot: ${global.config.BOTNAME || "Isenkai"}\n` +
                        `Prefix: ${global.config.PREFIX}\n` +
                        `Nhóm: ${threadName}\n` +
                        `Thành viên: ${memberCount}\n` +
                        `Được thêm bởi: ${adderName}\n` +
                        `Thời gian: ${time}\n\n` +
                        `Dùng ${global.config.PREFIX}help để xem hướng dẫn`;
                    if (botMsg) {
                        api.sendMessage({ body: botMsg, effect: "CELEBRATION" }, threadID, (err, messageInfo) => {
                            if (err) {
                                console.error("[Join] Lỗi gửi tin nhắn bot:", err);
                                return;
                            }

                            if (messageInfo && messageInfo.messageID) {
                                setTimeout(() => {
                                    api.unsendMessage(messageInfo.messageID, (unsendErr) => {
                                        if (unsendErr) {
                                            //console.error("[Notification] ✗ Lỗi unsend:", unsendErr);
                                        } else {
                                            //console.log("[Notification] ✓ Unsend thành công!");
                                        }
                                    });
                                }, 5000);
                            }
                        });
                    }
                    continue;
                }

                let newUserName = "Thành viên mới";
                let newUserGender = "UNKNOWN";

                try {
                    const newUserInfoData = await api.getUserInfo(userID);
                    const newUserInfo = newUserInfoData[userID] || (newUserInfoData.id === userID ? newUserInfoData : null);
                    if (newUserInfo) {
                        newUserName = newUserInfo.name || "Thành viên mới";
                        newUserGender = newUserInfo.gender || "UNKNOWN";
                    }
                } catch (err) {
                    console.error("Error getting new user info:", err);
                }

                let genderText = "Không xác định";
                if (newUserGender === "MALE") {
                    genderText = "Nam";
                } else if (newUserGender === "FEMALE") {
                    genderText = "Nữ";
                }

                const welcomeMsg =
                    `=== THÀNH VIÊN MỚI ===\n\n` +
                    `Tên: ${newUserName}\n` +
                    `ID: ${userID}\n` +
                    `Giới tính: ${genderText}\n` +
                    `Được thêm bởi: ${adderName}\n` +
                    `Nhóm: ${threadName}\n` +
                    `Tổng thành viên: ${memberCount}\n` +
                    `Thời gian: ${time}\n\n` +
                    `Chào mừng đến với nhóm!`;
                if (welcomeMsg) {
                    api.sendMessage({ body: welcomeMsg, effect: "CELEBRATION" }, threadID, (err, messageInfo) => {
                        if (err) {
                            console.error("[Join] Lỗi gửi tin nhắn welcome:", err);
                            return;
                        }

                        if (messageInfo && messageInfo.messageID) {
                            setTimeout(() => {
                                api.unsendMessage(messageInfo.messageID, (unsendErr) => {
                                    if (unsendErr) {
                                        //console.error("[Notification] ✗ Lỗi unsend:", unsendErr);
                                    } else {
                                        //console.log("[Notification] ✓ Unsend thành công!");
                                    }
                                });
                            }, 7000);
                        }
                    });

                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error("Error in join event:", error);
        }
    }
};
