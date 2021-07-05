const {merge} = require('webpack-merge')
const path = require('path')
const Config = getConfig()
const config = Config.config
const {VueLoaderPlugin} = require('vue-loader-v2')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const ESLintPlugin = require('eslint-webpack-plugin')
var baseWebpackConfig = requireMod('profile/@base/default/webpack.base.conf')
var helpers = requireMod('profile/helpers')
const isProd = helpers.isProd()

var plugins = [
    new VueLoaderPlugin(),
    new ESLintPlugin({
        context: config.root,
        extensions: ['js', 'vue', 'ts', 'tsx']
    })
]

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
                        compiler: 'vue-template-compiler'
                    }
                }
            },
            ...config.tsc.options
        })
    )
}

module.exports = merge(baseWebpackConfig, {
    entry: {
        app: config.entry
    },
    resolve: {
        extensions: ['.vue', '.ts', 'tsx'],
        alias: {
            vue$: 'vue/dist/vue.esm.js'
        }
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                use: [
                    {
                        loader: 'vue-loader-v2',
                        options: {
                            loaders: helpers.cssLoaders(
                                isProd
                                    ? {
                                          sourceMap: false,
                                          extract: true,
                                          usePostcss: true
                                      }
                                    : {}
                            )
                        }
                    }
                ],
                include: config.root,
                exclude: /node_modules/
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
                                        corejs: 3
                                    }
                                ]
                            ],
                            plugins: [
                                [
                                    requireMod('plugins/babel-import-css'),
                                    {
                                        enable: config.importSameNameStyle
                                    }
                                ],
                                ...['@vue/babel-plugin-transform-vue-jsx', '@babel/plugin-transform-runtime', '@babel/plugin-syntax-dynamic-import', '@babel/plugin-proposal-class-properties'].map(require.resolve)
                            ],
                            cacheDirectory: true,
                            cacheCompression: isProd,
                            compact: isProd
                        }
                    },
                    {
                        loader: requirePath('loader/fis3.js')
                    },
                    {
                        loader: requirePath('loader/router.js'),
                        options: {
                            pagesPath: resolveApp(path.resolve(config.root, 'pages'))
                        }
                    }
                ],
                include: config.root,
                exclude: /node_modules/
            }
        ]
    },
    plugins
})
