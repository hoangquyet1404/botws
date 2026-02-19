/**
 * metaAI (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => {
    return {
        chat: async (prompt, threadID, callback) => {
            if (!prompt) throw new Error("metaAI.chat: prompt is required");
            if (!threadID) throw new Error("metaAI.chat: threadID is required");
            try {
                const result = await api.call('metaAI.chat', prompt, threadID);
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

            if (!query) throw new Error("metaAI.search: query is required");

            // Auto-inject token
            if (api.config && api.config.token) {
                options.eaadToken = api.config.token;
            }

            try {
                const result = await api.call('metaAI.search', query, options);
                if (callback) callback(null, result);
                return result;
            } catch (e) {
                if (callback) callback(e);
                throw e;
            }
        }
    };
};
