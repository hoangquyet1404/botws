/**
 * upload2 (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (input, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    options = options || {};

    if (!input) throw new Error("upload2: input (path/stream) is required");

    try {
        const threadID = options.threadID || options.threadId || options.targetThreadID || options.targetThreadId;
        const result = threadID
            ? await api.call('upload', input, threadID)
            : await api.call('upload', input);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
