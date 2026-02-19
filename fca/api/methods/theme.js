/**
 * theme (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (themeID, threadID, callback) => {
    if (!themeID) throw new Error("theme: themeID is required");
    if (!threadID) throw new Error("theme: threadID is required");

    try {
        const result = await api.call('theme', themeID, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
