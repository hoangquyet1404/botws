/**
 * editMessage (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (message, messageID, callback) => {
    if (!message) throw new Error("editMessage: message content is required");
    if (!messageID) throw new Error("editMessage: messageID is required");

    try {
        const result = await api.call('editMessage', message, messageID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
