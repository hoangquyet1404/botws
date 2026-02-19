/**
 * addToGroup (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => {
    return async function addToGroup(userID, threadID, callback) {
        if (!callback && typeof threadID === 'function') {
            callback = threadID;
            threadID = null;
        }
        if (!userID) throw new Error("addToGroup: userID is required");
        if (!threadID) throw new Error("addToGroup: threadID is required");

        try {
            const result = await api.call('addToGroup', userID, threadID);
            if (callback) callback(null, result);
            return result;
        } catch (e) {
            if (callback) callback(e);
            throw e;
        }
    };
};
