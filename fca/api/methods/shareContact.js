/**
 * shareContact (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (text, senderID, threadID, callback) => {
    if (!threadID) throw new Error("shareContact: threadID is required");
    // text and senderID checks if necessary, but threadID is critical.

    try {
        const result = await api.call('shareContact', text, senderID, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
