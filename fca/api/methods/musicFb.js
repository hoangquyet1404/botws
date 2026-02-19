/**
 * musicFb (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (query, threadID, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    options = options || {};

    if (!query) throw new Error("musicFb: query is required");
    // threadID might be optional depending on impl, but usually required for context
    if (!threadID) throw new Error("musicFb: threadID is required");

    if (api.config && api.config.token) {
        options.eaadToken = api.config.token;
    }
    options.searchText = query;

    try {
        const result = await api.call('musicFb', options);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
