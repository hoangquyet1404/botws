const WebSocket = require('ws'), logger = require('../../main/utils/log');

class FCAwsClient {
    constructor(config) {
        this.config = config;
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.messageHandlers = new Map();
        this.timers = {};
    }

    async connect() {
        return new Promise((resolve, reject) => {
            const isSecure = this.config.apiUrl?.startsWith('https'), protocol = isSecure ? 'wss' : 'ws';
            const fcaVer = this.config.api?.fca || 'fca3';
            const url = `${protocol}://${this.config.apiHost}${this.config.apiPort && !isSecure ? ':' + this.config.apiPort : ''}/ws/${fcaVer}/${this.config.sessionId}`;
            
            this.ws = new WebSocket(url);
            this.ws.on('open', () => {
                logger('WebSocket connected', 'success');
                this.connected = true;
                this.reconnectAttempts = 0;
                this.setupListeners();
                this.startHeartbeat();
                this.startStatusReporting();
                this.startAutoRestart();
                resolve(this);
            });

            this.ws.on('error', (err) => { logger(`WS Error: ${err.message}`, 'error'); reject(err); });
            this.ws.on('close', () => {
                //logger('WebSocket disconnected', 'warn');
                this.connected = false;
                this.clearTimers();
                this.handleReconnect();
            });
        });
    }

    setupListeners() {
        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'pong') return clearTimeout(this.timers.pong);
                //if (msg.error === 'Session not found') { logger('Session expired. Exiting...', 'error'); process.exit(1); }

                for (const [type, handler] of this.messageHandlers) {
                    if (type === msg.type || type === '*') handler(msg);
                }
            } catch (e) { logger(`Parse error: ${e.message}`, 'error'); }
        });
    }

    startHeartbeat() {
        this.timers.ping = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
                this.timers.pong = setTimeout(() => {
                    //logger('Ping timeout! Reconnecting...', 'error');
                    this.ws.close();
                }, 10000);
            }
        }, 30000);
    }

    startStatusReporting() {
        this.timers.status = setInterval(() => {
            if (this.connected && this.ws?.readyState === WebSocket.OPEN) 
                this.ws.send(JSON.stringify({ type: 'report_status', status: 'alive' }));
        }, 60000);
    }

    startAutoRestart() {
        const mins = this.config.reconnectMinutes || 60;
        this.timers.auto = setInterval(() => {
            logger(`Scheduled auto-reconnect triggered (${mins}m)`, 'info');
            this.ws.close();
        }, mins * 60000);
    }

    clearTimers() { Object.values(this.timers).forEach(t => { clearInterval(t); clearTimeout(t); }); }

    on(type, handler) { this.messageHandlers.set(type, handler); }

    send(data) {
        if (!this.connected) throw new Error('WS not connected');
        this.ws.send(JSON.stringify(data));
    }

    handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger('Max reconnect attempts reached.', 'error');
            process.exit(0);
        }
        const delay = Math.min(1000 * Math.pow(2, ++this.reconnectAttempts), 30000);
        logger(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`, 'warn');
        setTimeout(() => this.connect().catch(() => {}), delay);
    }

    close() { if (this.ws) { this.clearTimers(); this.ws.close(); this.connected = false; } }
}

module.exports = FCAwsClient;