/**
 * customtheme (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
const fs = require('fs');

module.exports = (api) => async (image, threadID, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    options = options || {};

    if (!image) throw new Error("customtheme: image (path or base64) is required");
    if (!threadID) throw new Error("customtheme: threadID is required");

    if (api.config && api.config.token) {
        options.eaadToken = api.config.token;
    }
    try {
        if (typeof image === 'string' && fs.existsSync(image)) {
            const bitmap = fs.readFileSync(image);
            const base64Info = bitmap.toString('base64');
            image = `data:image/jpeg;base64,${base64Info}`;
        }
    } catch (e) {
        console.error("customtheme wrapper: Error reading file for base64 conversion:", e);
    }

    try {
        const result = await api.call('customtheme', image, threadID, options);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
