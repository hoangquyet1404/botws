
module.exports = {
    config: {
        name: "cmd",
        aliases: ["cmd"],
        version: "1.0.0",
        role: 3,
        author: "Mirai Team",
        info: "Quản lý/Kiểm soát toàn bộ module của bot",
        Category: "Admin",
        guides: "[load/unload/loadAll/unloadAll/info] [tên module]",
        cd: 2,
        hasPrefix: true,
        images: [],
    },
    onRun: ({ event, args, api }) => {
        const fs = require('fs');
        const path = require('path');
        const adminIDs = global.config.NDH || [];
        if (!adminIDs.includes(event.senderID)) return api.sendMessage(`=))`, event.threadID, event.messageID);
        const { readdirSync } = require("fs-extra");
        const { threadID, messageID } = event;
        var moduleList = args.splice(1, args.length);
        switch (args[0]) {
            case "c":
            case "count": {
                let commands = global.concac.commands.values();
                let infoCommand = "";
                api.sendMessage("📝 Hiện tại có " + global.concac.commands.size + " lệnh có thể sử dụng" + infoCommand, event.threadID, event.messageID);
                break;
            }
            case "l":
            case "load": {
                if (moduleList.length == 0) return api.sendMessage("❎ Tên module không được phép bỏ trống", threadID, messageID);
                else return loadCommand({ moduleList, threadID, messageID });
            }
            case "unload": {
                if (moduleList.length == 0) return api.sendMessage("❎ Tên module không được phép bỏ trống", threadID, messageID);
                else return unloadModule({ moduleList, threadID, messageID });
            }
            case "loadAll": {
                moduleList = readdirSync(global.concac.commandsPath).filter((file) => file.endsWith(".js") && !file.includes('example'));
                moduleList = moduleList.map(item => item.replace(/\.js/g, ""));
                return loadCommand({ moduleList, threadID, messageID });
            }
            case "unloadAll": {
                moduleList = readdirSync(global.concac.commandsPath).filter((file) => file.endsWith(".js") && !file.includes('example') && !file.includes("command"));
                moduleList = moduleList.map(item => item.replace(/\.js/g, ""));
                return unloadModule({ moduleList, threadID, messageID });
            }
            case "info": {
                const command = global.concac.commands.get(moduleList.join("") || "");
                if (!command) return api.sendMessage("❎ Module bạn nhập không tồn tại", threadID, messageID);
                const { name, version, role, author, cd } = command.config;
                return api.sendMessage(
                    "|› Tên lệnh" + name.toUpperCase() + "\n" +
                    "|› Tác giả: " + author + "\n" +
                    "|› Phiên bản: " + version + "\n" +
                    "|› Quyền hạn: " + ((role == 0) ? "Người dùng" : (role == 1) ? "Quản trị viên" : "Admin Bot") + "\n" +
                    "|› Thời gian chờ: " + cd + " giây(s)\n" +
                    "──────────────────",
                    threadID, messageID
                );
            }
            default: {
                return api.sendMessage(`❎ Lỗi: Sử dụng sai cú pháp lệnh ${module.exports.config.name}`, threadID, messageID);
            }
        }
    }
};

const loadCommand = function ({ moduleList, threadID, messageID }) {
    const { writeFileSync, unlinkSync } = require('fs-extra');
    const { join } = require('path');
    const { configPath, api } = global.concac;
    const logger = require('../../main/utils/log');
    var errorList = [];
    delete require.cache[require.resolve(configPath)];
    var configValue = require(configPath);
    writeFileSync(configPath + '.temp', JSON.stringify(configValue, null, 2), 'utf8');
    for (const nameModule of moduleList) {
        try {
            const dirModule = join(global.concac.commandsPath, nameModule + '.js');
            delete require.cache[require.resolve(dirModule)];
            const command = require(dirModule);
            global.concac.commands.delete(nameModule);
            if (!command.config || !command.onRun || !command.config.Category)
                throw new Error('Module không đúng định dạng!');
            global.concac.eventRegistered = global.concac.eventRegistered.filter(info => info != command.config.name);
            if (command.config.envConfig && typeof command.config.envConfig == 'object') {
                for (const [key, value] of Object.entries(command.config.envConfig)) {
                    if (typeof global.concac.configModule[command.config.name] == 'undefined')
                        global.concac.configModule[command.config.name] = {};
                    if (typeof configValue[command.config.name] == 'undefined')
                        configValue[command.config.name] = {};
                    if (typeof configValue[command.config.name][key] !== 'undefined')
                        global.concac.configModule[command.config.name][key] = configValue[command.config.name][key];
                    else
                        global.concac.configModule[command.config.name][key] = value || '';
                    if (typeof configValue[command.config.name][key] == 'undefined')
                        configValue[command.config.name][key] = value || '';
                }
                logger('Loaded config' + ' ' + command.config.name, "CMD");
            }
            if (command['onLoad']) {
                const onLoads = {};
                onLoads['configValue'] = configValue;
                command['onLoad'](onLoads);
            }
            if (command.onEvent)
                global.concac.eventRegistered.push(command.config.name);

            if (!global.config.commandDisabled) global.config.commandDisabled = [];
            if (!configValue.commandDisabled) configValue.commandDisabled = [];

            if (global.config.commandDisabled.includes(nameModule + '.js') || configValue.commandDisabled.includes(nameModule + '.js')) {
                configValue.commandDisabled.splice(configValue.commandDisabled.indexOf(nameModule + '.js'), 1);
                global.config.commandDisabled.splice(global.config.commandDisabled.indexOf(nameModule + '.js'), 1);
            }
            global.concac.commands.set(command.config.name, command);
            logger('Loaded command ' + command.config.name + '!', "CMD");
        } catch (error) {
            errorList.push('- ' + nameModule + ' reason:' + error + ' at ' + error.stack);
        };
    }
    if (errorList.length != 0)
        api.sendMessage('❎ Những lệnh xảy ra sự cố khi load: ' + errorList.join(' '), threadID, messageID);
    api.sendMessage('☑️ Đã tải thành công ' + (moduleList.length - errorList.length) + ' lệnh', threadID, messageID);
    writeFileSync(configPath, JSON.stringify(configValue, null, 4), 'utf8');
    unlinkSync(configPath + '.temp');
    return;
}
const unloadModule = function ({ moduleList, threadID, messageID }) {
    const { writeFileSync, unlinkSync } = require("fs-extra");
    const { configPath, mainPath, api } = global.concac;
    const logger = require(process.cwd() + '/main/utils/log').loader;
    delete require.cache[require.resolve(configPath)];
    var configValue = require(configPath);
    writeFileSync(configPath + ".temp", JSON.stringify(configValue, null, 4), 'utf8');
    for (const nameModule of moduleList) {
        global.concac.commands.delete(nameModule);
        global.concac.eventRegistered = global.concac.eventRegistered.filter(item => item !== nameModule);

        if (!configValue["commandDisabled"]) configValue["commandDisabled"] = [];
        if (!global.config["commandDisabled"]) global.config["commandDisabled"] = [];

        configValue["commandDisabled"].push(`${nameModule}.js`);
        global.config["commandDisabled"].push(`${nameModule}.js`);
        logger(`Unloaded command ${nameModule}!`, "CMD");
    }
    writeFileSync(configPath, JSON.stringify(configValue, null, 4), 'utf8');
    unlinkSync(configPath + ".temp");

    return api.sendMessage(`☑️ Đã hủy tải thành công ${moduleList.length} lệnh`, threadID, messageID);
}