const fs = require('fs'), path = require('path'), logger = require('../../main/utils/log');

class FCAApi {
    constructor(wsClient) {
        this.ws = wsClient;
        this.pendingCalls = new Map();
        this.callId = 0;
        this.ws.on('api_response', (msg) => this.handleResponse(msg));
    }

    handleResponse(msg) {
        const pending = this.pendingCalls.get(msg.callId);
        if (!pending) return;
        this.pendingCalls.delete(msg.callId);

        if (msg.error) {
            const err = typeof msg.error === 'object' ? JSON.stringify(msg.error) : String(msg.error);
            pending.reject(new Error(err));
        } else pending.resolve(msg.result);
    }

    getCurrentUserID = () => this.botInfo?.userID;

    call(method, ...args) {
        const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
        const promise = new Promise((resolve, reject) => {
            const id = ++this.callId;
            this.pendingCalls.set(id, { resolve, reject });
            this.ws.send({ type: 'api_call', callId: id, method, args });

            setTimeout(() => {
                if (this.pendingCalls.has(id)) {
                    this.pendingCalls.delete(id);
                    reject(new Error(`Timeout: ${method}`));
                }
            }, 120000);
        });

        if (callback) promise.then(res => callback(null, res)).catch(err => callback(err));
        return promise;
    }

    loadMethods() {
        const mPath = path.join(__dirname, 'methods');
        if (!fs.existsSync(mPath)) return logger('Methods folder not found', 'warn');

        const files = fs.readdirSync(mPath).filter(f => f.endsWith('.js'));
        files.forEach(file => {
            try {
                const name = file.replace('.js', '');
                this[name] = require(path.join(mPath, file))(this);
            } catch (e) { logger(`Failed to load ${file}: ${e.message}`, 'error'); }
        });
        logger(`Loaded ${files.length} methods successfully`, 'success');
    }
}

module.exports = FCAApi;