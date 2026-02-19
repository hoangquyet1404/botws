// handleCommandEvent.js
const logger = require("../utils/log");
const fs = require("fs");
const path = require("path");
const money = require("../utils/money");

module.exports = function ({ api }) {
  return async function ({ event }) {
    const { allowInbox, NDH } = global.config;
    const databanPath = path.resolve(__dirname, '../data/databan.json');
    let dataBan = { users: {}, threads: {} };
    if (fs.existsSync(databanPath)) {
      dataBan = JSON.parse(fs.readFileSync(databanPath));
    }
    const { commands, eventRegistered } = global.concac;
    const { senderID, threadID } = event;
    const fixUserIB = true;
    const isSenderInNDH = NDH.includes(String(senderID));
    if (!isSenderInNDH && (dataBan.users[String(senderID)] || dataBan.threads[String(threadID)]) && fixUserIB) {
      return;
    }
    for (const eventReg of eventRegistered) {
      const cmd = commands.get(eventReg);
      try {
        if (cmd && cmd.onEvent) {
          const Currencies = {
            checkMoney: (userID) => money.checkMoney(threadID, userID),
            addMoney: (userID, amount) => money.addMoney(threadID, userID, amount),
            subtractMoney: (userID, amount) => money.subtractMoney(threadID, userID, amount),
            setMoney: (userID, amount) => money.setMoney(threadID, userID, amount),
            pay: (userID, receiverID, amount) => money.pay(threadID, userID, receiverID, amount)
          };
          await cmd.onEvent({ api, event, money: Currencies });
        }
      } catch (error) {
        console.log(error);
        if (cmd && cmd.config) {
          logger(`Lỗi khi xử lý sự kiện của lệnh ${cmd.config.name}: ${error}`, 'error');
        }
      }
    }
  };
};