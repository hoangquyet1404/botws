module.exports = (api) => async (messageOrAttachments, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    try {
        const result = await api.call('downloadE2EEAttachments', messageOrAttachments, options || {});
        if (callback) callback(null, result);
        return result;
    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
