function resolveLocalMusicFb(api) {
    if (typeof api.localApi?.musicFb === 'function') {
        return api.localApi.musicFb.bind(api.localApi);
    }
    if (typeof api.localApi?.message?.musicFb === 'function') {
        return api.localApi.message.musicFb.bind(api.localApi.message);
    }
    return null;
}

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
        const localMusicFb = resolveLocalMusicFb(api);
        const result = localMusicFb
            ? await localMusicFb(options)
            : await api.call('musicFb', options);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
