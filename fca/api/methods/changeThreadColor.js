/**
 * changeThreadColor (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (color, threadID, callback) => {
    if (!color) throw new Error("changeThreadColor: color is required");
    if (!threadID) throw new Error("changeThreadColor: threadID is required");

    try {
        const result = await api.call('changeThreadColor', color, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
