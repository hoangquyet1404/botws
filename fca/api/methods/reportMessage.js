/**
 * reportMessage (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (messageID, callback) => {
    if (!messageID) throw new Error("reportMessage: messageID is required");

    try {
        const result = await api.call('reportMessage', messageID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
