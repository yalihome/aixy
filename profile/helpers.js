const path = require('path')
const fs = require('fs')
const Config = getConfig()
const config = Config.config
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const {walk} = requireMod('utils')

function assetsPath(..._path) {
    return path.posix.join(config.assertPath, ..._path)
}

exports.assetsPath = assetsPath

var cssLoaders = (exports.cssLoaders = function (options = {}) {
    var loaders = [
        {
            loader: 'css-loader',
            options: {
                // https://github.com/vuejs/vue-style-loader/issues/46
                esModule: false,
                sourceMap: options.sourceMap,
                ...options.loaderOptions,
                ...((config.styleLoaderOptions || {}).css || {})
            }
        }
    ]
    if (options.usePostcss) {
        loaders.push({
            loader: 'postcss-loader',
            options: {
                postcssOptions: {
                    plugins: [require('postcss-preset-env')]
                },
                ...((config.styleLoaderOptions || {}).postcss || {})
            }
        })
    }
    if (config.remUnit) {
        loaders.push({
            loader: 'px2rem-loader',
            options: {
                remUnit: config.remUnit,
                remPrecision: config.remPrecision
            }
        })
    }
    if (options.extract) {
        loaders = [MiniCssExtractPlugin.loader].concat(loaders)
    } else {
        loaders = [config.fallbackStyleLoader || 'style-loader'].concat(loaders)
    }
    return loaders
})

// Generate loaders for standalone style files (outside of .vue)
exports.styleLoaders = function (options = {}) {
    Object.assign(options, config.styleLoadersOptions || {})
    var output = []
    var exts = ['css', 'postcss', 'less', 'sass', 'scss', 'stylus', 'styl']
    var defLoader = cssLoaders(options)
    exts.forEach(ext => {
        var useLoader = [...defLoader]
        if (ext !== 'css') {
            useLoader.push({
                loader: ext + '-loader',
                options: Object.assign({}, (config.styleLoaderOptions || {})[ext] || {}, {
                    sourceMap: options.sourceMap
                })
            })
        }
        output.push({
            test: new RegExp('\\.' + ext + '$'),
            use: useLoader,
            ...((config.ruleOptions || {})[ext] || {})
        })
    })
    return output
}

exports.getEntries = function (options = {}) {
    var re = {
        entry: {},
        htmls: [],
        htmlSet: new Set()
    }
    var commonChunks = options.chunks || []
    delete options.chunks
    function toEntryName(file) {
        return file.split(path.sep).join('/')
    }
    function genHtmlPlugin(opts) {
        return new HtmlWebpackPlugin({
            ...opts,
            ...options,
            ...(config.htmlWebpackOptions || {})
        })
    }
    function gen(dir) {
        var fss = fs.readdirSync(dir)
        fss.forEach(function (f) {
            var basename = path.basename(f),
                realPath = path.resolve(dir, f)
            if (basename[0] === '_') return
            var stat = fs.statSync(realPath)
            if (stat.isDirectory()) {
                gen(realPath)
            } else {
                let entry = path.dirname(realPath).replace(`${config.pagesPath}${path.sep}`, '')
                let chunkId = toEntryName(entry)
                if (/index\.(js|ts)/.test(basename)) {
                    re.entry[chunkId] = realPath
                }
                config.ext.forEach(ext => {
                    let htmlFile = path.resolve(path.dirname(realPath), `index.${ext}`)
                    if (fs.existsSync(htmlFile) && !re.htmlSet.has(htmlFile)) {
                        re.htmlSet.add(htmlFile)
                        re.htmls.push({
                            filename: `${entry}.${config.toext}`,
                            template: htmlFile,
                            chunks: [...commonChunks],
                            chunkId
                        })
                    }
                })
            }
        })
    }
    if (config.pagesPath && fs.existsSync(config.pagesPath)) {
        gen(config.pagesPath)
    }
    re.htmls = re.htmls.map(htmlOption => {
        if (re.entry[htmlOption.chunkId]) {
            htmlOption.chunks.push(htmlOption.chunkId)
        }
        delete htmlOption.chunkId
        return genHtmlPlugin(htmlOption)
    })
    if (config.entry) {
        re.entry.app = config.entry
    }
    if (config.templateFile) {
        re.htmls.push(
            genHtmlPlugin({
                filename: config.indexFileName || 'index.html',
                template: config.templateFile
            })
        )
    }
    return re
}

exports.getHtmlPlugIns = function (options = {}) {
    var entries = []
    if (config.viewsPath) {
        walk(config.viewsPath, /\.(ejs|html)$/, file => {
            var filename = file.replace(config.viewsPath, '').replace(path.extname(file), '.html')
            entries.push(
                new HtmlWebpackPlugin({
                    filename: assetsPath(filename),
                    template: file,
                    inject: config.templateFile && config.templateFile === file,
                    ...options,
                    ...(config.htmlWebpackOptions || {})
                })
            )
        })
    } else if (config.templateFile) {
        entries.push(
            new HtmlWebpackPlugin({
                filename: assetsPath('index.html'),
                template: config.templateFile,
                inject: true,
                ...options,
                ...(config.htmlWebpackOptions || {})
            })
        )
    }
    return entries
}

var getLoader = function (config, callback) {
    return config.module.rules.filter(callback)[0]
}
exports.getLoader = getLoader
var getOneOfLoaders = function (config) {
    return getLoader(config, rule => {
        return rule.hasOwnProperty('oneOf')
    }).oneOf
}
exports.getOneOfLoaders = getOneOfLoaders
var getOneOfLoader = function (config, callback) {
    return getOneOfLoaders(config).filter(callback)[0]
}
exports.getOneOfLoader = getOneOfLoader

exports.isProd = function () {
    return process.env.NODE_ENV === 'production'
}
