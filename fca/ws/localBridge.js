class LocalBridge {
    constructor() {
        this.handlers = new Map();
    }

    on(type, handler) {
        this.handlers.set(`${type}:${this.handlers.size}:${Date.now()}`, { type, handler });
        return this;
    }

    emitMessage(message) {
        for (const { type, handler } of this.handlers.values()) {
            if (type === '*' || type === message?.type) {
                try {
                    handler(message);
                } catch (error) {
                    console.error('[LocalBridge] Handler error:', error.message);
                }
            }
        }
    }

    close() {
        this.handlers.clear();
    }
}

module.exports = LocalBridge;
