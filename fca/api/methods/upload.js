const fs = require('fs');
const path = require('path');
const stream = require('stream');

const MIME_BY_EXTENSION = {
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.m4a': 'audio/mp4',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.png': 'image/png',
    '.txt': 'text/plain',
    '.wav': 'audio/wav',
    '.webm': 'video/webm',
    '.webp': 'image/webp'
};

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isReadableStream(value) {
    return value instanceof stream.Stream &&
        (typeof value._read === 'function' || typeof value._readableState === 'object');
}

function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || ''));
}

function isDataUri(value) {
    return /^data:/i.test(String(value || ''));
}

async function streamToBuffer(input) {
    if (Buffer.isBuffer(input)) return input;
    return await new Promise((resolve, reject) => {
        const chunks = [];
        input.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        input.on('error', reject);
        input.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

function decodeDataUri(value) {
    const matched = String(value || '').match(/^data:([^;,]+);base64,(.+)$/i);
    if (!matched) return null;
    return {
        buffer: Buffer.from(matched[2], 'base64'),
        contentType: matched[1] || 'application/octet-stream'
    };
}

function decodeBase64Buffer(value) {
    if (!value || typeof value !== 'string') return null;
    const dataUri = decodeDataUri(value);
    if (dataUri) return dataUri.buffer;
    return Buffer.from(value, 'base64');
}

function extractNameFromUrl(url) {
    try {
        const parsed = new URL(url);
        const baseName = path.basename(parsed.pathname || '');
        return baseName ? decodeURIComponent(baseName) : 'attachment.bin';
    } catch {
        return 'attachment.bin';
    }
}

function inferMimeType(filename, fallback) {
    const explicit = String(fallback || '').trim();
    if (explicit) return explicit;
    return MIME_BY_EXTENSION[path.extname(String(filename || '')).toLowerCase()] || 'application/octet-stream';
}

function inferMediaType(filename, mimeType, explicit) {
    const raw = String(explicit || '').toLowerCase();
    if (['image', 'video', 'audio', 'gif', 'file', 'document'].includes(raw)) return raw;

    const mime = String(mimeType || '').toLowerCase();
    const ext = path.extname(String(filename || '')).toLowerCase();
    if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        return mime === 'image/gif' || ext === '.gif' ? 'gif' : 'image';
    }
    if (mime.startsWith('video/') || ['.mp4', '.m4v', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) return 'video';
    if (mime.startsWith('audio/') || ['.mp3', '.m4a', '.ogg', '.opus', '.wav', '.aac', '.flac'].includes(ext)) return 'audio';
    return undefined;
}

function withTransportMetadata(payload, options = {}) {
    const filename = payload.filename || payload.fileName || payload.name || options.filename || options.fileName || options.name || 'attachment.bin';
    const contentType = inferMimeType(filename, payload.contentType || payload.mimeType || payload.mimetype || options.contentType || options.mimeType || options.mimetype);
    const mediaType = inferMediaType(filename, contentType, payload.mediaType || payload.type || options.mediaType || options.type);
    return {
        ...payload,
        filename,
        fileName: payload.fileName || filename,
        contentType,
        mimeType: payload.mimeType || contentType,
        mediaType
    };
}

function keepRemoteContentType(payload, source = {}, options = {}) {
    const explicitContentType = source.contentType || source.mimeType || source.mimetype ||
        options.contentType || options.mimeType || options.mimetype;
    const ext = path.extname(String(payload.filename || payload.fileName || payload.name || '')).toLowerCase();
    if (!explicitContentType && !MIME_BY_EXTENSION[ext]) {
        const next = { ...payload };
        delete next.contentType;
        delete next.mimeType;
        return next;
    }
    return payload;
}

async function normalizeUploadSource(source, options = {}) {
    if (Array.isArray(source)) {
        return Promise.all(source.map((item) => normalizeUploadSource(item, options)));
    }

    if (Buffer.isBuffer(source)) {
        return withTransportMetadata({ buffer: source }, options);
    }

    if (isReadableStream(source)) {
        const filename = source.path ? path.basename(String(source.path)) : (options.filename || options.fileName || 'attachment.bin');
        const buffer = await streamToBuffer(source);
        return withTransportMetadata({
            buffer,
            filename,
            contentType: source.contentType || source.mimeType || source.mimetype
        }, options);
    }

    if (typeof source === 'string') {
        if (isDataUri(source)) {
            const decoded = decodeDataUri(source);
            if (!decoded) throw new Error('upload: invalid data URI');
            const ext = decoded.contentType.split('/')[1] || 'bin';
            return withTransportMetadata({
                buffer: decoded.buffer,
                filename: options.filename || options.fileName || `attachment.${ext}`,
                contentType: decoded.contentType
            }, options);
        }

        if (isHttpUrl(source)) {
            return keepRemoteContentType(withTransportMetadata({
                url: source,
                filename: options.filename || options.fileName || extractNameFromUrl(source),
                contentType: options.contentType || options.mimeType
            }, options), {}, options);
        }

        const filePath = path.resolve(source);
        const filename = options.filename || options.fileName || path.basename(filePath);
        return withTransportMetadata({
            buffer: await fs.promises.readFile(filePath),
            filename,
            path: filePath,
            contentType: options.contentType || options.mimeType
        }, options);
    }

    if (isPlainObject(source)) {
        if (source.path && typeof source.path === 'string') {
            const filePath = path.resolve(source.path);
            const filename = source.filename || source.fileName || source.name || options.filename || options.fileName || path.basename(filePath);
            return withTransportMetadata({
                ...source,
                buffer: await fs.promises.readFile(filePath),
                filename,
                path: filePath
            }, options);
        }

        const rawBuffer = source.buffer || source.data || source.base64 || source.dataBase64;
        if (Buffer.isBuffer(rawBuffer)) {
            return withTransportMetadata({ ...source, buffer: rawBuffer }, options);
        }
        if (typeof rawBuffer === 'string') {
            return withTransportMetadata({ ...source, buffer: decodeBase64Buffer(rawBuffer) }, options);
        }

        const url = source.url || source.download_url || source.downloadUrl;
        if (typeof url === 'string' && isHttpUrl(url)) {
            return keepRemoteContentType(withTransportMetadata({
                ...source,
                url,
                filename: source.filename || source.fileName || source.name || options.filename || options.fileName || extractNameFromUrl(url)
            }, options), source, options);
        }
    }

    throw new Error('upload: source must be a path, url, stream, Buffer, data URI, or { path/buffer/url } object');
}

module.exports = (api) => async (source, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    options = options || {};

    if (!source) throw new Error('upload: source is required');

    try {
        const normalizedSource = await normalizeUploadSource(source, options);
        const threadID = options.threadID || options.threadId || options.targetThreadID || options.targetThreadId;
        const callOptions = threadID ? { threadID } : undefined;
        const result = callOptions
            ? await api.call('upload', normalizedSource, callOptions)
            : await api.call('upload', normalizedSource);
        if (callback) callback(null, result);
        return result;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
