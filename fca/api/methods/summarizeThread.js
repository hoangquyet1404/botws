/**
 * summarizeThread (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => {
    return async function summarizeThread(threadID, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        if (!threadID) throw new Error("summarizeThread: threadID is required");

        options = options || {};

        // Auto-inject token from config
        if (api.config && api.config.token) {
            options.eaadToken = api.config.token;
        }

        try {
            const result = await api.call('summarizeThread', threadID, options);
            if (callback) callback(null, result);
            return result;
        } catch (e) {
            if (callback) callback(e);
            throw e;
        }
    };
};
