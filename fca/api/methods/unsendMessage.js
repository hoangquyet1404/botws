function normalizeID(value) {
    return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeJid(value) {
    const normalized = normalizeID(value);
    if (!normalized) return '';
    return normalized.includes('@') ? normalized : `${normalized}@msgr`;
}

function getMapValue(map, key) {
    return map instanceof Map && key ? map.get(key) : undefined;
}

function getLocalCtx(api) {
    return api.localApi?.ctx || {};
}

function resolveCachedMessageChatJid(api, messageID) {
    const id = normalizeID(messageID);
    const localCtx = getLocalCtx(api);
    const meta = getMapValue(localCtx.e2eeMessageMetaMap, id) || {};

    return normalizeJid(
        getMapValue(api.e2eeMessageMap, id) ||
        getMapValue(localCtx.e2eeMessageMap, id) ||
        meta.chatJid ||
        ''
    );
}

function resolveThreadChatJid(api, threadID, options = {}) {
    const explicit = normalizeID(options.chatJid || options.e2eeChatJid);
    if (explicit) return normalizeJid(explicit);

    const normalizedThreadID = normalizeID(options.threadID || options.threadId || threadID);
    if (!normalizedThreadID) return '';
    if (normalizedThreadID.includes('@')) return normalizeJid(normalizedThreadID);

    if (typeof api.getKnownE2EEChatJid === 'function') {
        const known = api.getKnownE2EEChatJid(normalizedThreadID, null, options);
        if (known) return normalizeJid(known);
    }

    const localCtx = getLocalCtx(api);
    const cachedThread = localCtx.stateStore?.getThread?.(normalizedThreadID) || null;
    return normalizeJid(
        getMapValue(api.e2eeThreadMap, normalizedThreadID) ||
        getMapValue(localCtx.e2eeThreadMap, normalizedThreadID) ||
        cachedThread?.chatJid ||
        cachedThread?.e2eeChatJid ||
        ''
    );
}

function getLocalE2EEUnsender(api) {
    if (typeof api.localApi?.unsendE2EEMessage === 'function') {
        return api.localApi.unsendE2EEMessage.bind(api.localApi);
    }
    if (typeof api.localApi?.ctx?.e2ee?.unsendE2EEMessage === 'function') {
        return api.localApi.ctx.e2ee.unsendE2EEMessage;
    }
    if (typeof api.localApi?.e2ee?.unsendE2EEMessage === 'function') {
        return api.localApi.e2ee.unsendE2EEMessage;
    }
    return null;
}

async function callE2EEUnsend(api, chatJid, messageID, options) {
    if (!chatJid) {
        throw new Error('E2EE chatJid is missing for unsendMessage');
    }

    const localUnsender = getLocalE2EEUnsender(api);
    if (localUnsender) {
        return localUnsender(chatJid, String(messageID), options);
    }

    return api.call('unsendE2EEMessage', chatJid, String(messageID), options || {});
}

function forgetE2EEMessage(api, messageID) {
    const id = normalizeID(messageID);
    if (!id) return;

    const localCtx = getLocalCtx(api);
    for (const map of [
        api.e2eeMessageMap,
        api.e2eeReplyMap,
        localCtx.e2eeMessageMap,
        localCtx.e2eeReplyMap,
        localCtx.e2eeMessageMetaMap
    ]) {
        if (map instanceof Map) {
            map.delete(id);
        }
    }
}

function normalizeArgs(threadIDOrOptions, callback) {
    let threadID = threadIDOrOptions;
    let options = {};
    let cb = callback;

    if (typeof threadIDOrOptions === 'function') {
        cb = threadIDOrOptions;
        threadID = undefined;
    } else if (threadIDOrOptions && typeof threadIDOrOptions === 'object' && !Array.isArray(threadIDOrOptions)) {
        options = { ...threadIDOrOptions };
        threadID = options.threadID || options.threadId || options.chatJid || options.e2eeChatJid;
    }

    return { threadID, options, callback: cb };
}

module.exports = (api) => async (messageID, threadIDOrOptions, callback) => {
    if (!messageID) throw new Error("unsendMessage: messageID is required");

    const normalized = normalizeArgs(threadIDOrOptions, callback);
    const messageChatJid = resolveCachedMessageChatJid(api, messageID);
    const threadChatJid = resolveThreadChatJid(api, normalized.threadID, normalized.options);
    const chatJid = messageChatJid || threadChatJid;
    const isE2EE = Boolean(
        normalized.options.forceE2EE ||
        normalized.options.e2ee ||
        normalized.options.isE2EE ||
        messageChatJid ||
        threadChatJid
    );

    try {
        if (isE2EE) {
            const result = await callE2EEUnsend(api, chatJid, messageID, normalized.options);
            forgetE2EEMessage(api, messageID);
            if (normalized.callback) normalized.callback(null, result);
            return result;
        }

        const result = await api.call('unsendMessage', messageID);
        if (normalized.callback) normalized.callback(null, result);
        return result;
    } catch (error) {
        if (normalized.callback) normalized.callback(error);
        throw error;
    }
};
