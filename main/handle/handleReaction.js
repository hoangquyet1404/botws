
const utils = require("../utils/log");
const store = require("../utils/database");

module.exports = function ({ api }) {
  return async function ({ event }) {
    const { onReaction, commands } = global.concac;
    const { messageID, threadID, reaction, userID, senderID } = event;
    try {
      const settings = store.getJson('unsendSettings', 'default', {});
      const threadSettings = settings.threads?.[threadID];

      if (threadSettings && threadSettings.icon === reaction) {
        await api.unsendMessage(messageID);
        //utils(`Auto unsend message ${messageID} in thread ${threadID} by reaction ${reaction}`, 'info');
        return;
      }
    } catch (error) {
      console.error('Auto unsend reaction error:', error);
    }

    if (!onReaction || onReaction.length === 0) return;

    const indexOfHandle = onReaction.findIndex(e => e.messageID == messageID);
    if (indexOfHandle < 0) return;

    const indexOfMessage = onReaction[indexOfHandle];
    const handleNeedExec = commands.get(indexOfMessage.name);

    if (!handleNeedExec) return api.sendMessage("Giá trị bị thiếu", threadID, messageID);

    try {
      const money = require("../utils/money");
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
      await handleNeedExec.onReaction({ api, event, onReaction: indexOfMessage, money: Currencies, database: store });
      return;
    } catch (error) {
      utils(error, "error");
      return api.sendMessage("Lỗi khi thực thi", threadID, messageID);
    }
  };
};
