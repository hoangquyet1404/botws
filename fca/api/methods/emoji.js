/**
 * emoji (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (emoji, threadID, callback) => {
    if (!emoji) throw new Error("emoji: emoji character is required");
    if (!threadID) throw new Error("emoji: threadID is required");

    try {
        const result = await api.call('emoji', emoji, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
