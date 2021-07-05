const Config = getConfig()
const config = Config.config
var helpers = requireMod('profile/helpers')
var webpack = require('webpack')
var {merge} = require('webpack-merge')
var baseWebpackConfig = require('./webpack.base.conf')
var MiniCssExtractPlugin = require('mini-css-extract-plugin')
var CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const SWPlugin = requireMod('plugins/sw')

baseWebpackConfig.entry.app = [].concat(baseWebpackConfig.entry.app)
if (config.pwa && config.pwa.enable) {
    let pwa = config.pwa
    baseWebpackConfig.entry.app.push(resolvePath('plugins/sw/client.js') + `?flush=${pwa.flush}&scope=${pwa.scope || config.urlPrefix || '/'}&filename=${config.urlPrefix}${config.assertPath}/${pwa.filename}`)
}
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
        }),
        config.pwa && config.pwa.enable
            ? new SWPlugin({
                  assertPath: config.assertPath,
                  urlPrefix: config.urlPrefix,
                  filename: config.pwa.filename
              })
            : function () {}
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
                },
                'common-lib': {
                    chunks: 'all',
                    name: 'common-lib',
                    enforce: true,
                    test: function (module) {
                        return module.resource && module.resource.includes('node_modules')
                    }
                }
            }
        },
        minimizer: [
            new TerserPlugin({
                exclude: /node_modules/,
                parallel: true
            }),
            new CssMinimizerPlugin()
        ]
    }
})
