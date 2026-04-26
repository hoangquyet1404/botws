module.exports = (api) => async (callback) => {
    try {
        const result = await api.call('getE2EESession');
        if (callback) callback(null, result);
        return result;
    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
