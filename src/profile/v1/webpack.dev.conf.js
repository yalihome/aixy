const Config = getConfig();
const {config} = Config;
const webpack = require('webpack');
const {merge} = require('webpack-merge');

const helpers = requireMod('profile/helpers');
const utils = requireMod('utils');
const path = require('path');
const baseWebpackConfig = require('./webpack.base.conf');

const LiveReloadPlugin = requireMod('plugins/livereload');

module.exports = merge(baseWebpackConfig, {
    module: {
        rules: helpers.styleLoaders({
            usePostcss: true,
        }),
    },
    devtool: 'eval-source-map',
    output: {
        filename: helpers.assetsPath('js/[name].js'),
        chunkFilename: helpers.assetsPath('js/[name].[chunkhash:6].chunk.js'),
    },
    plugins: [
        // https://github.com/glenjamin/webpack-hot-middleware#installation--usage
        // new webpack.HotModuleReplacementPlugin(),
        // https://github.com/ampedandwired/html-webpack-plugin
        ...helpers.getHtmlPlugIns({
            dllfile: config.enableDll ? path.posix.join(config.urlPrefix, utils.assetsPath('dll.js')) : '',
        }),
        config.enableDll
            ? new webpack.DllReferencePlugin({
                  context: __dirname, // context 需要跟dll中的保持一致，这个用来指导 Webpack 匹配 manifest 中库的路径；
                  manifest: require(path.posix.join(config.publicPath, utils.assetsPath('manifest.json'))),
              })
            : function () {},
        config.devServer && config.devServer.livereload
            ? new LiveReloadPlugin({
                  appendScriptTag: true,
                  hostname: utils.getIp(),
                  delay: 200,
                  //   ignore: /^((?!index\.html).)*$/,
                  port: 0,
              })
            : function () {},
    ],
    mode: 'development',
});
