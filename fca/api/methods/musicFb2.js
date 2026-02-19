/**
 * musicFb2 (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (keyword, callback) => {
    // keyword is optional (defaults to empty/popular), so we don't strict check it

    try {
        const result = await api.call('musicFb2', keyword);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
