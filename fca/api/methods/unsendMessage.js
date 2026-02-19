/**
 * unsendMessage - Unsend/delete a message
 * @param {FCAApi} api - FCA API instance
 */
module.exports = (api) => async (messageID, threadID, callback) => {
    if (!messageID) throw new Error("unsendMessage: messageID is required");
    // threadID is not strictly used by some unsend implementations but user requested it in signature
    try {
        const result = await api.call('unsendMessage', messageID, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
