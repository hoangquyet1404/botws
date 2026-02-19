/**
 * changeGroupImage (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (image, threadID, callback) => {
    if (!image) throw new Error("changeGroupImage: image (stream/buffer) is required");
    if (!threadID) throw new Error("changeGroupImage: threadID is required");

    try {
        const result = await api.call('changeGroupImage', image, threadID);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
