module.exports = (api) => async (chatJid, messageID, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    try {
        const result = await api.unsendMessage(messageID, {
            ...(options || {}),
            chatJid,
            forceE2EE: true
        });
        if (callback) callback(null, result);
        return result;
    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
