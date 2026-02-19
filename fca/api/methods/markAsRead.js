/**
 * markAsRead - Mark a thread as read
 * @param {FCAApi} api - FCA API instance
 */
module.exports = (api) => async (threadID, callback) => {
    if (!threadID) throw new Error("markAsRead: threadID is required");
    try {
        const result = await api.call('markAsRead', threadID);
        if (callback) callback(null, result);
        return result;
    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
