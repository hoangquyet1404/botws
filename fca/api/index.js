const fs = require('fs');
const path = require('path');
const stream = require('stream');
const logger = require('../../main/utils/log');

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
    '.wav': 'audio/wav',
    '.webm': 'video/webm',
    '.webp': 'image/webp'
};

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isReplyTargetObject(value) {
    return Boolean(
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        (
            value.messageID ||
            value.messageId ||
            value.id ||
            value.senderJid ||
            value.senderJID ||
            value.senderID ||
            value.senderId
        )
    );
}

function isReadableStream(value) {
    return value instanceof stream.Stream &&
        (typeof value._read === 'function' || typeof value._readableState === 'object');
}

async function streamToBuffer(input) {
    if (Buffer.isBuffer(input)) {
        return input;
    }

    return await new Promise((resolve, reject) => {
        const chunks = [];
        input.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        input.on('error', reject);
        input.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

function encodeTransportBuffer(buffer) {
    return {
        __type: 'Buffer',
        base64: Buffer.from(buffer).toString('base64')
    };
}

function inferMediaTypeFromFile(filename, mimeType) {
    const mime = String(mimeType || '').toLowerCase();
    const ext = path.extname(String(filename || '')).toLowerCase();

    if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        return mime === 'image/gif' || ext === '.gif' ? 'gif' : 'image';
    }
    if (mime.startsWith('video/') || ['.mp4', '.m4v', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) {
        return 'video';
    }
    if (mime.startsWith('audio/') || ['.mp3', '.m4a', '.ogg', '.opus', '.wav', '.aac', '.flac'].includes(ext)) {
        return 'audio';
    }
    return undefined;
}

function inferMimeTypeFromFile(filename, fallback) {
    const raw = String(fallback || '').trim();
    if (raw) return raw;
    return MIME_BY_EXTENSION[path.extname(String(filename || '')).toLowerCase()];
}

async function normalizeRemoteTransportValue(value) {
    if (value === undefined || value === null) {
        return value;
    }

    if (Buffer.isBuffer(value)) {
        return encodeTransportBuffer(value);
    }

    if (isReadableStream(value)) {
        const buffer = await streamToBuffer(value);
        const filename = value.path ? path.basename(String(value.path)) : 'attachment.bin';
        const mimeType = inferMimeTypeFromFile(filename, value.mimeType || value.mimetype || value.contentType);
        return {
            buffer: encodeTransportBuffer(buffer),
            filename,
            mimeType,
            contentType: mimeType,
            mediaType: inferMediaTypeFromFile(filename, mimeType)
        };
    }

    if (Array.isArray(value)) {
        return await Promise.all(value.map((item) => normalizeRemoteTransportValue(item)));
    }

    if (!isPlainObject(value)) {
        return value;
    }

    const normalized = {};
    for (const [key, item] of Object.entries(value)) {
        normalized[key] = await normalizeRemoteTransportValue(item);
    }

    const filename = normalized.filename || normalized.fileName || normalized.name || normalized.path || normalized.url;
    const mimeType = inferMimeTypeFromFile(filename, normalized.mimeType || normalized.mimetype || normalized.contentType);
    if (filename && mimeType && !normalized.mimeType && !normalized.contentType) {
        normalized.mimeType = mimeType;
        normalized.contentType = mimeType;
    }
    if (filename && !normalized.mediaType) {
        const mediaType = inferMediaTypeFromFile(filename, normalized.mimeType || normalized.contentType || normalized.mimetype);
        if (mediaType) normalized.mediaType = mediaType;
    }

    return normalized;
}

function normalizeID(value) {
    return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeJid(value) {
    const normalized = normalizeID(value);
    if (!normalized) return '';
    return normalized.includes('@') ? normalized : `${normalized}@msgr`;
}

function stripJidDevice(value) {
    const normalized = normalizeJid(value);
    const match = normalized.match(/^([^:@]+)(?::\d+)?@([^@]+)$/i);
    return match ? `${match[1]}@${match[2]}` : normalized;
}

function extractUserIDFromJid(value) {
    const match = normalizeID(value).match(/^(\d+)/);
    return match ? match[1] : '';
}

const DEFAULT_LOCAL_METHODS = new Set([
    'getCurrentUserID',
    'addToGroup',
    'addUserToGroup',
    'changeAdminStatus',
    'changeGroupImage',
    'changeThreadColor',
    'changeThreadEmoji',
    'emojiMqtt',
    'gcname',
    'getThreadInfo',
    'getThreadInfo.userInfo',
    'getThreadList',
    'getUserInfo',
    'getMessage',
    'markAsDelivered',
    'markAsRead',
    'markAsReadAll',
    'markAsSeen',
    'resolvePhotoUrl',
    'sendMessage',
    'sendTypingIndicator',
    'setMessageReaction',
    'setNickname',
    'setTitle',
    'removeFromGroup',
    'removeUserFromGroup',
    'shareContact',
    'unsendMessage'
]);

class FCAApi {
    constructor({ localApi, remoteClient, eventBridge, config }) {
        this.localApi = localApi;
        this.remote = remoteClient;
        this.ws = eventBridge;
        this.config = config;
        this.e2eeThreads = new Set();
        this.e2eeThreadMap = new Map();
        this.e2eeMessageMap = new Map();
        this.e2eeReplyMap = new Map();
        this.bindEventBridge();
    }

    getCurrentUserID = () => this.localApi?.getCurrentUserID?.() || this.botInfo?.userID;

    bindEventBridge() {
        if (!this.ws || typeof this.ws.on !== 'function' || this.boundEventBridge) {
            return;
        }

        this.boundEventBridge = true;
        this.ws.on('*', (event) => {
            try {
                this.rememberE2EEEvent(event);
            } catch (error) {
                logger(`E2EE cache update failed: ${error.message}`, 'warn');
            }
        });
    }

    rememberE2EEEvent(event) {
        if (!event || !event.isE2EE) {
            return;
        }

        const threadID = normalizeID(event.threadID || extractUserIDFromJid(event.chatJid));
        const chatJid = normalizeJid(event.chatJid);
        const messageID = normalizeID(event.messageID || event.messageId);
        const senderJid = normalizeJid(event.senderJid || event.userJid || event.senderID || event.senderId);
        const replyMessageID = normalizeID(event.messageReply?.messageID || event.messageReply?.messageId);
        const replySenderJid = normalizeJid(event.messageReply?.senderJid || event.messageReply?.senderID || event.messageReply?.senderId);

        if (threadID) {
            this.e2eeThreads.add(threadID);
        }
        if (threadID && chatJid) {
            this.e2eeThreadMap.set(threadID, chatJid);
        }
        if (messageID && chatJid) {
            this.e2eeMessageMap.set(messageID, chatJid);
        }
        if (messageID && senderJid) {
            this.e2eeReplyMap.set(messageID, senderJid);
        }
        if (replyMessageID && replySenderJid) {
            this.e2eeReplyMap.set(replyMessageID, replySenderJid);
        }
    }

    resolveReplyTarget(replyTarget) {
        if (!replyTarget) {
            return null;
        }
        if (typeof replyTarget === 'string' || typeof replyTarget === 'number') {
            const messageID = normalizeID(replyTarget);
            if (!messageID) {
                return null;
            }
            const senderJid = normalizeJid(this.e2eeReplyMap.get(messageID));
            return senderJid ? { messageID, senderJid } : { messageID };
        }
        if (!isReplyTargetObject(replyTarget)) {
            return null;
        }

        const messageID = normalizeID(replyTarget.messageID || replyTarget.messageId || replyTarget.id);
        if (!messageID) {
            return null;
        }

        const senderJid = normalizeJid(
            replyTarget.senderJid ||
            replyTarget.senderJID ||
            replyTarget.senderID ||
            replyTarget.senderId ||
            this.e2eeReplyMap.get(messageID)
        );

        return senderJid ? { messageID, senderJid } : { messageID };
    }

    getKnownE2EEChatJid(threadID, replyTarget, message) {
        const explicitChatJid = normalizeID(message?.chatJid);
        if (explicitChatJid) {
            return explicitChatJid;
        }

        const normalizedThreadID = normalizeID(threadID);
        if (normalizedThreadID.includes('@')) {
            return normalizeJid(normalizedThreadID);
        }
        if (normalizedThreadID && this.e2eeThreadMap.has(normalizedThreadID)) {
            return normalizeJid(this.e2eeThreadMap.get(normalizedThreadID));
        }

        const localCtx = this.localApi?.ctx || {};
        if (normalizedThreadID && localCtx.e2eeThreadMap instanceof Map && localCtx.e2eeThreadMap.has(normalizedThreadID)) {
            return normalizeJid(localCtx.e2eeThreadMap.get(normalizedThreadID));
        }
        if (normalizedThreadID && localCtx.e2eeThreads instanceof Set && localCtx.e2eeThreads.has(normalizedThreadID)) {
            return normalizeJid(normalizedThreadID);
        }
        const cachedThreadInfo = normalizedThreadID
            ? (
                (typeof localCtx.stateStore?.getThread === 'function' ? localCtx.stateStore.getThread(normalizedThreadID) : null) ||
                (typeof localCtx.stateStore?.toThreadInfo === 'function' ? localCtx.stateStore.toThreadInfo(normalizedThreadID) : null)
            )
            : null;
        if (cachedThreadInfo?.isE2EE) {
            return normalizeJid(cachedThreadInfo.chatJid || cachedThreadInfo.e2eeChatJid || normalizedThreadID);
        }

        const normalizedReply = this.resolveReplyTarget(replyTarget);
        if (normalizedReply?.messageID && this.e2eeMessageMap.has(normalizedReply.messageID)) {
            return normalizeJid(this.e2eeMessageMap.get(normalizedReply.messageID));
        }

        return '';
    }

    applyE2EEMessageContext(message, threadID, replyTarget) {
        const payload = typeof message === 'string'
            ? { body: message }
            : (isPlainObject(message) ? { ...message } : message);

        if (!payload || typeof payload !== 'object') {
            return payload;
        }

        const chatJid = this.getKnownE2EEChatJid(threadID, replyTarget, payload);
        if (!chatJid) {
            return payload;
        }

        payload.chatJid = chatJid;
        if (payload.forceE2EE !== true && payload.e2ee !== true && payload.isE2EE !== true) {
            payload.forceE2EE = true;
        }
        return payload;
    }

    getSendMessageReplyTarget(args) {
        if (!Array.isArray(args)) {
            return null;
        }

        if (args[3] !== undefined && args[3] !== null) {
            return args[3];
        }

        const callbackOrOptions = args[2];
        if (
            typeof callbackOrOptions === 'string' ||
            typeof callbackOrOptions === 'number' ||
            isReplyTargetObject(callbackOrOptions)
        ) {
            return callbackOrOptions;
        }

        return null;
    }

    normalizeRemoteSendMessageArgs(args) {
        const nextArgs = [...args];
        const replyTarget = this.getSendMessageReplyTarget(nextArgs);
        const normalizedReplyTarget = this.resolveReplyTarget(replyTarget);

        if (this.isE2EESendMessage(nextArgs[0], nextArgs[1], normalizedReplyTarget || replyTarget)) {
            nextArgs[0] = this.applyE2EEMessageContext(nextArgs[0], nextArgs[1], normalizedReplyTarget || replyTarget);

            if (
                typeof nextArgs[2] === 'string' ||
                typeof nextArgs[2] === 'number' ||
                isReplyTargetObject(nextArgs[2])
            ) {
                nextArgs[2] = null;
            }
            nextArgs[3] = null;
        }
        return nextArgs;
    }

    shouldUseLocal(method, args) {
        if (!this.localApi) {
            return false;
        }

        if (method === 'sendMessage') {
            const replyTarget = this.getSendMessageReplyTarget(args);
            if (this.isE2EESendMessage(args[0], args[1], replyTarget)) {
                return this.isLocalE2EEReady();
            }
            return !this.isHiddenSendMessage(args[0]);
        }

        return DEFAULT_LOCAL_METHODS.has(method);
    }

    isLocalE2EEReady() {
        return Boolean(
            this.localApi?.ctx?.e2ee ||
            this.localApi?.e2ee ||
            this.localApi?.e2eeSession ||
            this.localApi?.ctx?.e2eeSession
        );
    }

    isE2EESendMessage(message, threadID, replyTarget) {
        const payload = typeof message === 'string' ? { body: message } : (message || {});
        if (payload.forceE2EE || payload.e2ee || payload.isE2EE || payload.chatJid) {
            return true;
        }
        return Boolean(this.getKnownE2EEChatJid(threadID, replyTarget, payload));
    }

    isHiddenSendMessage(message) {
        const payload = typeof message === 'string' ? { body: message } : (message || {});
        return Boolean(payload.effect || payload.power_up);
    }

    normalizeLocalArgs(method, args) {
        if (method !== 'sendMessage' || !args[0] || typeof args[0] !== 'object') {
            return args;
        }

        const message = { ...args[0] };
        if (!Array.isArray(message.attachment)) {
            if (!message.attachment) return [message, ...args.slice(1)];
            message.attachment = [message.attachment];
        }

        message.attachment = message.attachment.map((item) => {
            if (typeof item === 'string' && item.startsWith('data:') && item.includes('base64,')) {
                try {
                    return Buffer.from(item.split('base64,')[1], 'base64');
                } catch {
                    return item;
                }
            }
            return item;
        });

        return [message, ...args.slice(1)];
    }

    resolveLocalMethod(method) {
        const pathParts = method.split('.');
        let target = this.localApi;
        let context = this.localApi;

        for (const part of pathParts) {
            context = target;
            target = target?.[part];
            if (!target) break;
        }

        if (typeof target !== 'function') {
            return null;
        }

        return { fn: target, context };
    }

    async invokeLocal(method, args) {
        const resolved = this.resolveLocalMethod(method);
        if (!resolved) {
            throw new Error(`Local method ${method} not found`);
        }

        const normalizedArgs = this.normalizeLocalArgs(method, args);
        return await new Promise((resolve, reject) => {
            let settled = false;
            const finalize = (error, result) => {
                if (settled) return;
                settled = true;
                if (error) reject(error);
                else resolve(result);
            };

            let returnValue;
            try {
                returnValue = resolved.fn.call(resolved.context, ...normalizedArgs, (error, result) => finalize(error, result));
            } catch (error) {
                finalize(error);
                return;
            }

            if (returnValue && typeof returnValue.then === 'function') {
                returnValue.then((result) => finalize(null, result)).catch(finalize);
                return;
            }

            if (returnValue !== undefined) {
                finalize(null, returnValue);
            }
        });
    }

    async call(method, ...args) {
        if (this.shouldUseLocal(method, args)) {
            return this.invokeLocal(method, args);
        }

        const remoteArgs = method === 'sendMessage'
            ? this.normalizeRemoteSendMessageArgs(args)
            : args;

        const normalizedRemoteArgs = await normalizeRemoteTransportValue(remoteArgs);
        return this.remote.call(method, ...normalizedRemoteArgs);
    }

    loadMethods() {
        const mPath = path.join(__dirname, 'methods');
        if (!fs.existsSync(mPath)) {
            logger('Methods folder not found', 'warn');
            return;
        }

        const files = fs.readdirSync(mPath).filter(f => f.endsWith('.js'));
        files.forEach(file => {
            try {
                const name = file.replace('.js', '');
                this[name] = require(path.join(mPath, file))(this);
            } catch (e) {
                logger(`Failed to load ${file}: ${e.message}`, 'error');
            }
        });

        if (!this.sendMessageMqtt && this.sendMessage) {
            this.sendMessageMqtt = (...args) => this.sendMessage(...args);
        }
        if (!this.sendMessageMqttv2 && this.sendMessage) {
            this.sendMessageMqttv2 = (...args) => this.sendMessage(...args);
        }
        if (this.callgroup && !this.callGroup) {
            this.callGroup = this.callgroup;
        }

        logger(`Loaded ${files.length} methods successfully`, 'success');
    }
}

module.exports = FCAApi;
