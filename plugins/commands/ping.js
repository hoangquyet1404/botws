module.exports = {
    config: {
        name: "ping",
        aliases: ["all", "tagall"],
        version: "3.0.0",
        role: 1,
        credits: "",
        info: "Tag tất cả thành viên trong nhóm với nội dung tùy chọn.",
        Category: "Box",
        guides: "[Nội dung]",
        cd: 10
    },

    onRun: async function({ api, event, args }) {
        try {
            const customMessage = args.join(" ") || "Dậy tương tác nào các bạn ơi!";
            if (event.messageReply) {
                const repliedUserID = event.messageReply.senderID;
                const threadInfo = await api.getThreadInfo(event.threadID);
                const repliedUser = threadInfo.userInfo.find(u => u.id === repliedUserID);
                const repliedUserName = repliedUser ? repliedUser.name : "User";
                
                return api.sendMessage({ tag: `${repliedUserName}`,userID: repliedUserID,body: customMessage,method: 'taguser'}, event.threadID,event.messageID);
            }
            return api.sendMessage({ tag: "mọi người",body: customMessage,method: 'tag'}, event.threadID,event.messageID);

        } catch (e) {
            console.log(e);
            return api.sendMessage("Đã có lỗi xảy ra!", event.threadID, event.messageID);
        }
    }
};