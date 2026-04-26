const axios = require("axios");

this.config = {
    name: "autodown",
    aliases: ["ad", "autodl"],
    version: "1.0.0",
    role: 0,
    credits: "Admin",
    info: "Tá»± Ä‘á»™ng táº£i video/áº£nh tá»« link",
    Category: "Box",
    guides: "[on/off]",
    cd: 0,
    hasPrefix: true,
};

const SUPPORTED_APIS = {
    capcut: /^(https?:\/\/)?(www\.)?capcut\.(com|net)\/[^\s]+$/i,
    tiktokv2: /^(https?:\/\/)?(www\.)?(tiktok\.com|vt\.tiktok\.com)\/[^\s]+$/i,
    instagram: /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/[^\s]+$/i,
    facebook: /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.com|fb\.watch)(\/[^\s]*)?$/i,
    zingmp3: /^(https?:\/\/)?(www\.|m\.)?zingmp3\.vn\/[^\s]+$/i,
    nhaccuatui: /^(https?:\/\/)?(www\.)?nhaccuatui\.com\/[^\s]+$/i,
    douyin: /^(https?:\/\/)?((www|v)\.)?douyin\.com\/[^\s]+$/i,
    reddit: /^(https?:\/\/)?(www\.)?reddit\.com\/[^\s]+$/i,
    youtube: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/[^\s]+$/i,
    threads: /^(https?:\/\/)?(www\.)?threads\.(com|net)\/.*$/i,
    pin: /^(https?:\/\/)?(([a-z0-9-]+\.)?pinterest\.[a-z.]+|pin\.it)\/[^\s]+$/i,
    soundcloud: /^(https?:\/\/)?(www\.)?(on\.)?soundcloud\.com\/[^\s]+$/i,
    viet69: /^(https?:\/\/)?(www\.)?viet69\.[^\s]+\/[^\s]+$/i,
    x: /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/[^\s]+$/i,
    xnxx: /^(https?:\/\/)?(www\.)?xnxx\.[^\s]+\/[^\s]+$/i,
    xvideos: /^(https?:\/\/)?(www\.)?xvideos\.[^\s]+\/[^\s]+$/i,
    xnhau: /^(https?:\/\/)?(www\.)?xnhau\.hot\/video\/\d+\/[^\s]+$/i,
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

function normalizeDownResult(payload) {
    const candidates = [
        payload,
        payload?.data,
        payload?.result,
        payload?.payload,
        payload?.data?.result,
        payload?.data?.data,
        payload?.result?.data,
        payload?.payload?.data
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        if (Array.isArray(candidate)) return { title: "Autodown", medias: candidate };
        if (Array.isArray(candidate.medias)) return candidate;
        if (Array.isArray(candidate.media)) return { ...candidate, medias: candidate.media };
        if (Array.isArray(candidate.items)) return { ...candidate, medias: candidate.items };
    }

    return null;
}

function normalizeMedia(media) {
    if (!media || typeof media !== "object") return null;
    const url = media.url || media.downloadUrl || media.download_url || media.src || media.href || media.link;
    if (!url) return null;

    const type = String(media.type || media.mimeType || media.contentType || "").toLowerCase();
    const normalized = { ...media, url };
    if (!normalized.type) {
        if (type.includes("audio")) normalized.type = "audio";
        else if (type.includes("image")) normalized.type = "image";
        else if (type.includes("video")) normalized.type = "video";
    }
    return normalized;
}

function getEventBody(event) {
    const body = event?.body || event?.text || event?.message || event?.content || event?.messageText || event?.snippet;
    return typeof body === "string" ? body : "";
}

function normalizeThreadID(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const match = raw.match(/^(\d+)/);
    return match ? match[1] : raw;
}

function cleanDetectedUrl(value) {
    return String(value || "").replace(/[)\].,!?]+$/u, "");
}

this.onRun = async function ({ api, event, args, database }) {
    const { threadID, messageID } = event;

    try {

        if (!args[0]) {
            const status = database.get.mapItem("autodownSettings", threadID, false) ? "BẬT" : "TẮT";
            return api.sendMessage(
                `âš™ï¸ AUTODOWN SETTINGS\n\n` +
                `Tráº¡ng thÃ¡i: ${status}\n` +
                `Sá»­ dá»¥ng: ${this.config.name} on/off`,
                threadID,
                messageID
            );
        }

        const action = args[0].toLowerCase();
        if (action === "on") {
            database.update.mapItem("autodownSettings", threadID, true);
            return api.sendMessage(
                "âœ… ÄÃ£ Báº¬T autodown cho nhÃ³m nÃ y!",
                threadID,
                messageID
            );
        } else if (action === "off") {
            database.delete.mapItem("autodownSettings", threadID);
            return api.sendMessage(
                " ÄÃ£ Táº®T autodown cho nhÃ³m nÃ y!",
                threadID,
                messageID
            );
        } else {
            return api.sendMessage(
                "âš ï¸ Sá»­ dá»¥ng: autodown on/off",
                threadID,
                messageID
            );
        }
    } catch (error) {
        console.error("[autodown] Error:", error);
        return api.sendMessage(
            ` Lá»—i: ${error.message}`,
            threadID,
            messageID
        );
    }
};

this.onEvent = async function ({ api, event, database }) {
    const rawThreadID = event.threadID || event.threadId || event.chatJid || event.threadJid;
    const threadID = normalizeThreadID(rawThreadID);
    const sendThreadID = rawThreadID || threadID;
    const { messageID, senderID } = event;
    const body = getEventBody(event);
    const botID = api.getCurrentUserID();

    if (senderID === botID) return;
    if (!threadID) return;
    if (!body) return;

    try {
        if (
            !database.get.mapItem("autodownSettings", threadID, false)
            && !database.get.mapItem("autodownSettings", String(rawThreadID || ""), false)
        ) return;
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const urls = (body.match(urlRegex) || []).map(cleanDetectedUrl).filter(Boolean);

        if (!urls || urls.length === 0) return;

        for (const url of urls) {
            const platform = detectPlatform(url);
            if (!platform) continue;

            try {
                const apiConfig = global.config.api;
                const baseUrl = apiConfig.url;
                let apiUrl = `${baseUrl}/api/v1/downall?url=${encodeURIComponent(url)}`;
                if (apiConfig.key) {
                    apiUrl += `&apikey=${apiConfig.key}`;
                }

                // console.log(`[autodown] Requesting: ${apiUrl}`);
                const response = await axios.get(apiUrl, {
                    headers: apiConfig.key ? { "x-api-key": apiConfig.key } : undefined,
                    timeout: 120000,
                    validateStatus: () => true
                });
                if (response.status >= 400) {
                    const errorText = response.data?.error || response.data?.message || response.statusText || "unknown";
                    console.error(`[autodown] DownAll HTTP ${response.status} ${platform}: ${errorText}`);
                    continue;
                }
                const result = normalizeDownResult(response.data);

                if (!result || !result.medias || result.medias.length === 0) {
                    continue;
                }

                const medias = result.medias.map(normalizeMedia).filter(Boolean);
                const filteredMedias = filterMedias(platform, medias);
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
                        body: ` ${title}\nðŸ”— ${platform.toUpperCase()}`,
                        attachment: allStreams
                    }, sendThreadID, messageID);
                }

            } catch (apiError) {
                console.error(`[autodown] API Error ${platform}:`, apiError.message);
            }
        }

    } catch (error) {
        console.error("[autodown] onEvent Error:", error);
    }
};

