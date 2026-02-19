/**
 * sendTypingIndicator (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (threadID, callback) => {
    if (!threadID) throw new Error("sendTypingIndicator: threadID is required");

    try {
        const result = await api.call('sendTypingIndicator', threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
