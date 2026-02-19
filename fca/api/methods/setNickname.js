/**
 * setNickname (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (nickname, threadID, participantID, callback) => {
    if (!threadID) throw new Error("setNickname: threadID is required");
    // nickname can be empty string (to remove nickname)
    // participantID optional (defaults to sender?) - usually required to target someone

    try {
        const result = await api.call('setNickname', nickname, threadID, participantID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
