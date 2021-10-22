const path = require('path')
const { series, parallel, src, dest, watch, lastRun, task } = require('gulp')
const fs = require('fs')
const rename = require('gulp-rename')
const less = require('gulp-less')
const cleanCSS = require('gulp-clean-css')
const minifyJs = require('gulp-js-minify')
// const uglifyEs = require('gulp-uglify-es').default;
const stylus = require('gulp-stylus')
const through2 = require('through2')
//html 解析器
const htmlparser2 = require('htmlparser2')
const alias = require('gulp-style-aliases')
const Buffer = require('buffer').Buffer
const css = require('css')
const plumber = require('gulp-plumber')
const { genRouter, genSubPackages, resolveComponent, createStreamFromFile, isHTTP, isBase64, toHash, toBase64, inlineSvg, normalizeUrl, toComponent, Cache, logger, definePlugin, adapterJsPlugin, adapterHtmlPlugin, babelTransform, resolvePath, genPlugins, genarateProjectConfJson, genPluginPages, getPluginPagesPath } = require('./utils')
const { isUndefined, isFunction } = require('util')
const anymatch = require('anymatch')
const { rm } = require('shelljs')
const Config = require(require.resolve('../../config')) //根目录的config.js
const config = Config.config
const { resolve: resolveUrl, parse: parseUrl } = require('url')
const { fieldEnds } = require('tar')
const DIST_PATH = path.relative(config.root, config.publicPath) //dist/wechat/sandbox
const INCLUDE_FILES = fromSrc('**/*', '!override.config.js', '!.DS_Store', '!**/init', '!**/*.less', '!**/*.stylus', '!**/*.tpl', '!**/pages/**/*.js', '!**/pages/**/*.json', '!**/*.{jpg,jpeg,png,gif,svg}', '!**/*.{zip,tgz}', '!app.json', '!package-lock.json', '!config/', '!project.config.json')
const EXCLUDE_FROM_CNPM_PATH = '**/node_modules/!(@xbreeze|@smart-breeze)'
const DIST_PROJECT_PATH = path.join(DIST_PATH, config.projectPath) //dist/wechat/sandbox/project
const DIST_ASSERT_PATH = path.join(DIST_PATH, config.assertPath)
let { PLUGIN_MINIPROGRAM_ROOT, PLUGIN_ROOT, TYPE_MAPPER } = require('./consts');

// 某些整个都不需要编译 的目录需要在这里配置
function fromSrc(...args) {
    return [...args, `!${DIST_PATH.split(path.sep)[0]}/**`, '!@config/**'].concat(config.ignorePath)
}

// normalizeUrl 统一路径为 E:smartbreeze/pshopping-mall 这种
/**
 * 产出到目标文件
 * @param  {...any} args
 * @returns
 */
function toDest(...args) {
    return dest(normalizeUrl(path.join(DIST_PATH, ...args)), {
        overwrite: true
    })
}
function getExt(type) {
    if (config.ext && config.ext[type]) {
        return config.ext[type]
    }
    return TYPE_MAPPER[config.platform][type]
}

/**
 * 根据 url 返回普通图片和 svg 的内容
 */
// fileCache
var HASH_MAP = {}
var BASE64_CACHE = {}
async function toUrl(defUrl, file, imageDomain) {
    //获取文件中引用的文件的绝对位置(这也可以?)
    var url = path.resolve(file.dirname, defUrl)
    // console.log('资源文件实际路径：'+url);
    var parsedUrl = parseUrl(url) //格式化成为对象的路径
    // console.log(parsedUrl);
    //带有 inline  的就嵌入，不带的就
    if (parsedUrl.query && parsedUrl.query === '__inline') {
        let pathname = parsedUrl.pathname
        let cache = BASE64_CACHE[pathname]
        if (cache) {
            return cache
        } else {
            let extname = path.extname(pathname).toLocaleLowerCase()
            switch (true) {
                case /\.(png|jpg|gif|jpeg)$/.test(extname):
                    cache = `data:image/${path.extname(pathname).replace('.', '')};base64,${toBase64(fs.readFileSync(pathname))}`
                    BASE64_CACHE[pathname] = cache
                    return cache
                case /\.svg$/.test(extname):
                    cache = await inlineSvg(fs.readFileSync(pathname).toString(), true)
                    BASE64_CACHE[pathname] = cache
                    return cache
                default:
                    return defUrl
            }
        }
    }
    //变为标准的 / 分割的 路径字符串
    url = normalizeUrl(url.replace(parsedUrl.search, ''))
    var cwd = normalizeUrl(process.cwd())
    if (config.useHash && !isIgnoreHash(url)) {
        let hash = getHashByUrl(url)
        url = url.replace(cwd, '')
        let extname = path.extname(url)
        return `${imageDomain}${url.replace(extname, '')}.${hash}${extname}`
    }
    return `${imageDomain}${url.replace(cwd, '')}`
}
function toDestUrl(url, file) {
    var cwd = normalizeUrl(process.cwd())
    url = path.resolve(file.dirname, url)
    url = normalizeUrl(url.replace(parseUrl(url).search, ''))
    if (config.useHash && !isIgnoreHash(url)) {
        let hash = getHashByUrl(url)
        url = url.replace(cwd, '')
        let extname = path.extname(url)
        return `${url.replace(extname, '')}.${hash}${extname}`
    }
    return url.replace(cwd, '')
}

function isIgnoreHash(url) {
    return config.ignoreHash && anymatch(config.ignoreHash, url)
}
//@ques 这里真的可以有缓存的吗？如果我资源文件变更了，url 还一样呢？
function getHashByUrl(url) {
    var cache = HASH_MAP[url]
    if (!cache) {
        cache = toHash(fs.readFileSync(url).toString(), config.hashLen)
        HASH_MAP[url] = cache
    }
    return cache
}

function translateUrl() {
    // console.log('translateUrl');
    return through2.obj(function (file, _, cb) {
        //file 为一个对象，其类型为 File，nodejs 有没有这个原生类型？
        if (file.isBuffer()) {
            let content = file.contents.toString()
            var queue = []
            content.replace(/url\s*\(\s*['|"]?([^'")]+)['|"]?\s*\)/gim, function (match, url) {
                // 匹配到的是各种资源文件，带 ?__inline 或者不带的
                // console.log('translateUrl:'+url);
                //带有 https 或者 base4 的 资源链接不做处理
                if (!isHTTP(url) && !isBase64(url)) {
                    queue.push(toUrl(url, file, config.imageDomain))
                } else {
                    queue.push(url)
                }
            })
            //一个一个的替换(顺序不用担心)
            Promise.all(queue)
                .then(data => {
                    content = content.replace(/url\s*\(\s*['|"]?([^'")]+)['|"]?\s*\)/gim, function (match, url) {
                        return match.replace(/url\s*\(\s*['|"]?([^'")]+)['|"]?\s*\)/, 'url(' + `${data.shift()}` + ')')
                    })
                    file.contents = Buffer.from(content)
                    cb(null, file)
                })
                .catch(err => {
                    logger.error(err)
                    cb(err, file)
                })
        } else {
            cb(null, file)
        }
    })
}

function watchFn(...args) {
    if (config.cmdArgv.watch) {
        return watch(...args)
    } else {
        return through2.obj()
    }
}
//去掉 @ext，所以两边的文件最后如何放到一起的，就是根据被处理后的 dirname，所以@ext 和根目录中的同路径文件夹下的文件名是最好不要重复
function replacePrefix(path) {
    path.dirname = path.dirname.replace(config.prefix, '')
}

function sync() {
    return src(INCLUDE_FILES.concat(config.assetsDir), {
        since: lastRun(sync),
        base: '.',
        ...(config.syncOptions || {})
    })
        .pipe(plumber())
        .pipe(
            babelTransform({
                root: config.root,
                enableEnvsResolve: config.enableEnvsResolve,
                alias: config.alias,
                exclude: [`${EXCLUDE_FROM_CNPM_PATH}/**/*`],
                platform: config.platform
            })
        )
        .pipe(
            definePlugin(config.consts, {
                exclude: [`${EXCLUDE_FROM_CNPM_PATH}/**/*`]
            })
        )
        .pipe(
            adapterJsPlugin({
                platform: config.platform,
                onAdapter: Config.onAdapter
            })
        )
        .pipe(
            adapterHtmlPlugin({
                platform: config.platform,
                onAdapter: Config.onAdapter
            })
        )
        .pipe(
            rename(function (path) {
                //@TODO 这里是否应该忽略掉某些文件，毕竟只有业务文件需要处理
                replacePrefix(path)
                switch (config.platform) {
                    case 'alipay':
                    case 'tt':
                        if (path.extname === '.wxs') {
                            path.extname = getExt('wxs')
                        }
                        break
                }
            })
        )
        .pipe(toDest(config.projectPath))
}

function translateLess() {
    // config.prefix 值为 @ext，这个是在哪里获取的?
    // console.log(`config.prefix:`+config.prefix);
    // console.log('lessOptions:');
    // console.log(config.lessOptions);
    //为什么有 **/!(${config.prefix})/*.less 还有 **/(${config.prefix})/*.less
    //lastRun 跳过上次任务以来没有更改的文件，增量构建(缩短执行时间)
    return src(fromSrc('*.less', `**/!(${config.prefix})/*.less`, `**/${config.prefix}/*.less`), {
        ignore: [`${EXCLUDE_FROM_CNPM_PATH}/**/*.less`],
        since: lastRun(translateLess)
    })
        .pipe(plumber())
        .pipe(
            alias({
                '~': config.root //re
            })
        )
        .pipe(
            less({
                //编译 less
                relativeUrls: true, //使用相对位置
                ...config.lessOptions //modifyVars 和 OSS-PATH 暂时还不知道怎么使用，还是要去看一下 less.js
            })
        )
        .pipe(translateUrl()) //资源文件绝对路径更换为对应线上资源域名路径，这里是异步的，pipe 会等待异步代码执行完？
        .pipe(
            rename(function (path) {
                // console.log(`less dirname: `+path.dirname);
                //这里看的话，@ext 里面的less 引用了 根目录下其它文件夹的 less这个咋整? 不会编译出错？——不会的，~/ 这种方式 import 的 less 文件，最终都被认为是从 项目根目录获取到的，虽然是 @ext，依然是从根目录获取到的，不会影响编译结果
                replacePrefix(path)
                path.extname = getExt('css')
            })
        )
        .pipe(toDest(config.projectPath))
}

function translateLessWithTheme(theme, themeData) {
    function addRuleWithPrefix(rules) {
        var prefix = `.${config.themePrefix}${theme}`
        // 获取__ROOT__ 标识
        // 遍历所有 selector
        // 匹配
        var roots = []
        rules.forEach(rule => {
            if (!rule.declarations) {
                // keyFrams
                return
            }
            var isRoot = rule.declarations.filter(declaration => {
                return declaration.type === 'comment' && declaration.comment.indexOf('__ROOT__') !== -1
            })[0]
            if (isRoot) {
                roots.push(...rule.selectors)
            }
        })
        if (roots && roots.length) {
            var reg = new RegExp(`^(${roots.join('|').replace(/\./g, '\\.')})(\$|\\s+)`)
            rules.forEach(rule => {
                if (!rule.selectors) {
                    // keyFrams
                    return
                }
                rule.selectors = rule.selectors.map(selector => {
                    if (reg.test(selector)) {
                        // 特殊处理普通标签
                        // .aa.T-red #aa.T-red view.T-red
                        // .T-red.aa .bb .T-red#aa .bb view.T-red .bb
                        if (/^(\.|#)/.test(selector)) {
                            return `${prefix}${selector}`
                        } else {
                            let selectorArr = selector.split(/\s+/)
                            if (selectorArr.length > 1) {
                                return `${selectorArr[0]}${prefix} ${selectorArr.slice(1).join(' ')}`
                            } else {
                                return `${selectorArr[0]}${prefix}`
                            }
                        }
                    } else {
                        return `${prefix} ${selector}`
                    }
                })
            })
        }
    }
    // @FIXME: 支持subPackage？
    function extFileExists(file) {
        // 如果存在ext_pages对应的样式文件，忽略
        let matched = false
        let extFile = resolvePath(file.history[0]).replace(/\/(pages|components)\//, function (word, type) {
            matched = true
            return `/${config.prefix}/${type}`
        })
        extFile = extFile.split('/').join(path.sep)
        return matched && fs.existsSync(extFile)
    }
    return function translateTheme() {
        // let target = config.projectPath+'/test';
        // console.log(`target: ${target}`);
        return (
            src(fromSrc('**/*.less'), {
                ignore: [`${EXCLUDE_FROM_CNPM_PATH}/**/*.less`]
            })
                .pipe(plumber())
                .pipe(
                    alias({
                        '~': config.root
                    })
                )
                .pipe(
                    less({
                        relativeUrls: true,
                        modifyVars: themeData
                    })
                )
                .pipe(
                    through2.obj(function (file, _, cb) {
                        // console.log('theme file:');
                        // console.log(file);
                        if (file.isBuffer()) {
                            if (extFileExists(file)) {
                                console.log('文件存在')
                                return cb()
                            }
                            // add namespace
                            let content = file.contents.toString()
                            try {
                                let cssObj = css.parse(content)
                                // 获取注释包含 root 的节点名称(仅支持一层)
                                // 遍历所有节点
                                // 节点名称前加 themeId
                                addRuleWithPrefix(cssObj.stylesheet.rules)
                                // console.log('file: '+file.path);
                                content = css.stringify(cssObj)
                                // console.log(content);
                                file.contents = Buffer.from(content)
                            } catch (err) {
                                logger.error(err)
                                return cb(err, file)
                            }
                        }
                        // console.log('产出路径：')
                        // console.log(path.join(DIST_PATH, config.projectPath))
                        cb(null, file)
                    })
                )
                .pipe(translateUrl())
                .pipe(
                    rename(function (path) {
                        replacePrefix(path)
                        path.extname = getExt('css')
                    })
                )
                // .pipe(toDest(target))
                .pipe(
                    dest(path.join(DIST_PATH, config.projectPath), {
                        overwrite: true,
                        append: true
                    })
                )
        )
    }
}
function translateStylus() {
    return src(fromSrc('**/*.stylus'), {
        ignore: [`${EXCLUDE_FROM_CNPM_PATH}/**/*.stylus`],
        since: lastRun(translateStylus)
    })
        .pipe(plumber())
        .pipe(stylus())
        .pipe(translateUrl())
        .pipe(
            rename(function (path) {
                path.extname = getExt('css')
            })
        )
        .pipe(toDest(config.projectPath))
}
function translateTpl() {
    // @ext 和 非 @ext 文件中的 tpl
    return src(fromSrc(`**/!(${config.prefix})/*.tpl`, `**/${config.prefix}/*.tpl`), {
        ignore: [`${EXCLUDE_FROM_CNPM_PATH}/**/*.tpl`],
        since: lastRun(translateTpl)
    })
        .pipe(plumber())
        .pipe(
            definePlugin(config.consts, {
                exclude: [`${EXCLUDE_FROM_CNPM_PATH}/**/*`]
            })
        )
        .pipe(
            adapterHtmlPlugin({
                platform: config.platform,
                onAdapter: Config.onAdapter
            })
        )
        .pipe(
            through2.obj(function (file, _, cb) {
                if (file.isBuffer()) {
                    try {
                        if (config.enableTheme || (config.globalComponents && config.globalComponents.enable)) {
                            let content = file.contents.toString()
                            let tree = htmlparser2.parseDOM(content, {
                                xmlMode: true,
                                decodeEntities: true
                            })

                            if (config.enableTheme) {
                                var parentNodes = tree.filter(element => {
                                    return !element.parent
                                })
                                if (parentNodes && parentNodes.length) {
                                    parentNodes.forEach(parentNode => {
                                        if (parentNode.attribs && parentNode.attribs.class) {
                                            parentNode.attribs.class += ' {{__THEME__}}'
                                        } else {
                                            parentNode.attribs = parentNode.attribs || {}
                                            parentNode.attribs.class = '{{__THEME__}}'
                                        }
                                    })
                                }
                            }
                            if (config.globalComponents && config.globalComponents.enable) {
                                if (isFunction(config.globalComponents.injection)) {
                                    let data = config.globalComponents.injection(file)
                                    if (data) {
                                        tree.push({
                                            data,
                                            type: 'text'
                                        })
                                    }
                                }
                            }
                            let html = htmlparser2.DomUtils.getOuterHTML(tree, {
                                xmlMode: true,
                                decodeEntities: false
                            })

                            file.contents = Buffer.from(html)
                        }
                    } catch (err) {
                        logger.error(err)
                        return cb(err, file)
                    }
                }
                cb(null, file)
            })
        )
        .pipe(
            rename(function (path) {
                replacePrefix(path)
                path.extname = getExt('html')
            })
        )
        .pipe(toDest(config.projectPath))
}
function translateJs() {
    return src(fromSrc('**/pages/**/*.js', `**/!(${config.prefix})/pages/**/*.js`, `**/${config.prefix}/pages/**/*.js`), {
        ignore: [`${EXCLUDE_FROM_CNPM_PATH}/**/*.js`],
        since: lastRun(translateJs)
    })
        .pipe(plumber())
        .pipe(
            rename(function (path) {
                replacePrefix(path)
            })
        )
        .pipe(
            babelTransform({
                root: config.root,
                enableEnvsResolve: config.enableEnvsResolve,
                alias: config.alias,
                exclude: [`${EXCLUDE_FROM_CNPM_PATH}/**/*`],
                platform: config.platform
            })
        )
        .pipe(
            definePlugin(config.consts, {
                exclude: [`${EXCLUDE_FROM_CNPM_PATH}/**/*`]
            })
        )
        .pipe(
            adapterJsPlugin({
                platform: config.platform,
                onAdapter: Config.onAdapter
            })
        )
        .pipe(
            through2.obj(function (file, _, cb) {
                if (file.isBuffer()) {
                    try {
                        let content = file.contents.toString()
                        // commonPageConfig 配置里，useComponents 已经被读取到里面来了，从哪里读取到的，默认每个页面都给加了一个 loading 组件
                        let commonPageConfig = {}
                        if (config.commonPageConfig && config.commonPageConfig.enable) {
                            commonPageConfig = {
                                ...config.commonPageConfig.injection
                            }
                        }

                        //非插件的时候，pages 目录下的 页面的 json 文件就能和 usingComponents 合并到一起
                        let re = resolveComponent(content, file, {
                            commonPageConfig,
                            root: config.root,
                            platform: config.platform,
                            enableEnvsResolve: config.enableEnvsResolve //允许多平台编译
                        })
                        file.contents = Buffer.from(re.content)
                        let newFile = file.clone()
                        newFile.contents = Buffer.from(re.componentJson)
                        newFile.path = newFile.path.replace(file.extname, '.json')
                        let stream = createStreamFromFile(newFile)
                        stream
                            .pipe(
                                rename(function (path) {
                                    replacePrefix(path)
                                })
                            )
                            .pipe(toDest(config.projectPath))
                    } catch (err) {
                        logger.error(err)
                        return cb(err, file)
                    }
                }
                cb(null, file)
            })
        )
        .pipe(toDest(config.projectPath))
}
function translateImage() {
    return src(fromSrc(`**/!(${config.prefix})/*.{jpg,jpeg,png,gif}`, `**/${config.prefix}/*.{jpg,jpeg,png,gif}`), {
        ignore: [`${EXCLUDE_FROM_CNPM_PATH}/**/*.{jpg,jpeg,png,gif}`].concat(config.assetsDir),
        since: lastRun(translateImage)
    })
        .pipe(plumber())
        .pipe(
            through2.obj(function (file, _, cb) {
                if (file.isBuffer()) {
                    try {
                        //所有引用的图片更换为线上路径
                        file.path = path.join(file.cwd, toDestUrl(file.path, file))
                        // console.log(`file.path: `+file.path);
                        // console.log(config.assertPath);
                    } catch (err) {
                        logger.error(err)
                        return cb(err, file)
                    }
                }
                cb(null, file)
            })
        )
        .pipe(toDest(config.assertPath))
}
/**
 * 处理 app.json
 * 文件都产出到了 project 目录，再开始处理 app.json
 * @returns
 */
function generateApp() {
    var router = []
    var subPackages = [];
    let isPlugin = config.cmdArgv.plugin;
    //根据编译后的产出目录中的 pages 目录下的文件，自动生成 app.json 中的 pages 配置
    var distProjectPath = path.join(config.root, DIST_PROJECT_PATH);
    var distPagesPath = '';
    //插件
    if (isPlugin) {
        distPagesPath = path.join(distProjectPath, path.relative(config.root, config.macroPagesPath));
        distProjectPath = getPluginPagesPath(distProjectPath, PLUGIN_MINIPROGRAM_ROOT);
    } else {
        distPagesPath = path.join(distProjectPath, path.relative(config.root, config.pagesPath)) // dist/wechat/sandbox/project/pages
    }
    if (fs.existsSync(distPagesPath)) {
        genRouter(distPagesPath, router, distProjectPath, config.platform)
    }

    //小程序分包的相关配置(插件、是否独立分包等)，可以在项目根目录的 @conf 下的 config 文件中配置，开发小程序插件项目，目前不支持此特性
    genSubPackages(distProjectPath, subPackages, config.platform, function (filepath) {
        let pathname = path.basename(filepath)
        return config.subPackages.indexOf(pathname) !== -1
    })

    //插件的 app.json 在 PLUGIN_MINIPROGRAM_ROOT 目录下
    let appPath = isPlugin ? `${PLUGIN_MINIPROGRAM_ROOT}` : '';
    //project.config.json 文件的产出位置
    let outputPath = path.join(config.projectPath, appPath);
    
    appPath += 'app.json';
    return src(appPath, {
        allowEmpty: true
    })
        .pipe(plumber())
        .pipe(
            through2.obj(function (file, _, cb) {
                if (file.isBuffer()) {
                    let content = file.contents.toString()
                    try {
                        content = JSON.parse(content)
                        content.plugins = content.plugins || {}
                        let plugins = Object.keys(content.plugins)
                        let hasLiveConf = false
                        for (var key of plugins) {
                            if (key === 'live-player-plugin') {
                                hasLiveConf = true
                            }
                        }

                        //去掉直播间配置
                        if (hasLiveConf && config.enableLive === false) {
                            logger.log('*无直播间版本')
                            delete content.plugins[key]
                        }

                        if (!hasLiveConf && config.enableLive === true) {
                            //有则不处理，无则添加
                            logger.log('*有直播间版本')
                            content.plugins['live-player-plugin'] = {
                                version: config.liveVersion || '1.3.0',
                                provider: 'wx2b03c6e691cd7370'
                            }
                        }

                        content.subPackages = content.subPackages || []
                        content.subPackages = content.subPackages.concat(subPackages)
                        content.pages = content.pages || []
                        content.pages = content.pages.concat(router)
                        //指定首页
                        if (config.indexPage && router.indexOf(config.indexPage) !== -1) {
                            content.pages.splice(content.pages.indexOf(config.indexPage), 1)
                            content.pages.unshift(config.indexPage)
                        }

                        //全局组件合并入 app.json
                        if (config.globalComponents && config.globalComponents.enable) {
                            content.usingComponents = content.usingComponents || {};
                            Object.keys(config.globalComponents.components).forEach(function (key) {
                                toComponent(content.usingComponents, key, config.globalComponents.components[key], config.root, config.root)
                            })
                        }

                        //根据环境处理 plugin 配置
                        genPlugins(config.appConfig, content);

                        //obj 转为 json 字符串的时候，冒号与属性值之间的空格数目为 4
                        content = JSON.stringify(content, null, 4)
                        let newFile = file.clone()
                        newFile.contents = Buffer.from(`export default ${content}`)
                        //为什么会有 app.json.js 这个文件
                        newFile.path = newFile.path.replace(file.extname, '.json.js')
                        let stream = createStreamFromFile(newFile)
                        stream.pipe(toDest(outputPath))
                    } catch (err) {
                        logger.error(err)
                        return cb(err, file)
                    }
                    file.contents = Buffer.from(content)
                }
                cb(null, file)
            })
        )
        .pipe(toDest(outputPath))
}

/**
 * 处理插件的 plugin.json
 * 文件都产出到了 project 目录，再开始处理 plugin.json
 * @returns 
 */
function generatePluginJSON() {
    var router = [];
    //根据编译后的产出目录中的 pages 目录下的文件，自动生成 app.json 中的 pages 配置
    var distProjectPath = path.join(config.root, DIST_PROJECT_PATH) //dist/wechat/sandbox/project
    var distPagesPath = path.join(distProjectPath, path.relative(config.root, config.pluginPagesPath)) // dist/wechat/sandbox/project/plugin/pages
    if (fs.existsSync(distPagesPath)) {
        //插件的最终页面路径不需要带上 plugin
        //baseDir 表示用于获取绝对页面路径后，去掉的前缀
        //distPagesPath 表示开始循环遍历获取页面文件路径的起始目录
        genRouter(distPagesPath, router, getPluginPagesPath(distProjectPath, PLUGIN_ROOT), config.platform);
    }
    let outputPath = path.join(config.projectPath, PLUGIN_ROOT);

    //命令行参数有 --plugin，表示当前编译的项目为 小程序插件
    return src(`${PLUGIN_ROOT}/plugin.json`, {
        allowEmpty: true
    })
        .pipe(plumber())
        .pipe(
            through2.obj(function (file, _, cb) {
                if (file.isBuffer()) {
                    let content = file.contents.toString()
                    try {
                        content = JSON.parse(content)
                        // 微信 plugin.json 中 pages 直接采用 map 的形式
                        // 支付宝 plugin.json 中 pages 采用 数组的形式，具体哪个页面对外可访问，取决于用户配置
                        let pagesObj = genPluginPages(router);
                        switch (config.platform) {
                            case 'wechat':
                                content.pages = content.pages || {};
                                content.pages = Object.assign(content.pages, pagesObj);
                                break;
                            case 'alipay':
                                content.pages = content.pages || [];
                                content.pages = content.pages.concat(router);
                                
                                content.publicPages = content.publicPages ||{};
                                content.publicPages = Object.assign(content.publicPages, pagesObj);
                                break;
                        }

                        //obj 转为 json 字符串的时候，冒号与属性值之间的空格数目为 4
                        content = JSON.stringify(content, null, 4);
                        let newFile = file.clone();
                        newFile.contents = Buffer.from(`export default ${content}`)
                        //为什么会有 app.json.js 这个文件
                        newFile.path = newFile.path.replace(file.extname, '.json.js')
                        let stream = createStreamFromFile(newFile)
                        stream.pipe(toDest(outputPath));
                    } catch (err) {
                        logger.error(err)
                        return cb(err, file)
                    }
                    file.contents = Buffer.from(content)
                }
                cb(null, file)
            })
        )
        .pipe(toDest(outputPath))
}

//压缩css
function optimize() {
    // console.log('optimize: '+getExt('css'));
    return src(normalizeUrl(path.join(DIST_PATH, config.projectPath, `**/*${getExt('css')}`)))
        .pipe(plumber())
        .pipe(cleanCSS())
        .pipe(toDest(config.projectPath))
}

//压缩js
function optimizeJs() {
    return src(normalizeUrl(path.join(DIST_PATH, config.projectPath, `**/*.js`)))
        .pipe(plumber())
        .pipe(
            minifyJs({
                mangle: false,
                compress: false
            })
        )
        .pipe(toDest(config.projectPath + '/test'))
        .pipe(toDest(config.projectPath))
}

var del = function (file, src = '', dist = '') {
    var filePathFromSrc = path.relative(path.join(process.cwd(), src), file)
    var destFilePath = path.resolve(path.join(DIST_PROJECT_PATH, dist), filePathFromSrc)
    rm(destFilePath)
}

var watchHandler = function (event, file) {
    var extname = path.extname(file)
    var isModify = event === 'add' || event === 'changed'
    switch (true) {
        case file === 'app.json':
            if (isModify) {
                logger.log(`Starting generateApp...`)
                generateApp()
            }
            break
        case extname === '.less':
            if (isModify) {
                logger.log(`Starting translateLess...`)
                translateLess()
            } else {
                del(file.replace(extname, '.wxss'))
            }
            break
        case extname === '.js' && anymatch('**/pages/**/*.js', file):
            if (isModify) {
                logger.log(`Starting translateJs...`)
                translateJs()
            } else {
                del(file)
            }
            break
        case extname === '.tpl':
            if (isModify) {
                logger.log(`Starting translateTpl...`)
                translateTpl()
            } else {
                del(file.replace(extname, '.wxml'))
            }
            break
        case /\.(jpg|jpeg|png|gif)$/.test(extname) && !anymatch(config.assetsDir, file):
            if (isModify) {
                logger.log(`Starting translateImage...`)
                translateImage()
            } else {
                var destFilePath = path.join(
                    DIST_ASSERT_PATH,
                    toDestUrl(path.basename(file), {
                        dirname: path.dirname(file)
                    })
                )
                rm(destFilePath)
            }
            break
        default:
            if (isModify) {
                logger.log(`Starting sync...`)
                sync()
            } else {
                del(file)
            }
            break
    }
}

var defaultTask = function () {
    Config.trigger('onInit', process.env.NODE_ENV);

    //自动生成 project.config.json 项目配置文件
    genarateProjectConfJson(config);

    var defaultTasks = [parallel(sync, translateLess, translateTpl, translateJs, translateImage), generateApp];

    //自动化处理 plugin.json
    if (config.cmdArgv.plugin) {
        defaultTasks.push(generatePluginJSON);
    }
    //命令行参数有 --theme
    if (config.cmdArgv.theme && config.enableTheme) {
        defaultTasks.push(
            ...config.themes.map(theme => {
                //颜色名及其配置
                return translateLessWithTheme(theme, config.themeData[theme])
            })
        )
    }
    if (config.cmdArgv.optimize) {
        defaultTasks.push(optimize) //optimizeJs
    }
    if (config.cmdArgv.watch) {
        var watcher = watch(fromSrc('**/*'), {
            ignored: [/[\/\\]\./, `${EXCLUDE_FROM_CNPM_PATH}/**/*`].concat(config.watchExclude || [])
        })
        watcher
            .on('change', function (file) {
                logger.warn(`${file} is changed`)
                watchHandler('changed', file)
            })
            .on('add', function (file) {
                logger.warn(`${file} is added`)
                watchHandler('add', file)
            })
            .on('unlink', function (file) {
                logger.warn(`${file} is deleted`)
                watchHandler('removed', file)
            })
    }
    Config.trigger('onConfig', defaultTasks, process.env.NODE_ENV)
    return series.apply(null, defaultTasks)
}
exports.default = defaultTask()
