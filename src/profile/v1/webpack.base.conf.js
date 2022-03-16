const {merge} = require('webpack-merge');
const path = require('path');
const fs = require('fs');

const Config = getConfig();
const {config} = Config;
const baseWebpackConfig = requireMod('profile/@base/default/webpack.base.conf');
const DirectoryNamedWebpackPlugin = require('directory-named-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

const helpers = requireMod('profile/helpers');
const isProd = helpers.isProd();

const alias = {
    util: path.join(config.root, 'util'),
};
const componentJsonFile = resolveApp('component.json');
if (fs.existsSync(componentJsonFile)) {
    let componentJson = require(componentJsonFile).dependencies;
    Object.keys(componentJson).forEach(key => {
        const version = componentJson[key];
        alias[key] = resolveApp(`component_modules/${key}/${version}/${key}.js`);
    });
}

module.exports = merge(baseWebpackConfig, {
    entry: {
        app: config.entry,
    },
    resolve: {
        alias,
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
                            babelrc: false,
                            configFile: false,
                            presets: [
                                [
                                    require.resolve('@babel/preset-env'),
                                    {
                                        modules: false,
                                        useBuiltIns: 'usage',
                                        corejs: 3,
                                        targets: {
                                            browsers: ['> 1%', 'last 4 versions', 'last 4 iOS major versions'],
                                        },
                                    },
                                ],
                            ],
                            plugins: [
                                [
                                    requireMod('plugins/babel-import-css'),
                                    {
                                        ext: /(less|css)/,
                                        enable: config.importSameNameStyle,
                                    },
                                ],
                                ...['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-runtime', '@babel/plugin-syntax-dynamic-import'].map(require.resolve),
                            ],
                            cacheDirectory: true,
                            cacheCompression: isProd,
                            compact: isProd,
                        },
                    },
                    {
                        loader: requirePath('loader/fis3.js'),
                    },
                ],
                include: [config.root, config.componentModulesPath, /@(xbreeze|smart-breeze)/],
            },
            {
                test: /\.js$/,
                use: [
                    {
                        loader: requirePath('loader/router.v1.js'),
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
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: resolveApp('views/favicon.ico'),
                    to: resolveApp(config.publicPath, 'favicon.ico'),
                    force: true,
                },
            ],
        }),
        new ESLintPlugin({
            context: config.root,
            extensions: ['js'],
            overrideConfigFile: path.resolve(__dirname, '.eslintrc.json'),
        }),
    ],
});
