const os = require('os');
const fs = require('fs').promises;
module.exports = {
  config: {
    name: "upt",
    aliases: ["uptime"],
    version: "2.1.6",
    role: 0,
    author: "",
    info: "Hiển thị thông tin hệ thống của bot!",
    Category: "Admin",
    guides: "",
    cd: 5,
    hasPrefix: true,
    images: []
  },
  onRun: async ({ api, event }) => {
    const pingStart = Date.now();    
    function formatUptime(seconds) {
      const days = Math.floor(seconds / (24 * 3600));
      const hours = Math.floor((seconds % (24 * 3600)) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return `${days}d : ${hours.toString().padStart(2, '0')}h : ${minutes.toString().padStart(2, '0')}m : ${secs.toString().padStart(2, '0')}s`;
    }
    const { heapTotal, heapUsed, rss } = process.memoryUsage();
    const uptime = process.uptime();
    const pingReal = Date.now() - pingStart;
    const botStatus = pingReal < 200 ? 'mượt' : (pingReal < 600 ? 'trung bình' : 'lag');
    api.sendMessage({body: `⩺ Thời gian hoạt động: ${formatUptime(uptime)}\n⩺ Tình trạng bot: ${botStatus}\n⩺ Heap Memory: ${(heapUsed / (1024 ** 2)).toFixed(2)}MB / ${(heapTotal / (1024 ** 2)).toFixed(2)}MB (đã dùng)\n⩺ RSS: ${(rss / (1024 ** 2)).toFixed(2)}MB\n⩺ Ping: ${pingReal}ms`,effect: "AVATAR_ANGRY"},event.threadID, event.messageID);
  }
};