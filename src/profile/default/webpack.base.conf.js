const {merge} = require('webpack-merge');

const Config = getConfig();
const {config} = Config;
const baseWebpackConfig = requireMod('profile/@base/default/webpack.base.conf');
const DirectoryNamedWebpackPlugin = require('directory-named-webpack-plugin');

const helpers = requireMod('profile/helpers');
const isProd = helpers.isProd();

module.exports = merge(baseWebpackConfig, {
    resolve: {
        plugins: [new DirectoryNamedWebpackPlugin(true)],
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: require.resolve('babel-loader'),
                        options: {
                            presets: [
                                require.resolve('@babel/preset-env', {
                                    modules: false,
                                    useBuiltIns: 'usage',
                                    corejs: 3,
                                }),
                            ],
                            plugins: [
                                [
                                    requireMod('plugins/babel-import-css'),
                                    {
                                        enable: config.importSameNameStyle,
                                    },
                                ],
                                ...['@vue/babel-plugin-transform-vue-jsx', '@babel/plugin-transform-runtime', '@babel/plugin-syntax-dynamic-import'].map(require.resolve),
                            ],
                            cacheDirectory: true,
                            cacheCompression: isProd,
                            compact: isProd,
                        },
                    },
                ],
                include: [config.root],
            },
        ],
    },
});
