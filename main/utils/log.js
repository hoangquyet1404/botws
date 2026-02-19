const chalk = require('chalk');

const themes = {
    warn:  { label: '[ WARNING ]', color: '#FF8C00', text: '#FFD700' },
    error: { label: '[ ERROR ]', color: '#FF0000', text: '#FFA0A0' },
    info:  { label: '[ INFO ]', color: '#00E5FF', text: '#E0FFFF' },
    success: { label: '[ SUCCESS ]', color: '#00FF7F', text: '#F0FFF0' }
};

const logger = (data, option = 'info') => {
    const theme = themes[option] || themes.info;
    console.log(
        chalk.bold.hex(theme.color)(theme.label) + 
        chalk.hex('#555555')(' » ') + 
        chalk.hex(theme.text)(data)
    );
};
Object.keys(themes).forEach(type => {
    logger[type] = (data) => logger(data, type);
});

module.exports = logger;
module.exports.loader = logger;