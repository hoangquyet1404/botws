/**
 * createGroupMqtt (Wrapper)
 * Forwards call to FCA2 server via api.call
 * Matches API signature: (participants, threadName, options, callback)
 */
module.exports = (api) => async (participants, threadName, options, callback) => {
    // Handling optional arguments logic similar to server side or just pass through
    // But since it's a wrapper, we should try to normalize or let server normalize.
    // Ideally we just pass them as is.

    // Argument shifting logic (to support optional args like server usually does)
    // Server has logic:
    /*
    if (typeof threadName === "function") { callback = threadName; threadName = null; options = {}; }
    if (typeof threadName === "object") { callback = options; options = threadName; threadName = null; }
    if (typeof options === "function") { callback = options; options = {}; }
    */
    // We can replicate this or just let the caller be strict. 
    // Given the user wants "param goc" (original params), I should support the flexible signature if possible,
    // OR just pass arguments in order.
    // `api.call` usually stringifies arguments or passes them. 
    // If I use `api.call('createGroupMqtt', participants, threadName, options)`, it sends 3 args.
    // The server receives them and does its own shifting logic.
    // So the client wrapper just needs to accept them.

    // Note: The last argument in client-side 'sendMessage' etc is usually callback.
    // Here we can use `...args` or explicit.

    // Explicit to be clear:
    try {
        // Handle argument shifting locally to ensure correct params sent to server?
        // Actually, if we send (participants, fn, undefined), server receives (participants, fn, undefined).
        // Server checks `typeof threadName === "function"`. `fn` is function? JSON.stringify of function is undefined?
        // Wait, `api.call` uses socket.io/websocket? 
        // If it's pure JSON, functions are NOT sent.
        // So the shifting logic ON THE SERVER depends on receiving values.

        // If client calls `createGroup([1,2], cb)`,
        // `threadName` is cb. `options` is undefined. `callback` is undefined.
        // `api.call` will probably NOT send the callback function over network.
        // The callback mechanism in `api.call` usually works by registering a customized callback id.

        // So I should just forward the data arguments suitable for JSON.
        // The `callback` passed to THIS wrapper is the client-side callback.

        // So:
        if (typeof threadName === 'function') {
            callback = threadName;
            threadName = null;
            options = {};
        } else if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        // Support (participants, options, cb) if threadName is omitted?
        // Server logic:
        // if (typeof threadName === "object") { callback = options; options = threadName; threadName = null; }
        if (typeof threadName === 'object' && threadName !== null && !Array.isArray(threadName)) {
            options = threadName;
            threadName = null;
        }

        const result = await api.call('createGroupMqtt', participants, threadName, options);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
