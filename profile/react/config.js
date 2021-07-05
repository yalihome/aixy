const utils = requireMod('utils')
const WebpackBaseConfig = require('../@base/default/config')
exports.profile = 'react'

exports.init = function (Config) {
    return class ProfileConfig extends WebpackBaseConfig(Config) {
        constructor() {
            super()
            this.config = {
                ...this.config,
                root: resolveApp('src'),
                templateFile: resolveApp('index.html'),
                entry: resolveApp('src/index.js'),
                profile: 'react',
                remUnit: 0,
                devServer: {
                    hot: true
                },
                styleLoaderOptions: {
                    less: {
                        lessOptions: {
                            javascriptEnabled: true
                        }
                    }
                },
                ruleOptions: {
                    css: {
                        exclude: /\.module\.css$/
                    }
                },
                watchOptions: {
                    ignored: /node_modules/
                },
                tsc: {
                    enableTsChecker: false,
                    options: {}
                }
            }
            this.config.hmrPath = `http://${utils.getIp()}:{port}/__webpack_hmr`
        }
    }
}
