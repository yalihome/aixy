const {merge} = require('webpack-merge');
const path = require('path');

const Config = getConfig();
const {config} = Config;
const baseWebpackConfig = requireMod('profile/@base/default/webpack.base.conf');
const helpers = requireMod('profile/helpers');
const ESLintPlugin = require('eslint-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const isProd = helpers.isProd();

const plugins = [
    new ESLintPlugin({
        context: config.root,
        extensions: ['js', 'ts', 'tsx'],
    }),
];

if (config.tsc.enableTsChecker) {
    plugins.push(
        new ForkTsCheckerWebpackPlugin({
            ...config.tsc.loaderConf,
        })
    );
}

module.exports = merge(baseWebpackConfig, {
    entry: {
        app: config.entry,
    },
    resolve: {
        extensions: ['.ts', '.tsx'],
    },
    module: {
        rules: [
            {
                test: /\.(js|tsx?)$/,
                use: [
                    {
                        loader: require.resolve('babel-loader'),
                        options: {
                            presets: [
                                [
                                    require.resolve('@babel/preset-env'),
                                    {
                                        modules: false,
                                        useBuiltIns: 'usage',
                                        corejs: 3,
                                    },
                                ],
                                require.resolve('@babel/preset-react'),
                            ],
                            plugins: [
                                [
                                    requireMod('plugins/babel-import-css'),
                                    {
                                        enable: config.importSameNameStyle,
                                    },
                                ],
                                [
                                    require.resolve('@babel/plugin-proposal-decorators'),
                                    {
                                        legacy: true,
                                    },
                                ],
                                require.resolve('@babel/plugin-transform-runtime'),
                                require.resolve('@babel/plugin-syntax-dynamic-import'),
                                [
                                    require.resolve('@babel/plugin-proposal-class-properties'),
                                    {
                                        loose: true,
                                    },
                                ],
                            ],
                            env: {
                                development: {
                                    plugins: [require.resolve('react-refresh/babel')],
                                },
                            },
                            cacheDirectory: true,
                            cacheCompression: isProd,
                            compact: isProd,
                        },
                    },
                    {
                        loader: requirePath('loader/router.react.js'),
                        options: {
                            pagesPath: resolveApp(path.resolve(config.root, 'pages')),
                        },
                    },
                ],
                include: config.root,
                exclude: /node_modules/,
            },
        ],
    },
    plugins,
});
