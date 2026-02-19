/**
 * changeAdminStatus (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (threadID, userID, adminStatus, callback) => {
    if (!threadID) throw new Error("changeAdminStatus: threadID is required");
    if (!userID) throw new Error("changeAdminStatus: userID is required");
    if (typeof adminStatus !== 'boolean') throw new Error("changeAdminStatus: adminStatus must be a boolean");

    try {
        const result = await api.call('changeAdminStatus', threadID, userID, adminStatus);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
