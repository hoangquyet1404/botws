const WebSocket = require('ws');
const WS_NOT_FOUND_MESSAGE = 'Private WS /ws/private not found. Deploy latest backend or enable WebSocket upgrade on proxy.';
const WS_UPGRADE_REQUIRED_MESSAGE = 'Private WS reached HTTP route but was not upgraded. Check nginx/WebSocket proxy headers.';
const logger = require('../../main/utils/log');

const KEY_REGISTER_MESSAGE = 'Vui lòng truy cập website https://khotools.com để đăng kí tài khoản lấy key';
const HISTORY_REPLAY_GRACE_MS = 5000;
const MAX_TIMER_MS = 2147483647;
const MAX_TIMER_MINUTES = Math.floor(MAX_TIMER_MS / 60000);

function toTimestampMs(value) {
    if (value === undefined || value === null || value === '') return 0;
    const raw = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(raw)) {
        return raw < 10_000_000_000 ? raw * 1000 : raw;
    }

    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
}

function getEventTimestampMs(event) {
    if (!event || typeof event !== 'object') return 0;
    const data = event.data && typeof event.data === 'object' ? event.data : {};
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};

    return toTimestampMs(
        event.timestamp ||
        event.serverTimestamp ||
        event.messageTimestamp ||
        event.createdAt ||
        event.sentAt ||
        data.timestamp ||
        data.serverTimestamp ||
        data.messageTimestamp ||
        data.createdAt ||
        data.sentAt ||
        payload.timestamp ||
        payload.serverTimestamp ||
        payload.messageTimestamp ||
        payload.createdAt ||
        payload.sentAt
    );
}

function shouldPreserveRuntimeEvent(event) {
    if (!event || typeof event !== 'object') return true;
    const data = event.data && typeof event.data === 'object' ? event.data : {};
    const topic = String(event.topic || data.topic || '');
    const type = String(event.type || data.type || '').toLowerCase();
    const dataType = String(event.dataType || data.dataType || '').toLowerCase();

    return (
        topic === '/mqtt_status' ||
        topic === '/mqtt_logout' ||
        type === 'system_event' ||
        type === 'mqtt_error' ||
        dataType === 'logout' ||
        dataType === 'checkpoint'
    );
}

function markPrivateWsSessionEvent(event, meta) {
    if (!event || typeof event !== 'object') return event;

    const sessionInitStartedAt = Number(meta?.sessionInitStartedAt || 0);
    const output = {
        ...event,
        privateWsSessionInitStartedAt: sessionInitStartedAt || undefined,
        privateWsSessionReadyAt: meta?.sessionReadyAt || undefined,
        privateWsReconnectGeneration: meta?.reconnectGeneration || 0
    };

    if (!sessionInitStartedAt || shouldPreserveRuntimeEvent(event)) {
        return output;
    }

    const timestamp = getEventTimestampMs(event);
    if (timestamp > 0 && timestamp < sessionInitStartedAt - HISTORY_REPLAY_GRACE_MS) {
        return {
            ...output,
            isHistory: true,
            isReplay: true,
            isPreloaded: true,
            replaySource: event.replaySource || 'private_ws_session_reconnect'
        };
    }

    return output;
}

function createHandshakeError(statusCode, message) {
    const error = new Error(message || `Unexpected server response: ${statusCode}`);
    error.statusCode = statusCode;

    if (Number(statusCode) === 403) {
        error.code = 'PRIVATE_WS_FORBIDDEN';
        error.stopReconnect = true;
    }

    if (Number(statusCode) === 404) {
        error.code = 'PRIVATE_WS_NOT_FOUND';
        error.stopReconnect = true;
    }

    if (Number(statusCode) === 426) {
        error.code = 'PRIVATE_WS_UPGRADE_REQUIRED';
        error.stopReconnect = true;
    }

    return error;
}

function formatWsError(error) {
    const statusCode = Number(error?.statusCode || 0);
    if (statusCode === 403 || /Unexpected server response:\s*403/i.test(error?.message || '')) {
        return KEY_REGISTER_MESSAGE;
    }

    if (statusCode === 404 || /Unexpected server response:\s*404/i.test(error?.message || '')) {
        return WS_NOT_FOUND_MESSAGE;
    }

    if (statusCode === 426 || /Unexpected server response:\s*426/i.test(error?.message || '')) {
        return WS_UPGRADE_REQUIRED_MESSAGE;
    }

    return error?.message || String(error);
}

function normalizeReconnectIntervalMs(config = {}) {
    const explicitMs = Number(config.reconnectMs || config.reconnectMilliseconds || config.reconnectIntervalMs || 0);
    if (Number.isFinite(explicitMs) && explicitMs > 0) {
        return Math.min(explicitMs, MAX_TIMER_MS);
    }

    const rawMinutes = Number(config.reconnectMinutes || 60);
    if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) {
        return 60 * 60000;
    }

    const intervalMs = rawMinutes > MAX_TIMER_MINUTES ? rawMinutes : rawMinutes * 60000;
    return Math.min(intervalMs, MAX_TIMER_MS);
}

function formatDurationMs(ms) {
    if (ms % 60000 === 0) return `${ms / 60000}m`;
    if (ms % 1000 === 0) return `${ms / 1000}s`;
    return `${ms}ms`;
}

class PrivateWsClient {
    constructor(config) {
        this.config = config;
        this.ws = null;
        this.connected = false;
        this.initialized = false;
        this.stopReconnect = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pendingCalls = new Map();
        this.sessionPayload = null;
        this.sessionInfo = null;
        this.sessionInitStartedAt = 0;
        this.sessionReadyAt = 0;
        this.reconnectGeneration = 0;
        this.callId = 0;
        this.timers = {};
    }

    async connect(sessionPayload) {
        if (sessionPayload) {
            this.sessionPayload = sessionPayload;
        }
        if (!this.sessionPayload) {
            throw new Error('Missing remote session payload');
        }
        this.stopReconnect = false;

        return new Promise((resolve, reject) => {
            const isSecure = this.config.apiUrl?.startsWith('https');
            const protocol = isSecure ? 'wss' : 'ws';
            const url = this.config.wsUrl || `${protocol}://${this.config.apiHost}${this.config.apiPort && !isSecure ? ':' + this.config.apiPort : ''}/ws/private`;
            const headers = {};

            if (this.config.apiKey) {
                headers['x-api-key'] = this.config.apiKey;
            }

            logger(`Private WS connecting: ${url}`, 'info');
            this.ws = new WebSocket(url, { headers });

            const failConnect = (error) => {
                this.connected = false;
                this.initialized = false;
                if (error?.stopReconnect) {
                    this.stopReconnect = true;
                }
                try {
                    this.ws?.close();
                } catch {}
                reject(error);
            };

            this.ws.once('open', () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                this.setupListeners();
                this.startHeartbeat();
                this.startAutoRestart();

                this.initSession(this.sessionPayload)
                    .then(() => {
                        logger('Private WS connected', 'success');
                        resolve(this);
                    })
                    .catch(failConnect);
            });

            this.ws.once('unexpected-response', (request, response) => {
                const statusCode = Number(response?.statusCode || 0);
                const error = createHandshakeError(
                    statusCode,
                    statusCode === 403
                        ? KEY_REGISTER_MESSAGE
                        : statusCode === 404
                            ? WS_NOT_FOUND_MESSAGE
                            : statusCode === 426
                                ? WS_UPGRADE_REQUIRED_MESSAGE
                                : `Unexpected server response: ${statusCode}`
                );
                logger(`Private WS Error: ${formatWsError(error)}`, 'error');
                failConnect(error);
            });

            this.ws.once('error', (err) => {
                logger(`Private WS Error: ${formatWsError(err)}`, 'error');
                failConnect(err);
            });

            this.ws.on('error', (err) => {
                logger(`Private WS Error: ${formatWsError(err)}`, 'error');
            });

            this.ws.on('close', () => {
                this.connected = false;
                this.initialized = false;
                this.clearTimers();
                this.rejectPendingCalls(new Error('Private WS disconnected'));
                this.handleReconnect();
            });
        });
    }

    setupListeners() {
        this.ws.on('message', (data) => {
            let msg;
            try {
                msg = JSON.parse(data.toString());
            } catch (error) {
                logger(`Private WS parse error: ${error.message}`, 'error');
                return;
            }

            if (msg.type === 'pong') {
                clearTimeout(this.timers.pong);
                return;
            }

            if (msg.type === 'session_ready') {
                this.initialized = true;
                this.sessionReadyAt = Date.now();
                this.sessionInfo = msg.data || {};
                if (this.timers.sessionInitReject) {
                    clearTimeout(this.timers.sessionInitReject.timeout);
                    this.timers.sessionInitReject.resolve(msg.data || {});
                    delete this.timers.sessionInitReject;
                }
                return;
            }

            if (msg.type === 'event') {
                const event = markPrivateWsSessionEvent(msg.data || msg.event || {}, {
                    sessionInitStartedAt: this.sessionInitStartedAt,
                    sessionReadyAt: this.sessionReadyAt,
                    reconnectGeneration: this.reconnectGeneration
                });
                this.config.eventBridge?.emitMessage?.(event);
                return;
            }

            if (msg.type === 'session_error') {
                const error = new Error(msg.error || 'Remote session init failed');
                if (this.timers.sessionInitReject) {
                    clearTimeout(this.timers.sessionInitReject.timeout);
                    this.timers.sessionInitReject.reject(error);
                    delete this.timers.sessionInitReject;
                }
                return;
            }

            if (msg.type === 'result' || msg.type === 'rpc_result') {
                const pending = this.pendingCalls.get(msg.id);
                if (!pending) return;

                clearTimeout(pending.timeout);
                this.pendingCalls.delete(msg.id);
                pending.resolve(msg.data);
                return;
            }

            if (msg.type === 'error' || msg.type === 'rpc_error') {
                const pending = this.pendingCalls.get(msg.id);
                const error = new Error(msg.error || 'Remote call failed');
                if (msg.code) error.code = msg.code;
                if (msg.details) error.details = msg.details;
                if (!pending) {
                    logger(`Private WS server error: ${error.message}`, 'error');
                    return;
                }

                clearTimeout(pending.timeout);
                this.pendingCalls.delete(msg.id);
                pending.reject(error);
            }
        });
    }

    async initSession(sessionPayload) {
        if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
            throw new Error('Private WS not connected');
        }

        return new Promise((resolve, reject) => {
            this.sessionInitStartedAt = Date.now();
            this.sessionReadyAt = 0;
            const timeout = setTimeout(() => {
                delete this.timers.sessionInitReject;
                reject(new Error('Remote session init timeout'));
            }, 30000);

            this.timers.sessionInitReject = { resolve, reject, timeout };
            this.ws.send(JSON.stringify({ type: 'session.init', payload: sessionPayload }));
        });
    }

    startHeartbeat() {
        this.timers.ping = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
                this.timers.pong = setTimeout(() => {
                    this.ws.close();
                }, 10000);
            }
        }, 30000);
    }

    startAutoRestart() {
        const intervalMs = normalizeReconnectIntervalMs(this.config);
        this.timers.auto = setInterval(() => {
            logger(`Private WS scheduled reconnect (${formatDurationMs(intervalMs)})`, 'info');
            this.ws.close();
        }, intervalMs);
    }

    clearTimers() {
        Object.values(this.timers).forEach((entry) => {
            if (!entry) return;
            if (typeof entry === 'object' && entry.timeout) {
                clearTimeout(entry.timeout);
                return;
            }
            clearInterval(entry);
            clearTimeout(entry);
        });
        this.timers = {};
    }

    rejectPendingCalls(error) {
        for (const pending of this.pendingCalls.values()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        this.pendingCalls.clear();
    }

    handleReconnect() {
        if (this.stopReconnect) {
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger('Private WS max reconnect attempts reached.', 'error');
            return;
        }

        this.reconnectGeneration += 1;
        const delay = Math.min(1000 * Math.pow(2, ++this.reconnectAttempts), 30000);
        logger(`Private WS reconnecting in ${delay}ms...`, 'warn');
        setTimeout(() => {
            this.connect().catch(() => {});
        }, delay);
    }

    async call(method, ...args) {
        if (!this.connected || !this.initialized || this.ws?.readyState !== WebSocket.OPEN) {
            throw new Error('Private WS session not ready');
        }

        const id = `rpc_${++this.callId}_${Date.now()}`;
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingCalls.delete(id);
                reject(new Error(`Timeout: ${method}`));
            }, 120000);

            this.pendingCalls.set(id, { resolve, reject, timeout });
            this.ws.send(JSON.stringify({
                type: 'call',
                id,
                method,
                args
            }));
        });
    }

    updateSessionPayload(nextPayload) {
        this.sessionPayload = nextPayload;
    }

    close() {
        this.clearTimers();
        this.stopReconnect = true;
        if (this.ws) {
            this.ws.close();
        }
        this.connected = false;
        this.initialized = false;
    }
}

module.exports = PrivateWsClient;
