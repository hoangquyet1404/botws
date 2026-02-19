"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

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
      const apiUrl = `${global.config.api.url}/api/downall`;
      const res = await axios.get(apiUrl, { params: { url: videoUrl } });
      const data = res.data;
      const medias = Array.isArray(data?.medias) ? data.medias : [];
      const audio = medias.find((m) => m?.type === "audio" && m?.url);
      if (!audio?.url) {
        return api.sendMessage("Không tìm thấy audio stream. Lệnh này chỉ gửi audio.", threadID, null, messageID);
      }
      const title = data?.title || picked?.snippet?.title || "YouTube Audio";
      const safeName = (String(title).replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 48) || "audio");
      const finalPath = path.resolve(__dirname, 'cache', `${safeName}.mp3`);

      if (!fs.existsSync(path.dirname(finalPath))) fs.mkdirSync(path.dirname(finalPath), { recursive: true });

      async function getStreamAndSize(url, headers = {}) {
        const requestHeaders = { Range: "bytes=0-", ...headers };
        const res = await axios.get(url, {
          responseType: "stream",
          headers: requestHeaders,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        const len = Number(res.headers["content-length"] || 0);
        const cr = res.headers["content-range"];
        const total = cr ? Number(String(cr).split("/").pop()) : len;

        return { stream: res.data, size: total || len };
      }
      const { stream } = await getStreamAndSize(audio.url);
      const audioBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });

      const base64Audio = audioBuffer.toString('base64');

      const apiConvertUrl = global.config.api.url + (global.config.api.url.endsWith('/') ? '' : '/') + 'api/media/convert';

      const convertResponse = await axios({
        method: 'POST',
        url: apiConvertUrl,
        data: {
          audio: base64Audio,
          ext: 'mp4'
        }
      });

      if (!convertResponse.data.success && !convertResponse.data.data) {
        throw new Error(convertResponse.data.error || "Conversion failed at API");
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
