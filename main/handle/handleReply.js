// handleReply.js
const logger = require("../utils/log");
const store = require("../utils/database");

module.exports = function ({ api }) {
    return async function ({ event }) {
        const { NDH } = global.config;
        let dataBan = store.getJson('databan', 'default', { users: {}, threads: {} });

        const { commands, onReply } = global.concac;
        const { senderID, threadID } = event;
        const fixUserIB = true;
        const isSenderInNDH = NDH.includes(String(senderID));

        if (!isSenderInNDH && (dataBan.users[String(senderID)] || dataBan.threads[String(threadID)]) && fixUserIB) {
            return;
        }

        if (!event.messageReply) {
            return;
        }

        const { messageID, messageReply } = event;
        if (!onReply || onReply.length === 0) {
            return;
        }

        const repliedMessageID = String(messageReply.messageID || messageReply.messageId || "");
        if (!repliedMessageID) {
            return;
        }

        const indexOfHandle = onReply.findIndex((item) => repliedMessageID === String(item.messageID));
        if (indexOfHandle < 0) {
            return;
        }

        const handleObj = onReply[indexOfHandle];
        const handleNeedExec = commands.get(handleObj.name);
        if (!handleNeedExec) {
            return api.sendMessage("Thieu gia tri name", threadID, messageID);
        }

        const onReplyCallback = () => {
            onReply.splice(indexOfHandle, 1);
            logger(`Removed reply handler for messageID: ${repliedMessageID}`, "info");
        };
        const args = event.body ? event.body.trim().split(/ +/) : [];

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

            await handleNeedExec.onReply({
                api,
                event: { ...event, args },
                onReply: handleObj,
                cleanup: onReplyCallback,
                money: Currencies,
                database: store
            });
            return;
        } catch (error) {
            console.log(error);
            logger(`Reply handler error for ${handleNeedExec.config?.name || "unknown"}: ${error}`, "error");
            api.sendMessage(`Loi thuc thi: ${error}`, threadID, messageID);
            onReplyCallback();
            return;
        }
    };
};
