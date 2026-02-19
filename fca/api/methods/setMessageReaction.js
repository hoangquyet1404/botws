/**
 * setMessageReaction - React to a message
 * @param {FCAApi} api - FCA API instance
 */
module.exports = (api) => async (reaction, messageID, callback) => {
    if (!reaction) throw new Error("setMessageReaction: reaction is required");
    if (!messageID) throw new Error("setMessageReaction: messageID is required");
    try {
        const result = await api.call('setMessageReaction', reaction, messageID);
        if (callback) callback(null, result);
        return result;
    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
