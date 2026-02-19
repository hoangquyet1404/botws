/**
 * storySong (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => {
    return {
        getSongList: async (options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }
            options = options || {};

            if (api.config && api.config.token) {
                options.eaadToken = api.config.token;
            }

            try {
                const result = await api.call('storySong.getSongList', options);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        searchSong: async (query, options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }
            options = options || {};

            if (!query) throw new Error("storySong.searchSong: query is required");

            if (api.config && api.config.token) {
                options.eaadToken = api.config.token;
            }

            try {
                const result = await api.call('storySong.searchSong', query, options);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        postSongStory: async (audioClusterId, options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }
            options = options || {};

            if (!audioClusterId) throw new Error("storySong.postSongStory: audioClusterId is required");

            try {
                const result = await api.call('storySong.postSongStory', audioClusterId, options);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        }
    };
};
