const Config = getConfig()
const config = Config.config
var helpers = requireMod('profile/helpers')
var webpack = require('webpack')
var {merge} = require('webpack-merge')
var baseWebpackConfig = require('./webpack.base.conf')
var MiniCssExtractPlugin = require('mini-css-extract-plugin')
var CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

module.exports = merge(baseWebpackConfig, {
    module: {
        rules: helpers.styleLoaders({
            sourceMap: false,
            extract: true,
            usePostcss: true
        })
    },
    devtool: false,
    output: {
        filename: helpers.assetsPath('js/[name].[contenthash:6].js'),
        chunkFilename: helpers.assetsPath('js/[name].[chunkhash:6].chunk.js')
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: helpers.assetsPath('css/[name].[contenthash:6].css'),
            ignoreOrder: true
        }),
        ...helpers.getHtmlPlugIns({
            minify: {
                removeComments: true,
                collapseWhitespace: true,
                removeAttributeQuotes: true,
                removeRedundantAttributes: false,
                minifyJS: false,
                minifyCSS: true
                // more options:
                // https://github.com/kangax/html-minifier#options-quick-reference
            }
        })
    ],
    mode: 'production',
    // https://gist.github.com/sokra/1522d586b8e5c0f5072d7565c2bee693
    optimization: {
        runtimeChunk: true,
        moduleIds: 'deterministic',
        splitChunks: {
            cacheGroups: {
                'common-chunk': {
                    chunks: 'async',
                    minChunks: 2,
                    name: 'common-chunk'
                }
            }
        },
        minimizer: [
            new TerserPlugin({
                exclude: /node_modules\/(?!.*\/@xbreeze\/).*$/,
                parallel: true
            }),
            new CssMinimizerPlugin()
        ]
    }
})
