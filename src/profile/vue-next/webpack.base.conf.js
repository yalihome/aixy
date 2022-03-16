const {merge} = require('webpack-merge');
const path = require('path');

const Config = getConfig();
const {config} = Config;
const {VueLoaderPlugin} = require('vue-loader');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

const baseWebpackConfig = requireMod('profile/@base/default/webpack.base.conf');
const helpers = requireMod('profile/helpers');
const isProd = helpers.isProd();

const plugins = [
    new VueLoaderPlugin(),
    new ESLintPlugin({
        context: config.root,
        extensions: ['js', 'vue', 'ts', 'tsx'],
    }),
];

if (config.tsc.enableTsChecker) {
    plugins.push(
        new ForkTsCheckerWebpackPlugin({
            // eslint: {
            //     files: path.join(config.root, `**/*.{ts,tsx,js,jsx}`)
            // },
            typescript: {
                extensions: {
                    vue: {
                        enabled: true,
                        compiler: '@vue/compiler-sfc',
                    },
                },
            },
            ...config.tsc.options,
        })
    );
}

module.exports = merge(baseWebpackConfig, {
    entry: {
        app: config.entry,
    },
    resolve: {
        extensions: ['.vue', '.ts', 'tsx'],
        alias: {
            vue: 'vue/dist/vue.esm-bundler.js',
        },
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                use: [
                    {
                        loader: 'vue-loader',
                        options: {
                            loaders: helpers.cssLoaders(
                                isProd
                                    ? {
                                          sourceMap: false,
                                          extract: true,
                                          usePostcss: true,
                                      }
                                    : {}
                            ),
                        },
                    },
                ],
                include: [config.root],
                exclude: /node_modules/,
            },
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
                            ],
                            plugins: [
                                [
                                    requireMod('plugins/babel-import-css'),
                                    {
                                        enable: config.importSameNameStyle,
                                    },
                                ],
                                ...['@vue/babel-plugin-transform-vue-jsx', '@babel/plugin-transform-runtime', '@babel/plugin-syntax-dynamic-import', '@babel/plugin-proposal-class-properties'].map(
                                    require.resolve
                                ),
                            ],
                            cacheDirectory: true,
                            cacheCompression: isProd,
                            compact: isProd,
                        },
                    },
                    {
                        loader: requirePath('loader/router.js'),
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
