// handleReply.js
const logger = require("../utils/log");
const fs = require("fs");
const path = require("path");

module.exports = function ({ api }) {
    return async function ({ event }) {
        const { allowInbox, NDH } = global.config;
        const databanPath = path.resolve(__dirname, '../data/databan.json');
        let dataBan = { users: {}, threads: {} };
        if (fs.existsSync(databanPath)) {
            dataBan = JSON.parse(fs.readFileSync(databanPath));
        }
        const { commands, onReply } = global.concac;
        const { senderID, threadID } = event;
        const fixUserIB = true;
        const isSenderInNDH = NDH.includes(String(senderID));
        if (!isSenderInNDH && (dataBan.users[String(senderID)] || dataBan.threads[String(threadID)]) && fixUserIB) {
            return;
        }

        if (!event.messageReply) return;

        const { messageID, messageReply } = event;

        if (!onReply || onReply.length === 0) return;

        const indexOfHandle = onReply.findIndex(e =>
            String(messageReply.messageID) === String(e.messageID)
        );

        if (indexOfHandle < 0) return;

        const handleObj = onReply[indexOfHandle];
        const handleNeedExec = commands.get(handleObj.name);

        if (!handleNeedExec) {
            return api.sendMessage("Thiếu giá trị name", threadID, messageID);
        }
        const onReplyCallback = () => {
            onReply.splice(indexOfHandle, 1);
            logger(`Đã xóa reply handler cho messageID: ${messageReply.messageID}`, 'info');
        };
        const args = event.body ? event.body.trim().split(/ +/) : [];

        try {
            const money = require("../utils/money");
            const Currencies = {
                checkMoney: (userID) => money.checkMoney(threadID, userID),
                addMoney: (userID, amount) => money.addMoney(threadID, userID, amount),
                subtractMoney: (userID, amount) => money.subtractMoney(threadID, userID, amount),
                setMoney: (userID, amount) => money.setMoney(threadID, userID, amount),
                pay: (userID, receiverID, amount) => money.pay(threadID, userID, receiverID, amount)
            };
            await handleNeedExec.onReply({
                api,
                event: { ...event, args },
                onReply: handleObj,
                cleanup: onReplyCallback,
                money: Currencies
            });
            return;
        } catch (error) {
            console.log(error);
            logger(`Lỗi khi xử lý reply của lệnh ${handleNeedExec.config?.name || 'unknown'}: ${error}`, 'error');
            api.sendMessage("Lỗi thực thi: " + error, threadID, messageID);
            onReplyCallback();
            return;
        }
    };
};