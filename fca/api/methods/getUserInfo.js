/**
 * getUserInfo - Get information about a user
 * @param {FCAApi} api - FCA API instance
 */
module.exports = (api) => async (userID, callback) => {
    if (!userID) throw new Error("getUserInfo: userID (string or array) is required");
    try {
        const result = await api.call('getUserInfo', userID);
        if (callback) callback(null, result);
        return result;
    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
