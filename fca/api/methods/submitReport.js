/**
 * submitReport (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (args, callback) => {
    if (!args) throw new Error("submitReport: args/reportData is required");

    try {
        const result = await api.call('submitReport', args);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
