/**
 * upload (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (source, callback) => {
    if (!source) throw new Error("upload: source (path/stream) is required");

    try {
        const result = await api.call('upload', source);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
