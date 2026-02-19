/**
 * markAsDelivered (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (threadID, messageID, callback) => {
    if (!threadID) throw new Error("markAsDelivered: threadID is required");
    if (!messageID) throw new Error("markAsDelivered: messageID is required");

    try {
        const result = await api.call('markAsDelivered', threadID, messageID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
