const fs = require("fs");
const path = require("path");
const moneyDir = path.join(process.cwd(), "main/data/money");

if (!fs.existsSync(moneyDir)) {
    fs.mkdirSync(moneyDir, { recursive: true });
}

function getFilePath(threadID) {
    return path.join(moneyDir, `${threadID}.json`);
}

function readData(threadID) {
    const filePath = getFilePath(threadID);
    if (!fs.existsSync(filePath)) return {};
    try {
        const data = fs.readFileSync(filePath, "utf8");
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

function writeData(threadID, data) {
    const filePath = getFilePath(threadID);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

module.exports = {
    checkMoney: async function (threadID, userID) {
        const data = readData(threadID);
        return data[userID] || 0;
    },
    
    addMoney: async function (threadID, userID, amount) {
        const data = readData(threadID);
        if (!data[userID]) data[userID] = 0;
        data[userID] += parseInt(amount);
        writeData(threadID, data);
        return data[userID];
    },

    setMoney: async function (threadID, userID, amount) {
        const data = readData(threadID);
        data[userID] = parseInt(amount);
        writeData(threadID, data);
        return data[userID];
    },

    pay: async function (threadID, senderID, receiverID, amount) {
        const data = readData(threadID);
        if (!data[senderID]) data[senderID] = 0;
        if (!data[receiverID]) data[receiverID] = 0;

        if (data[senderID] < amount) return false; // Không đủ tiền

        data[senderID] -= parseInt(amount);
        data[receiverID] += parseInt(amount);
        
        writeData(threadID, data);
        return true;
    },

    getBoxData: function (threadID) {
        return readData(threadID);
    }
};