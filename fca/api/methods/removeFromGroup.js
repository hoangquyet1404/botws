/**
 * removeFromGroup (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => {
    return async function removeFromGroup(userID, threadID, callback) {
        if (!callback && typeof threadID === 'function') {
            callback = threadID;
            threadID = null;
        }
        if (!userID) throw new Error("removeFromGroup: userID is required");
        // threadID might not be strictly required if user is leaving? but usually yes for 'remove'.

        try {
            const result = await api.call('removeFromGroup', userID, threadID);
            if (callback) callback(null, result);
            return result;
        } catch (e) {
            if (callback) callback(e);
            throw e;
        }
    };
};
