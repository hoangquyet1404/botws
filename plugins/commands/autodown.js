const fs = require("fs");
const path = require("path");
const axios = require("axios");

this.config = {
    name: "autodown",
    aliases: ["ad", "autodl"],
    version: "1.0.0",
    role: 0,
    credits: "Admin",
    info: "Tự động tải video/ảnh từ link",
    Category: "Box",
    guides: "[on/off]",
    cd: 0,
    hasPrefix: true,
};

const DATA_DIR = path.join(__dirname, "..", "..", "main", "data");
const DATA_FILE = path.join(DATA_DIR, "autodownSettings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}));

const SUPPORTED_APIS = {
    capcut: /^(https?:\/\/)?(www\.)?capcut\.(com|net)\/[^\s]+$/i,
    tiktokv2: /^(https?:\/\/)?(www\.)?(tiktok\.com|vt\.tiktok\.com)\/[^\s]+$/i,
    instagram: /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/[^\s]+$/i,
    facebook: /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.com)(\/[^\s]*)?$/i,
    zingmp3: /^(https?:\/\/)?(www\.|m\.)?zingmp3\.vn\/[^\s]+$/i,
    nhaccuatui: /^(https?:\/\/)?(www\.)?nhaccuatui\.com\/[^\s]+$/i,
    douyin: /^(https?:\/\/)?((www|v)\.)?douyin\.com\/[^\s]+$/i,
    reddit: /^(https?:\/\/)?(www\.)?reddit\.com\/[^\s]+$/i,
    youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+(\?[^\s]*)?$/i,
    threads: /^(https?:\/\/)?(www\.)?threads\.com\/.*$/i,
    pin: /^(https?:\/\/)?((www\.)?pinterest\.com|pin\.it)\/[^\s]+$/i,
    soundcloud: /^(https?:\/\/)?(www\.)?(on\.)?soundcloud\.com\/[^\s]+$/i,
    viet69: /^(https?:\/\/)?(www\.)?viet69\.[^\s]+\/[^\s]+$/i,
    x: /^(https?:\/\/)?(www\.)?x\.com\/[^\s]+$/i,
    xnxx: /^(https?:\/\/)?(www\.)?xnxx\.[^\s]+\/[^\s]+$/i,
    xvideos: /^(https?:\/\/)?(www\.)?xvideos\.[^\s]+\/[^\s]+$/i,
    xiaohongshu: /^(https?:\/\/)?((www\.)?xiaohongshu\.com\/explore\/|xhslink\.com\/)[^\s]+$/i
};

function detectPlatform(url) {
    for (const [platform, regex] of Object.entries(SUPPORTED_APIS)) {
        if (regex.test(url)) return platform;
    }
    return null;
}

function filterMedias(platform, medias) {
    if (!Array.isArray(medias) || medias.length === 0) return [];

    switch (platform) {
        case 'facebook':
            return medias.filter(m =>
                m.type === 'image' || (m.type === 'video' && m.quality === 'sd') || (m.type === 'video/mp4' && m.quality === 'sd')
            );

        case 'youtube':
            return medias.filter(m => m.type === 'video');
        case 'tiktokv2':
            const firsttVideo = medias.find(m => m.type === 'video');
            return firsttVideo ? [firsttVideo] : medias.filter(m => m.type === 'image');

        case 'nhaccuatui':
            const firstAudio = medias.find(m => m.type === 'audio');
            return firstAudio ? [firstAudio] : [];

        case 'reddit':
            const video480p = medias.find(m => m.type === 'video' && m.quality === '480p');
            if (video480p) return [video480p];
            const firstVideo = medias.find(m => m.type === 'video');
            if (firstVideo) return [firstVideo];
            return medias;

        default:
            return medias;
    }
}

this.onRun = async function ({ api, event, args }) {
    const { threadID, messageID } = event;

    try {
        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
        }

        if (!args[0]) {
            const status = data[threadID] ? "BẬT" : "TẮT";
            return api.sendMessage(
                `⚙️ AUTODOWN SETTINGS\n\n` +
                `Trạng thái: ${status}\n` +
                `Sử dụng: ${this.config.name} on/off`,
                threadID,
                messageID
            );
        }

        const action = args[0].toLowerCase();
        if (action === "on") {
            data[threadID] = true;
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            return api.sendMessage(
                "✅ Đã BẬT autodown cho nhóm này!",
                threadID,
                messageID
            );
        } else if (action === "off") {
            data[threadID] = false;
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            return api.sendMessage(
                " Đã TẮT autodown cho nhóm này!",
                threadID,
                messageID
            );
        } else {
            return api.sendMessage(
                "⚠️ Sử dụng: autodown on/off",
                threadID,
                messageID
            );
        }
    } catch (error) {
        console.error("[autodown] Error:", error);
        return api.sendMessage(
            ` Lỗi: ${error.message}`,
            threadID,
            messageID
        );
    }
};

this.onEvent = async function ({ api, event }) {
    const { threadID, messageID, body, senderID } = event;
    const botID = api.getCurrentUserID();

    if (senderID === botID) return;
    if (!body) return;

    try {
        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
        }

        if (!data[threadID]) return;
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const urls = body.match(urlRegex);

        if (!urls || urls.length === 0) return;

        for (const url of urls) {
            const platform = detectPlatform(url);
            if (!platform) continue;

            try {
                const apiConfig = global.config.api;
                const baseUrl = apiConfig.url;
                let apiUrl = `${baseUrl}/api/downall?url=${encodeURIComponent(url)}`;
                if (apiConfig.key) {
                    apiUrl += `&apikey=${apiConfig.key}`;
                }

                // console.log(`[autodown] Requesting: ${apiUrl}`);
                const response = await axios.get(apiUrl);
                const result = response.data;

                if (!result || !result.medias || result.medias.length === 0) {
                    continue;
                }

                const filteredMedias = filterMedias(platform, result.medias);
                if (filteredMedias.length === 0) {
                    continue;
                }

                const title = result.title || `Autodown from ${platform}`;
                const allStreams = [];

                for (const media of filteredMedias) {
                    if (!media.url) continue;
                    try {
                        let ext = 'mp4';
                        if (media.type === 'audio') ext = 'mp3';
                        else if (media.type === 'video' || media.type === 'video/mp4') ext = 'mp4';
                        else if (media.url.includes('.')) {
                            const urlExt = media.url.split('.').pop().split('?')[0];
                            if (['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mp3', 'webm'].includes(urlExt.toLowerCase())) ext = urlExt.toLowerCase();
                        }

                        // Use streamURL to get stream (which will be converted to base64 by client api)
                        const stream = await global.tools.streamURL(media.url, ext);
                        allStreams.push(stream);

                    } catch (err) {
                        console.error(`[autodown] Failed to stream media:`, err.message);
                    }
                }

                if (allStreams.length > 0) {
                    await api.sendMessage({
                        body: ` ${title}\n🔗 ${platform.toUpperCase()}`,
                        attachment: allStreams
                    }, threadID, messageID);
                }

            } catch (apiError) {
                console.error(`[autodown] API Error ${platform}:`, apiError.message);
            }
        }

    } catch (error) {
        console.error("[autodown] onEvent Error:", error);
    }
};
