const axios = require('axios'), fs = require('fs'), path = require('path');
const FCAwsClient = require('./ws/client'), FCAApi = require('./api');
const performAutoLogin = require('../main/utils/autolog'), logger = require('../main/utils/log');

const cookiePath = path.join(__dirname, '../cookie.txt'), configPath = path.join(__dirname, '../config.json');
const getCookieFromFile = () => fs.existsSync(cookiePath) ? fs.readFileSync(cookiePath, 'utf8').trim() : '';

async function saveCookieAndToken(cookie, token, config) {
    fs.writeFileSync(cookiePath, cookie, 'utf8');
    if (token) {
        config.token = token;
        try { fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8'); }
        catch (e) { logger.error(`[FCA] Token save failed: ${e.message}`); }
    }
}

async function initFCA(config) {
    const headers = { 'Content-Type': 'application/json', ...(config.api.key && { 'x-api-key': config.api.key }) };
    let cookie = (await getCookieFromFile()) || config.cookie, loginRes;
    const loginData = { cookie, facebookAccount: config.facebookAccount };
    const fcaVer = config.api.fca || 'fca3';

    try {
        loginRes = await axios.post(`${config.api.url}/api/${fcaVer}/login`, loginData, { headers });
        if (!loginRes.data.success) throw new Error(loginRes.data.error);
    } catch (err) {
        if (err.response && err.response.status === 500) logger.error('[FCA] Cookie lỗi vui lòng lấy cookie khác');

        if (!config.status) { logger.error('[FCA] Login failed (Auto-login disabled).'); process.exit(0); }

        let retryCount = 0, success = false;
        while (retryCount < 3 && !success) {
            retryCount++;
            logger.warn(`[FCA] Auto-login attempt ${retryCount}/3...`);
            try {
                const autoData = await performAutoLogin(config);
                await saveCookieAndToken(autoData.cookie, autoData.access_token, config);
                loginData.cookie = autoData.cookie;
                loginRes = await axios.post(`${config.api.url}/api/${fcaVer}/login`, loginData, { headers });
                if (loginRes.data.success) success = true; else throw new Error(loginRes.data.error);
            } catch (e) {
                logger.error(`[FCA] Attempt ${retryCount} failed: ${e.message}`);
                if (retryCount >= 3) { logger.error('[FCA] Max retries reached.'); process.exit(0); }
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    const { sessionId, botName, userID } = loginRes.data.data;
    logger.info(`[FCA] Logged in: ${botName} (${userID})`);

    const apiUrl = new URL(config.api.url);
    const wsClient = new FCAwsClient({
        apiUrl: config.api.url, apiHost: apiUrl.hostname,
        apiPort: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80), sessionId,
        api: config.api
    });

    await wsClient.connect();
    const api = new FCAApi(wsClient);
    api.loadMethods();
    Object.assign(api, { config, botInfo: { botName, userID, sessionId } });

    logger.info('[FCA] System Initialized');
    return api;
}

module.exports = { initFCA };