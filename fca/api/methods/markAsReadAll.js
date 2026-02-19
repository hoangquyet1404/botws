/**
 * markAsReadAll (Auto-generated wrapper)
 * Forwards call to FCA2 server via api.call
 */
module.exports = (api) => async (...args) => {
    let callback;
    // Standard FCA pattern: callback is the last argument if it's a function
    if (args.length > 0 && typeof args[args.length - 1] === 'function') {
        callback = args.pop();
    }
    
    try {
        const result = await api.call('markAsReadAll', ...args);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
