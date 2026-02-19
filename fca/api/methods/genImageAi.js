/**
 * genImageAi (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (prompt, style, options, callback) => {
    if (typeof style === 'function') {
        callback = style;
        style = null;
        options = null;
    } else if (typeof options === 'function') {
        callback = options;
        options = null;
    }
    if (typeof style === 'object' && style !== null && !options) {
        options = style;
        style = null;
    }

    options = options || {};

    if (!prompt) throw new Error("genImageAi: prompt is required");
    if (api.config && api.config.token) {
        options.eaadToken = api.config.token;
    }

    try {
        const result = await api.call('genImageAi', prompt, options);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
