/**
 * sendMessage - Send a message to a thread using MQTTv2 protocol
 * Supports: effects, attachments (as streams/buffers in msg object), mentions, reply
 * @param {FCAApi} api - FCA API instance
 */
const stream = require('stream');

async function streamToBase64(inputStream) {
    let buffer;
    if (Buffer.isBuffer(inputStream)) {
        buffer = inputStream;
    } else {
        buffer = await new Promise((resolve, reject) => {
            const chunks = [];
            inputStream.on('data', chunk => chunks.push(Buffer.from(chunk)));
            inputStream.on('error', err => reject(err));
            inputStream.on('end', () => resolve(Buffer.concat(chunks)));
        });
    }

    let type = 'unknown';
    if (buffer.length >= 4) {
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) type = 'image'; // JPG
        else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) type = 'image'; // PNG
        else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) type = 'image'; // GIF
        else if (buffer.slice(4, 8).toString() === 'ftyp' || (buffer[0] === 0x00 && buffer[4] === 0x66)) type = 'video'; // MP4/MOV
        else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            if (buffer.slice(8, 12).toString() === 'WEBP') type = 'image';
            else type = 'audio';
        }
        else if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) type = 'audio'; // MP3 (loose check)
        else if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) type = 'audio'; // MP3 ID3
    }

    return {
        base64: buffer.toString('base64'),
        type: type
    };
}

function isReadableStream(obj) {
    return obj instanceof stream.Stream &&
        (typeof obj._read === 'function' || typeof obj._readableState === 'object');
}

module.exports = (api) => async (message, threadID, callback, replyToMessage) => {
    try {
        if (!message) throw new Error("sendMessage: message content is required");
        if (!threadID) throw new Error("sendMessage: threadID is required");

        if (typeof callback === 'string') {
            replyToMessage = callback;
            callback = null;
        }

        if (!message.attachment) {
            const result = await api.call('sendMessage', message, threadID, null, replyToMessage);
            if (callback) callback(null, result);
            return result;
        }

        if (!Array.isArray(message.attachment)) {
            message.attachment = [message.attachment];
        }

        const images = [];
        const videos = [];
        const others = [];

        for (const att of message.attachment) {
            if (isReadableStream(att) || Buffer.isBuffer(att)) {
                try {
                    const { base64, type } = await streamToBase64(att);
                    const bucket = (type === 'image') ? images : (type === 'video' ? videos : others);
                    bucket.push(`data:application/octet-stream;base64,${base64}`);
                } catch (err) {
                    console.error('[sendMessageMqttv2] Failed to process attachment:', err.message);
                }
            } else {
                // assume string url/id is image or generic? 
                // Hard to tell without fetching. Let's assume generic/other to be safe, or include in images if common usage.
                others.push(att);
            }
        }
        let sentMain = false;
        let lastResult = null;
        const mainBody = message.body;
        if (images.length > 0) {
            const msg = { ...message, body: mainBody, attachment: images };
            lastResult = await api.call('sendMessage', msg, threadID, null, replyToMessage);
            sentMain = true;
        }

        for (const vid of videos) {
            const body = !sentMain ? mainBody : null;
            const msg = { body: body, attachment: [vid] };
            const reply = !sentMain ? replyToMessage : null;
            lastResult = await api.call('sendMessage', msg, threadID, null, reply);
            sentMain = true;
        }
        for (const other of others) {
            const body = !sentMain ? mainBody : null;
            const msg = { body: body, attachment: [other] };
            const reply = !sentMain ? replyToMessage : null;

            lastResult = await api.call('sendMessage', msg, threadID, null, reply);
            sentMain = true;
            await new Promise(r => setTimeout(r, 500));
        }
        if (!sentMain && message.body) {
            lastResult = await api.call('sendMessage', { body: message.body }, threadID, null, replyToMessage);
        }

        if (callback) callback(null, lastResult);
        return lastResult;

    } catch (error) {
        if (callback) callback(error);
        throw error;
    }
};
