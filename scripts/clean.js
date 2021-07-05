const shelljs = require('shelljs')
const Config = require('../config')
const config = Config.config
shelljs.rm('-rf', config.publicPath)
try {
    shelljs.rm('-rf', resolveApp('node_modules/.cache'))
} catch (err) {}
