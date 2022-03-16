const shelljs = require('shelljs');
const Config = require('../config');

const {config} = Config;
shelljs.rm('-rf', config.publicPath);
try {
    shelljs.rm('-rf', resolveApp('node_modules/.cache'));
} catch (err) {
    console.log('something wrong while cleaning');
    console.log(err);
}
