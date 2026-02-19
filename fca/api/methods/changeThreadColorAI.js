/**
 * changeThreadColorAI (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (prompt, threadID, callback) => {
    if (!prompt) throw new Error("changeThreadColorAI: prompt is required");
    if (!threadID) throw new Error("changeThreadColorAI: threadID is required");

    try {
        const result = await api.call('changeThreadColorAI', prompt, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
