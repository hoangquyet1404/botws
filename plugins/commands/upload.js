"use strict";

function getAttachmentUrl(attachment) {
    if (!attachment || typeof attachment !== "object") return "";
    return attachment.url ||
        attachment.largePreviewUrl ||
        attachment.previewUrl ||
        attachment.facebookUrl ||
        attachment.fallbackUrl ||
        attachment.playableUrl ||
        attachment.thumbnailUrl ||
        "";
}

function normalizeType(type) {
    const raw = String(type || "").toLowerCase();
    if (raw === "photo") return "image";
    if (raw === "animated_image") return "gif";
    if (["image", "video", "audio", "gif"].includes(raw)) return raw;
    return "";
}

function findMediaId(result) {
    if (!result || typeof result !== "object") return "";
    const candidates = [
        result.attachmentID,
        result.attachmentId,
        result.mediaID,
        result.mediaId,
        result.image_id,
        result.imageID,
        result.video_id,
        result.videoID,
        result.audio_id,
        result.audioID,
        result.gif_id,
        result.gifID,
        result.file_id,
        result.fileID,
        result.id,
        result.metadata?.fbid,
        result.metadata?.image_id,
        result.metadata?.video_id,
        result.metadata?.audio_id,
        result.metadata?.gif_id,
        result.metadata?.file_id
    ];
    return candidates.find(Boolean) || "";
}

module.exports = {
    config: {
        name: "upload",
        aliases: ["uptest"],
        version: "1.0.0",
        role: 2,
        author: "HoangDev",
        info: "Test api.upload bằng media reply/kèm tin nhắn",
        Category: "Dev",
        guides: [
            "upload",
            "Reply ảnh/video/audio/file rồi dùng upload",
            "Có thể gửi kèm media trực tiếp cùng lệnh upload"
        ].join("\n"),
        cd: 3,
        hasPrefix: true,
        images: []
    },

    onRun: async function ({ api, event, args }) {
        const { threadID, messageID, messageReply } = event;
        const attachments = [
            ...(Array.isArray(event.attachments) ? event.attachments : []),
            ...(Array.isArray(messageReply?.attachments) ? messageReply.attachments : [])
        ].filter(Boolean);

        const attachment = attachments[0];
        if (!attachment) {
            return api.sendMessage(
                "Reply hoặc gửi kèm 1 media để test api.upload.",
                threadID,
                null,
                messageID
            );
        }

        const url = getAttachmentUrl(attachment);
        if (!url) {
            return api.sendMessage("Không tìm thấy URL media trong attachment.", threadID, null, messageID);
        }

        const mediaType = normalizeType(args[0]) || normalizeType(attachment.type || attachment.mediaType);
        const filename = attachment.filename ||
            attachment.name ||
            `${mediaType || "attachment"}_${Date.now()}`;

        try {
            await api.sendMessage("Đang test api.upload...", threadID, null, messageID);
            const result = await api.upload({
                url,
                filename,
                contentType: attachment.contentType || attachment.mimeType || attachment.mimetype,
                mediaType
            }, { threadID });

            const id = Array.isArray(result)
                ? result.map(findMediaId).filter(Boolean).join(", ")
                : findMediaId(result);

            const body = [
                "[ UPLOAD TEST ]",
                `Status: OK`,
                `ID: ${id || "không thấy"}`,
                `Type: ${mediaType || "unknown"}`,
                "",
                "Raw:",
                JSON.stringify(result, null, 2)
            ].join("\n");

            return api.sendMessage(body.slice(0, 18000), threadID, null, messageID);
        } catch (error) {
            console.error("[upload] Error:", error);
            return api.sendMessage(
                `[ UPLOAD TEST ]\nStatus: ERROR\n${error.message || error}`,
                threadID,
                null,
                messageID
            );
        }
    }
};
