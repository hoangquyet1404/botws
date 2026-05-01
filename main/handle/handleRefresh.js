// handleRefresh.js - Xá»­ lÃ½ Anti-Change cho cÃ¡c event
const moment = require("moment-timezone");
const store = require("../utils/database");

const ADMIN_REFRESH_DELAY_MS = 800;

function sendAntiMessage(api, message, threadID) {
    api.sendMessage(message, threadID, (err, messageInfo) => {
        if (err) {
            console.error("[Anti] Lỗi gửi tin nhắn:", err);
            return;
        }

        if (messageInfo && messageInfo.messageID) {
            setTimeout(() => {
                //console.log("[Anti] Äang unsend messageID:", messageInfo.messageID);
                api.unsendMessage(messageInfo.messageID, (unsendErr) => {
                    if (unsendErr) {
                        //console.error("[Anti] âœ— Lá»—i unsend:", unsendErr);
                    } else {
                        //console.log("[Anti] âœ“ Unsend thÃ nh cÃ´ng!");
                    }
                });
            }, 5000);
        }
    });
}

function loadAntiSettings() {
    try {
        return store.getJson("antiSettings", "default", { threads: {} });
    } catch (error) {
        console.error("Error loading anti settings:", error);
        return { threads: {} };
    }
}

function saveAntiSettings(data) {
    try {
        store.setJson("antiSettings", "default", data || { threads: {} });
        return true;
    } catch (error) {
        console.error("Error saving anti settings:", error);
        return false;
    }
}

async function getThreadData(api, threadID) {
    try {
        const threadInfo = await api.getThreadInfo(threadID);
        return buildThreadSnapshot(threadInfo);
    } catch (error) {
        console.error("Error getting thread data:", error);
        return null;
    }
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getFreshThreadInfo(api, threadID, options = {}) {
    if (options.delayMs) {
        await wait(options.delayMs);
    }

    try {
        return await api.getThreadInfo({
            threadID,
            forceRefresh: true
        });
    } catch {
        return await api.getThreadInfo(threadID);
    }
}

function updateThreadDataInSettings(antiSettings, threadID, field, value) {
    if (!antiSettings.threads[threadID]) {
        antiSettings.threads[threadID] = {
            enabled: false,
            antiName: false,
            antiColor: false,
            antiEmoji: false,
            antiNickname: false,
            antiImage: false,
            allowGroupAdmin: false,
            data: {}
        };
    }

    if (!antiSettings.threads[threadID].data) {
        antiSettings.threads[threadID].data = {};
    }

    antiSettings.threads[threadID].data[field] = value;
    antiSettings.threads[threadID].data.lastUpdate = Date.now();
}

function resolveThemeEventData(logMessageData, threadInfo) {
    return {
        accessibilityLabel:
            logMessageData?.accessibility_label ||
            logMessageData?.theme_name_with_subtitle ||
            logMessageData?.theme_name ||
            threadInfo?.accessibility_label ||
            threadInfo?.accessibilityLabel ||
            null,
        themeColor:
            logMessageData?.theme_color ??
            threadInfo?.color ??
            threadInfo?.themeColor ??
            null,
        themeId:
            logMessageData?.theme_id ??
            logMessageData?.themeID ??
            threadInfo?.threadThemeId ??
            threadInfo?.threadTheme ??
            threadInfo?.themeID ??
            threadInfo?.theme_id ??
            threadInfo?.themeId ??
            null
    };
}

function getSavedThemeValue(savedData = {}) {
    return (
        savedData.themeId ||
        savedData.threadTheme ||
        savedData.themeID ||
        savedData.themeColor ||
        savedData.color ||
        null
    );
}

async function restoreThreadTheme(api, threadID, themeValue) {
    if (!themeValue) return false;

    try {
        await api.changeThreadColor(themeValue, threadID);
        return true;
    } catch (colorErr) {
        console.error("[Anti Color] Lỗi khôi phục bằng changeThreadColor:", colorErr);
    }

    if (typeof api.theme !== "function") return false;

    try {
        await api.theme(themeValue, threadID);
        return true;
    } catch (themeErr) {
        console.error("[Anti Color] Lỗi khôi phục bằng theme:", themeErr);
        return false;
    }
}

function buildThreadSnapshot(threadInfo = {}) {
    const themeData = resolveThemeEventData({}, threadInfo);
    return {
        threadName: threadInfo.threadName || threadInfo.name || "",
        emoji: threadInfo.emoji || "\u{1F44D}",
        themeColor: themeData.themeColor,
        themeId: themeData.themeId,
        color: themeData.themeColor,
        threadTheme: themeData.themeId,
        imageSrc: threadInfo.imageSrc || threadInfo.imageURL || null,
        nicknames: threadInfo.nicknames || {},
        adminIDs: (threadInfo.adminIDs || []).map(a => String(a.id || a)),
        timestamp: Date.now(),
        lastUpdate: Date.now()
    };
}

module.exports = function ({ api }) {
    return async function handleRefresh({ event }) {
        try {
            const { threadID, logMessageType, logMessageData, author, messageID } = event;

            if (!threadID || !logMessageType) return;

            const antiSettings = loadAntiSettings();
            let threadSettings = antiSettings.threads[threadID];
            if (!threadSettings) {
                antiSettings.threads[threadID] = {
                    enabled: false,
                    antiName: false,
                    antiColor: false,
                    antiEmoji: false,
                    antiNickname: false,
                    antiImage: false,
                    allowGroupAdmin: false,
                    data: {}
                };
                threadSettings = antiSettings.threads[threadID];
                saveAntiSettings(antiSettings);
            }

            const savedData = threadSettings.data || (threadSettings.data = {});
            const { ADMINBOT = [], NDH = [] } = global.config;
            const isAdminBot = ADMINBOT.includes(String(author)) || NDH.includes(String(author));

            const threadInfo = logMessageType === "log:thread-admins"
                ? await getFreshThreadInfo(api, threadID, { delayMs: ADMIN_REFRESH_DELAY_MS })
                : await api.getThreadInfo(threadID);
            if (!threadSettings.data || Object.keys(threadSettings.data).length === 0) {
                const data = buildThreadSnapshot(threadInfo);
                Object.assign(threadSettings.data, data);
                saveAntiSettings(antiSettings);
            }
            const threadAdmins = normalizeAdminIDs(threadInfo.adminIDs);
            const isGroupAdmin = threadAdmins.includes(String(author));
            const isTrustedActor = isAdminBot || (threadSettings.allowGroupAdmin === true && isGroupAdmin);

            const isAntiAdmin = logMessageType === "log:thread-admins" && threadSettings.enabled && threadSettings.antiAdmin;

            if (!isAntiAdmin && isTrustedActor) {
                await updateDataAfterEvent(api, antiSettings, threadID, logMessageType, logMessageData, threadInfo);
                return;
            }

            const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");

            switch (logMessageType) {
                case "log:subscribe": {
                    if (!threadSettings.enabled || !threadSettings.antiJoin) break;

                    if (!logMessageData || !logMessageData.addedParticipants) break;
                    if (isTrustedActor) break;

                    const addedParticipants = logMessageData.addedParticipants;
                    const botID = api.getCurrentUserID();

                    for (const participant of addedParticipants) {
                        const userID = participant.userFbId;

                        if (userID === botID) continue;

                        try {
                            await api.removeFromGroup(userID, threadID);
                            //console.log(`[Anti Join] ÄÃ£ kick ${userID} khá»i nhÃ³m ${threadID}`);
                        } catch (kickErr) {
                            console.error(`[Anti Join] Lỗi kick ${userID}:`, kickErr);
                        }
                    }

                    if (author !== botID) {
                        const adderUser = threadInfo.userInfo.find(u => u.id === author);
                        const adderName = adderUser ? adderUser.name : "Ai Ä‘Ã³";

                        sendAntiMessage(
                            api,
                            `⚠️ Bạn không có quyền thêm thành viên.\n` +
                            `Người thêm: ${adderName}\n` +
                            `Đã kick: ${addedParticipants.filter(p => p.userFbId !== botID).length} người`,
                            threadID
                        );
                    }
                    break;
                }

                case "log:unsubscribe": {
                    if (!threadSettings.enabled || !threadSettings.antiLeave) break;

                    if (!logMessageData || !logMessageData.leftParticipantFbId) break;

                    const leftUserID = String(logMessageData.leftParticipantFbId);
                    const isSelfLeave = String(author) === leftUserID;
                    const botID = api.getCurrentUserID();

                    if (!isSelfLeave || leftUserID === botID) break;
                    const isUserGroupAdmin = threadAdmins.includes(leftUserID);
                    const isUserBotAdmin = ADMINBOT.includes(leftUserID) || NDH.includes(leftUserID);
                    if (isUserBotAdmin || isUserGroupAdmin) break;
                    try {
                        await api.addToGroup(leftUserID, threadID);
                        console.log(`[Anti Leave] Đã thêm lại ${leftUserID} vào nhóm ${threadID}`);

                        const leftUser = threadInfo.userInfo.find(u => u.id === leftUserID);
                        const leftUserName = leftUser ? leftUser.name : "Thành viên";

                        sendAntiMessage(
                            api,
                            `⚠️ Bạn không thể tự rời nhóm.\n` +
                            `Thành viên: ${leftUserName}\n` +
                            `Đã thêm lại vào nhóm.`,
                            threadID
                        );
                    } catch (addErr) {
                        console.error(`[Anti Leave] Lỗi thêm lại ${leftUserID}:`, addErr);

                        const leftUser = threadInfo.userInfo.find(u => u.id === leftUserID);
                        const leftUserName = leftUser ? leftUser.name : "Thành viên";

                        sendAntiMessage(
                            api,
                            `⚠️ Bạn không thể tự rời nhóm.\n` +
                            `Thành viên: ${leftUserName}\n` +
                            `Không thể thêm lại.`,
                            threadID
                        );
                    }
                    break;
                }

                case "log:thread-name": {
                    if (!threadSettings.enabled || !threadSettings.antiName) {
                        updateThreadDataInSettings(antiSettings, threadID, 'threadName', logMessageData.name);
                        saveAntiSettings(antiSettings);
                        break;
                    }
                    if (isTrustedActor) {
                        updateThreadDataInSettings(antiSettings, threadID, 'threadName', logMessageData.name);
                        saveAntiSettings(antiSettings);
                        break;
                    }

                    const oldName = savedData.threadName;
                    const newName = logMessageData.name;

                    if (oldName && newName !== oldName) {
                        await api.gcname(oldName, threadID);
                        if (author !== api.getCurrentUserID()) {
                            const user = threadInfo.userInfo.find(u => u.id === author);
                            const userName = user ? user.name : "Người dùng";
                            sendAntiMessage(
                                api,
                                `⚠️ Bạn không có quyền đổi tên nhóm.\n` +
                                `Người đổi: ${userName}\n` +
                                `Đã khôi phục: "${oldName}"`,
                                threadID
                            );
                        }
                    }
                    break;
                }

                case "log:thread-color": {
                    const themeData = resolveThemeEventData(logMessageData, threadInfo);
                    const saveThemeData = () => {
                        updateThreadDataInSettings(antiSettings, threadID, 'themeColor', themeData.themeColor);
                        updateThreadDataInSettings(antiSettings, threadID, 'themeId', themeData.themeId);
                        updateThreadDataInSettings(antiSettings, threadID, 'accessibility_label', themeData.accessibilityLabel);
                        saveAntiSettings(antiSettings);
                    };

                    if (!threadSettings.enabled || !threadSettings.antiColor) {
                        saveThemeData();
                        //console.log(`[Anti] âœ“ Updated theme data (Anti OFF) - ID: ${themeData.themeId}, Color: ${themeData.themeColor}`);
                        break;
                    }

                    if (isTrustedActor) {
                        saveThemeData();
                        break;
                    }

                    if (author === api.getCurrentUserID()) break;

                    const oldThemeId = getSavedThemeValue(savedData);
                    if (!oldThemeId) {
                        saveThemeData();
                        sendAntiMessage(
                            api,
                            `⚠️ Chưa có theme gốc.\n` +
                            `Đã lưu theme hiện tại để chống đổi lần sau.`,
                            threadID
                        );
                        break;
                    }

                    const restoredTheme = await restoreThreadTheme(api, threadID, oldThemeId);
                    const user = threadInfo.userInfo.find(u => u.id === author);
                    const userName = user ? user.name : "Người dùng";
                    const oldThemeName = savedData.accessibility_label || "theme cũ";

                    sendAntiMessage(
                        api,
                        `⚠️ Bạn không có quyền đổi theme nhóm.\n` +
                        `Người đổi: ${userName}\n` +
                        (restoredTheme ? `Đã khôi phục: ${oldThemeName}` : `Không thể khôi phục theme.`),
                        threadID
                    );
                    break;
                }

                case "log:thread-icon": {
                    const defaultEmoji = "\u{1F44D}";
                    const latestEmoji =
                        logMessageData.thread_icon ||
                        logMessageData.thread_quick_reaction_emoji ||
                        logMessageData.custom_emoji ||
                        threadInfo.emoji ||
                        defaultEmoji;
                    const latestEmojiUrl =
                        logMessageData.thread_quick_reaction_emoji_url ||
                        logMessageData.thread_icon_url ||
                        null;
                    const storedEmoji = savedData.emoji || defaultEmoji;

                    const persistEmoji = (emojiValue) => {
                        updateThreadDataInSettings(antiSettings, threadID, "emoji", emojiValue);
                        savedData.emoji = emojiValue;
                        if (latestEmojiUrl) {
                            updateThreadDataInSettings(antiSettings, threadID, "emojiUrl", latestEmojiUrl);
                            savedData.emojiUrl = latestEmojiUrl;
                        }
                        saveAntiSettings(antiSettings);
                    };

                    if (!threadSettings.enabled || !threadSettings.antiEmoji) {
                        if (!savedData.emoji || storedEmoji !== latestEmoji) {
                            persistEmoji(latestEmoji);
                        }
                        break;
                    }

                    if (isTrustedActor) {
                        if (storedEmoji !== latestEmoji) {
                            persistEmoji(latestEmoji);
                        }
                        break;
                    }

                    if (!savedData.emoji) {
                        persistEmoji(latestEmoji);
                        break;
                    }

                    const revertEmoji = savedData.emoji || defaultEmoji;

                    if (latestEmoji !== revertEmoji) {
                        await api.emojiMqtt(revertEmoji, threadID);

                        if (author !== api.getCurrentUserID()) {
                            const user = threadInfo.userInfo.find(u => u.id === author);
                            const userName = user ? user.name : "Người dùng";
                            sendAntiMessage(
                                api,
                                "⚠️ Bạn không có quyền đổi emoji nhóm.\n" +
                                "Người đổi: " + userName + "\n" +
                                "Đã khôi phục: " + revertEmoji,
                                threadID
                            );
                        }
                    }
                    break;
                }

                case "log:user-nickname": {
                    const participant_id = String(logMessageData.participant_id);
                    const newNickname = logMessageData.nickname || null;

                    if (!threadSettings.enabled || !threadSettings.antiNickname) {
                        if (!savedData.nicknames) savedData.nicknames = {};
                        savedData.nicknames[participant_id] = newNickname;
                        updateThreadDataInSettings(antiSettings, threadID, 'nicknames', savedData.nicknames);
                        saveAntiSettings(antiSettings);
                        break;
                    }
                    if (isTrustedActor) {
                        if (!savedData.nicknames) savedData.nicknames = {};
                        savedData.nicknames[participant_id] = newNickname;
                        updateThreadDataInSettings(antiSettings, threadID, 'nicknames', savedData.nicknames);
                        saveAntiSettings(antiSettings);
                        break;
                    }

                    const oldNickname = savedData.nicknames ? savedData.nicknames[participant_id] : null;
                    if (oldNickname !== newNickname && author !== api.getCurrentUserID()) {
                        try {
                            await api.setNickname(oldNickname || "", threadID, participant_id);

                            const authorUser = threadInfo.userInfo.find(u => u.id === author);
                            const userName = authorUser ? authorUser.name : "Người dùng";
                            const targetUser = threadInfo.userInfo.find(u => u.id === participant_id);
                            const targetUserName = targetUser ? targetUser.name : "Người dùng";

                            sendAntiMessage(
                                api,
                                `⚠️ Bạn không có quyền đổi biệt danh.\n` +
                                `Người đổi: ${userName}\n` +
                                `Đối tượng: ${targetUserName}\n` +
                                `Đã khôi phục biệt danh cũ.`,
                                threadID
                            );
                        } catch (err) {
                            console.error(`[Anti Nickname] Lỗi khôi phục nickname:`, err);
                        }
                    }
                    break;
                }

                case "log:thread-image": {
                    if (!threadSettings.enabled || !threadSettings.antiImage) {
                        updateThreadDataInSettings(antiSettings, threadID, 'imageSrc', logMessageData.url);
                        saveAntiSettings(antiSettings);
                        break;
                    }
                    if (isTrustedActor) {
                        updateThreadDataInSettings(antiSettings, threadID, 'imageSrc', logMessageData.url);
                        saveAntiSettings(antiSettings);
                        break;
                    }

                    const oldImageSrc = savedData.imageSrc;

                    if (oldImageSrc && author !== api.getCurrentUserID()) {
                        try {
                            const user = threadInfo.userInfo.find(u => u.id === author);
                            const userName = user ? user.name : "Người dùng";
                            const axios = require('axios');
                            const imageResponse = await axios.get(oldImageSrc, { responseType: 'stream' });
                            await api.changeGroupImage(oldImageSrc, threadID);

                            sendAntiMessage(
                                api,
                                `⚠️ Bạn không có quyền đổi ảnh nhóm.\n` +
                                `Người đổi: ${userName}\n` +
                                `Đã khôi phục ảnh cũ.`,
                                threadID
                            );
                        } catch (error) {
                            console.error("Error restoring group image:", error);
                            sendAntiMessage(
                                api,
                                `⚠️ Không thể khôi phục ảnh nhóm.\n` +
                                `Vui lòng Admin đổi lại.`,
                                threadID
                            );
                        }
                    }
                    break;
                }

                case "log:thread-admins": {
                    if (!threadSettings.enabled || !threadSettings.antiAdmin) {
                        const currentAdmins = normalizeAdminIDs(threadInfo.adminIDs);
                        updateThreadDataInSettings(antiSettings, threadID, 'adminIDs', currentAdmins);
                        saveAntiSettings(antiSettings);
                        break;
                    }
                    if (isAdminBot) {
                        const currentAdmins = normalizeAdminIDs(threadInfo.adminIDs);
                        updateThreadDataInSettings(antiSettings, threadID, 'adminIDs', currentAdmins);
                        saveAntiSettings(antiSettings);
                        break;
                    }

                    const oldAdminIDs = savedData.adminIDs || [];
                    const currentAdminIDs = normalizeAdminIDs(threadInfo.adminIDs);
                    if (oldAdminIDs.length > 0 && currentAdminIDs.length === 0) {
                        console.warn(`[Anti Admin] Không lấy được danh sách QTV mới cho nhóm ${threadID}, bỏ qua event này.`);
                        break;
                    }
                    if (!savedData.adminIDs || oldAdminIDs.length === 0) {
                        updateThreadDataInSettings(antiSettings, threadID, 'adminIDs', currentAdminIDs);
                        saveAntiSettings(antiSettings);
                        console.log(`[Anti Admin] Đã lưu trạng thái QTV ban đầu cho nhóm ${threadID}`);
                        break;
                    }

                    const addedAdmins = currentAdminIDs.filter(id => !oldAdminIDs.includes(id));
                    const removedAdmins = oldAdminIDs.filter(id => !currentAdminIDs.includes(id));

                    if (addedAdmins.length > 0 || removedAdmins.length > 0) {
                        try {
                            const violatorID = String(author);
                            const isViolatorAdmin = oldAdminIDs.includes(violatorID);
                            const isViolatorBotAdmin = ADMINBOT.includes(violatorID) || NDH.includes(violatorID);
                            const botID = api.getCurrentUserID();

                            for (const adminID of removedAdmins) {
                                if (adminID === botID) continue;
                                try {
                                    await api.changeAdminStatus(threadID, adminID, true);
                                } catch (restoreErr) {
                                    console.error(`[Anti Admin] Lỗi thêm lại QTV ${adminID}:`, restoreErr);
                                }
                            }

                            for (const adminID of addedAdmins) {
                                if (adminID === botID || ADMINBOT.includes(adminID) || NDH.includes(adminID)) continue;
                                try {
                                    await api.changeAdminStatus(threadID, adminID, false);
                                } catch (removeAddedErr) {
                                    console.error(`[Anti Admin] Lỗi gỡ QTV mới ${adminID}:`, removeAddedErr);
                                }
                            }

                            let violatorWasDemoted = false;
                            if (isViolatorAdmin && !isViolatorBotAdmin && violatorID !== botID) {
                                try {
                                    await api.changeAdminStatus(threadID, violatorID, false);
                                    violatorWasDemoted = true;
                                } catch (demoteErr) {
                                    console.error(`[Anti Admin] Lỗi gỡ QTV người vi phạm:`, demoteErr);
                                }
                            }

                            let finalAdminIDs = [...oldAdminIDs];
                            if (violatorWasDemoted) {
                                finalAdminIDs = finalAdminIDs.filter(id => id !== violatorID);

                            }
                            updateThreadDataInSettings(antiSettings, threadID, 'adminIDs', finalAdminIDs);
                            saveAntiSettings(antiSettings);

                            if (author !== api.getCurrentUserID()) {
                                const user = threadInfo.userInfo.find(u => u.id === author);
                                const userName = user ? user.name : "Người dùng";

                                let changeDesc = "";
                                if (addedAdmins.length > 0) {
                                    changeDesc += `thêm ${addedAdmins.length} QTV`;
                                }
                                if (removedAdmins.length > 0) {
                                    if (changeDesc) changeDesc += " và ";
                                    changeDesc += `xóa ${removedAdmins.length} QTV`;
                                }

                                let punishmentMsg = "";
                                if (violatorWasDemoted) {
                                    punishmentMsg = `\nĐã gỡ quyền QTV của ${userName} do vi phạm.`;
                                }

                                sendAntiMessage(
                                    api,
                                    `⚠️ Bạn không có quyền đổi QTV.\n` +
                                    `Người đổi: ${userName}\n` +
                                    `Hành động: ${changeDesc}\n` +
                                    `Đã khôi phục danh sách QTV.${punishmentMsg}`,
                                    threadID
                                );
                            }
                        } catch (error) {
                            console.error("Error restoring admin status:", error);
                            sendAntiMessage(
                                api,
                                `⚠️ Không thể khôi phục danh sách QTV.\n` +
                                `Vui lòng tắt anti nếu cần thay đổi.`,
                                threadID
                            );
                        }
                    }
                    break;
                }

                default:
                    break;
            }

        } catch (error) {
            console.error("Error in handleRefresh:", error);
        }
    };
};

function normalizeAdminIDs(adminIDs) {
    return (Array.isArray(adminIDs) ? adminIDs : [])
        .map(admin => {
            if (admin && typeof admin === 'object' && admin.id) return String(admin.id);
            return String(admin || '');
        })
        .filter(Boolean);
}

async function updateDataAfterEvent(api, antiSettings, threadID, logMessageType, logMessageData, threadInfo) {
    try {
        switch (logMessageType) {
            case "log:thread-name":
                updateThreadDataInSettings(antiSettings, threadID, 'threadName', logMessageData.name);
                //console.log(`[Anti] âœ“ Updated threadName for thread ${threadID}`);
                break;
            case "log:thread-color": {
                const themeData = resolveThemeEventData(logMessageData, threadInfo);
                updateThreadDataInSettings(antiSettings, threadID, 'themeColor', themeData.themeColor);
                updateThreadDataInSettings(antiSettings, threadID, 'themeId', themeData.themeId);
                updateThreadDataInSettings(antiSettings, threadID, 'accessibility_label', themeData.accessibilityLabel);
                //console.log(`[Anti] âœ“ Updated theme data - ID: ${themeData.themeId}, Color: ${themeData.themeColor}, Label: ${themeData.accessibilityLabel}`);
                break;
            }
            case "log:thread-icon":
                {
                    const emojiValue =
                        logMessageData.thread_icon ||
                        logMessageData.thread_quick_reaction_emoji ||
                        logMessageData.custom_emoji;
                    if (emojiValue) {
                        updateThreadDataInSettings(antiSettings, threadID, 'emoji', emojiValue);
                    }
                    const emojiUrl =
                        logMessageData.thread_quick_reaction_emoji_url ||
                        logMessageData.thread_icon_url;
                    if (emojiUrl) {
                        updateThreadDataInSettings(antiSettings, threadID, 'emojiUrl', emojiUrl);
                    }
                }
                break;
            case "log:user-nickname":
                const participant_id = String(logMessageData.participant_id);
                const newNickname = logMessageData.nickname || null;
                const savedData = antiSettings.threads[threadID]?.data || {};
                if (!savedData.nicknames) savedData.nicknames = {};
                savedData.nicknames[participant_id] = newNickname;
                updateThreadDataInSettings(antiSettings, threadID, 'nicknames', savedData.nicknames);
                //console.log(`[Anti] âœ“ Updated nickname for ${participant_id}`);
                break;
            case "log:thread-image":
                updateThreadDataInSettings(antiSettings, threadID, 'imageSrc', logMessageData.url);
                //console.log(`[Anti] âœ“ Updated imageSrc for thread ${threadID}`);
                break;
            case "log:thread-admins": {
                const latestThreadInfo = await getFreshThreadInfo(api, threadID, { delayMs: ADMIN_REFRESH_DELAY_MS });
                const currentAdmins = normalizeAdminIDs(latestThreadInfo.adminIDs);
                if (currentAdmins.length === 0) {
                    break;
                }
                updateThreadDataInSettings(antiSettings, threadID, 'adminIDs', currentAdmins);
                //console.log(`[Anti] âœ“ Updated adminIDs for thread ${threadID}`);
                break;
            }
        }
        saveAntiSettings(antiSettings);
    } catch (error) {
        console.error("[Anti] âœ— Error updating data:", error);
    }
}

module.exports.loadAntiSettings = loadAntiSettings;
module.exports.saveAntiSettings = saveAntiSettings;
module.exports.getThreadData = getThreadData;
module.exports.updateThreadDataInSettings = updateThreadDataInSettings;




