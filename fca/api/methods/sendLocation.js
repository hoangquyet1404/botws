/**
 * sendLocation (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (mapLink, threadID, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    options = options || {};

    if (!mapLink) throw new Error("sendLocation: mapLink is required");
    if (!threadID) throw new Error("sendLocation: threadID is required");



    try {
        const result = await api.call('sendLocation', mapLink, threadID, options);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
