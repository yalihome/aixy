const path = require('path')
const { series, parallel, src, dest, watch, lastRun, task } = require('gulp')
const fs = require('fs')
const rename = require('gulp-rename')
const less = require('gulp-less')
const cleanCSS = require('gulp-clean-css')
const stylus = require('gulp-stylus')
const through2 = require('through2')
//html 解析器
const htmlparser2 = require('htmlparser2')
const alias = require('gulp-style-aliases')
const Buffer = require('buffer').Buffer
const css = require('css')
const plumber = require('gulp-plumber')
const { genRouter, genSubPackages, resolveComponent, createStreamFromFile, isHTTP, isBase64, toHash, toBase64, inlineSvg, normalizeUrl, toComponent, Cache, logger, definePlugin, adapterJsPlugin, adapterHtmlPlugin, babelTransform, resolvePath } = require('./utils')
const { isUndefined, isFunction } = require('util')
const anymatch = require('anymatch')
const { rm } = require('shelljs')
const Config = require(require.resolve('../../config')) //根目录的config.js
const config = Config.config
const { resolve: resolveUrl, parse: parseUrl } = require('url')
const { fieldEnds } = require('tar')
//这里的root 居然是 E:\smartbreeze\work\dist\wechat\\sandbox
const DIST_PATH = path.relative(config.root, config.publicPath) //dist/wechat/sandbox
// console.log(`publicPath: ${config.publicPath}`)
const INCLUDE_FILES = fromSrc('**/*', '!override.config.js', '!.DS_Store', '!**/init', '!**/*.less', '!**/*.stylus', '!**/*.tpl', '!**/pages/**/*.js', '!**/pages/**/*.json', '!**/*.{jpg,jpeg,png,gif,svg}', '!**/*.{zip,tgz}', '!app.json', '!package-lock.json')
const EXCLUDE_FROM_CNPM_PATH = '**/node_modules/!(@xbreeze)'
const DIST_PROJECT_PATH = path.join(DIST_PATH, config.projectPath) //dist/wechat/sandbox/project
const DIST_ASSERT_PATH = path.join(DIST_PATH, config.assertPath);

// console.log(`config.projectPath:`+config.projectPath);
// console.log(`path.sep: ${path.sep} ,DIST_PATH: ${DIST_PATH} ,DIST_ASSERT_PATH: ${DIST_ASSERT_PATH}, DIST_PROJECT_PATH: ${DIST_PROJECT_PATH}, DIST_ASSERT_PATH: ${DIST_ASSERT_PATH}`)

function fromSrc(...args) {
    return [...args, `!${DIST_PATH.split(path.sep)[0]}/**`]
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

const TYPE_MAPPER = {
    wechat: {
        html: '.wxml',
        css: '.wxss',
        wxs: '.wsx'
    },
    alipay: {
        html: '.axml',
        css: '.acss',
        wxs: '.sjs'
    },
    tt: {
        html: '.ttml',
        css: '.ttss',
        wxs: '.sjs'
    }
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
    var url = path.resolve(file.dirname, defUrl);
    // console.log('资源文件实际路径：'+url);
    var parsedUrl = parseUrl(url);  //格式化成为对象的路径
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
    // console.log(`config.assetsDir: ${config.assetsDir}`)
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
                '~': config.root  //re
            })
        )
        .pipe(
            less({
                //编译 less
                relativeUrls: true,  //使用相对位置
                ...config.lessOptions   //modifyVars 和 OSS-PATH 暂时还不知道怎么使用，还是要去看一下 less.js
            })
        )
        .pipe(translateUrl())  //资源文件绝对路径更换为对应线上资源域名路径，这里是异步的，pipe 会等待异步代码执行完？
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
        return src(fromSrc('**/*.less'), {
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
                    if (file.isBuffer()) {
                        if (extFileExists(file)) {
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
                            content = css.stringify(cssObj)
                            file.contents = Buffer.from(content)
                        } catch (err) {
                            logger.error(err)
                            return cb(err, file)
                        }
                    }
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
            .pipe(
                dest(path.join(DIST_PATH, config.projectPath), {
                    overwrite: true,
                    append: true
                })
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
                        // @todo 这里做了什么，需要研究下
                        if (config.enableTheme || (config.globalComponents && config.globalComponents.enable)) {
                            //乱码的两种猜测：1、在转为 tree 结构的时候已经出错   2、tree 结构转为 html 的时候出错
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
                            });

                            file.contents = Buffer.from(html);
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
                        let content = file.contents.toString();
                        // commonPageConfig 配置里，useComponents 已经被读取到里面来了，从哪里读取到的，默认每个页面都给加了一个 loading 组件
                        let commonPageConfig = {}
                        if (config.commonPageConfig && config.commonPageConfig.enable) {
                            commonPageConfig = {
                                ...config.commonPageConfig.injection
                            }
                        }
                        let re = resolveComponent(content, file, {
                            commonPageConfig,
                            root: config.root,
                            platform: config.platform,
                            enableEnvsResolve: config.enableEnvsResolve
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
    var router = [];
    var subPackages = [];
    //根据编译后的产出目录中的 pages 目录下的文件，自动生成 app.json 中的 pages 配置
    var distProjectPath = path.join(config.root, DIST_PROJECT_PATH);  //dist/wechat/sandbox/project
    var distPagesPath = path.join(distProjectPath, path.relative(config.root, config.pagesPath));  // dist/wechat/sandbox/project/pages
    //生成主包的目录
    // pages 目录存在 ，小程序才这样处理，插件会跳过这这里，插件项目源码的 app.json 不需要处理(其实也应该做处理)
    if (fs.existsSync(distPagesPath)) {
        genRouter(distPagesPath, router, distProjectPath);
    }
    //处理分包以及分包下的路径，问题在于，现在分包也是可以引入 plugin 的
    //@todo 应该在分包下面放置一个 config.json，用于合并分包其它配置
    genSubPackages(distProjectPath, subPackages, function (filepath) {
        let pathname = path.basename(filepath);
        // console.log(`pathname: ${pathname}`);
        //config.subPackages 用于存储当前已经确定是分包的目录，哪些目录是分包目录，可通过 override.config.js 的 subpackages 配置项配置
        return config.subPackages.indexOf(pathname) !== -1
    });
    return src('app.json', {
        allowEmpty: true
    })
        .pipe(plumber())
        .pipe(
            through2.obj(function (file, _, cb) {
                if (file.isBuffer()) {
                    let content = file.contents.toString()
                    try {
                        content = JSON.parse(content)
                        content.subPackages = content.subPackages || []
                        content.subPackages = content.subPackages.concat(subPackages)
                        content.pages = content.pages || []
                        content.pages = content.pages.concat(router)
                        if (config.indexPage && router.indexOf(config.indexPage) !== -1) {
                            content.pages.splice(content.pages.indexOf(config.indexPage), 1)
                            content.pages.unshift(config.indexPage)
                        }
                        if (config.globalComponents && config.globalComponents.enable) {
                            content.usingComponents = content.usingComponents || {}
                            Object.keys(config.globalComponents.components).forEach(function (key) {
                                toComponent(content.usingComponents, key, config.globalComponents.components[key], config.root)
                            })
                        }
                        //obj 转为 json 字符串的时候，冒号与属性值之间的空格数目为 4
                        content = JSON.stringify(content, null, 4)
                        let newFile = file.clone()
                        newFile.contents = Buffer.from(`export default ${content}`)
                        newFile.path = newFile.path.replace(file.extname, '.json.js')
                        let stream = createStreamFromFile(newFile)
                        stream.pipe(toDest(config.projectPath))
                    } catch (err) {
                        logger.error(err)
                        return cb(err, file)
                    }
                    file.contents = Buffer.from(content)
                }
                cb(null, file)
            })
        )
        .pipe(toDest(config.projectPath))
}
//清除中间过程产生的 css 文件
function optimize() {
    return src(normalizeUrl(path.join(DIST_PATH, config.projectPath, `**/*${getExt('css')}`)))
        .pipe(plumber())
        .pipe(cleanCSS())
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
    Config.trigger('onInit', process.env.NODE_ENV)
    var defaultTasks = [parallel(sync, translateLess, translateTpl, translateJs, translateImage), generateApp]
    if (config.cmdArgv.theme && config.enableTheme) {
        defaultTasks.push(
            ...config.themes.map(theme => {
                return translateLessWithTheme(theme, config.themeData[theme])
            })
        )
    }
    if (config.cmdArgv.optimize) {
        defaultTasks.push(optimize)
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
