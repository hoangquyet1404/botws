const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function send(api, message, threadID, callbackOrReply, replyToMessage) {
    const sender = api.sendMessageMqttv2 || api.sendMessage;
    return sender.call(api, message, threadID, callbackOrReply, replyToMessage);
}

async function getPendingList(api) {
    const spam = await api.getThreadList(100, null, ["OTHER"]) || [];
    const pending = await api.getThreadList(100, null, ["PENDING"]) || [];
    return [...spam, ...pending];
}

function formatList(items, title) {
    let body = "";
    items.forEach((single, index) => {
        const type = single.isGroup ? "Nhóm" : "User";
        body += `${index + 1}. [${type}] ${single.name || "Không tên"}\n`;
        body += `   ID: ${single.threadID}\n\n`;
    });
    return `${title}\n\nTổng: ${items.length}\n\n${body}Reply số thứ tự để duyệt\nReply c + stt để từ chối (vd: c 1 2)`;
}

module.exports = {
    config: {
        name: "pending",
        aliases: ["duyet"],
        version: "1.1.0",
        role: 3,
        author: "Panna, adapted by Isenkai",
        info: "Quản lý tin nhắn chờ của bot",
        Category: "Admin",
        guides: "[user/u] | [thread/t] | [all/a] | [approveall] | [rejectall]",
        cd: 5,
        hasPrefix: true,
        images: []
    },

    onRun: async function({ api, event, args }) {
        const { threadID, messageID, senderID } = event;

        try {
            if (args.length === 0) {
                return send(
                    api,
                    "HƯỚNG DẪN LỆNH PENDING\n" +
                    "pending user - Hàng chờ người dùng\n" +
                    "pending thread - Hàng chờ nhóm\n" +
                    "pending all - Tất cả đang chờ\n" +
                    "pending approveall - Duyệt tất cả\n" +
                    "pending rejectall - Từ chối tất cả",
                    threadID,
                    messageID
                );
            }

            const action = String(args[0] || "").toLowerCase();
            const list = await getPendingList(api);
            let selected = list;
            let title = "DANH SÁCH TẤT CẢ CHỜ DUYỆT";

            if (["user", "u", "-u"].includes(action)) {
                selected = list.filter(item => !item.isGroup);
                title = "DANH SÁCH NGƯỜI DÙNG CHỜ DUYỆT";
            } else if (["thread", "t", "-t"].includes(action)) {
                selected = list.filter(item => item.isSubscribed && item.isGroup);
                title = "DANH SÁCH NHÓM CHỜ DUYỆT";
            } else if (!["all", "a", "-a", "approveall", "rejectall"].includes(action)) {
                return send(api, "Lệnh không hợp lệ. Dùng: pending [user/thread/all/approveall/rejectall]", threadID, messageID);
            }

            if (action === "approveall" || action === "rejectall") {
                if (list.length === 0) {
                    return send(api, "Hiện tại không có tin nhắn chờ nào", threadID, messageID);
                }

                let count = 0;
                for (const pendingRequest of list) {
                    try {
                        if (action === "approveall") {
                            if (global.rentScheduler) {
                                await global.rentScheduler.updateNickname(pendingRequest.threadID);
                            }
                            await api.shareContact("Đã được phê duyệt!", global.config.NDH[0], pendingRequest.threadID);
                            await wait(1000);
                        } else {
                            await send(api, "Yêu cầu của bạn đã bị từ chối", pendingRequest.threadID);
                            await wait(500);
                        }
                        count++;
                    } catch (error) {
                        console.error(`[pending] ${action} ${pendingRequest.threadID}:`, error);
                    }
                }

                return send(
                    api,
                    action === "approveall"
                        ? `Đã phê duyệt thành công ${count}/${list.length} yêu cầu`
                        : `Đã từ chối ${count}/${list.length} yêu cầu`,
                    threadID,
                    messageID
                );
            }

            if (selected.length === 0) {
                return send(api, "Hiện tại không có mục nào trong hàng chờ", threadID, messageID);
            }

            return send(api, formatList(selected, title), threadID, (error, info) => {
                if (!error && info) {
                    global.concac.onReply.push({
                        name: this.config.name,
                        messageID: info.messageID,
                        author: senderID,
                        pending: selected
                    });
                }
            }, messageID);
        } catch (error) {
            console.error("[pending] Error:", error);
            return send(api, `Không thể lấy danh sách chờ: ${error.message}`, threadID, messageID);
        }
    },

    onReply: async function({ api, event, onReply: $, cleanup }) {
        const { body, threadID, messageID, senderID } = event;

        try {
            if (String(senderID) !== String($.author)) {
                return send(api, "Chỉ người dùng lệnh mới reply được", threadID, messageID);
            }

            const pending = Array.isArray($.pending) ? $.pending : [];
            const isCancel = /^c(ancel)?\b/i.test(String(body || "").trim());
            const rawIndices = isCancel
                ? String(body || "").replace(/^c(ancel)?/i, "").trim().split(/\s+/)
                : String(body || "").trim().split(/\s+/);
            const indices = rawIndices.filter(Boolean);

            if (indices.length === 0) {
                return send(api, "Vui lòng reply số thứ tự cần xử lý", threadID, messageID);
            }

            let count = 0;
            for (const rawIndex of indices) {
                const index = Number.parseInt(rawIndex, 10);
                if (!Number.isInteger(index) || index <= 0 || index > pending.length) {
                    return send(api, `${rawIndex} không phải là số thứ tự hợp lệ`, threadID, messageID);
                }

                const pendingRequest = pending[index - 1];
                try {
                    if (isCancel) {
                        await send(api, "Yêu cầu của bạn đã bị từ chối", pendingRequest.threadID);
                    } else {
                        if (global.rentScheduler) {
                            await global.rentScheduler.updateNickname(pendingRequest.threadID);
                        }
                        await api.shareContact("Đã được phê duyệt!", global.config.NDH[0], pendingRequest.threadID);
                    }
                    count++;
                } catch (error) {
                    console.error(`[pending] reply ${pendingRequest.threadID}:`, error);
                }
            }

            if ($.messageID) api.unsendMessage($.messageID);
            cleanup?.();
            return send(
                api,
                isCancel ? `Đã từ chối thành công ${count} yêu cầu` : `Đã phê duyệt thành công ${count} yêu cầu`,
                threadID,
                messageID
            );
        } catch (error) {
            console.error("[pending] onReply Error:", error);
            cleanup?.();
            return send(api, `Lỗi: ${error.message}`, threadID, messageID);
        }
    }
};
