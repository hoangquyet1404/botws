/**
 * stikerSong (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => {
    return {
        list: async (options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }
            options = options || {};

            if (api.config && api.config.token) {
                options.eaadToken = api.config.token;
            }

            try {
                const result = await api.call('stikerSong.list', options);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        search: async (query, options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }
            options = options || {};

            if (!query) throw new Error("stikerSong.search: query is required");

            if (api.config && api.config.token) {
                options.eaadToken = api.config.token;
            }

            try {
                const result = await api.call('stikerSong.search', query, options);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        send: async (stickerID, threadID, callback) => {
            if (!stickerID) throw new Error("stikerSong.send: stickerID is required");
            if (!threadID) throw new Error("stikerSong.send: threadID is required");
            try {
                const result = await api.call('stikerSong.send', stickerID, threadID);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        }
    };
};
