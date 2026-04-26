/**
 * rupload (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (source, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    options = options || {};

    if (!source) throw new Error("rupload: source (url/stream) is required");

    if (api.config && !options.eaadToken && !options.accessToken) {
        options.eaadToken = api.config.ACCESS_TOKEN_MESS || api.config.token;
    }

    try {
        const result = await api.call('rupload', source, options);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
