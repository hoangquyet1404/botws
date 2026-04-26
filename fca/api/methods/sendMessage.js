const path = require('path');
const stream = require('stream');

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isReplyTargetObject(value) {
    return Boolean(
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        (
            value.messageID ||
            value.messageId ||
            value.id ||
            value.senderJid ||
            value.senderJID ||
            value.senderID ||
            value.senderId
        )
    );
}

function isReadableStream(value) {
    return value instanceof stream.Stream &&
        (typeof value._read === 'function' || typeof value._readableState === 'object');
}

async function streamToBuffer(input) {
    if (Buffer.isBuffer(input)) {
        return input;
    }

    return await new Promise((resolve, reject) => {
        const chunks = [];
        input.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        input.on('error', reject);
        input.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

async function toRemoteAttachment(attachment) {
    if (!attachment) {
        return attachment;
    }

    if (Buffer.isBuffer(attachment)) {
        return { buffer: attachment };
    }

    if (isReadableStream(attachment)) {
        const buffer = await streamToBuffer(attachment);
        const filename = attachment.path ? path.basename(attachment.path) : 'attachment.bin';
        const mimeType = attachment.mimeType || attachment.mimetype || attachment.contentType;
        const mediaType = inferAttachmentMediaType({ filename, mimeType });
        return {
            buffer,
            filename,
            mimeType,
            contentType: mimeType,
            mediaType
        };
    }

    if (isPlainObject(attachment) && Buffer.isBuffer(attachment.buffer)) {
        const filename = attachment.filename || attachment.fileName || attachment.name || 'attachment.bin';
        const mimeType = attachment.mimeType || attachment.mimetype || attachment.contentType;
        const mediaType = attachment.mediaType || inferAttachmentMediaType({ filename, mimeType });
        return {
            ...attachment,
            buffer: attachment.buffer,
            filename,
            mimeType,
            contentType: mimeType || attachment.contentType,
            mediaType
        };
    }

    return attachment;
}

async function normalizeRemoteMessage(message) {
    const payload = typeof message === 'string'
        ? { body: message }
        : (isPlainObject(message) ? { ...message } : message);

    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    const rawAttachments = payload.attachment !== undefined ? payload.attachment : payload.attachments;
    if (rawAttachments === undefined) {
        return payload;
    }

    const attachmentList = Array.isArray(rawAttachments) ? rawAttachments : [rawAttachments];
    const normalizedAttachments = await Promise.all(attachmentList.map((item) => toRemoteAttachment(item)));

    if (payload.attachment !== undefined) {
        payload.attachment = normalizedAttachments;
    }
    if (payload.attachments !== undefined) {
        payload.attachments = normalizedAttachments;
    }

    return payload;
}

function hasAttachmentPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const rawAttachments = payload.attachment !== undefined ? payload.attachment : payload.attachments;
    if (rawAttachments === undefined || rawAttachments === null) {
        return false;
    }

    return Array.isArray(rawAttachments) ? rawAttachments.length > 0 : true;
}

function toE2EEReplyOptions(replyTarget) {
    if (!replyTarget || typeof replyTarget !== 'object') {
        return {};
    }

    const replyToId = String(replyTarget.messageID || replyTarget.messageId || replyTarget.id || replyTarget.replyToId || '');
    if (!replyToId) {
        return {};
    }

    const replyToSenderJid = String(
        replyTarget.senderJid ||
        replyTarget.senderJID ||
        replyTarget.userJid ||
        replyTarget.senderID ||
        replyTarget.senderId ||
        replyTarget.replyToSenderJid ||
        ''
    );

    return replyToSenderJid ? { replyToId, replyToSenderJid } : { replyToId };
}

function buildE2EESendResult(result, payload, threadID, chatJid, replyOptions) {
    const messageID = String(result?.messageId || result?.messageID || result?.id || Date.now());
    return {
        attachments: [],
        body: payload.body || payload.text || null,
        chatJid,
        isE2EE: true,
        messageID,
        offlineThreadingId: messageID,
        replyTo: replyOptions.replyToId ? replyOptions : null,
        sendMethod: result?.sendMethod || 'E2EE',
        threadID: String(threadID),
        timestampMs: result?.timestampMs ? String(result.timestampMs) : String(Date.now()),
        type: 'message'
    };
}

function rememberE2EESendResult(api, sendInfo) {
    const messageID = String(sendInfo?.messageID || '');
    const chatJid = String(sendInfo?.chatJid || '');
    if (!messageID || !chatJid) {
        return;
    }

    const localCtx = api.localApi?.ctx || {};
    if (api.e2eeMessageMap instanceof Map) {
        api.e2eeMessageMap.set(messageID, chatJid);
    }
    if (localCtx.e2eeMessageMap instanceof Map && !localCtx.e2eeMessageMap.has(messageID)) {
        localCtx.e2eeMessageMap.set(messageID, chatJid);
    }
    if (localCtx.e2eeMessageMetaMap instanceof Map && !localCtx.e2eeMessageMetaMap.has(messageID)) {
        const currentUserID = String(api.getCurrentUserID?.() || localCtx.userID || '');
        localCtx.e2eeMessageMetaMap.set(messageID, {
            chatJid,
            senderID: currentUserID,
            senderJid: String(localCtx.e2eeOwnJid || (currentUserID ? `${currentUserID}@msgr` : ''))
        });
    }
}

function getLocalE2EESender(api) {
    if (typeof api.localApi?.sendE2EEMessage === 'function') {
        return api.localApi.sendE2EEMessage.bind(api.localApi);
    }
    if (typeof api.localApi?.ctx?.e2ee?.sendE2EEMessage === 'function') {
        return api.localApi.ctx.e2ee.sendE2EEMessage;
    }
    if (typeof api.localApi?.e2ee?.sendE2EEMessage === 'function') {
        return api.localApi.e2ee.sendE2EEMessage;
    }
    return null;
}

function getLocalE2EEAttachmentSender(api) {
    if (typeof api.localApi?.sendE2EEAttachment === 'function') {
        return api.localApi.sendE2EEAttachment.bind(api.localApi);
    }
    if (typeof api.localApi?.ctx?.e2ee?.sendE2EEAttachment === 'function') {
        return api.localApi.ctx.e2ee.sendE2EEAttachment;
    }
    if (typeof api.localApi?.e2ee?.sendE2EEAttachment === 'function') {
        return api.localApi.e2ee.sendE2EEAttachment;
    }
    return null;
}

function getAttachmentPayloads(payload) {
    if (!payload || typeof payload !== 'object') {
        return [];
    }

    const rawAttachments = payload.attachment !== undefined ? payload.attachment : payload.attachments;
    if (rawAttachments === undefined || rawAttachments === null) {
        return [];
    }

    return (Array.isArray(rawAttachments) ? rawAttachments : [rawAttachments])
        .filter((item) => item !== undefined && item !== null);
}

function getExtension(value) {
    const raw = String(value || '');
    const pathname = /^https?:\/\//i.test(raw) ? (() => {
        try {
            return new URL(raw).pathname;
        } catch {
            return raw;
        }
    })() : raw;
    return path.extname(pathname).toLowerCase();
}

function inferAttachmentMediaType(attachment) {
    if (!isPlainObject(attachment)) {
        return undefined;
    }

    const mimeType = String(attachment.mimeType || attachment.mimetype || attachment.contentType || '').toLowerCase();
    const filename = attachment.filename || attachment.fileName || attachment.name || attachment.path || attachment.url || '';
    const extension = getExtension(filename);

    if (mimeType.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
        return 'image';
    }
    if (mimeType.startsWith('video/') || ['.mp4', '.m4v', '.mov', '.webm', '.avi', '.mkv'].includes(extension)) {
        return 'video';
    }
    if (mimeType.startsWith('audio/') || ['.mp3', '.m4a', '.ogg', '.opus', '.wav', '.aac', '.flac'].includes(extension)) {
        return 'audio';
    }

    const explicit = String(attachment.mediaType || attachment.attachmentType || attachment.type || '').toLowerCase();
    if (explicit === 'photo' || explicit === 'gif') {
        return 'image';
    }
    if (['image', 'video', 'audio', 'document', 'sticker'].includes(explicit)) {
        return explicit;
    }

    return undefined;
}

function getAttachmentOptions(attachment, replyOptions) {
    const options = { ...replyOptions };
    if (isPlainObject(attachment)) {
        const filename = attachment.filename || attachment.fileName || attachment.name;
        const mimeType = attachment.mimeType || attachment.mimetype || attachment.contentType;
        const mediaType = inferAttachmentMediaType(attachment);
        if (filename) options.filename = filename;
        if (mimeType) options.mimeType = mimeType;
        if (mediaType) options.mediaType = mediaType;
        if (attachment.duration !== undefined) options.duration = attachment.duration;
        if (attachment.ptt !== undefined) options.ptt = attachment.ptt;
        if (attachment.width !== undefined) options.width = attachment.width;
        if (attachment.height !== undefined) options.height = attachment.height;
    }
    return options;
}

function buildE2EEAttachmentSendResult(result, payload, threadID, chatJid, replyOptions) {
    const sendInfo = buildE2EESendResult(result, payload, threadID, chatJid, replyOptions);
    const attachment = result?.attachment;
    sendInfo.attachments = attachment ? [{
        filename: attachment.filename || null,
        mediaType: attachment.mediaType || null,
        mimeType: attachment.mimeType || null,
        size: attachment.size || null
    }] : [];
    return sendInfo;
}

module.exports = (api) => async (message, threadID, callbackOrOptions, replyToMessage) => {
    let callback = null;
    let callArg3;
    let replyTarget = replyToMessage;

    try {
        if (!message) throw new Error('sendMessage: message content is required');
        if (!threadID) throw new Error('sendMessage: threadID is required');

        if (typeof callbackOrOptions === 'function') {
            callback = callbackOrOptions;
        } else if (
            typeof callbackOrOptions === 'string' ||
            typeof callbackOrOptions === 'number' ||
            isReplyTargetObject(callbackOrOptions)
        ) {
            replyTarget = callbackOrOptions;
        } else if (isPlainObject(callbackOrOptions)) {
            callArg3 = callbackOrOptions;
        }

        if (isPlainObject(replyTarget) && !isReplyTargetObject(replyTarget)) {
            callArg3 = replyTarget;
            replyTarget = null;
        }

        const normalizedReplyTarget = api.resolveReplyTarget
            ? api.resolveReplyTarget(replyTarget)
            : replyTarget;
        const effectiveReplyTarget = normalizedReplyTarget || replyTarget;

        let payload = api.applyE2EEMessageContext
            ? api.applyE2EEMessageContext(message, threadID, effectiveReplyTarget)
            : message;

        const isE2EESend = api.isE2EESendMessage
            ? api.isE2EESendMessage(payload, threadID, effectiveReplyTarget)
            : false;
        if (isE2EESend && effectiveReplyTarget && isPlainObject(payload) && !payload.replyTo) {
            payload.replyTo = effectiveReplyTarget;
        }

        const localE2EESender = getLocalE2EESender(api);
        const localE2EEAttachmentSender = getLocalE2EEAttachmentSender(api);
        if (
            isE2EESend &&
            isPlainObject(payload) &&
            hasAttachmentPayload(payload) &&
            localE2EEAttachmentSender
        ) {
            if (payload.effect || payload.power_up) {
                throw new Error('E2EE sendMessage does not support message effects with attachments yet.');
            }

            const chatJid = payload.chatJid || api.getKnownE2EEChatJid?.(threadID, effectiveReplyTarget, payload);
            if (!chatJid) {
                throw new Error('E2EE chatJid is missing for sendMessage');
            }

            const replyOptions = toE2EEReplyOptions(payload.replyTo || effectiveReplyTarget);
            const body = String(payload.body || payload.text || '');
            let textInfo = null;
            if (body && localE2EESender) {
                const textResult = await localE2EESender(chatJid, body, replyOptions);
                textInfo = buildE2EESendResult(textResult, payload, threadID, chatJid, replyOptions);
                rememberE2EESendResult(api, textInfo);
            }

            const attachmentInfos = [];
            for (const rawAttachment of getAttachmentPayloads(payload)) {
                const normalizedAttachment = await toRemoteAttachment(rawAttachment);
                const attachmentOptions = getAttachmentOptions(normalizedAttachment || rawAttachment, replyOptions);
                const mediaResult = await localE2EEAttachmentSender(chatJid, normalizedAttachment, attachmentOptions);
                const mediaInfo = buildE2EEAttachmentSendResult(mediaResult, { body: null }, threadID, chatJid, replyOptions);
                rememberE2EESendResult(api, mediaInfo);
                attachmentInfos.push(mediaInfo);
            }

            const sendInfo = attachmentInfos[attachmentInfos.length - 1] || textInfo;
            if (sendInfo) {
                sendInfo.body = body || null;
                sendInfo.attachments = attachmentInfos.flatMap((info) => Array.isArray(info.attachments) ? info.attachments : []);
            }
            if (callback) callback(null, sendInfo);
            return sendInfo;
        }

        if (
            isE2EESend &&
            isPlainObject(payload) &&
            !hasAttachmentPayload(payload) &&
            !payload.effect &&
            !payload.power_up &&
            localE2EESender
        ) {
            const chatJid = payload.chatJid || api.getKnownE2EEChatJid?.(threadID, effectiveReplyTarget, payload);
            if (!chatJid) {
                throw new Error('E2EE chatJid is missing for sendMessage');
            }

            const replyOptions = toE2EEReplyOptions(payload.replyTo || effectiveReplyTarget);
            const result = await localE2EESender(chatJid, String(payload.body || payload.text || ''), replyOptions);
            const sendInfo = buildE2EESendResult(result, payload, threadID, chatJid, replyOptions);
            rememberE2EESendResult(api, sendInfo);
            if (callback) callback(null, sendInfo);
            return sendInfo;
        }

        const useLocal = api.shouldUseLocal('sendMessage', [payload, threadID, callArg3, effectiveReplyTarget]);
        if (!useLocal) {
            payload = await normalizeRemoteMessage(payload);
        }

        const sendReplyTarget = isE2EESend ? null : effectiveReplyTarget;
        const result = await api.call('sendMessage', payload, threadID, callArg3, sendReplyTarget);
        if (isE2EESend && result) {
            const chatJid = result.chatJid || (isPlainObject(payload) ? payload.chatJid : '') || api.getKnownE2EEChatJid?.(threadID, effectiveReplyTarget, payload);
            if (chatJid) {
                rememberE2EESendResult(api, {
                    ...result,
                    chatJid,
                    isE2EE: true,
                    messageID: result.messageID || result.messageId || result.id,
                    threadID: String(threadID)
                });
            }
        }
        if (callback) callback(null, result);
        return result;
    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
