const axios = require('axios'), logger = require('./log'); 

async function performAutoLogin(config) {
    if (!config.status) throw new Error("Auto-login is disabled.");
    
    const acc = config.facebookAccount, apiUrl = config.api?.url;
    if (!acc?.email || !acc?.password) throw new Error("Missing email/password in config.");
    if (!apiUrl) throw new Error("Missing API URL in config.");

    logger('[AutoLog] Triggering auto-login...', 'info');

    const headers = { 'Content-Type': 'application/json', ...(config.api?.key && { 'x-api-key': config.api.key }) };
    const payload = { type: acc.type || 'apk', email: acc.email, password: acc.password, twofactor: acc.twofactor };

    try {
        const { data } = await axios.post(`${apiUrl}/api/autolog`, payload, { headers });
        
        if (data?.cookie) {
            logger('[AutoLog] Auto-login successful!', 'success');
            return data;
        }
        throw new Error(data?.error || 'Invalid response format');
    } catch (e) {
        throw new Error(`Auto-login failed: ${e.response?.data?.error || e.message}`);
    }
}

module.exports = performAutoLogin;