const moment = require('moment-timezone');
const messageCounter = require('../../main/utils/messageCounter');
const utils = require('../../main/utils/log');


module.exports = {
    config: {
        name: "leave",
        version: "2.0.0",
        credits: "Isenkai",
        info: "Thông báo khi có thành viên rời khỏi nhóm với unsend sau 10s",
        eventType: ["log:unsubscribe"]
    },

    onEvent: async function ({ api, event, database }) {
        try {
            const { threadID, logMessageData, author } = event;

            if (!logMessageData || !logMessageData.leftParticipantFbId) return;

            const leftUserID = String(logMessageData.leftParticipantFbId);
            const isSelfLeave = String(author) === leftUserID;
            let notiSettings = database.get.json('notiSettings', 'default', { threads: {} });
            if (!notiSettings.threads || typeof notiSettings.threads !== 'object') notiSettings.threads = {};
            const isBotLeave = leftUserID === api.getCurrentUserID();

            if (isBotLeave) {
                const result = messageCounter.deleteAllThreadData(threadID);
                utils(`Bot rời nhóm ${threadID}, đã xóa dữ liệu: ${result}`, 'info');
                return;
            }

            const threadNoti = notiSettings.threads[threadID] || {};
            if (threadNoti.notiLeave === false) return;

            const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
            const threadInfo = await api.getThreadInfo(threadID);

            // Xóa data user rời nhóm khỏi messageCounter
            messageCounter.deleteUserFromThread(threadID, leftUserID);

            const threadName = threadInfo.threadName || threadInfo.name || "nhóm";
            // -1 vì API chưa update kịp, vẫn còn user vừa rời
            const memberCount = (threadInfo.participantIDs?.length || 0) - 1;

            let leftUserInfo;
            let leftUserName = "Thành viên";
            let leftUserGender = "UNKNOWN";

            try {
                const userInfoData = await api.getUserInfo(leftUserID);
                leftUserInfo = userInfoData[leftUserID] || (userInfoData.id === leftUserID ? userInfoData : null);
                if (leftUserInfo) {
                    leftUserName = leftUserInfo.name || "Thành viên";
                    leftUserGender = leftUserInfo.gender || "UNKNOWN";
                }
            } catch (err) {
                console.error("Error getting left user info:", err);
            }

            let genderText = "Không xác định";
            if (leftUserGender === "MALE") genderText = "Nam";
            else if (leftUserGender === "FEMALE") genderText = "Nữ";

            let leaveMsg;

            if (isSelfLeave) {
                leaveMsg =
                    `=== THÀNH VIÊN RỜI NHÓM ===\n\n` +
                    `Tên: ${leftUserName}\n` +
                    `ID: ${leftUserID}\n` +
                    `Giới tính: ${genderText}\n` +
                    `Hành động: Tự rời nhóm\n` +
                    `Nhóm: ${threadName}\n` +
                    `Còn lại: ${memberCount} thành viên\n` +
                    `Thời gian: ${time}\n\n` +
                    `Tạm biệt và hẹn gặp lại!`;
            } else {
                // Bị kick
                let kickerName = "Quản trị viên";
                try {
                    const kickerInfoData = await api.getUserInfo(author);
                    const kickerInfo = kickerInfoData[author] || (kickerInfoData.id === author ? kickerInfoData : null);
                    if (kickerInfo) {
                        kickerName = kickerInfo.name || "Quản trị viên";
                    }
                } catch (err) {
                    console.error("Error getting kicker info:", err);
                }

                leaveMsg =
                    `=== THÀNH VIÊN BỊ XÓA ===\n\n` +
                    `Tên: ${leftUserName}\n` +
                    `ID: ${leftUserID}\n` +
                    `Giới tính: ${genderText}\n` +
                    `Bị xóa bởi: ${kickerName}\n` +
                    `Nhóm: ${threadName}\n` +
                    `Còn lại: ${memberCount} thành viên\n` +
                    `Thời gian: ${time}\n\n` +
                    `Đã bị loại khỏi nhóm!`;
            }

            if (leaveMsg) {
                api.sendMessage(leaveMsg, threadID, (err, messageInfo) => {
                    if (err) {
                        console.error("[Leave] Lỗi gửi tin nhắn:", err);
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
                        }, 6000);
                    }
                });
            }
        } catch (error) {
            console.error("Error in leave event:", error);
        }
    }
};
