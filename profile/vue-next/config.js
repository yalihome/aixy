const utils = requireMod('utils')
const path = require('path')
const WebpackBaseConfig = require('../@base/default/config')
exports.profile = 'vue-next'

exports.init = function (Config) {
    return class ProfileConfig extends WebpackBaseConfig(Config) {
        constructor() {
            super()
            this.config = {
                ...this.config,
                root: resolveApp('src'),
                templateFile: resolveApp('index.ejs'),
                entry: resolveApp('src/index.js'),
                profile: 'vue-next',
                remUnit: 0,
                devServer: {
                    hot: true
                },
                fallbackStyleLoader: 'vue-style-loader',
                hmrPath: `http://${utils.getIp()}:{port}/__webpack_hmr`,
                pwa: {
                    enable: false,
                    flush: false,
                    scope: this.config.urlPrefix,
                    filename: `sw.js`
                },
                tsc: {
                    enableTsChecker: false,
                    options: {}
                },
                styleLoaderOptions: {
                    less: {
                        lessOptions: {
                            javascriptEnabled: true
                        }
                    }
                }
            }
        }
    }
}
