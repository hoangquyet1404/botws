"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { downloadMediaAsBase64 } = require("../../main/utils/mediaDownload");

function getApiBaseUrl() {
  const base = String(global.config?.api?.url || "").trim();
  return (base.endsWith("/") ? base.slice(0, -1) : base).replace(/\/api\/v1$/i, "");
}

function getApiKeyHeaders() {
  const key = global.config?.api?.key;
  return key ? { "x-api-key": key } : {};
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

  for (const item of candidates) {
    if (!item) continue;
    if (Array.isArray(item.medias)) return item;
    if (Array.isArray(item.media)) return { ...item, medias: item.media };
    if (Array.isArray(item.items)) return { ...item, medias: item.items };
  }

  return null;
}

module.exports = {
  config: {
    name: "sing",
    aliases: ["music", "ytmusic2"],
    version: "1.0.4",
    role: 0,
    author: "",
    info: "Tìm và gửi audio từ YouTube",
    Category: "Media",
    guides: "sing <từ khóa>",
    cd: 5,
    hasPrefix: true,
    images: []
  },
  _fmtDuration: function (iso) {
    if (!iso || typeof iso !== "string") return "00:00";
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const h = Number(m?.[1] || 0);
    const mm = Number(m?.[2] || 0);
    const s = Number(m?.[3] || 0);

    const pad = (n) => String(n).padStart(2, "0");
    if (h > 0) return `${pad(h)}:${pad(mm)}:${pad(s)}`;
    return `${pad(mm)}:${pad(s)}`;
  },

  onRun: async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const query = (args || []).join(" ").trim();

    if (!query) {
      return api.sendMessage("Phần tìm kiếm không được để trống.", threadID, null, messageID);
    }
    const apiKey = "AIzaSyAygWrPYHFVzL0zblaZPkRcgIFZkBNAW9g";

    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${apiKey}`;

      const searchRes = await axios.get(searchUrl);
      const items = searchRes?.data?.items || [];

      if (!items.length) {
        return api.sendMessage("Không tìm thấy video nào.", threadID, null, messageID);
      }
      const ids = items.map((it) => it?.id?.videoId).filter(Boolean);
      let durationMap = {};

      if (ids.length) {
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(",")}&key=${apiKey}`;
        const videosRes = await axios.get(videosUrl);
        const vids = videosRes?.data?.items || [];

        durationMap = Object.fromEntries(
          vids.map((v) => [v?.id, this._fmtDuration(v?.contentDetails?.duration)])
        );
      }

      let msg = `Kết quả tìm kiếm: ${query}\n\n`;
      items.forEach((item, idx) => {
        const title = item?.snippet?.title || "Unknown";
        const channel = item?.snippet?.channelTitle || "Unknown";
        const vid = item?.id?.videoId;
        const dur = durationMap[vid] || "00:00";
        msg += `${idx + 1}. [${dur}] ${title} - ${channel}\n`;
      });
      msg += `\nReply số thứ tự để chọn.`;

      return api.sendMessage(msg, threadID, (err, info) => {
        if (err) return;

        const safeItems = items.map((item) => ({
          id: item?.id && typeof item.id === "object" ? { ...item.id } : {},
          snippet: item?.snippet ? { ...item.snippet } : {}
        }));

        global.concac.onReply.push({
          name: this.config.name,
          messageID: info.messageID,
          author: senderID,
          data: { items: safeItems, query }
        });
      }, messageID);
    } catch (err) {
      return api.sendMessage(`Lỗi: ${err.message}`, threadID, null, messageID);
    }
  },

  onReply: async function ({ api, event, onReply: $, cleanup }) {
    const { threadID, messageID, senderID, body } = event;

    try {
      if (String(senderID) !== String($.author)) {
        return api.sendMessage("Chỉ người dùng lệnh mới chọn được.", threadID, null, messageID);
      }

      const items = $.data?.items || [];
      const stt = parseInt(String(body || "").trim(), 10);

      if (!items.length || Number.isNaN(stt) || stt < 1 || stt > items.length) {
        return api.sendMessage("Số thứ tự không hợp lệ.", threadID, null, messageID);
      }
      if (typeof cleanup === "function") cleanup();
      if ($?.messageID) api.unsendMessage($.messageID);

      const picked = items[stt - 1];
      const videoId = picked?.id?.videoId;

      if (!videoId) {
        return api.sendMessage("Không lấy được videoId hợp lệ.", threadID, null, messageID);
      }

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const apiUrl = `${getApiBaseUrl()}/api/v1/downall`;
      const res = await axios.get(apiUrl, {
        params: { url: videoUrl, apikey: global.config?.api?.key },
        headers: getApiKeyHeaders(),
        timeout: 120000,
        validateStatus: () => true
      });
      if (res.status >= 400) {
        throw new Error(res.data?.error || res.data?.message || `DownAll HTTP ${res.status}`);
      }
      const data = normalizeDownResult(res.data);
      const medias = Array.isArray(data?.medias) ? data.medias : [];
      const audio = medias.find((m) => m?.type === "audio" && m?.url);
      if (!audio?.url) {
        return api.sendMessage("Không tìm thấy audio stream. Lệnh này chỉ gửi audio.", threadID, null, messageID);
      }
      const title = data?.title || picked?.snippet?.title || "YouTube Audio";
      const safeName = (String(title).replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 48) || "audio");
      const finalPath = path.resolve(__dirname, 'cache', `${safeName}.mp3`);

      if (!fs.existsSync(path.dirname(finalPath))) fs.mkdirSync(path.dirname(finalPath), { recursive: true });

      const apiConvertUrl = `${getApiBaseUrl()}/api/v1/media/convert`;
      const downloadedAudio = await downloadMediaAsBase64(audio.url, audio.headers || audio.httpHeaders || {});

      const convertResponse = await axios({
        method: 'POST',
        url: apiConvertUrl,
        params: {
          ext: 'mp4'
        },
        data: {
          audio: downloadedAudio.base64,
          ext: 'mp4'
        },
        headers: {
          'Content-Type': 'application/json',
          ...getApiKeyHeaders()
        },
        timeout: 0,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true
      });

      if (convertResponse.status >= 400 || !convertResponse.data?.success || !convertResponse.data?.data) {
        throw new Error(convertResponse.data?.error || convertResponse.data?.message || `Conversion HTTP ${convertResponse.status}`);
      }

      const mp3Buffer = Buffer.from(convertResponse.data.data, 'base64');
      fs.writeFileSync(finalPath, mp3Buffer);

      const stats = fs.statSync(finalPath);
      const mb = (stats.size / 1024 / 1024).toFixed(2);

      return api.sendMessage(
        {
          body: `Dang phat: ${title}\nDung luong: ${mb} MB`,
          attachment: fs.createReadStream(finalPath)
        },
        threadID,
        () => {
          if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
        },
        messageID
      );
    } catch (err) {
      return api.sendMessage(`Lỗi: ${err.message}`, threadID, null, messageID);
    }
  }
};
