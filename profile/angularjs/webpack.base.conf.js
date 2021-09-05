const {merge} = require('webpack-merge')
const fs = require('fs')
const Config = getConfig()
//这里， webpack 的配置已经合并进来了
const config = Config.config
const DirectoryNamedWebpackPlugin = require('directory-named-webpack-plugin')
const helpers = requireMod('profile/helpers')
const CopyPlugin = require('copy-webpack-plugin')
var baseWebpackConfig = requireMod('profile/@base/default/webpack.base.conf')
const isProd = helpers.isProd()

var alias = {}
var componentJsonFile = resolveApp('component.json')
if (fs.existsSync(componentJsonFile)) {
    componentJson = require(componentJsonFile).dependencies
    Object.keys(componentJson).forEach(key => {
        let version = componentJson[key]
        alias[key] = resolveApp(`component_modules/${key}/${version}/${key}.js`)
    })
}

module.exports = merge(baseWebpackConfig, {
    entry: {
        app: config.entry
    },
    resolve: {
        alias,
        plugins: [new DirectoryNamedWebpackPlugin(true)]
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: require.resolve('babel-loader'),
                        options: {
                            babelrc: false,
                            configFile: false,
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
                                        ext: /(less|css)/,
                                        enable: config.importSameNameStyle
                                    }
                                ],
                                ...['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-runtime', '@babel/plugin-syntax-dynamic-import'].map(require.resolve)
                            ],
                            cacheDirectory: true,
                            cacheCompression: isProd,
                            compact: isProd
                        }
                    },
                    {
                        loader: requirePath('loader/fis3.js')
                    }
                ],
                include: [config.root, config.componentModulesPath, /@(xbreeze|smart-breeze)/]
            }
        ]
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: resolveApp('views/favicon.ico'),
                    to: resolveApp(config.publicPath, 'favicon.ico'),
                    force: true
                }
            ]
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: 'controllers/**/view/*.tpl',
                    to: resolveApp(config.publicPath, config.assertPath, 'views'),
                    context: config.root,
                    force: true
                }
            ]
        })
    ]
})
