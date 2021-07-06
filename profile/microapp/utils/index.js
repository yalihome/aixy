const fs = require('fs')
const path = require('path')
const through2 = require('through2')
const crypto = require('crypto')
const SVGO = require('svgo')
const { Buffer } = require('buffer')
const { default: traverse } = require('@babel/traverse')
const { parse } = require('@babel/parser')
const { default: generate } = require('@babel/generator')
const { isStringLiteral, isIdentifier } = require('@babel/types')
const { transform } = require('@babel/core')
const util = require('util')
const shelljs = require('shelljs')
const log = require('fancy-log')
const colors = require('ansi-colors')
const anymatch = require('anymatch')
const htmlparser2 = require('htmlparser2')
const template = require('art-template')
var rule = template.defaults.rules[1]
rule.test = new RegExp(rule.test.source.replace('{{', '{#').replace('}}', '#}'))

/**
 * 遍历获取同一个目录下的所有目录的文件真实路径
 * @param {*} dir 
 * @param {*} callback 
 */
function handlerSameNameDirFile(dir, callback) {
    // 遍历同一个文件夹下的所有目录以及文件
    var fss = fs.readdirSync(dir)
    fss.forEach(function (f) {
        var basename = path.basename(f),
            realPath = path.resolve(dir, f);
            // console.log(`dir: ${dir}, basename: ` + basename + ' ,realPath: '+realPath);
        if (basename[0] === '_') return
        var stat = fs.statSync(realPath);
        //是目录，继续进入目录进行处理
        if (stat.isDirectory()) {
            handlerSameNameDirFile(realPath, callback)
        } else {
            //是文件，且仅处理 js 文件，模板文件和 js 不处理
            let extname = path.extname(realPath)
            if (extname !== '.js') return
            var basename = path.basename(realPath).replace(extname, ''),
                dirname = path.dirname(realPath).split(path.sep).pop()
                // js 文件的名称和目录名称一致，则调用 回调
            if (basename === dirname) {
                //传递出去的是真实目录、当前文件所在目录名、文件名、文件后缀（后缀限定死了是 js 文件）
                callback({
                    dirname: dirname,
                    realPath: realPath,
                    basename: basename,
                    extname: extname
                })
            }
        }
    })
}
/**
 * 获取 dir 目录下所有的符合小程序规范的页面文件路径数组： ['pages/index/index'，'pages/test/test'] 这样
 * 关键点在于：获取 pages/index/index，获取真实路径，通过替换真实路径中的根目录字符串获取到
 * 仅在普通小程序主包和分包(extPackage)两个地方有调用 此函数
 * 待优化部分： 插件的 plugin.json 文件也需要调用此函数产生路径数组，而不是每次都手动配置
 * @param {*} dir 当前遍历的目录
 * @param {*} router 路径数组
 * @param {*} baseDir 最终需要在文件真实目录中需要去掉的路径部分
 */
function genRouter(dir, router, baseDir) {
    // baseDir 取值：
    // E:\smart-breeze\pi-ma-guide-client\dist\nuode\wechat\sandbox\project
    // E:\smart-breeze\pi-ma-guide-client\dist\nuode\wechat\sandbox\project\extPackage
    handlerSameNameDirFile(dir, function ({ realPath, extname }) {
        router.push(resolvePath(realPath.replace(baseDir + path.sep, '').replace(extname, '')))
    });
}

exports.genRouter = genRouter

//@ques 除开 extPackage ，分包叫做其它名字真的不行？
function getSubPages(dir, condition, callback) {
    var fss = fs.readdirSync(dir)
    fss.forEach(function (f) {
        var basename = path.basename(f),
            realPath = path.resolve(dir, f)
        var stat = fs.statSync(realPath);
        if (condition(realPath) && stat.isDirectory()) {
            // console.log(`realPath: ${realPath}`);
            let pagesPath = path.resolve(realPath, './pages')
            if (fs.existsSync(pagesPath)) {
                callback({
                    basename,
                    pagesPath,
                    realPath
                })
            }
        }
    })
}

//dir 依然是从 dist/wechat/sandbox/project 开始
/**
 * 
 * @param {*} dir 
 * @param {*} subPackages 
 * @param {*} condition 校验路径的函数，返回 true/false
 */
function genSubPackages(dir, subPackages, condition) {
    //project 目录下的 extPackage 目录下的 pages 目录
    getSubPages(dir, condition, function ({ pagesPath, realPath, basename }) {
        let router = [];
        //生成某个目录下的页面记录
        //pagesPath  dist/wechat/sandbox/project/extPackage/pages
        //realPath  E:\smart-breeze\pi-ma-guide-client\dist\nuode\wechat\sandbox\project\extPackage
        genRouter(pagesPath, router, realPath);
        subPackages.push({
            root: basename,
            pages: router
        })
    })
}

exports.genSubPackages = genSubPackages

function resolvePath(dir) {
    return dir.split(path.sep).join('/')
}

exports.resolvePath = resolvePath

function camelize2line(str) {
    return str.replace(/[A-Z]/g, function (str) {
        return `-${str.toLowerCase()}`
    })
}

function getSiblingPath(dir, dest, root) {
    dir = dir.split(path.sep);
    while (dir.length) {
        var src = dir.join(path.sep);
        var fss = fs.readdirSync(src)
        for (let i = 0; i < fss.length; i++) {
            let file = path.resolve(src, fss[i])
            let stat = fs.statSync(file)
            if (stat.isDirectory() && path.basename(file) === dest) {
                return file
            }
        }
        if (root && src === root) return
        dir.pop()
    }
}

function merge(target, ...sources) {
    if (!sources.length) return target
    const source = sources.shift()
    if (util.isObject(target) && util.isObject(source)) {
        for (const key in source) {
            if (util.isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} })
                merge(target[key], source[key])
            } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
                target[key] = target[key].concat(source[key])
            } else {
                Object.assign(target, { [key]: source[key] })
            }
        }
    }
    return merge(target, ...sources)
}

/**
 * 主要是用来处理小程序 Page 配置项中的 components 配置的
 * @param {*} components 
 * @param {*} modName 
 * @param {*} modPath 
 * @param {*} pwd 页面所在目录
 * @param {*} root 
 * @returns 
 */
function toComponent(components, modName, modPath, pwd, root) {
    var componentPath
    // 相对 subPage 模块
    if (modPath.startsWith('&')) {
        modPath = modPath.replace('&', '')
        // 获取 components 相对路径
        let componentsPath = getSiblingPath(pwd, 'components', root);
        if (!componentsPath) {
            components[modName] = null
            delete components[modName]
            log.warn(`cannot find components in ${pwd}`)
            return
        }
        //获取 components 目录再项目中的绝对路径 
        componentPath = resolvePath(path.relative(pwd, componentsPath));
        // 获取 subPackage 内部 component
    } else if (modPath.startsWith('~')) {
        modPath = modPath.replace('~', '')
        componentPath = '/components'
    }
    if (componentPath) {
        let componentName = path.basename(modPath);
        if (path.dirname(modPath) !== '.') {
            componentPath = `${componentPath}/${path.dirname(modPath)}`
        }
        //拼接成了 E:xxx/components/coupon-info/coupon-info 这样
        components[modName] = `${componentPath}/${componentName}/${componentName}`
    } else {
        components[modName] = modPath
    }
    //到了这里，拿到了所有页面代码中 components 配置项中的内容，怎么拿到的？
}

exports.toComponent = toComponent

function resolveComponent(content, file, config = {}) {
    var pageConfig = {
        usingComponents: {}
    }
    if (config.commonPageConfig) {
        merge(pageConfig, config.commonPageConfig)
        if (config.commonPageConfig.usingComponents) {
            let usingComponents = config.commonPageConfig.usingComponents
            Object.keys(usingComponents).forEach(key => {
                toComponent(pageConfig.usingComponents, key, usingComponents[key], file.dirname, config.root)
            })
        }
    }
    // if((/@component\(['"](.*)['"]\)[;]?/g).test(content)){
    //     console.log(content);
    //     console.log('dirname: ' + file.dirname);
    // }
    // 替换@component('组件')
    content = content.replace(/@component\(['"](.*)['"]\)[;]?/g, function (input, mod, modPath) {
        toComponent(pageConfig.usingComponents, mod, mod, file.dirname)
        return ''
    })
    // 替换 components 声明组件（eslint）
    // components: {
    // shortcut: '~shortcut', 顶层 components
    // 'card-myposter-user': '&cards/card-myposter-user', 当前 subPage components
    // "list": "@xbreeze/micro-list" node_modules | default
    // }
    content = genIdentifierComponents(content, file.dirname, pageConfig)
    let jsonFile = file.path.replace(file.extname, '.json')
    let platformJsonFile = `${file.path.replace(file.extname, '')}.${config.platform}.json`
    if (config.enableEnvsResolve && fs.existsSync(platformJsonFile)) {
        jsonFile = platformJsonFile
    }
    if (fs.existsSync(jsonFile)) {
        //自身存在json 文件的目录，建议是和默认配置合并，而不是直接覆盖，当前小程序插件就存在这样的问题
        // console.log('存在json文件的目录：'+file.dirname);
        jsonFile = fs.readFileSync(jsonFile).toString()
        try {
            jsonFile = JSON.parse(jsonFile)
        } catch (err) {
            jsonFile = {}
        }
    } else {
        jsonFile = {}
    }
    return {
        content,
        componentJson: JSON.stringify(merge(jsonFile, pageConfig), null, 4)
    }
}

exports.resolveComponent = resolveComponent

function genIdentifierComponents(
    code,
    dirname,
    pageConfig = {
        usingComponents: {}
    }
) {
    const ast = parse(code, {
        sourceType: 'module'
    })
    traverse(ast, {
        enter(path) {
            if ((isIdentifier(path.node) && path.node.name === 'components') || (isStringLiteral(path.node) && path.node.value === 'components')) {
                let parentNode = path.parent
                let value = parentNode.value
                if (parentNode.type === 'VariableDeclarator') {
                    parentNode.init.properties.forEach(prop => {
                        // StringLiteral | Literal
                        toComponent(pageConfig.usingComponents, prop.key.value || prop.key.name, prop.value.value, dirname)
                    })
                }

                if (value && value.type === 'ObjectExpression') {
                    value.properties.forEach(prop => {
                        // StringLiteral | Literal
                        toComponent(pageConfig.usingComponents, prop.key.value || prop.key.name, prop.value.value, dirname)
                    })
                    path.parentPath.remove()
                }
            }
            if ((isIdentifier(path.node) && path.node.name === '$pageConfig') || (isStringLiteral(path.node) && path.node.value === '$pageConfig')) {
                let value = path.parent.value
                if (value.type === 'ObjectExpression') {
                    value.properties.forEach(prop => {
                        pageConfig[prop.key.value || prop.key.name] = prop.value.value
                    })
                    path.parentPath.remove()
                }
            }
        }
    })
    return generate(ast).code
}

exports.genIdentifierComponents = genIdentifierComponents

function createStreamFromFile(file) {
    let stream = through2.obj(function (file, enc, callback) {
        this.push(file)
        return callback()
    })
    stream.write(file)
    stream.end()
    return stream
}

exports.createStreamFromFile = createStreamFromFile

exports.isHTTP = function (str) {
    if (!str) return false
    return /^(https?:)?\/\//.test(String(str))
}
exports.isBase64 = function (str) {
    if (!str) return false
    return /^data:image\/([^;]+);base64,/.test(str)
}

function reRequire(module_path) {
    var mod_path = require.resolve(module_path)
    var module = require.cache[mod_path]
    if (module && module.parent) {
        module.parent.children.splice(module.parent.children.indexOf(module), 1)
    }
    module = require.cache[mod_path] = undefined
    return require(mod_path)
}

exports.reRequire = reRequire

var toHash = function (content, len) {
    var hash = crypto.createHash('sha1')
    hash.update(content)
    return hash.digest('hex').slice(0, len)
}
exports.toHash = toHash

exports.toBase64 = function (content) {
    return Buffer.from(content).toString('base64')
}

function encodeSvg(content) {
    return `"data:image/svg+xml,${encodeURIComponent(content)}"`
}

exports.encodeSvg = encodeSvg

exports.inlineSvg = function (content, compress) {
    if (compress) {
        let svgo = new SVGO()
        return svgo.optimize(content).then(re => {
            return encodeSvg(re.data)
        })
    } else {
        return Promise.resolve(encodeSvg(content))
    }
}

exports.normalizeUrl = function (url) {
    return url.split(path.sep).join('/')
}

class Cache {
    constructor(conf) {
        this.key = `__FILE_CACHE_${conf.namespace}`
        //@ .ovestack 暂时换成了 .aixy，备注下
        this.cachePath = path.resolve(process.cwd(), `node_modules/.aixy/${this.key}`)
        if (fs.existsSync(this.cachePath)) {
            shelljs.rm('-r', this.cachePath)
        }
        shelljs.mkdir('-p', this.cachePath)
    }
    get(filename) {
        let hash = toHash(filename)
        let cachePath = path.join(this.cachePath, hash)
        if (fs.existsSync(cachePath)) {
            return fs.readFileSync(cachePath)
        }
    }
    set(filename, cache) {
        let hash = toHash(filename)
        fs.writeFileSync(path.join(this.cachePath, hash), cache)
        return cache
    }
}

exports.Cache = Cache

var logger = {
    log(...args) {
        return log.apply(
            null,
            args.map(text => {
                return colors.green(text)
            })
        )
    },
    error(...args) {
        return log.apply(
            null,
            args.map(text => {
                return colors.red(text)
            })
        )
    },
    warn(...args) {
        return log.apply(
            null,
            args.map(text => {
                return colors.yellow(text)
            })
        )
    }
}

exports.logger = logger

function toRenderConsts(consts) {
    var re = {}
    Object.keys(consts).forEach(key => {
        var val = consts[key]
        if (key.indexOf('.')) {
            key = key.split('.')
            let index = 0
            let pre = re
            while (index < key.length - 1) {
                let newKey = key.slice(index, ++index)
                pre[newKey] = pre[newKey] || {}
                pre = pre[newKey]
            }
            pre[key[key.length - 1]] = val
        } else {
            re[key] = val
        }
    })
    return re
}
//webpack 中 definePlugin 的功能就是如此
exports.definePlugin = function (
    consts,
    conf = {
        exclude: []
    }
) {
    var constsKeys = Object.keys(consts)
    return through2.obj(function (file, enc, callback) {
        if (file.isBuffer() && /\.(js|tpl)$/.test(file.extname) && constsKeys && constsKeys.length && !anymatch(conf.exclude, file.path)) {
            try {
                let content = file.contents.toString()
                switch (file.extname) {
                    case '.js':
                        //值替换
                        constsKeys.forEach(key => {
                            content = content.replace(new RegExp(key, 'gm'), JSON.stringify(consts[key]))
                        })
                        break
                    case '.tpl':
                        if (content) {
                            content = template.render(content, toRenderConsts(consts), {
                                minimize: false
                            })
                        }
                        break
                }
                file.contents = Buffer.from(content)
            } catch (err) {
                return callback(err, file)
            }
        }
        callback(null, file)
    })
}
/**
 * 平台适配器，用于适配 alipay 和 字节跳动 小程序
 * @param {*} config 
 * @returns 
 */
exports.adapterJsPlugin = function (config) {
    return through2.obj(function (file, enc, callback) {
        if (file.isBuffer() && file.extname === '.js') {
            try {
                let content = file.contents.toString()
                switch (config.platform) {
                    case 'alipay':
                        //wx. 替换为 my.
                        content = content.replace(new RegExp(`\\bwx\.\\b`, 'gm'), 'my.')
                        break
                    case 'tt':
                        //wx. 替换为 tt. 
                        content = content.replace(new RegExp(`\\bwx\.\\b`, 'gm'), 'tt.')
                        break
                }
                if (config.onAdapter) {
                    content = config.onAdapter(content, {
                        file,
                        platform: config.platform
                    })
                }
                file.contents = Buffer.from(content)
            } catch (err) {
                return callback(err, file)
            }
        }
        callback(null, file)
    })
}

var camelize = function (prop) {
    return prop.replace(/^([a-z])/gi, function (all, letter) {
        return letter.toUpperCase()
    })
}

exports.camelize = camelize

var adapterHtml = function (tree, platform) {
    tree.forEach(item => {
        if (item.type === 'tag') {
            switch (platform) {
                case 'alipay':
                    //支付宝统一为 wxs 方式导入 js
                    if (item.name === 'wxs') {
                        item.name = 'import-sjs'
                        if (item.attribs) {
                            item.attribs['name'] = item.attribs['module'] || ''
                            item.attribs['from'] = item.attribs['src'] || ''
                            if (item.attribs['from']) {
                                item.attribs['from'] = item.attribs['from'].replace(/\.wxs/, '.sjs')
                            }
                            delete item.attribs['module']
                            delete item.attribs['src']
                        }
                    }
                    break
                case 'tt':
                    if (item.name === 'wxs') {
                        item.name = 'sjs'
                        if (item.attribs) {
                            if (item.attribs['src']) {
                                item.attribs['src'] = item.attribs['src'].replace(/\.wxs/, '.sjs')
                            }
                        }
                    }
                    break
            }
            // import-sjs wxs
            Object.keys(item.attribs).forEach(attr => {
                let value = item.attribs[attr]
                let newAttr
                switch (platform) {
                    case 'alipay':
                        switch (true) {
                            case attr === 'wx:key':
                                newAttr = 'key'
                                break
                            case attr.indexOf('bind') === 0:
                                newAttr = `on${camelize(attr.replace('bind', ''))}`
                                break
                            case attr.indexOf('catch') === 0:
                                newAttr = `catch${camelize(attr.replace('catch', ''))}`
                                break
                            case attr.indexOf('wx:') === 0:
                                newAttr = attr.replace('wx:', 'a:')
                                break
                        }
                        break
                    case 'tt':
                        switch (true) {
                            case attr.indexOf('wx:') === 0:
                                newAttr = attr.replace('wx:', 'tt:')
                                break
                        }
                        break
                }
                if (newAttr) {
                    delete item.attribs[attr]
                    item.attribs[newAttr] = value
                }
            })
            if (item.children && item.children.length) {
                adapterHtml(item.children, platform)
            }
        }
    })
    return tree
}

exports.adapterHtmlPlugin = function (config) {
    return through2.obj(function (file, enc, callback) {
        if (file.isBuffer() && file.extname === '.tpl') {
            try {
                let content = file.contents.toString()
                switch (config.platform) {
                    case 'alipay':
                    case 'tt':
                        //用于编辑 XML/HTML/RSS，产生流，为什么要这么做呢？
                        var tree = htmlparser2.parseDOM(content, {
                            xmlMode: true,
                            decodeEntities: true
                        })
                        content = htmlparser2.DomUtils.getOuterHTML(adapterHtml(tree, config.platform), {
                            xmlMode: true
                        })
                        break
                }
                if (config.onAdapter) {
                    content = config.onAdapter(content, {
                        file,
                        platform: config.platform
                    })
                }
                file.contents = Buffer.from(content)
            } catch (err) {
                return callback(err, file)
            }
        }
        callback(null, file)
    })
}

exports.babelTransform = function (
    conf = {
        exclude: []
    }
) {
    return through2.obj(function (file, enc, callback) {
        if (file.isBuffer() && file.extname === '.js' && !anymatch(conf.exclude, file.path)) {
            try {
                let content = file.contents.toString()
                // unknown...
                content = transform(content, {
                    babelrc: false,
                    plugins: [
                        [
                            require.resolve('babel-plugin-module-resolver'),
                            {
                                extensions: ['.js'],
                                root: [conf.root],
                                alias: conf.alias,
                                resolvePath(sourcePath, currentFile, opts) {
                                    let hasChange = false
                                    let _sourcePath = path.join(
                                        ...sourcePath.split('/').map(item => {
                                            if (opts.alias[item]) {
                                                hasChange = true
                                            }
                                            return opts.alias[item] || item
                                        })
                                    )
                                    if (hasChange) {
                                        sourcePath = resolvePath(path.relative(path.dirname(file.path), _sourcePath))
                                    }
                                    if (!conf.enableEnvsResolve) {
                                        return sourcePath
                                    }
                                    try {
                                        let platformSource = `${sourcePath}.${conf.platform}`
                                        require.resolve(path.join(path.dirname(file.path), platformSource))
                                        return platformSource
                                    } catch (err) {
                                        return sourcePath
                                    }
                                }
                            }
                        ],
                        // Add @babel/plugin-proposal-class-properties (https://git.io/vb4SL) to the 'plugins' section of your Babel config to enable transformation.
                        // If you want to leave it as-is, add @babel/plugin-syntax-class-properties (https://git.io/vb4yQ) to the 'plugins' section to enable parsing.
                        require.resolve('@babel/plugin-syntax-class-properties')
                    ]
                }).code
                file.contents = Buffer.from(content)
            } catch (err) {
                return callback(err, file)
            }
        }
        callback(null, file)
    })
}
