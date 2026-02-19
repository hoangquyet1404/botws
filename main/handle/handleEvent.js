// handleEvent.js
const fs = require("fs");
const path = require("path");
const utils = require("../utils/log");
const moment = require("moment-timezone");

module.exports = function ({ api }) {
  return async function ({ event }) {
    const timeStart = Date.now();
    const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss L");
    const databanPath = path.resolve(__dirname, '../data/databan.json');
    let dataBan = { users: {}, threads: {} };
    if (fs.existsSync(databanPath)) {
      dataBan = JSON.parse(fs.readFileSync(databanPath));
    }
    const { events } = global.concac;
    const { allowInbox, DeveloperMode, NDH } = global.config;
    let { senderID, threadID } = event;
    senderID = String(senderID);
    threadID = String(threadID);
    const isSenderInNDH = NDH.includes(senderID);
    if (!isSenderInNDH && (dataBan.users[senderID] || dataBan.threads[threadID] || (!allowInbox && senderID === threadID))) {
      return;
    }
    for (const [key, value] of events.entries()) {
      if (value.config.eventType && value.config.eventType.includes(event.logMessageType)) {
        const eventRun = events.get(key);
        try {
          const money = require("../utils/money");
          const Currencies = {
            checkMoney: (userID) => money.checkMoney(threadID, userID),
            addMoney: (userID, amount) => money.addMoney(threadID, userID, amount),
            subtractMoney: (userID, amount) => money.subtractMoney(threadID, userID, amount),
            setMoney: (userID, amount) => money.setMoney(threadID, userID, amount),
            pay: (userID, receiverID, amount) => money.pay(threadID, userID, receiverID, amount)
          };
          await eventRun.onEvent({ api, event, money: Currencies });
          if (DeveloperMode) {
            utils(`Đang thực thi sự kiện ${eventRun.config.name} vào lúc ${time} trong nhóm ${threadID}. Thời gian thực hiện: ${Date.now() - timeStart}ms`, '[ Sự kiện ]');
          }
        } catch (error) {
          utils(`Đã xảy ra lỗi trong quá trình thực thi sự kiện ${eventRun.config.name}: ${JSON.stringify(error)}`, "error");
        }
      }
    }
  };
};