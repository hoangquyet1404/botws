// handleCommandEvent.js
const logger = require("../utils/log");
const money = require("../utils/money");
const store = require("../utils/database");

module.exports = function ({ api }) {
  return async function ({ event }) {
    const { allowInbox, NDH } = global.config;
    let dataBan = store.getJson('databan', 'default', { users: {}, threads: {} });
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
            pay: (userID, receiverID, amount) => money.pay(threadID, userID, receiverID, amount),
            getBoxData: () => money.getBoxData(threadID),
            resetThread: () => money.resetThread(threadID),
            resetAll: () => money.resetAll()
          };
          await cmd.onEvent({ api, event, money: Currencies, database: store });
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
