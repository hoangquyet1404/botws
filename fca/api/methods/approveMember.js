/**
 * approveMember (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (userID, threadID, callback) => {
    if (!userID) throw new Error("approveMember: userID is required");
    if (!threadID) throw new Error("approveMember: threadID is required");

    try {
        const result = await api.call('approveMember', userID, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
