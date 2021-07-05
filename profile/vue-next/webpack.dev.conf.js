const Config = getConfig()
const config = Config.config
var webpack = require('webpack')
var {merge} = require('webpack-merge')
var helpers = requireMod('profile/helpers')
var path = require('path')
var baseWebpackConfig = require('./webpack.base.conf')
const enableDll = config.dlls && config.dlls.length

module.exports = merge(baseWebpackConfig, {
    module: {
        rules: helpers.styleLoaders()
    },
    devtool: 'cheap-module-source-map',
    output: {
        filename: helpers.assetsPath('js/[name].js'),
        chunkFilename: helpers.assetsPath('js/[name].[chunkhash:6].chunk.js')
    },
    plugins: [
        // https://github.com/glenjamin/webpack-hot-middleware#installation--usage
        // new webpack.HotModuleReplacementPlugin(),
        // https://github.com/ampedandwired/html-webpack-plugin
        ...helpers.getHtmlPlugIns({
            dllfile: enableDll ? path.posix.join(config.urlPrefix, helpers.assetsPath('dll.js')) : ''
        }),
        enableDll
            ? new webpack.DllReferencePlugin({
                  context: __dirname, //context 需要跟dll中的保持一致，这个用来指导 Webpack 匹配 manifest 中库的路径；
                  manifest: require(path.posix.join(config.publicPath, helpers.assetsPath('manifest.json')))
              })
            : function () {},
        new webpack.HotModuleReplacementPlugin()
    ],
    mode: 'development'
})
