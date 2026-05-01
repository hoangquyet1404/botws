const stringSimilarity = require('string-similarity');
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const utils = require("../utils/log");
const moment = require("moment-timezone");
const money = require("../utils/money");
const store = require("../utils/database");

module.exports = function ({ api }) {
  return async function ({ event }) {
    const dateNow = Date.now();
    const time = moment.tz("Asia/Ho_Chi_minh").format("HH:MM:ss DD/MM/YYYY");
    const { allowInbox, PREFIX, ADMINBOT, NDH, DeveloperMode, adminOnly, ndhOnly } = global.config;
    // const PREFIX = prefix || global.config.PREFIX || "!";
    const { commands, cd } = global.concac;
    if (event?.isE2EE && typeof api.rememberE2EEEvent === 'function') {
      api.rememberE2EEEvent(event);
    }

    var { body, senderID, threadID, messageID } = event;
    senderID = String(senderID);
    threadID = String(threadID);
    messageID = String(messageID);
    let threadInfo = {};
    if (event?.isE2EE) {
      threadInfo = {
        threadID,
        threadName: event.threadName || event.name || '',
        userInfo: Array.isArray(event.userInfo) ? event.userInfo : [],
        participantIDs: Array.isArray(event.participantIDs) && event.participantIDs.length > 0
          ? event.participantIDs
          : [senderID, api.getCurrentUserID?.()].filter(Boolean),
        adminIDs: [],
        isGroup: Boolean(event.isGroup),
        isE2EE: true,
        chatJid: event.chatJid || ''
      };
    } else {
      threadInfo = (await api.getThreadInfo(threadID)) || {};
    }
    const senderUser = (threadInfo.userInfo || []).find(u => u.id === senderID);
    const ten = senderUser ? senderUser.name : 'Unknown User';
    let dataBan = { users: {}, threads: {} };
    const findd = (threadInfo.adminIDs || []).some(admin => admin.id == senderID);
    let prefixbox = PREFIX;
    if (global.rentScheduler) {
      prefixbox = global.rentScheduler.getPrefix(threadID) || PREFIX;
    } else {
      const prefixData = store.getJson('prefixData', 'default', { threads: {} });
      prefixbox = prefixData.threads[threadID]?.prefix || PREFIX;
    }

    let dataAdbox = store.getJson('dataAdbox', 'default', { adminbox: {} });

    if (typeof body === 'string' && body.startsWith(prefixbox) && !NDH.includes(senderID) && ndhOnly == true) {
      return api.sendMessage('[ WARNING ] - Hiện tại đang bật chế độ NDHOnly chỉ NDH mới được sử dụng bot!!!', threadID, null, messageID);
    }
    if (typeof body === 'string' && body.startsWith(prefixbox) && !NDH.includes(senderID) && !ADMINBOT.includes(senderID) && adminOnly == true) {
      return api.sendMessage('[ WARNING ] - Hiện tại đang bật chế độ AdminOnly chỉ ADMIN mới được sử dụng bot!!!', threadID, null, messageID);
    }
    if (typeof body === 'string' && body.startsWith(prefixbox) && dataAdbox.adminbox && dataAdbox.adminbox[threadID] == true && !NDH.includes(senderID) && !ADMINBOT.includes(senderID) && !findd && event.isGroup == true) {
      return api.sendMessage('[ WARNING ] - Hiện tại nhóm này đang bật chế độ chỉ quản trị viên nhóm mới có thể sử dụng bot!!!', threadID, null, messageID);
    }
    dataBan = store.getJson('databan', 'default', dataBan);
    const isPrivilegedUser = ADMINBOT.includes(senderID) || NDH.includes(senderID);
    const shouldBlockInboxCommand = allowInbox == false
      && senderID == threadID
      && body
      && body.startsWith(PREFIX)
      && !isPrivilegedUser;

    if (dataBan.users[senderID] || dataBan.threads[threadID] || shouldBlockInboxCommand) {
      if ((body || '').startsWith(prefixbox)) {
        if (!ADMINBOT.includes(senderID) && !NDH.includes(senderID)) {
          if (dataBan.users[senderID]) {
            const { reason, dateAdded } = dataBan.users[senderID];
            const banMsg = `⚠️ Bạn đã bị ban cmnr\n👉 Lý do: ${reason}\n👉 Vào lúc: ${dateAdded}\n👉 Show Info cho Admin để được unban`;
            return api.sendMessage(banMsg, threadID, (err, info) => {
              if (!err) {
                setTimeout(() => {
                  api.unsendMessage(info.messageID);
                }, 15000);
              }
            }, messageID);
          } else if (dataBan.threads[threadID]) {
            const { reason, dateAdded } = dataBan.threads[threadID];
            const banMsg = `⚠️ Nhóm đã bị ban cmnr\n👉 Lý do: ${reason}\n👉 Vào lúc: ${dateAdded}\n👉 Show Info cho Admin để được unban`;
            return api.sendMessage(banMsg, threadID, (err, info) => {
              if (!err) {
                setTimeout(() => {
                  api.unsendMessage(info.messageID);
                }, 15000);
              }
            }, messageID);
          }
        }
      }
      return;
    }

    body = body !== undefined ? body : 'x';
    const prefixRegex = new RegExp(`^(<@!?${senderID}>|${escapeRegex(prefixbox)})\\s*`);
    const [matchedPrefix] = body.match(prefixRegex) || [''];
    var args = body.slice(matchedPrefix.length).trim().split(/ +/);
    var commandName = args.shift().toLowerCase();
    var command = commands.get(commandName);
    if (!prefixRegex.test(body)) {
      args = (body || '').trim().split(/ +/);
      commandName = args.shift()?.toLowerCase();
      command = commands.get(commandName);
      if (command && command.config) {
        if (typeof body === 'string' && !body.startsWith(prefixbox) && command.config.hasPrefix === false && !NDH.includes(senderID) && ndhOnly == true) {
          return api.sendMessage('[ WARNING ] - Hiện tại đang bật chế độ NDHOnly chỉ NDH mới được sử dụng bot!!!', threadID, null, messageID);
        }
        if (typeof body === 'string' && !body.startsWith(prefixbox) && command.config.hasPrefix === false && !NDH.includes(senderID) && !ADMINBOT.includes(senderID) && adminOnly == true) {
          return api.sendMessage('[ WARNING ] - Hiện tại đang bật chế độ AdminOnly chỉ ADMIN mới được sử dụng bot!!!', threadID, null, messageID);
        }
        if (typeof body === 'string' && !body.startsWith(prefixbox) && command.config.hasPrefix === false && dataAdbox.adminbox && dataAdbox.adminbox[threadID] == true && !NDH.includes(senderID) && !ADMINBOT.includes(senderID) && !findd && event.isGroup == true) {
          return api.sendMessage('[ WARNING ] - Hiện tại nhóm này đang bật chế độ chỉ quản trị viên nhóm mới có thể sử dụng bot!!!', threadID, null, messageID);
        }
        if (command.config.hasPrefix === false && commandName.toLowerCase() !== command.config.name.toLowerCase()) {
          return;
        }
        if (command.config.hasPrefix === true && !body.startsWith(prefixbox)) {
          return;
        }
      }
      if (command && command.config) {
        if (typeof command.config.hasPrefix === 'undefined') {
          return;
        }
      }
    }
    if (!command) {
      if (!body.startsWith(prefixbox)) return;
      for (const [name, cmd] of commands.entries()) {
        if (cmd.config.aliases && cmd.config.aliases.includes(commandName)) {
          command = cmd;
          break;
        }
      }
    }
    if (!command) {
      if (!body.startsWith(prefixbox)) return;
      var allCommandName = [];
      const commandValues = commands.keys();
      for (const cmd of commandValues) allCommandName.push(cmd);
      const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
      if (checker.bestMatch.rating >= 0.5) {
        command = commands.get(checker.bestMatch.target);
      } else {
        const errorMsg = { body: `❎ Lệnh bạn sử dụng không tồn tại gõ ${prefixbox}menu để xem các lệnh hiện có\n✏️ Lệnh gần giống là: ${checker.bestMatch.target}` };
        return api.sendMessage(errorMsg, threadID, (err, info) => {
          if (!err) {
            setTimeout(() => {
              api.unsendMessage(info.messageID);
            }, 30000);
          }
        }, messageID);
      }
    }
    let commandBannedData = store.getJson('commandBanned', 'default', {});
    const send = (msg, replyTo = null, callback = null) => {
      if (callback) {
        return api.sendMessage(msg, threadID, callback, replyTo);
      } else if (replyTo) {
        return api.sendMessage(msg, threadID, null, replyTo);
      } else {
        return api.sendMessage(msg, threadID);
      }
    };
    const isQtvBox = id => threadInfo.adminIDs.some(admin => admin.id == id);
    const getName = async (id) => {
      const user = threadInfo.userInfo.find(u => u.id === id);
      return user ? user.name : 'Unknown';
    };
    const cmd = command.config.name;
    let data = store.getJson('commands-banned', 'default', {});
    let disableData = store.getJson('disable-command', 'default', {});
    if (data[threadID]) {
      const ban = data[threadID].cmds.find(b => b.cmd == cmd);
      const userBans = data[threadID].users[senderID] || {};
      const userBan = userBans.cmds?.find(b => b.cmd == cmd);
      const allBan = userBans.all;
      const banMsg = async (banType, author, time) => {
        const name = await getName(author);
        return `❎ ${time} ${banType}: ${name}\n📝 Đã cấm bạn sử dụng lệnh ${cmd}`;
      };
      if (ban && (ADMINBOT.includes(ban.author) || isQtvBox(ban.author)) && !NDH.includes(senderID) && ban.author != senderID) {
        return send(await banMsg(isQtvBox(ban.author) ? 'qtv nhóm' : 'admin bot', ban.author, ban.time));
      }
      if (allBan?.status && ((ADMINBOT.includes(allBan.author) && !ADMINBOT.includes(senderID)) || (isQtvBox(allBan.author) && !NDH.includes(senderID) && !isQtvBox(senderID) && !ADMINBOT.includes(senderID)))) {
        const name = await getName(allBan.author);
        return send(`❎ ${allBan.time} ${isQtvBox(allBan.author) ? 'qtv box' : 'admin bot'}: ${name} cấm`);
      }
      if (userBan && ((ADMINBOT.includes(userBan.author) && !ADMINBOT.includes(senderID)) || (isQtvBox(userBan.author) && !isQtvBox(senderID) && !ADMINBOT.includes(senderID)))) {
        return send(await banMsg(isQtvBox(userBan.author) ? 'qtv nhóm' : 'admin bot', userBan.author, userBan.time));
      }
    }
    if ((disableData[threadID]?.commands?.[command.config.name] || disableData[threadID]?.categories?.[command.config.Category]) && !NDH.includes(senderID) && !ADMINBOT.includes(senderID)) {
      if (disableData[threadID]?.categories?.[command.config.Category]) {
        return api.sendMessage(`❎ Nhóm lệnh '${command.config.Category}' đã bị cấm trong nhóm này`, threadID);
      }
      if (disableData[threadID]?.commands?.[command.config.name]) {
        return api.sendMessage(`❎ Lệnh '${command.config.name}' đã bị cấm trong nhóm này`, threadID);
      }
    }
    if (commandBannedData[threadID] || commandBannedData[senderID]) {
      if (!ADMINBOT.includes(senderID) && !NDH.includes(senderID)) {
        const banThreads = commandBannedData[threadID] || [],
          banUsers = commandBannedData[senderID] || [];
        if (banThreads.includes(command.config.name))
          return api.sendMessage(`📌 Nhóm đã bị cấm sử dụng lệnh '${command.config.name}'`, threadID, (err, info) => {
            if (!err) {
              setTimeout(() => {
                api.unsendMessage(info.messageID);
              }, 15000);
            }
          }, messageID);
        if (banUsers.includes(command.config.name))
          return api.sendMessage(`📌 Bạn đã bị cấm sử dụng lệnh '${command.config.name}'`, threadID, (err, info) => {
            if (!err) {
              setTimeout(() => {
                api.unsendMessage(info.messageID);
              }, 15000);
            }
          }, messageID);
      }
    }
    if (event.isGroup) {
      try {
        if (Object.keys(threadInfo).length == 0) throw new Error("Không thể lấy thông tin về luồng dữ liệu.");
      } catch (err) {
        utils(`Lỗi: Không thể lấy thông tin về luồng dữ liệu: ${err}`, 'error');
      }
    }
    let threadAllowNSFW = [];
    const nsfwData = store.getJson('threadAllowNSFW', 'default', { threads: [] });
    threadAllowNSFW = nsfwData.threads || [];
    if (command.config.Category.toLowerCase() == 'Nsfw' && !threadAllowNSFW.includes(threadID) && !NDH.includes(senderID) && !ADMINBOT.includes(senderID)) {
      return api.sendMessage(`❎ Nhóm không được phép sử dụng các lệnh thuộc nhóm NSFW!`, threadID, (err, info) => {
        if (!err) {
          setTimeout(() => {
            api.unsendMessage(info.messageID);
          }, 15000);
        }
      }, messageID);
    }
    var permssion = 0;
    const find = threadInfo.adminIDs.find(el => el.id == senderID);
    if (NDH.includes(senderID.toString())) permssion = 3;
    else if (ADMINBOT.includes(senderID.toString())) permssion = 2;
    else if (find) permssion = 1;
    const rolePermissions = {
      1: "Quản Trị Viên",
      2: "ADMIN BOT",
      3: "Người Hỗ Trợ"
    };
    const requiredPermission = rolePermissions[command.config.role] || "";
    if (permssion < command.config.role) {
      api.setMessageReaction('⛔', messageID, () => { }, true);
      return api.sendMessage(`📌 Lệnh ${command.config.name} có quyền hạn là ${requiredPermission}`, threadID, (err, info) => {
        if (!err) {
          setTimeout(() => {
            api.unsendMessage(info.messageID);
          }, 15000);
        }
      }, messageID);
    }
    if (!cd.has(command.config.name)) cd.set(command.config.name, new Map());
    const timestamps = cd.get(command.config.name);
    const expirationTime = (command.config.cd || 1) * 1000;
    if (timestamps.has(senderID) && dateNow < timestamps.get(senderID) + expirationTime) {
      api.setMessageReaction('⏱️', messageID, () => { }, true);
      const cooldownMsg = `⏱️ Bạn sử dụng quá nhanh, vui lòng thử lại sau: ${((timestamps.get(senderID) + expirationTime - dateNow) / 1000).toString().slice(0, 5)} giây`;
      return api.sendMessage(cooldownMsg, threadID, (err, info) => {
        if (!err) {
          setTimeout(() => {
            api.unsendMessage(info.messageID);
          }, 15000);
        }
      }, messageID);
    }
    try {
      const Currencies = {
        checkMoney: (userID) => money.checkMoney(threadID, userID),
        addMoney: (userID, amount) => money.addMoney(threadID, userID, amount),
        subtractMoney: (userID, amount) => money.subtractMoney(threadID, userID, amount),
        setMoney: (userID, amount) => money.setMoney(threadID, userID, amount),
        pay: (userID, receiverID, amount) => money.pay(threadID, userID, receiverID, amount),
        getBoxData: () => money.getBoxData(threadID),
        resetThread: () => money.resetThread(threadID),
        resetAll: () => money.resetAll()
      };
      await command.onRun({ api, event, args, permssion, money: Currencies, database: store });
      timestamps.set(senderID, dateNow);
      if (DeveloperMode) utils(`Lệnh ${commandName} được thực thi lúc ${time} bởi ${senderID} trong nhóm ${threadID}, thời gian thực thi: ${(Date.now()) - dateNow}ms`, "MODE");
    } catch (e) {
      return api.sendMessage(`❎ Lỗi khi thực thi lệnh ${commandName}: ${e}`, threadID);
    }
  };
};
