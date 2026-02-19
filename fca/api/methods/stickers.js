/**
 * stickers (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => {
    return {
        search: async (query, callback) => {
            if (!query) throw new Error("stickers.search: query is required");
            try {
                const result = await api.call('stickers.search', query);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        listPacks: async (callback) => {
            try {
                const result = await api.call('stickers.listPacks');
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        getStorePacks: async (callback) => {
            try {
                const result = await api.call('stickers.getStorePacks');
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        listAllPacks: async (callback) => {
            try {
                const result = await api.call('stickers.listAllPacks');
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        addPack: async (packID, callback) => {
            if (!packID) throw new Error("stickers.addPack: packID is required");
            try {
                const result = await api.call('stickers.addPack', packID);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        getStickersInPack: async (packID, callback) => {
            if (!packID) throw new Error("stickers.getStickersInPack: packID is required");
            try {
                const result = await api.call('stickers.getStickersInPack', packID);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        },
        getAiStickers: async (options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }
            options = options || {};
            try {
                const result = await api.call('stickers.getAiStickers', options);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        }
    };
};
