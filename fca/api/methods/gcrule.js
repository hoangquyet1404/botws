/**
 * gcrule (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (rule, threadID, callback) => {
    if (!rule) throw new Error("gcrule: rule content is required");
    if (!threadID) throw new Error("gcrule: threadID is required");

    try {
        const result = await api.call('gcrule', rule, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
