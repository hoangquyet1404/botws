/**
 * changeAdminStatus (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (threadID, adminIDs, adminStatus, callback) => {
    if (!threadID) throw new Error("changeAdminStatus: threadID is required");
    if (!adminIDs || (Array.isArray(adminIDs) && adminIDs.length === 0)) {
        throw new Error("changeAdminStatus: adminIDs is required");
    }
    if (typeof adminStatus !== 'boolean') throw new Error("changeAdminStatus: adminStatus must be a boolean");

    const normalizedThreadID = String(threadID);
    const normalizedAdminIDs = Array.isArray(adminIDs)
        ? adminIDs.map(id => String(id || '').trim()).filter(Boolean)
        : String(adminIDs).trim();

    if (Array.isArray(normalizedAdminIDs) && normalizedAdminIDs.length === 0) {
        throw new Error("changeAdminStatus: at least one admin ID is required");
    }
    if (!Array.isArray(normalizedAdminIDs) && !normalizedAdminIDs) {
        throw new Error("changeAdminStatus: at least one admin ID is required");
    }

    try {
        const result = await api.call('changeAdminStatus', normalizedThreadID, normalizedAdminIDs, adminStatus);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
