const Config = getConfig()
const config = Config.config
var {merge} = require('webpack-merge')
var helpers = requireMod('profile/helpers')
var utils = requireMod('utils')
var baseWebpackConfig = require('./webpack.base.conf')
var LiveReloadPlugin = requireMod('plugins/livereload')

var entries = helpers.getEntries()

module.exports = merge(baseWebpackConfig, {
    entry: entries.entry,
    module: {
        rules: helpers.styleLoaders({
            usePostcss: true
        })
    },
    devtool: 'cheap-module-source-map',
    output: {
        filename: helpers.assetsPath('js/[name].js'),
        chunkFilename: helpers.assetsPath('js/[name].[chunkhash:6].chunk.js')
    },
    plugins: [
        ...entries.htmls,
        config.devServer && config.devServer.livereload
            ? new LiveReloadPlugin({
                  appendScriptTag: true,
                  hostname: utils.getIp(),
                  delay: 200,
                  // ignore: /^((?!\.html).)*$/,
                  port: 0
              })
            : function () {}
    ],
    mode: 'development'
})
