module.exports = class {
    static config = {
        name: "threadcolor",
        aliases: ["changecolor", "color"],
        version: "1.0.0",
        role: 1,
        author: "Panna",
        info: "Thay đổi màu nền chủ đề bằng AI dựa trên prompt",
        Category: "Box",
        guides: "[threadcolor <prompt>]",
        cd: 5,
        hasPrefix: true,
        images: []
    };

    static async onRun({ api, event, args, Threads }) {
        const threadID = event.threadID;
        const prompt = args.join(" ") || "Màu sắc tươi sáng và hiện đại";

        if (!prompt) {
            return api.sendMessage("Vui lòng cung cấp một prompt để thay đổi màu nền!", threadID);
        }

        try {
            await new Promise((resolve, reject) => {
                api.changeAI(prompt, threadID, (err) => {
                    if (err) {
                        console.error("Error changing thread color with AI:", err);
                        return reject(err);
                    }
                    resolve();
                });
            });
            return api.sendMessage(`Đã thay đổi màu nền chủ đề dựa trên prompt: "${prompt}"`, threadID);
        } catch (error) {
            return api.sendMessage("Có lỗi xảy ra khi thay đổi màu nền: " + error.message, threadID);
        }
    }
}