/**
 * upload (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (source, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    options = options || {};

    if (!source) throw new Error("upload: source (path/stream) is required");

    try {
        const threadID = options.threadID || options.threadId || options.targetThreadID || options.targetThreadId;
        const result = threadID
            ? await api.call('upload', source, threadID)
            : await api.call('upload', source);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
