const utils = requireMod('profile/helpers')
const webpack = require('webpack')
const WebpackBar = require('webpackbar')
const WebpackStats = requireMod('plugins/stats')
const Config = getConfig()
const config = Config.config

module.exports = {
    output: {
        path: config.publicPath,
        publicPath: config.urlPrefix,
        filename: '[name].js'
    },
    resolve: {
        modules: ['node_modules', ...config.nodeModulesPath, config.root],
        extensions: ['.js'],
        alias: {
            '@': config.root
        }
    },
    // 追加loader查询路径
    resolveLoader: {
        modules: [...config.nodeModulesPath]
    },
    module: {
        rules: [
            {
                test: /\.tpl$/,
                loader: 'html-loader'
            },
            {
                test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                loader: 'file-loader',
                options: {
                    limit: 1000,
                    name: utils.assetsPath('img/[name].[contenthash:5].[ext]')
                }
            },
            {
                test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                loader: 'file-loader',
                options: {
                    limit: 0,
                    name: utils.assetsPath('fonts/[contenthash:5].[ext]')
                }
            }
        ]
    },
    plugins: [
        new webpack.DefinePlugin(config.consts),
        new WebpackBar({
            name: 'ovestack'
        }),
        new WebpackStats({
            output: utils.assetsPath('stats.json')
        })
    ],
    stats: {
        colors: true,
        modules: false,
        children: false,
        chunks: false,
        chunkModules: false,
        assets: false
    }
}
