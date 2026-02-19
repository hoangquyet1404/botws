/**
 * markAsSeen (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (seen_timestamp, callback) => {
    if (!seen_timestamp) throw new Error("markAsSeen: seen_timestamp (boolean or number) is required");

    try {
        const result = await api.call('markAsSeen', seen_timestamp);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
