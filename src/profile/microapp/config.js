const path = require('path')
const fs = require('fs')

const {name, version, enterprise} = require(path.resolve(process.cwd(), 'package.json'))
const {PLUGIN_ROOT, PLUGIN_MINIPROGRAM_ROOT, ENV_MAPPER, MAPPER} = require('./consts')

exports.profile = 'microapp'
exports.init = function (Config) {
    class ProfileConfig extends Config {
        constructor() {
            super()
            const ENV = ENV_MAPPER[process.env.NODE_ENV || 'production']
            let imageDomain = ''
            const conf = {}
            const isPlugin = this.config.cmdArgv.plugin
            const confPath = new Array()

            // 如果是插件，可以从 2个地方读取配置 miniprogram/@conf 和 plugin/@onf
            if (isPlugin) confPath.push(PLUGIN_ROOT, PLUGIN_MINIPROGRAM_ROOT)
            else confPath.push('')

            function mergeConf(pathname) {
                const tp = path.resolve(pathname, MAPPER[ENV])
                if (fs.existsSync(tp)) {
                    Object.assign(conf, require(tp) || {})
                }
            }

            while (confPath.length) {
                mergeConf(`${confPath.shift()}@conf`)
            }

            // 也可从项目根目录的 @config 中读取配置，这里的配置不会作为项目的业务文件被编译，只会用来给 当前构建工具读取
            mergeConf('@config')

            if (conf.imageDomain) imageDomain = conf.imageDomain

            const ENV_VARS = {}
            Object.keys(this.config.ENV_VARS).forEach(key => {
                ENV_VARS[`process.env.${key}`] = this.config.ENV_VARS[key]
            })

            // 插件有两个配置：小程序目录、插件自身目录
            var config = (this.config = {
                ...this.config,
                enableDll: false,
                root: resolveApp('./'),
                pagesPath: resolveApp('pages'),
                projectPath: 'project',
                get publicPath() {
                    return resolveApp(`dist/${this.platform}/${ENV}`)
                },
                assertPath: `public/${enterprise}`,
                indexPage: 'pages/loading/loading',
                env: ENV,
                useHash: true,
                hashLen: 8,
                version,
                lessOptions: {},
                themePrefix: '_T-',
                subPackages: [],
                imageDomain: `${imageDomain}/${enterprise}`,
                assetsDir: [], // 本地公共存放图片的目录，不对它做编译，不是所有图片都走 cdn 的
                consts: {
                    'process.env.APP_BUILD_TIME': new Date().toLocaleString('zh-CN', {
                        hour12: false
                    }),
                    get 'process.env.APP_VERSION'() {
                        return config.version
                    },
                    'process.env.PROJECT_ENV': ENV,
                    'process.env.NODE_ENV': process.env.NODE_ENV,
                    // 这里需要看一下对微信小程序有无影响
                    // get 'process.env.PLATFORM'() {
                    //     return config.platform
                    // },
                    ...ENV_VARS
                },
                platform: process.env.PLATFORM || 'wechat', // 这个 platform 用 .env 指定不是更好？
                watchExclude: [],
                syncOptions: {},
                enableEnvsResolve: false,
                alias: {
                    get '@'() {
                        return config.root
                    }
                },
                appConfig: conf,
                prefix: '@ext',
                ignorePath: [] // 此处配置的小程序/插件目录不需要编译
            })

            // 插件页面路径
            if (config.cmdArgv.plugin) {
                config.pluginPagesPath = resolveApp(`${PLUGIN_ROOT}/pages`)
            }

            // 插件内部小程序页面路径
            if (config.cmdArgv.plugin) {
                config.macroPagesPath = resolveApp(`${PLUGIN_MINIPROGRAM_ROOT}/pages`)
            }
        }

        resolveArgs(cmd) {
            // @TODO: 自动根据publicPath路径生成包名称
            const ts = new Date().toISOString().replace(/[^0-9]/g, '')
            switch (cmd) {
                case 'pack':
                    return {
                        src: this.config.projectPath,
                        dest: resolveApp(`${[name, this.config.platform, this.config.env, `v${version}`, ts].join('-')}.zip`),
                        conf: {
                            C: this.config.publicPath
                        }
                    }
                case 'fmt':
                    return {
                        configPath: path.resolve(__dirname, 'lint-staged.config.js')
                    }
            }
        }

        onAdapter(content, {file, platform}) {
            return content
        }
    }
    return ProfileConfig
}
