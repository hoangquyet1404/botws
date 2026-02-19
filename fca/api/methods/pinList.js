/**
 * pinList (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (threadID, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    options = options || {};

    if (!threadID) throw new Error("pinList: threadID is required");

    if (api.config && api.config.token) {
        options.eaadToken = api.config.token;
    }

    try {
        const result = await api.call('pinList', threadID, options);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
