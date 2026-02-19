/**
 * getThreadList (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (limit, timestamp, tags, callback) => {
    if (typeof limit !== 'number') throw new Error("getThreadList: limit must be a number");
    if (!tags || !Array.isArray(tags)) throw new Error("getThreadList: tags must be an array");

    try {
        const result = await api.call('getThreadList', limit, timestamp, tags);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
