const fs = require('fs');
const path = require('path');

const FCAApi = require('./api');
const LocalBridge = require('./ws/localBridge');
const PrivateWsClient = require('./ws/client');
const performAutoLogin = require('../main/utils/autolog');
const logger = require('../main/utils/log');

const cookiePath = path.join(__dirname, '../cookie.txt');

const getCookieFromFile = () => fs.existsSync(cookiePath) ? fs.readFileSync(cookiePath, 'utf8').trim() : '';

function sanitizeScope(value) {
    return String(value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getSessionE2EEKey(config = {}) {
    if (config.__e2eeSessionKey) {
        return sanitizeScope(config.__e2eeSessionKey);
    }

    const fallback = `bot-${process.pid}-${Date.now()}`;
    config.__e2eeSessionKey = fallback;
    return sanitizeScope(fallback);
}

function normalizeClientVersion(config = {}) {
    return /^fca2$/i.test(String(config.fca || config.api?.fca || '').trim()) ? 'fca2' : 'fcaPrime';
}

function normalizeError(error) {
    if (error instanceof Error) return error;
    return new Error(error?.message || error?.error || String(error));
}

async function saveCookieAndToken(cookie, token, config) {
    try {
        await performAutoLogin.saveSession(config, { cookie, access_token: token });
    } catch (error) {
        logger.error(`[FCA] Token save failed: ${error.message}`);
    }
}

function isAutologEnabled(config = {}) {
    return performAutoLogin.isAutologEnabled(config);
}

function buildSessionPayload(config, cookie, sessionInfo = {}) {
    return {
        cookie,
        token: config.token,
        fca: normalizeClientVersion(config),
        facebookAccount: config.facebookAccount,
        config: {
            sessionKey: getSessionE2EEKey(config)
        },
        botName: sessionInfo.botName || config.BOTNAME || 'Bot',
        userID: sessionInfo.userID || config.facebookAccount?.email || ''
    };
}

async function connectRemoteSession(remoteClient, config, cookie) {
    await remoteClient.connect(buildSessionPayload(config, cookie));
    const sessionInfo = remoteClient.sessionInfo || {};
    return {
        cookie,
        version: sessionInfo.version || normalizeClientVersion(config),
        userID: sessionInfo.userID || config.facebookAccount?.email || '',
        botName: sessionInfo.botName || config.BOTNAME || 'Bot'
    };
}

async function bootRemoteSession(remoteClient, config) {
    let cookie = getCookieFromFile() || config.cookie;
    const autologEnabled = isAutologEnabled(config);
    let lastError;

    if (cookie) {
        try {
            return await connectRemoteSession(remoteClient, config, cookie);
        } catch (error) {
            lastError = normalizeError(error);
            if (!autologEnabled) throw lastError;
            logger.warn(`[FCA] Remote boot failed: ${lastError.message}`);
            remoteClient.close();
        }
    } else if (!autologEnabled) {
        throw new Error('Missing cookie for remote FCA session');
    }

    for (let retryCount = 1; retryCount <= 3; retryCount++) {
        logger.warn(`[FCA] Auto-login attempt ${retryCount}/3...`);
        try {
            const autoData = await performAutoLogin(config);
            cookie = autoData.cookie;
            await saveCookieAndToken(cookie, autoData.access_token, config);
            return await connectRemoteSession(remoteClient, config, cookie);
        } catch (retryError) {
            lastError = normalizeError(retryError);
            remoteClient.close();
            logger.error(`[FCA] Attempt ${retryCount} failed: ${lastError.message}`);
            if (retryCount >= 3) throw performAutoLogin.createExhaustedError(lastError);
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    throw performAutoLogin.createExhaustedError(lastError || new Error('Remote FCA session failed'));
}

async function initFCA(config) {
    const bridge = new LocalBridge();
    const apiUrl = new URL(config.api.url);
    const remoteClient = new PrivateWsClient({
        apiUrl: config.api.url,
        wsUrl: config.api.wsUrl || config.api.wsURL || '',
        apiHost: apiUrl.hostname,
        apiPort: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
        apiKey: config.api.key,
        reconnectMinutes: config.reconnectMinutes,
        reconnectMs: config.reconnectMs || config.reconnectMilliseconds || config.reconnectIntervalMs,
        eventBridge: bridge
    });

    const remoteRuntime = await bootRemoteSession(remoteClient, config);
    logger.info(`[FCA] Remote session ready: ${remoteRuntime.botName} (${remoteRuntime.userID})`);

    const api = new FCAApi({
        localApi: null,
        remoteClient,
        eventBridge: bridge,
        config
    });

    api.loadMethods();

    Object.assign(api, {
        config,
        ws: bridge,
        botInfo: {
            botName: remoteRuntime.botName,
            userID: remoteRuntime.userID,
            sessionId: remoteRuntime.userID
        },
        localApi: null,
        remoteClient,
        msgEmitter: remoteClient
    });

    logger.info('[FCA] System initialized (remote private WS only)');
    return api;
}

module.exports = { initFCA };
