const WebpackBaseConfig = require('../@base/default/config')
const path = require('path')
exports.profile = 'default'

exports.init = function (Config) {
    class ProfileConfig extends WebpackBaseConfig(Config) {
        constructor() {
            super()
            this.setConfig({
                dlls: [],
                pagesPath: resolveApp('./src/pages'),
                root: resolveApp('./src'),
                remUnit: 0,
                devServer: {
                    livereload: true
                },
                assertPath: 'assets/',
                ext: ['html', 'ejs'],
                toext: 'html'
            })
        }
    }
    return ProfileConfig
}
