/**
 * getNoti (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (limit, options, callback) => {
    if (typeof limit === 'function') {
        callback = limit;
        limit = 20; // Default limit
        options = {};
    }
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (!limit) limit = 20;
    options = options || {};

    if (api.config && api.config.token) {
        options.eaadToken = api.config.token;
    }

    try {
        const result = await api.call('getNoti', limit, options);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
