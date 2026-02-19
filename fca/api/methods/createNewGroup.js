/**
 * createNewGroup (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (participantIDs, groupTitle, callback) => {
    if (!participantIDs || !Array.isArray(participantIDs)) throw new Error("createNewGroup: participantIDs array is required");
    if (!groupTitle) throw new Error("createNewGroup: groupTitle is required");

    try {
        const result = await api.call('createNewGroup', participantIDs, groupTitle);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
