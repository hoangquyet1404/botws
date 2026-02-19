/**
 * emojiMqtt (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (emoji, threadID, callback) => {
    if (!emoji) throw new Error("emojiMqtt: emoji character is required");
    if (!threadID) throw new Error("emojiMqtt: threadID is required");

    try {
        const result = await api.call('emojiMqtt', emoji, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
