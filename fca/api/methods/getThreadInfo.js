/**
 * getThreadInfo - Get information about a thread
 * @param {FCAApi} api - FCA API instance
 */
module.exports = (api) => {
    const getThreadInfo = async (threadID, callback) => {
        if (!threadID) throw new Error("getThreadInfo: threadID is required");
        try {
            const result = await api.call('getThreadInfo', threadID);
            if (callback) callback(null, result);
            return result;
        } catch (error) {
            if (callback) callback(error);
            throw error;
        }
    };

    getThreadInfo.userInfo = async (userID, callback) => {
        if (!userID) throw new Error("getThreadInfo.userInfo: userID is required");
        try {
            // Forward call using dot notation which server must handle
            const result = await api.call('getThreadInfo.userInfo', userID);
            if (callback) callback(null, result);
            return result;
        } catch (error) {
            if (callback) callback(error);
            throw error;
        }
    };

    return getThreadInfo;
};
