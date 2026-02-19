/**
 * pinMessage (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (messageID, threadID, callback) => {
    if (!messageID) throw new Error("pinMessage: messageID is required");
    if (!threadID) throw new Error("pinMessage: threadID is required");

    try {
        const result = await api.call('pinMessage', messageID, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
