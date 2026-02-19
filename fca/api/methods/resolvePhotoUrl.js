/**
 * resolvePhotoUrl (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (photoID, callback) => {
    if (!photoID) throw new Error("resolvePhotoUrl: photoID is required");

    try {
        const result = await api.call('resolvePhotoUrl', photoID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
