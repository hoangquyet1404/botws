module.exports = (api) => {
    const invoke = (method, ...args) => api.call(`callgroup.${method}`, ...args);

    return {
        buildUrl: (input, callback) => invoke('buildUrl', input).then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        decodeFrame: (data, callback) => invoke('decodeFrame', data).then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        decodeThrift: (data, callback) => invoke('decodeThrift', data).then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        inspect: (input, callback) => invoke('inspect', input).then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        buildSignalingUrl: (input, callback) => invoke('buildSignalingUrl', input).then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        discoverTurn: (input, callback) => invoke('discoverTurn', input).then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        connect: (input, callback) => invoke('connect', input).then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        start: (input, callback) => invoke('start', input).then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        disconnect: (connectionID, callback) => invoke('disconnect', connectionID).then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        listConnections: (callback) => invoke('listConnections').then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        ),
        getLastInspection: (callback) => invoke('getLastInspection').then(
            result => {
                if (callback) callback(null, result);
                return result;
            },
            error => {
                if (callback) callback(error);
                throw error;
            }
        )
    };
};
