/**
 * changeAI (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (prompt, threadID, callback) => {
    if (!prompt || typeof prompt !== 'string') throw new Error("changeAI: prompt (string) is required");
    if (!threadID) throw new Error("changeAI: threadID is required");

    try {
        const result = await api.call('changeAI', prompt, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
