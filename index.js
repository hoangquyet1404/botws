const { fork } = require('child_process'), path = require('path'), MAIN_PATH = path.join(__dirname, 'main.js');
const log = (data, type = "SYSTEM") => {
    const color = type === "ERROR" ? "\x1b[31m" : type === "WARN" ? "\x1b[33m" : "\x1b[36m";
    console.log(`${color}[ ${type} ]\x1b[0m ${data}`);
};

function startBot() {
    log(' Starting Bot Worker...', "START");
    const child = fork(MAIN_PATH, [], { env: process.env });
    
    child.on('exit', (code) => {
        if (code !== 0) {
            log(`⚠️ Bot Worker exited with code ${code}. Restarting in 1s...`, "WARN");
            setTimeout(startBot, 1000);
        } else {
            log('Bot Worker stopped gracefully.', "EXIT");
            process.exit(0);
        }
    });

    child.on('error', (err) => log(`Failed to start worker: ${err}`, "ERROR"));
}

startBot();