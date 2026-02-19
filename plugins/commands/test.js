
const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports.config = {
    name: "test",
    aliases: ["media"],
    version: "1.0.0",
    role: 0,
    author: "Antigravity",
    info: "Test media sending (Link & Binary)",
    Category: "System",
    guides: "[link] | [reply] | [local]",
    cd: 5,
    hasPrefix: true
};

module.exports.onRun = async ({ api, event, args }) => {
    const { threadID, messageID, type, messageReply } = event;
    if (type === "message_reply" && messageReply.attachments && messageReply.attachments.length > 0) {
        const attachmentUrls = messageReply.attachments.map(att => att.url || att.facebookUrl).filter(u => u);

        if (attachmentUrls.length === 0) return api.sendMessage("Cannot get URLs from these attachments.", threadID, messageID);

        return api.sendMessage({
            body: `Echoing ${messageReply.attachments.length} attachment(s):`,
            attachment: attachmentUrls // Send array of URLs
        }, threadID, messageID);
    }
    const input = args[0];
    if (input && input.startsWith("http")) {
        return api.sendMessage({
            body: "Test sending Link:",
            attachment: [input]
        }, threadID, messageID);
    }
    if (input === "local") {
        const imagePath = path.join(__dirname, 'cache', 'image.jpg');
        const imagePath2 = path.join(__dirname, 'cache', 'image2.jpg');
        const imagePath3 = path.join(__dirname, 'cache', 'image3.jpg');

        const attachments = [];
        if (fs.existsSync(imagePath)) attachments.push(fs.createReadStream(imagePath));
        if (fs.existsSync(imagePath2)) attachments.push(fs.createReadStream(imagePath2));
        if (fs.existsSync(imagePath3)) attachments.push(fs.createReadStream(imagePath3));

        if (attachments.length === 0) {
            return api.sendMessage("Missing images in cache folder.", threadID, messageID);
        }

        return api.sendMessage({
            body: "Test sending 3 Local Images:",
            attachment: attachments
        }, threadID, messageID);
    }

    // Default: Guide
    return api.sendMessage(
        "Usage:\n" +
        "1. !test <link> (Test URL)\n" +
        "2. !test local (Test local image & video)\n" +
        "3. Reply to media + !test (Echo)",
        threadID,
        messageID
    );
};
