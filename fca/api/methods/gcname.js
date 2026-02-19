/**
 * gcname (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (name, threadID, callback) => {
    if (typeof name !== 'string') throw new Error("gcname: name must be a string");
    if (!threadID) throw new Error("gcname: threadID is required");

    try {
        const result = await api.call('gcname', name, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
