function send(api, message, threadID, replyToMessage) {
    return api.sendMessage(message, threadID, null, replyToMessage);
}

function compact(value) {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, current) => {
        if (key === "connection" || typeof current === "function") return undefined;
        if (current && typeof current === "object" && current.socket) return undefined;
        if (current && typeof current === "object") {
            if (seen.has(current)) return "[Circular]";
            seen.add(current);
        }
        return current;
    }, 2);
}

async function getUsersToRing(api, threadID, selfID, explicitIDs) {
    if (explicitIDs.length > 0) {
        return explicitIDs.map(String);
    }

    const info = await api.getThreadInfo(threadID);
    return (info.participantIDs || [])
        .map(String)
        .filter(id => id && id !== String(selfID || ""));
}

module.exports = {
    config: {
        name: "call",
        aliases: ["groupcall", "callgroup"],
        version: "1.0.0",
        role: 2,
        author: "qh",
        info: "Quản lý group call bằng api.callgroup",
        Category: "Admin",
        guides: "[start] [threadID] [userID...] | stop [connectionID] | list | inspect [threadID] | url [threadID]",
        cd: 5,
        hasPrefix: true,
        images: []
    },

    onRun: async function({ api, event, args }) {
        const { threadID, messageID } = event;

        try {
            if (!api.callgroup) {
                return send(api, "api.callgroup chưa được load.", threadID, messageID);
            }

            const action = String(args[0] || "start").toLowerCase();
            if (["stop", "end", "disconnect"].includes(action)) {
                const result = await api.callgroup.disconnect(args[1]);
                return send(api, `Đã ngắt call.\n${compact(result)}`, threadID, messageID);
            }

            if (action === "list") {
                const result = await api.callgroup.listConnections();
                return send(api, result.length ? compact(result) : "Không có call nào đang mở.", threadID, messageID);
            }

            const isActionOnly = ["start", "inspect", "url"].includes(action);
            const targetThreadID = isActionOnly && args[1] ? args[1] : threadID;
            const explicitIDs = (isActionOnly ? args.slice(2) : args.slice(1))
                .filter(value => /^\d+$/.test(String(value)));
            const usersToRing = await getUsersToRing(api, targetThreadID, api.getCurrentUserID?.(), explicitIDs);
            const input = {
                threadID: String(targetThreadID),
                usersToRing
            };

            if (action === "url") {
                const result = await api.callgroup.buildUrl(input);
                return send(api, compact(result), threadID, messageID);
            }

            if (action === "inspect") {
                const result = await api.callgroup.inspect(input);
                return send(api, compact(result), threadID, messageID);
            }

            const result = await api.callgroup.start(input);
            const summary = {
                callID: result?.inspection?.callID || result?.callID || null,
                threadID: result?.inspection?.threadID || targetThreadID,
                usersToRing,
                connection: result?.connection?.id || result?.connectionID || null,
                sent: result?.sent || null
            };
            return send(api, `Đã gửi yêu cầu call.\n${compact(summary)}`, threadID, messageID);
        } catch (error) {
            console.error("[call] Error:", error);
            return send(api, `Lỗi call: ${error.message}`, threadID, messageID);
        }
    }
};
