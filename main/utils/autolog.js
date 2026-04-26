const axios = require('axios'), logger = require('./log'); 
const fs = require('fs'), path = require('path');

const botRoot = path.resolve(__dirname, '../..');
const cookiePath = path.join(botRoot, 'cookie.txt');
const configPath = path.join(botRoot, 'config.json');

function isAutologEnabled(config = {}) {
    return config.autolog !== undefined ? Boolean(config.autolog) : Boolean(config.status);
}

function normalizeAutologConfig(config = {}) {
    if (config.autolog === undefined && config.status !== undefined) {
        config.autolog = Boolean(config.status);
    }
    delete config.status;
    return config;
}

function parseJsonLike(value) {
    if (typeof value !== 'string') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function appStateToCookie(appState) {
    if (!Array.isArray(appState)) {
        return '';
    }

    return appState
        .map((cookie) => {
            const name = cookie && (cookie.name || cookie.key);
            const value = cookie && cookie.value;
            return name && value !== undefined ? `${name}=${value}` : '';
        })
        .filter(Boolean)
        .join('; ');
}

function findAutoLoginPayload(raw, depth = 0) {
    const value = parseJsonLike(raw);
    if (!value || typeof value !== 'object' || depth > 4) {
        return null;
    }

    const cookie = value.cookie || value.cookies || value.cookieString || appStateToCookie(value.appState || value.appstate);
    const token = value.access_token || value.accessToken || value.token;
    if (cookie || token || value.uid || value.userID || value.userId) {
        return value;
    }

    for (const key of ['data', 'result', 'payload', 'account', 'session']) {
        const nested = findAutoLoginPayload(value[key], depth + 1);
        if (nested) {
            return nested;
        }
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = findAutoLoginPayload(item, depth + 1);
            if (nested) {
                return nested;
            }
        }
    }

    return null;
}

function getAutoLoginErrorMessage(raw) {
    const value = parseJsonLike(raw);
    if (!value || typeof value !== 'object') {
        return typeof value === 'string' && value ? value : '';
    }

    return value.error || value.message || value.msg || value.reason || '';
}

function normalizeAutoLoginResponse(raw) {
    const payload = findAutoLoginPayload(raw);
    if (!payload) {
        throw new Error(getAutoLoginErrorMessage(raw) || 'Invalid response format');
    }

    const cookie = payload.cookie || payload.cookies || payload.cookieString || appStateToCookie(payload.appState || payload.appstate);
    if (!cookie) {
        throw new Error(getAutoLoginErrorMessage(raw) || 'Invalid response format: missing cookie');
    }

    return {
        ...payload,
        uid: payload.uid || payload.userID || payload.userId,
        access_token: payload.access_token || payload.accessToken || payload.token,
        cookie
    };
}

function createAutologExhaustedError(error) {
    const message = error && error.message ? error.message : String(error || 'Auto-login failed');
    const exhausted = new Error(`Auto-login failed after 3 attempts: ${message}`);
    exhausted.code = 'AUTOLOGIN_EXHAUSTED';
    exhausted.stopRestart = true;
    exhausted.cause = error;
    return exhausted;
}

function shouldStopRestart(error) {
    return Boolean(error && (error.stopRestart || error.code === 'AUTOLOGIN_EXHAUSTED'));
}

async function saveAutoLoginSession(config, data = {}) {
    let persistedConfig = { ...config };
    try {
        if (fs.existsSync(configPath)) {
            persistedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch {
        persistedConfig = { ...config };
    }

    if (data.cookie) {
        fs.writeFileSync(cookiePath, data.cookie, 'utf8');
        config.cookie = data.cookie;
        persistedConfig.cookie = data.cookie;
    }

    const token = data.access_token || data.token;
    if (token) {
        config.token = token;
        persistedConfig.token = token;
    }

    normalizeAutologConfig(config);
    normalizeAutologConfig(persistedConfig);
    fs.writeFileSync(configPath, JSON.stringify(persistedConfig, null, 4), 'utf8');
}

async function performAutoLogin(config) {
    if (!isAutologEnabled(config)) throw new Error("Auto-login is disabled.");
    
    const acc = config.facebookAccount, apiUrl = config.api?.url;
    if (!acc?.email || !acc?.password) throw new Error("Missing email/password in config.");
    if (!apiUrl) throw new Error("Missing API URL in config.");

    logger('[AutoLog] Triggering auto-login...', 'info');

    const headers = { 'Content-Type': 'application/json', ...(config.api?.key && { 'x-api-key': config.api.key }) };
    const payload = { type: acc.type || 'apk', email: acc.email, password: acc.password, twofactor: acc.twofactor };

    try {
        const { data } = await axios.post(`${apiUrl}/api/v1/autolog`, payload, { headers });
        const normalized = normalizeAutoLoginResponse(data);
        logger('[AutoLog] Auto-login successful!', 'success');
        return normalized;
    } catch (e) {
        if (e.response && e.response.data) {
            try {
                const normalized = normalizeAutoLoginResponse(e.response.data);
                logger('[AutoLog] Auto-login successful!', 'success');
                return normalized;
            } catch {
                // Use the explicit API error below.
            }
        }

        throw new Error(`Auto-login failed: ${getAutoLoginErrorMessage(e.response?.data) || e.message}`);
    }
}

performAutoLogin.isAutologEnabled = isAutologEnabled;
performAutoLogin.saveSession = saveAutoLoginSession;
performAutoLogin.normalizeConfig = normalizeAutologConfig;
performAutoLogin.normalizeResponse = normalizeAutoLoginResponse;
performAutoLogin.createExhaustedError = createAutologExhaustedError;
performAutoLogin.shouldStopRestart = shouldStopRestart;

module.exports = performAutoLogin;
