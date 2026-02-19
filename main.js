const { initFCA } = require('./fca'), listen = require('./main/listen'), config = require('./config.json');
const fs = require('fs'), path = require('path'), logger = require('./main/utils/log');

global.tools = require("./main/tools.js");
global.config = config;
global.concac = {
    commands: new Map(), events: new Map(), cd: new Map(), eventRegistered: [],
    onReply: [], onReaction: [], handleSchedule: new Map(), mainPath: process.cwd(), api: null,
    configPath: path.join(process.cwd(), 'config.json'),
    commandsPath: path.join(process.cwd(), 'plugins/commands'),
    eventsPath: path.join(process.cwd(), 'plugins/events')
};

function loadPlugins() {
    const load = (dir, type) => {
        const p = path.join(__dirname, `plugins/${dir}`);
        if (!fs.existsSync(p)) return 0;
        let count = 0;
        fs.readdirSync(p).filter(f => f.endsWith('.js')).forEach(file => {
            try {
                const item = require(path.join(p, file)), { config, onRun, onLoad, onEvent } = item;
                if (!config?.name) throw new Error("Missing config/name");
                if (type === 'cmd' && !onRun) throw new Error("Missing onRun");
                if (type === 'ev' && !onEvent) throw new Error("Missing onEvent");

                const col = type === 'cmd' ? 'commands' : 'events';
                if (global.concac[col].has(config.name)) throw new Error("Name duplicated");

                const money = require(path.join(process.cwd(), 'main/utils/money.js'));
                if (onLoad) try { onLoad({ api: global.concac.api, models: {}, money }); } catch (e) { logger.error(`onLoad ${file}: ${e.message}`); }
                if (onEvent) global.concac.eventRegistered.push(config.name);

                global.concac[col].set(config.name, item);
                if (config.aliases && type === 'cmd') config.aliases.forEach(al => global.concac[col].set(al, item));
                count++;
            } catch (e) { logger.error(`Failed to load ${type} ${file}: ${e.message}`); }
        });
        return count;
    };

    const cmdCount = load('commands', 'cmd'), evCount = load('events', 'ev');
    logger.success(`Loaded ${cmdCount} commands & ${evCount} events`);
}

async function main() {
    try {
        const cookiePath = path.join(__dirname, 'cookie.txt');
        if (fs.existsSync(cookiePath)) {
            const cookie = fs.readFileSync(cookiePath, 'utf8').trim();
            if (cookie) config.cookie = cookie;
        }

        const api = await initFCA(config);
        global.concac.api = api;
        loadPlugins();
        listen({ api });
        logger.success('System is ready to work!');
    } catch (e) {
        logger.error(`Startup failed: ${e.message}`);
        process.exit(config.status ? 1 : 0);
    }
}

if (require.main === module) main();

process.on('unhandledRejection', (reason) => {
    const ignore = ['unsendMessage', 'sendMessage', 'shareContact', 'setNickname','removeFromGroup','removeUserFromGroup','unsendMessage'];
    if (ignore.some(m => reason?.message?.includes(m))) return;
    logger.error(`Unhandled Rejection: ${reason}`);
}).on('uncaughtException', (e) => logger.error(`Uncaught Exception: ${e.message}`));

module.exports = main;