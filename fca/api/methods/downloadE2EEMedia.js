module.exports = (api) => async (attachment, info, options, callback) => {
    if (typeof info === 'function') {
        callback = info;
        info = {};
        options = {};
    } else if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    try {
        const result = await api.call('downloadE2EEMedia', attachment, info || {}, options || {});
        if (callback) callback(null, result);
        return result;
    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
