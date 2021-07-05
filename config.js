const path = require('path')
const fs = require('fs')
const argv = require('minimist')(process.argv.slice(2))
const {getProjectConf, merge, isFunction} = require('./utils')
const packageJson = require(path.resolve(process.cwd(), 'package.json'))
const {platform, version, urlPrefix} = packageJson

global.resolveApp = function (...args) {
    return path.resolve(process.cwd(), ...args)
}

global.requireApp = function (...args) {
    return require.resolve(path.join(process.cwd(), ...args))
}

global.resolvePath = function resolvePath(...args) {
    return path.resolve(__dirname, ...args)
}

global.requirePath = function requirePath(...args) {
    return require.resolve(path.resolve(__dirname, ...args))
}

global.requireMod = function (mod) {
    return require(requirePath(mod))
}

const dotenv = require('dotenv')
dotenv.config()
var ENV_VARS = {}
if (fs.existsSync(resolveApp('.env'))) {
    ENV_VARS = dotenv.parse(fs.readFileSync(resolveApp('.env')))
}
class Config {
    constructor() {
        this.config = {
            assertPath: `${platform}/${version}`,
            urlPrefix: `${urlPrefix || '/'}`,
            publicPath: resolveApp('public'),
            nodeModulesPath: [resolveApp('node_modules'), resolvePath('node_modules')],
            enableDll: false,
            consts: {
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
            },
            packageJson,
            ENV_VARS,
            cmdArgv: argv
        }
    }
    setConfig(conf) {
        merge(this.config, conf)
    }
    trigger(event, ...args) {
        if (this[event]) {
            this[event](...args)
        }
    }
}

var config = new Config()

var OverrideConfig = getProjectConf()

var profile = OverrideConfig.profile || 'default'
var ProfileConfig
if (profile) {
    const profileConfigFile = resolvePath('profile', profile, 'config.js')
    if (fs.existsSync(profileConfigFile)) {
        ProfileConfig = require(profileConfigFile)
        if (isFunction(ProfileConfig.init)) {
            ProfileConfig = ProfileConfig.init(Config)
            config = new ProfileConfig()
        } else {
            ProfileConfig = null
        }
    }
}

if (isFunction(OverrideConfig.init)) {
    OverrideConfig = OverrideConfig.init(ProfileConfig || Config)
    config = new OverrideConfig()
}

config.setConfig({
    profile,
    cmdArgv: argv
})

if (argv.d) {
    config.setConfig({
        publicPath: path.resolve(process.cwd(), argv.d)
    })
}

global.getConfig = function () {
    return config
}

module.exports = config
