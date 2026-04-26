"use strict";

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const FormData = require("form-data");

module.exports = {
    config: {
        name: "4k",
        version: "1.4.6",
        role: 0,
        author: "",
        info: "Upscale ảnh 4K bằng cách reply ảnh",
        Category: "Box",
        guides: "Gõ '4k' sau đó reply ảnh vào tin nhắn của bot",
        cd: 5,
        hasPrefix: false
    },

    onReply: async function ({ api, event, onReply }) {
        const { threadID, messageID, senderID, attachments, type } = event;
        const send = (msg, cb) => api.sendMessage(msg, threadID, cb, messageID);

        if (senderID !== onReply.author) return;

        if (type !== "message_reply" || !attachments || attachments[0].type !== "photo") {
            return send("📸 Vui lòng reply đúng vào tấm ảnh ông muốn làm nét!");
        }

        const imageUrl = attachments[0].url;
        const cacheDir = path.join(__dirname, 'cache');
        const inputPath = path.join(cacheDir, `in4k_${senderID}_${Date.now()}.jpg`);
        const outputPath = path.join(cacheDir, `out4k_${senderID}_${Date.now()}.png`);
        
        let waitMsg;

        try {
            waitMsg = await new Promise(res => send("⏳ Đang xử lý ảnh, ông đợi tí nhé...", (err, info) => res(info)));
            
           
            const imageBuffer = (await axios.get(imageUrl, { responseType: "arraybuffer" })).data;
            fs.ensureDirSync(cacheDir);
            fs.writeFileSync(inputPath, imageBuffer);

            
            const formData = new FormData();
            formData.append("files", fs.createReadStream(inputPath));
            
            const uploadRes = await axios.post("https://tuan2308-upscaler-2.hf.space/gradio_api/upload", formData, {
                headers: formData.getHeaders()
            });

            const filePath = uploadRes.data[0];
            const session_hash = Math.random().toString(36).substring(2);

           
            const fileData = {
                path: filePath,
                url: `https://tuan2308-upscaler-2.hf.space/gradio_api/file=${filePath}`,
                orig_name: "image.jpg",
                size: imageBuffer.length,
                mime_type: "image/jpeg",
                meta: { _type: "gradio.FileData" }
            };

            
            await axios.post("https://tuan2308-upscaler-2.hf.space/gradio_api/queue/join?__theme=system", {
                data: [fileData, "RealESRGAN_x4plus_anime_6B", 0.5, false, 3],
                event_data: null,
                fn_index: 1,
                session_hash: session_hash,
                trigger_id: 17 
            });

            
            let finalUrl = "";
            let isDone = false;
            while (!isDone) {
                const queueRes = await axios.get(`https://tuan2308-upscaler-2.hf.space/gradio_api/queue/data?session_hash=${session_hash}`);
                const responseData = typeof queueRes.data === 'string' ? queueRes.data : JSON.stringify(queueRes.data);

                if (responseData.includes("process_completed")) {
                    const match = responseData.match(/"path":\s*"([^"]+)"/);
                    if (match) {
                        finalUrl = `https://tuan2308-upscaler-2.hf.space/gradio_api/file=${match[1]}`;
                        isDone = true;
                    }
                } else if (responseData.includes("process_error")) {
                    throw new Error("Server AI báo lỗi khi đang xử lý.");
                }
                if (!isDone) await new Promise(r => setTimeout(r, 2000));
            }

            
            const finalBuffer = (await axios.get(finalUrl, { responseType: "arraybuffer" })).data;
            fs.writeFileSync(outputPath, finalBuffer);

            api.unsendMessage(waitMsg.messageID);
            return send({
                body: "✅ Xong rồi nhé! Nét căng luôn.",
                attachment: fs.createReadStream(outputPath)
            }, () => {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            });

        } catch (err) {
            if (waitMsg) api.unsendMessage(waitMsg.messageID);
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            return send(`🛑 Lỗi rồi: ${err.message}`);
        }
    },

    onRun: async function ({ api, event }) {
        const { threadID, messageID, senderID } = event;
        return api.sendMessage("📸 Ông hãy reply tấm ảnh muốn làm nét vào tin nhắn này của tôi nhé!", threadID, (err, info) => {
            if (err) return;
            global.concac.onReply.push({
                name: this.config.name,
                messageID: info.messageID,
                author: senderID
            });
        }, messageID);
    }
};