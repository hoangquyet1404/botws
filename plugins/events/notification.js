
const moment = require("moment-timezone");
function loadNotiSettings(database) {
    const settings = database.get.json("notiSettings", "default", { threads: {} });
    if (!settings.threads || typeof settings.threads !== "object") settings.threads = {};
    return settings;
}

module.exports = {
    config: {
        name: "notification",
        version: "2.0.0",
        credits: "Isenkai",
        info: "Thông báo tất cả các sự kiện thay đổi trong nhóm",
        eventType: [
            "log:thread-name",
            "log:thread-color", 
            "log:thread-icon",
            "log:thread-image",
            "log:user-nickname",
            "log:thread-admins",
            "log:thread-approval-mode",
            "log:thread-approval-request",
            "log:thread-approval-approve",
            "log:thread-approval-reject",
            "log:approval-queue",
            "log:approval-queue-action",
            "log:pin-message",
            "log:unpin-message",
            "log:thread-poll",
            "log:thread-call"
        ]
    },

    onEvent: async function({ api, event, database }) {
        try {
            const { threadID, logMessageType, logMessageData, logMessageBody, author } = event;
            const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
            if (author === api.getCurrentUserID()) return;
            const notiSettings = loadNotiSettings(database);
            const threadNoti = notiSettings.threads[threadID] || {};
            const threadInfo = await api.getThreadInfo(threadID);
            const authorUser = threadInfo.userInfo.find(u => u.id === author);
            const userName = authorUser ? authorUser.name : "Ai đó";

            let message = "";
            switch (logMessageType) {
                case "log:thread-name": {
                    if (threadNoti.notiName === false) return;
                    const newName = logMessageData.name;
                    message = `${userName} đã đổi tên nhóm thành: ${newName}`;
                    break;
                }

                case "log:thread-color": {
                    if (threadNoti.notiColor === false) return;
                    const themeName = logMessageData.accessibility_label || 
                                     logMessageData.theme_name_with_subtitle || 
                                     logMessageData.theme_color || 
                                     "mặc định";
                    const themeEmoji = logMessageData.theme_emoji ? ` ${logMessageData.theme_emoji}` : '';
                    message = `${userName} đã đổi theme nhóm thành: ${themeName}${themeEmoji}`;
                    break;
                }

                case "log:thread-icon": {
                    if (threadNoti.notiEmoji === false) return;
                    const newEmoji = logMessageData.thread_icon || "👍";
                    message = `${userName} đã đổi emoji nhóm thành: ${newEmoji}`;
                    break;
                }

                case "log:thread-image": {
                    if (threadNoti.notiImage === false) return;
                    message = `${userName} đã thay đổi ảnh nhóm`;
                    break;
                }

                case "log:user-nickname": {
                    if (threadNoti.notiNickname === false) return;
                    
                    const targetUserID = String(logMessageData.participant_id);
                    const newNickname = logMessageData.nickname || null;
                    const targetUser = threadInfo.userInfo.find(u => u.id === targetUserID);
                    const targetName = targetUser ? targetUser.name : "Thành viên";
                    const isSelf = String(author) === targetUserID;

                    if (newNickname) {
                        message = isSelf ? 
                            `${userName} đã đặt biệt danh cho mình là: ${newNickname}`
                        :
                            `${userName} đã đặt biệt danh cho ${targetName} là: ${newNickname}`;
                    } else {
                        message = isSelf ?
                            `${userName} đã xóa biệt danh của mình`
                        :
                            `${userName} đã xóa biệt danh của ${targetName}`;
                    }
                    break;
                }

                case "log:thread-admins": {
                    if (threadNoti.notiAdmin === false) return;

                    const targetAdminID = logMessageData?.TARGET_ID || logMessageData?.target_id;
                    let targetAdminName = "thành viên";
                    
                    if (targetAdminID) {
                        const targetAdmin = threadInfo.userInfo.find(u => u.id === targetAdminID);
                        targetAdminName = targetAdmin ? targetAdmin.name : "thành viên";
                    }
                    
                    message = ` ${logMessageBody || `thay đổi quyền quản trị viên cho ${targetAdminName}`}`;
                    break;
                }

                case "log:thread-approval-mode": {
                    if (threadNoti.notiApproval === false) return;
                    const enabled = logMessageData?.APPROVAL_MODE === 1;
                    message = `${userName} đã ${enabled ? 'bật' : 'tắt'} chế độ phê duyệt thành viên`;
                    break;
                }

                case "log:thread-approval-request":
                case "log:thread-approval-approve":
                case "log:thread-approval-reject": {
                    if (threadNoti.notiApproval === false) return;

                    const requesterID = String(
                        logMessageData?.requester_id ||
                        logMessageData?.participant_id ||
                        ""
                    );
                    const requester = requesterID
                        ? threadInfo.userInfo.find(u => String(u.id) === requesterID)
                        : null;
                    const requesterName =
                        logMessageData?.requester_name ||
                        (requester ? requester.name : null) ||
                        "Ai Ä‘Ã³";
                    const actorID = String(logMessageData?.actor_id || author || "");
                    const actor = actorID
                        ? threadInfo.userInfo.find(u => String(u.id) === actorID)
                        : null;
                    const actorName = actor ? actor.name : userName;

                    if (logMessageType === "log:thread-approval-request") {
                        message = `${requesterName} Ä‘Ã£ gá»­i yÃªu cáº§u tham gia nhÃ³m`;
                    } else if (logMessageType === "log:thread-approval-approve") {
                        message = `${actorName} Ä‘Ã£ cháº¥p nháº­n yÃªu cáº§u tham gia cá»§a ${requesterName}`;
                    } else {
                        message = `${actorName} Ä‘Ã£ tá»« chá»‘i yÃªu cáº§u tham gia cá»§a ${requesterName}`;
                    }
                    break;
                }

                case "log:approval-queue": {
                    if (threadNoti.notiApproval === false) return;
                    const approvalData = logMessageData.approvalQueue;
                    
                    if (approvalData && approvalData.recipientFbId) {
                        const recipient = threadInfo.userInfo.find(u => u.id === approvalData.recipientFbId);
                        const recipientName = recipient ? recipient.name : "Ai đó";

                        const actorID = approvalData.actorFbId || author;
                        const actor = threadInfo.userInfo.find(u => u.id === actorID);
                        const actorName = actor ? actor.name : "Ai đó";
                        
                        switch (approvalData.action) {
                            case "REQUESTED":
                                message = `${recipientName} đã gửi yêu cầu tham gia nhóm`;
                                break;
                            case "REMOVED":
                                message = `${actorName} đã từ chối yêu cầu tham gia của ${recipientName}`;
                                break;
                            case "APPROVED":
                                message = `${actorName} đã chấp nhận yêu cầu tham gia của ${recipientName}`;
                                break;
                            case "CANCELED":
                                message = `${recipientName} đã hủy yêu cầu tham gia nhóm`;
                                break;
                            default:
                                message = `${actorName} đã xử lý yêu cầu tham gia của ${recipientName}`;
                        }
                    }
                    break;
                }

                case "log:approval-queue-action": {
                    if (threadNoti.notiApproval === false) return;
                    if (logMessageData.action && logMessageData.targetFbId) {
                        const target = threadInfo.userInfo.find(u => u.id === logMessageData.targetFbId);
                        const targetName = target ? target.name : "Ai đó";
                        
                        let actionText = "";
                        switch (logMessageData.action) {
                            case "accept": actionText = "chấp nhận"; break;
                            case "reject": actionText = "từ chối"; break;
                            case "ignore": actionText = "bỏ qua"; break;
                            default: actionText = "xử lý";
                        }
                        
                        message = `${userName} đã ${actionText} yêu cầu tham gia của ${targetName}`;
                    }
                    break;
                }

                case "log:pin-message": {
                    if (threadNoti.notiPin === false) return;
                    message = `${userName} đã ghim một tin nhắn`;
                    break;
                }

                case "log:unpin-message": {
                    if (threadNoti.notiPin === false) return;
                    message = `${userName} đã bỏ ghim tin nhắn`;
                    break;
                }

                case "log:thread-poll": {
                    if (threadNoti.notiPoll === false) return;
                    message = `${userName} đã tạo một cuộc bỏ phiếu mới`;
                    break;
                }

                case "log:thread-call": {
                    if (threadNoti.notiCall === false) return;
                    message = `${userName} đã bắt đầu cuộc gọi nhóm`;
                    break;
                }

                default:
                    break;
            }
            if (message) {
                api.sendMessage(message, threadID, (err, messageInfo) => {
                    if (err) {
                        console.error("[Notification] Lỗi gửi tin nhắn:", err);
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

        } catch (error) {
            console.error("Error in notification event:", error);
        }
    }
};
