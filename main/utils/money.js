const store = require('./database');

module.exports = {
    checkMoney: async function (threadID, userID) {
        return store.money.get(threadID, userID);
    },

    addMoney: async function (threadID, userID, amount) {
        return store.money.add(threadID, userID, amount);
    },

    subtractMoney: async function (threadID, userID, amount) {
        return store.money.subtract(threadID, userID, amount);
    },

    setMoney: async function (threadID, userID, amount) {
        return store.money.set(threadID, userID, amount);
    },

    pay: async function (threadID, senderID, receiverID, amount) {
        return store.money.pay(threadID, senderID, receiverID, amount);
    },

    getBoxData: function (threadID) {
        return store.money.getThread(threadID);
    },

    resetThread: function (threadID) {
        return store.money.resetThread(threadID);
    },

    resetAll: function () {
        return store.money.resetAll();
    }
};
