const axios = require('axios');

const BLOCKED_HEADER_NAMES = new Set(['host', 'connection', 'content-length', 'transfer-encoding']);
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

function getLimitBytes() {
    return Number(global.config?.api?.mediaConvertMaxBytes || process.env.BOT_MEDIA_CONVERT_DOWNLOAD_LIMIT_BYTES || 80 * 1024 * 1024);
}

function normalizeHeaders(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const headers = {};
    for (const [key, item] of Object.entries(value)) {
        const name = String(key || '').trim();
        if (!name || BLOCKED_HEADER_NAMES.has(name.toLowerCase())) continue;
        if (item === undefined || item === null) continue;
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
            headers[name] = String(item);
        }
    }
    return headers;
}

function streamToBuffer(stream, limitBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;

        stream.on('data', (chunk) => {
            size += chunk.length;
            if (size > limitBytes) {
                stream.destroy(new Error(`Media too large (${size} bytes)`));
                return;
            }
            chunks.push(Buffer.from(chunk));
        });
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

async function downloadMediaBuffer(url, extraHeaders = {}) {
    if (!url || typeof url !== 'string') {
        throw new Error('Missing media url');
    }

    const limitBytes = getLimitBytes();
    const headers = {
        'User-Agent': DEFAULT_UA,
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        ...normalizeHeaders(extraHeaders)
    };

    const response = await axios.get(url, {
        responseType: 'stream',
        headers,
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true
    });

    if (response.status < 200 || response.status >= 300) {
        if (response.data && typeof response.data.destroy === 'function') response.data.destroy();
        const error = new Error(`Download media failed with status ${response.status}`);
        error.status = response.status;
        throw error;
    }

    const declaredLength = Number(response.headers?.['content-length'] || 0);
    if (declaredLength > limitBytes) {
        response.data.destroy();
        throw new Error(`Media too large (${declaredLength} bytes)`);
    }

    const buffer = await streamToBuffer(response.data, limitBytes);
    return {
        buffer,
        contentType: response.headers?.['content-type'] || '',
        size: buffer.length
    };
}

async function downloadMediaAsBase64(url, extraHeaders = {}) {
    const media = await downloadMediaBuffer(url, extraHeaders);
    return {
        contentType: media.contentType,
        size: media.size,
        base64: media.buffer.toString('base64')
    };
}

module.exports = {
    downloadMediaAsBase64,
    downloadMediaBuffer
};
