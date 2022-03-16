// const Config = getConfig();
// const {config} = Config;
const helpers = requireMod('profile/helpers');
// const webpack = require('webpack');
const {merge} = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const baseWebpackConfig = require('./webpack.base.conf');

module.exports = merge(baseWebpackConfig, {
    module: {
        rules: helpers.styleLoaders({
            sourceMap: false,
            extract: true,
            usePostcss: true,
        }),
    },
    devtool: false,
    output: {
        filename: helpers.assetsPath('js/[name].[contenthash:6].js'),
        chunkFilename: helpers.assetsPath('js/[name].[chunkhash:6].chunk.js'),
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: helpers.assetsPath('css/[name].[contenthash:6].css'),
            ignoreOrder: true,
        }),
        ...helpers.getHtmlPlugIns({
            minify: {
                removeComments: true,
                collapseWhitespace: true,
                removeAttributeQuotes: true,
                removeRedundantAttributes: false,
                minifyJS: false,
                minifyCSS: true,
                // more options:
                // https://github.com/kangax/html-minifier#options-quick-reference
            },
        }),
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
                    name: 'common-chunk',
                },
            },
        },
        minimizer: [
            new TerserPlugin({
                exclude: /node_modules\/(?!.*\/@(xbreeze|smart-breeze)\/).*$/,
                parallel: true,
            }),
            new CssMinimizerPlugin(),
        ],
    },
});
