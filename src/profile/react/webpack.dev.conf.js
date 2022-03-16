const Config = getConfig();
const {config} = Config;
const webpack = require('webpack');
const {merge} = require('webpack-merge');

const helpers = requireMod('profile/helpers');
const utils = requireMod('utils');
const path = require('path');

const LiveReloadPlugin = requireMod('plugins/livereload');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const baseWebpackConfig = require('./webpack.base.conf');

const enableDll = config.dlls && config.dlls.length;

module.exports = merge(baseWebpackConfig, {
    module: {
        rules: [
            ...helpers.styleLoaders(),
            {
                test: /\.module\.css$/,
                use: helpers.cssLoaders({
                    loaderOptions: {
                        modules: {
                            localIdentName: '[path][name]__[local]',
                        },
                    },
                }),
                include: /\.module\.css$/,
            },
        ],
    },
    devtool: 'cheap-module-source-map',
    output: {
        filename: helpers.assetsPath('js/[name].js'),
        chunkFilename: helpers.assetsPath('js/[name].[chunkhash:6].chunk.js'),
    },
    plugins: [
        // https://github.com/glenjamin/webpack-hot-middleware#installation--usage
        // new webpack.HotModuleReplacementPlugin(),
        // https://github.com/ampedandwired/html-webpack-plugin
        ...helpers.getHtmlPlugIns({
            dllfile: enableDll ? path.posix.join(config.urlPrefix, helpers.assetsPath('dll.js')) : '',
        }),
        ...[
            enableDll &&
                new webpack.DllReferencePlugin({
                    context: __dirname, // context 需要跟dll中的保持一致，这个用来指导 Webpack 匹配 manifest 中库的路径；
                    manifest: require(path.posix.join(config.publicPath, helpers.assetsPath('manifest.json'))),
                }),
            config.devServer && config.devServer.hot && new webpack.HotModuleReplacementPlugin(),
            config.devServer &&
                config.devServer.hot &&
                new ReactRefreshWebpackPlugin({
                    overlay: {
                        sockIntegration: 'whm',
                    },
                    ...(config.devServer.hotConfig || {}),
                }),
            config.devServer &&
                config.devServer.livereload &&
                new LiveReloadPlugin({
                    appendScriptTag: true,
                    hostname: utils.getIp(),
                    delay: 200,
                    //   ignore: /^((?!index\.html).)*$/,
                    port: 0,
                }),
            config.ssr &&
                new MiniCssExtractPlugin({
                    filename: helpers.assetsPath('css/[name].[contenthash:6].css'),
                    ignoreOrder: true,
                }),
        ].filter(Boolean),
    ],
    mode: 'development',
});
