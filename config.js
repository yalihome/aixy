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
    ENV_VARS = dotenv.parse(fs.readFileSync(resolveApp('.env')));
}
//如果是小程序，则小程序需要添加 PLATFORM 环境变量
if(packageJson.platform=='microapp' && !ENV_VARS.PLATFORM){
    process.env.PLATFORM = ENV_VARS.PLATFORM = 'wechat';
}
class Config {
    constructor() {
        this.config = {
            assertPath: `${platform}/${version}`,  // desktop/1.0.0
            urlPrefix: `${urlPrefix || '/'}`,
            publicPath: resolveApp('public'),  // public 目录的位置
            nodeModulesPath: [resolveApp('node_modules'), resolvePath('node_modules')],  // 项目 node_modules 目录和 工具的 node_modules 目录
            enableDll: false,  // 是否开启缓存?
            consts: {
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
            },
            packageJson,  // package.json文件的配置
            ENV_VARS,  //环境变量
            cmdArgv: argv
        }
    }
    setConfig(conf) {
        //添加配置到 this.config，就是覆盖默认配置
        merge(this.config, conf);
    }
    trigger(event, ...args) {
        //触发事件
        if (this[event]) {
            this[event](...args)
        }
    }
}
//全局配置
var config = new Config()
//读取项目根目录的 override.config.js
var OverrideConfig = getProjectConf()

var profile = OverrideConfig.profile || 'default'
var ProfileConfig
if (profile) {
    //根据 profile 来读取配置( angularjs/vue 的)
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
//如果有 init 方法，直接通过 OverrideConfig 直接重新 new 一个实例，覆盖原来的 config 实例
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
