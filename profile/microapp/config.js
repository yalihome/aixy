const path = require('path')
const fs = require('fs')
const {name, version, enterprise} = require(path.resolve(process.cwd(), 'package.json'))
// 这个config 文件貌似没有使用

const MAPPER = {
    dev: 'config.dev.js',
    sandbox: 'config.sandbox.js',
    prod: 'config.js'
}
const ENV_MAPPER = {
    development: 'dev',
    sandbox: 'sandbox',
    production: 'prod'
}

exports.profile = 'microapp'
exports.init = function (Config) {
    class ProfileConfig extends Config {
        constructor() {
            super()
            const ENV = ENV_MAPPER[process.env.NODE_ENV || 'production']
            console.log(`ENV: ${ENV}, root: ${resolveApp('./')}`)
            var imageDomain = ''
            var conf = {}
            if (fs.existsSync(path.resolve('@conf', MAPPER[ENV]))) {
                conf = require(path.resolve('@conf', MAPPER[ENV]))
                imageDomain = conf.imageDomain
            }
            var ENV_VARS = {}
            Object.keys(this.config.ENV_VARS).forEach(key => {
                ENV_VARS[`process.env.${key}`] = this.config.ENV_VARS[key]
            })
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
                assetsDir: [],
                consts: {
                    'process.env.APP_BUILD_TIME': new Date().toLocaleString('zh-CN', {
                        hour12: false
                    }),
                    get 'process.env.APP_VERSION'() {
                        return config.version
                    },
                    'process.env.PROJECT_ENV': ENV,
                    'process.env.NODE_ENV': process.env.NODE_ENV,
                    get 'process.env.PLATFORM'() {
                        return config.platform
                    },
                    ...ENV_VARS
                },
                platform: 'wechat',
                watchExclude: [],
                syncOptions: {},
                enableEnvsResolve: false,
                alias: {
                    get '@'() {
                        return config.root
                    }
                },
                appConfig: conf,
                prefix: '@ext'
            })
        }
        resolveArgs(cmd) {
            switch (cmd) {
                case 'pack':
                    // @TODO: 自动根据publicPath路径生成包名称
                    let ts = new Date().toISOString().replace(/[^0-9]/g, '')
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
