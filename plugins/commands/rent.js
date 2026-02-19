

const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

module.exports = {
    config: {
        name: "rent",
        aliases: ["thue", "thuê"],
        version: "1.0.0",
        role: 2,
        author: "Isenkai",
        info: "Quản lý thuê bot cho nhóm",
        Category: "Admin",
        guides: "rent add <threadID> <days> | rent list | rent del <stt> | rent giahan <stt> <days>",
        cd: 3,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args, permssion }) {
        const { threadID, messageID, senderID } = event;
        const rentDataPath = path.join(process.cwd(), 'main/data/rentData.json');
        const keyDataPath = path.join(process.cwd(), 'main/data/keyData.json');

        let rentData = { threads: {} };
        let keyData = { keys: {} };

        if (fs.existsSync(rentDataPath)) {
            rentData = JSON.parse(fs.readFileSync(rentDataPath, 'utf8'));
        }

        if (fs.existsSync(keyDataPath)) {
            keyData = JSON.parse(fs.readFileSync(keyDataPath, 'utf8'));
        }

        try {
            const action = args[0]?.toLowerCase();

            // ===== RENT ADD =====
            if (action === 'add') {
                if (permssion < 2) {
                    return api.sendMessage("✗ Chỉ Admin Bot mới có thể thêm ngày thuê!", threadID, messageID);
                }
                const days = parseInt(args[1]);

                if (isNaN(days) || days <= 0) {
                    return api.sendMessage(
                        "✗ Sử dụng: rent add <số ngày>\n" +
                        "Ví dụ: rent add 30",
                        threadID,
                        messageID
                    );
                }
                let threadName = "Unknown";
                try {
                    const threadInfo = await api.getThreadInfo(threadID);
                    threadName = threadInfo.threadName || threadInfo.name || "Nhóm";
                } catch (err) {
                    console.error("Error getting thread info:", err);
                }

                const now = Date.now();
                const daysInMs = days * 24 * 60 * 60 * 1000;

                if (!rentData.threads[threadID]) {
                    rentData.threads[threadID] = {
                        startDate: now,
                        endDate: now + daysInMs,
                        days: days,
                        threadName: threadName,
                        addedBy: senderID,
                        addedTime: moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY")
                    };

                    fs.writeFileSync(rentDataPath, JSON.stringify(rentData, null, 2), 'utf8');

                    if (global.rentScheduler) {
                        global.rentScheduler.updateNickname(threadID);
                    }

                    return api.sendMessage(
                        `✓ Đã thêm ${days} ngày thuê cho nhóm!\n\n` +
                        `• Nhóm: ${threadName}\n` +
                        `• ID: ${threadID}\n` +
                        `• Ngày hết hạn: ${moment(now + daysInMs).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY HH:mm:ss")}\n` +
                        `• Còn lại: ${days} ngày`,
                        threadID,
                        messageID
                    );
                } else {
                    const currentData = rentData.threads[threadID];
                    const currentEnd = currentData.endDate;
                    const newEnd = currentEnd + daysInMs;
                    const totalDays = Math.ceil((newEnd - now) / (24 * 60 * 60 * 1000));

                    rentData.threads[threadID].endDate = newEnd;
                    rentData.threads[threadID].days = totalDays;
                    rentData.threads[threadID].threadName = threadName;

                    fs.writeFileSync(rentDataPath, JSON.stringify(rentData, null, 2), 'utf8');
                    if (global.rentScheduler) {
                        global.rentScheduler.updateNickname(threadID);
                    }

                    return api.sendMessage(
                        `✓ Đã cộng thêm ${days} ngày thuê!\n\n` +
                        `• Nhóm: ${threadName}\n` +
                        `• ID: ${threadID}\n` +
                        `• Ngày hết hạn: ${moment(newEnd).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY HH:mm:ss")}\n` +
                        `• Tổng còn lại: ${totalDays} ngày`,
                        threadID,
                        messageID
                    );
                }
            }

            // ===== RENT LIST =====
            else if (action === 'list') {
                const threads = rentData.threads || {};
                const threadList = Object.keys(threads);

                if (threadList.length === 0) {
                    return api.sendMessage("⩺ Chưa có nhóm nào thuê bot!", threadID, messageID);
                }

                const now = Date.now();
                let message = "[ DANH SÁCH THUÊ BOT ]\n\n";

                const allThreads = [];
                for (let i = 0; i < threadList.length; i++) {
                    const tid = threadList[i];
                    const data = threads[tid];
                    const daysLeft = Math.ceil((data.endDate - now) / (24 * 60 * 60 * 1000));

                    // Hiển thị cả nhóm hết hạn (chưa quá 7 ngày)
                    if (daysLeft > -7) {
                        allThreads.push({ tid, data, daysLeft });
                    }
                }

                allThreads.forEach((item, index) => {
                    const { tid, data, daysLeft } = item;
                    message += `${index + 1}. ${data.threadName}\n`;
                    message += `• ID: ${tid}\n`;

                    if (daysLeft > 0) {
                        message += `• Còn: ${daysLeft} ngày\n`;
                    } else {
                        message += `• Đã hết hạn ${Math.abs(daysLeft)} ngày\n`;
                    }

                    message += `• Hết hạn: ${moment(data.endDate).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY")}\n\n`;
                });

                message += `⩺ Reply [ del | out | giahan ] + stt\n`;
                message += `⩺ Reply [ upall ] + số ngày để cộng cho tất cả`;

                return api.sendMessage(message, threadID, (err, info) => {
                    if (err) return console.error(err);

                    global.concac.onReply.push({
                        name: this.config.name,
                        messageID: info.messageID,
                        author: senderID,
                        data: { allThreads, type: 'list' }
                    });
                }, messageID);
            }

            // ===== RENT KEY - TẠO KEY =====
            else if (action === 'key') {
                if (permssion < 2) {
                    return api.sendMessage("✗ Chỉ Admin Bot mới có thể tạo key!", threadID, messageID);
                }

                const days = parseInt(args[1]);

                if (isNaN(days) || days <= 0) {
                    return api.sendMessage(
                        "✗ Sử dụng: rent key <số ngày>\n" +
                        "Ví dụ: rent key 30",
                        threadID,
                        messageID
                    );
                }
                const randomText = Math.random().toString(36).substring(2, 10).toUpperCase();
                const keyPrefix = global.config.RENTKEY || 'banana';
                const key = `${keyPrefix}${randomText}`;
                keyData.keys[key] = {
                    days: days,
                    createdBy: senderID,
                    createdTime: moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY"),
                    used: false,
                    usedBy: null,
                    usedTime: null,
                    usedThread: null
                };

                fs.writeFileSync(keyDataPath, JSON.stringify(keyData, null, 2), 'utf8');

                return api.sendMessage(
                    `✓ Đã tạo key thành công!\n\n` +
                    `• Key: ${key}\n` +
                    `• Số ngày: ${days} ngày\n` +
                    `• Tạo bởi: ${senderID}\n\n` +
                    `⩺ Gửi key này vào nhóm để kích hoạt!`,
                    threadID,
                    messageID
                );
            }

            // ===== HƯỚNG DẪN =====
            else {
                return api.sendMessage(
                    "⩺ HƯỚNG DẪN SỬ DỤNG LỆNH RENT\n" +
                    "━━━━━━━━━━━━━━━━━━━━\n\n" +
                    `${global.config.PREFIX}rent add <số ngày>\n` +
                    "   → Thêm ngày thuê cho nhóm này\n\n" +
                    `${global.config.PREFIX}rent list\n` +
                    "   → Xem danh sách nhóm thuê\n\n" +
                    `${global.config.PREFIX}rent key <số ngày>\n` +
                    "   → Tạo key kích hoạt\n\n" +
                    "Trong list reply với:\n" +
                    "• del <stt> - Xóa nhóm\n" +
                    "• out <stt> - Bot out khỏi nhóm\n" +
                    "• giahan <stt> <số ngày> - Gia hạn\n" +
                    "• upall <số ngày> - Cộng cho tất cả nhóm",
                    threadID,
                    messageID
                );
            }

        } catch (error) {
            console.error(`[rent] Error:`, error);
            return api.sendMessage(`✗ Lỗi: ${error.message}`, threadID, messageID);
        }
    },

    onReply: async function ({ api, event, onReply: $, cleanup }) {
        const { threadID, messageID, senderID, body } = event;

        try {
            if (String(senderID) !== String($.author)) {
                return api.sendMessage("✗ Chỉ người dùng lệnh mới reply được", threadID, messageID);
            }

            const rentDataPath = path.join(process.cwd(), 'main/data/rentData.json');
            const prefixDataPath = path.join(process.cwd(), 'main/data/prefixData.json');

            let rentData = { threads: {} };
            let prefixData = { threads: {} };

            if (fs.existsSync(rentDataPath)) {
                rentData = JSON.parse(fs.readFileSync(rentDataPath, 'utf8'));
            }

            if (fs.existsSync(prefixDataPath)) {
                prefixData = JSON.parse(fs.readFileSync(prefixDataPath, 'utf8'));
            }

            const { allThreads } = $.data;
            const args = body.trim().split(/ +/);
            const action = args[0]?.toLowerCase();

            // ===== DEL =====
            if (action === 'del') {
                const index = parseInt(args[1]) - 1;

                if (isNaN(index) || index < 0 || index >= allThreads.length) {
                    return api.sendMessage("✗ Số thứ tự không hợp lệ!", threadID, messageID);
                }

                const targetThread = allThreads[index];
                const tid = targetThread.tid;

                delete rentData.threads[tid];
                fs.writeFileSync(rentDataPath, JSON.stringify(rentData, null, 2), 'utf8');
                if (global.rentScheduler) {
                    global.rentScheduler.updateNickname(tid);
                }

                api.unsendMessage($.messageID);
                return api.sendMessage(
                    `✓ Đã xóa nhóm khỏi danh sách thuê!\n\n` +
                    `• Nhóm: ${targetThread.data.threadName}\n` +
                    `• ID: ${tid}`,
                    threadID,
                    messageID
                );
            }

            // ===== OUT =====
            else if (action === 'out') {
                const index = parseInt(args[1]) - 1;

                if (isNaN(index) || index < 0 || index >= allThreads.length) {
                    return api.sendMessage("✗ Số thứ tự không hợp lệ!", threadID, messageID);
                }

                const targetThread = allThreads[index];
                const tid = targetThread.tid;

                try {
                    delete rentData.threads[tid];
                    fs.writeFileSync(rentDataPath, JSON.stringify(rentData, null, 2), 'utf8');
                    await api.sendMessage(
                        `⚠ Bot sẽ rời khỏi nhóm theo yêu cầu của Admin`,
                        tid
                    );

                    setTimeout(async () => {
                        api.removeFromGroup(api.getCurrentUserID(), tid);
                    }, 2000);

                    api.unsendMessage($.messageID);
                    return api.sendMessage(
                        `✓ Bot đã out khỏi nhóm!\n\n` +
                        `• Nhóm: ${targetThread.data.threadName}\n` +
                        `• ID: ${tid}`,
                        threadID,
                        messageID
                    );
                } catch (error) {
                    return api.sendMessage(
                        `✗ Lỗi khi out khỏi nhóm: ${error.message}`,
                        threadID,
                        messageID
                    );
                }
            }

            // ===== GIA HẠN =====
            else if (action === 'giahan') {
                const index = parseInt(args[1]) - 1;
                const days = parseInt(args[2]);

                if (isNaN(index) || index < 0 || index >= allThreads.length) {
                    return api.sendMessage("✗ Số thứ tự không hợp lệ!", threadID, messageID);
                }

                if (isNaN(days) || days <= 0) {
                    return api.sendMessage("✗ Số ngày không hợp lệ!", threadID, messageID);
                }

                const targetThread = allThreads[index];
                const tid = targetThread.tid;
                const daysInMs = days * 24 * 60 * 60 * 1000;

                rentData.threads[tid].endDate += daysInMs;
                const newDaysLeft = Math.ceil((rentData.threads[tid].endDate - Date.now()) / (24 * 60 * 60 * 1000));
                rentData.threads[tid].days = newDaysLeft;
                const newEndDate = moment(rentData.threads[tid].endDate).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY");

                fs.writeFileSync(rentDataPath, JSON.stringify(rentData, null, 2), 'utf8');
                if (global.rentScheduler) {
                    global.rentScheduler.updateNickname(tid);
                }
                api.sendMessage(
                    `[ Thông Báo ]\n\n` +
                    `• Nhóm của bạn đã được Admin gia hạn thêm ${days} ngày\n` +
                    `• Sẽ kết thúc vào ngày: ${newEndDate}`,
                    tid
                );

                api.unsendMessage($.messageID);
                return api.sendMessage(
                    `✓ Đã gia hạn thành công!\n\n` +
                    `• Nhóm: ${targetThread.data.threadName}\n` +
                    `• ID: ${tid}\n` +
                    `• Thêm: ${days} ngày\n` +
                    `• Tổng còn: ${newDaysLeft} ngày\n` +
                    `• Hết hạn: ${newEndDate}`,
                    threadID,
                    messageID
                );
            }

            // ===== UPALL - CỘNG CHO TẤT CẢ =====
            else if (action === 'upall') {
                const days = parseInt(args[1]);

                if (isNaN(days) || days <= 0) {
                    return api.sendMessage("✗ Số ngày không hợp lệ!\nVí dụ: upall 1", threadID, messageID);
                }

                const daysInMs = days * 24 * 60 * 60 * 1000;
                let updatedCount = 0;
                for (const item of allThreads) {
                    const tid = item.tid;
                    if (rentData.threads[tid]) {
                        rentData.threads[tid].endDate += daysInMs;
                        const newDaysLeft = Math.ceil((rentData.threads[tid].endDate - Date.now()) / (24 * 60 * 60 * 1000));
                        rentData.threads[tid].days = newDaysLeft;
                        updatedCount++;
                    }
                }
                fs.writeFileSync(rentDataPath, JSON.stringify(rentData, null, 2), 'utf8');
                for (const item of allThreads) {
                    const tid = item.tid;
                    if (rentData.threads[tid]) {
                        if (global.rentScheduler) {
                            global.rentScheduler.updateNickname(tid);
                        }
                        const newEndDate = moment(rentData.threads[tid].endDate).tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY");
                        api.sendMessage(
                            `[ Thông Báo ]\n\n` +
                            `• Nhóm của bạn đã được Admin gia hạn thêm ${days} ngày\n` +
                            `• Sẽ kết thúc vào ngày: ${newEndDate}`,
                            tid
                        );
                    }
                }

                api.unsendMessage($.messageID);
                return api.sendMessage(
                    `✓ Đã cộng thêm ${days} ngày cho tất cả!\n\n` +
                    `• Số nhóm được cập nhật: ${updatedCount}\n` +
                    `• Tất cả nhóm đã được thông báo`,
                    threadID,
                    messageID
                );
            }

            else {
                return api.sendMessage(
                    "✗ Lệnh không hợp lệ!\n" +
                    "Sử dụng:\n" +
                    "• del <stt> - Xóa nhóm\n" +
                    "• out <stt> - Bot out khỏi nhóm\n" +
                    "• giahan <stt> <số ngày> - Gia hạn\n" +
                    "• upall <số ngày> - Cộng cho tất cả",
                    threadID,
                    messageID
                );
            }

        } catch (error) {
            console.error(`[rent] onReply Error:`, error);
            return api.sendMessage(`✗ Lỗi: ${error.message}`, threadID, messageID);
        }
    }
};
