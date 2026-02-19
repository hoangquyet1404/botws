/**
 * getMessage (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (threadID, messageID, callback) => {
    if (!threadID) throw new Error("getMessage: threadID is required");
    if (!messageID) throw new Error("getMessage: messageID is required");

    try {
        const result = await api.call('getMessage', threadID, messageID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
