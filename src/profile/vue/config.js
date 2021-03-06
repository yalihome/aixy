const utils = requireMod('utils');
const WebpackBaseConfig = require('../@base/default/config');

exports.profile = 'vue';

exports.init = function (Config) {
    return class ProfileConfig extends WebpackBaseConfig(Config) {
        constructor() {
            super();
            this.config = {
                ...this.config,
                root: resolveApp('src'),
                templateFile: resolveApp('index.ejs'),
                entry: resolveApp('src/main.js'),
                profile: 'vue',
                remUnit: 0,
                devServer: {
                    hot: true,
                },
                fallbackStyleLoader: 'vue-style-loader',
                hmrPath: `http://${utils.getIp()}:{port}/__webpack_hmr`,
                pwa: {
                    enable: false,
                    flush: false,
                    scope: this.config.urlPrefix,
                    filename: 'sw.js',
                },
                tsc: {
                    enableTsChecker: false,
                    options: {},
                },
                styleLoaderOptions: {
                    less: {
                        lessOptions: {
                            javascriptEnabled: true,
                        },
                    },
                },
            };
        }
    };
};
