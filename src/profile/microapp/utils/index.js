const fs = require('fs')
const path = require('path')
const through2 = require('through2')
const crypto = require('crypto')
const SVGO = require('svgo')
const {Buffer} = require('buffer')
const {default: traverse} = require('@babel/traverse')
const {parse} = require('@babel/parser')
const {default: generate} = require('@babel/generator')
const {isStringLiteral, isIdentifier} = require('@babel/types')
const {transform} = require('@babel/core')
const util = require('util')
const shelljs = require('shelljs')
const log = require('fancy-log')
const colors = require('ansi-colors')
const anymatch = require('anymatch')
const htmlparser2 = require('htmlparser2')
const template = require('art-template')
const mkdirp = require('mkdirp')

const rule = template.defaults.rules[1]
rule.test = new RegExp(rule.test.source.replace('{{', '{#').replace('}}', '#}'))
const {PLUGIN_MINIPROGRAM_ROOT, PLUGIN_ROOT, CONF_FILENAME_MAP, TYPE_MAPPER} = require('../consts')

/**
 * 遍历获取同一个目录下的所有目录的文件真实路径
 * @param {*} dir
 * @param {*} callback
 */
function handlerSameNameDirFile(dir, platform, callback) {
    // 遍历同一个文件夹下的所有目录以及文件
    const fss = fs.readdirSync(dir)
    fss.forEach(f => {
        var basename = path.basename(f)
        const realPath = path.resolve(dir, f)
        if (basename[0] === '_') return
        const stat = fs.statSync(realPath)
        // 是目录，继续进入目录进行处理
        // 是目录：判断有无 js 文件、有没有同名 json，且 json 中 component 为 false
        // 非目录
        if (stat.isDirectory()) {
            handlerSameNameDirFile(realPath, platform, callback)
        } else {
            // 是文件，且仅处理 js 文件，模板文件和 js 不处理
            const extname = path.extname(realPath)
            if (extname !== '.js') return
            const ext = TYPE_MAPPER[platform]
            basename = path.basename(realPath).replace(extname, '')
            const dirname = path.dirname(realPath).split(path.sep).pop()
            // js 文件的名称和目录名称一致，则调用 回调
            // 通过 callback 处理的，才需要被放到 router 中
            // basename 与 dirname 不一定相等
            const prefix = realPath.replace('.js', '')
            const sameNameJson = `${prefix}.json`
            const sameNameJsonExist = fs.existsSync(sameNameJson)
            const sameNameXmlExist = fs.existsSync(`${prefix}${ext.html}`)
            const sameNameTplExist = fs.existsSync(`${prefix}.tpl`)
            let obj = ''

            if (sameNameJsonExist) {
                obj = fs.readFileSync(sameNameJson).toString('utf-8')
                obj = JSON.parse(obj)
            }

            // 首先需要有对应的同名 axml/wxml/tpl 文件，无同名 json，或者有同名 json，且 json 中没有 component: true，才是页面
            if ((sameNameXmlExist || sameNameTplExist) && (!sameNameJsonExist || (obj && !obj.component))) {
                // 传递出去的是真实目录、当前文件所在目录名、文件名、文件后缀（后缀限定死了是 js 文件）
                callback({
                    dirname,
                    realPath,
                    basename,
                    extname
                })
            }
        }
    })
}
/**
 * 获取 dir 目录下所有的符合小程序规范的页面文件路径数组(pagePath)： ['pages/index/index'，'pages/test/test'] 这样
 * 关键点在于：获取 pages/index/index，获取真实路径，通过替换真实路径中的根目录字符串获取到
 * 仅在普通小程序主包和分包(extPackage)、插件 3个地方有调用 此函数
 * @param {*} dir 当前遍历的目录(pagePath)
 * @param {*} router 存储路径的数组
 * @param {*} baseDir 最终需要在文件真实目录中需要去掉的路径部分(projectPath)
 */
function genRouter(dir, router, baseDir, platform) {
    // 不是所有页面 都是符合 pages/index/index 这种规范的，而且很多页面下面是放置的有组件的，需要剔除这种
    handlerSameNameDirFile(dir, platform, ({realPath, extname}) => {
        router.push(resolvePath(realPath.replace(baseDir + path.sep, '').replace(extname, '')))
    })
}

exports.genRouter = genRouter

// @ques 除开 extPackage ，分包叫做其它名字真的不行？——名字是用户自行配置的，可以为其他名字
function getSubPages(dir, condition, callback) {
    const fss = fs.readdirSync(dir)
    fss.forEach(f => {
        const basename = path.basename(f)
        const realPath = path.resolve(dir, f)
        const stat = fs.statSync(realPath)
        if (condition(realPath) && stat.isDirectory()) {
            // console.log(`realPath: ${realPath}`);
            const pagesPath = path.resolve(realPath, './pages')
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

// dir 依然是从 dist/wechat/sandbox/project 开始
/**
 *
 * @param {*} dir
 * @param {*} subPackages
 * @param {*} condition 校验路径的函数，返回 true/false
 */
function genSubPackages(dir, subPackages, platform, condition) {
    // project 目录下的 extPackage 目录下的 pages 目录
    getSubPages(dir, condition, ({pagesPath, realPath, basename}) => {
        const router = []
        // 生成某个目录下的页面记录
        genRouter(pagesPath, router, realPath, platform)
        subPackages.push({
            root: basename,
            pages: router
        })
    })
}

exports.genSubPackages = genSubPackages

/**
 * 将 [pages/index/index, pges/test/test] 转换为 plugin.json 中的 pages: { index: 'pages/index/index' }
 * @param {*} router
 */
function genPluginPages(router) {
    const map = {}
    router.forEach(ele => {
        let tmp = ele.split('/')
        // 去头
        tmp.shift()
        const len = tmp.length
        if (tmp.length >= 2 && tmp[len - 2] == tmp[len - 1]) {
            // 去尾
            tmp.pop()
        }
        map[tmp.join('/')] = ele
        tmp = null
    })
    return map
}

exports.genPluginPages = genPluginPages

/**
 * 专拼接 plugin/ 或者 miniprogram/ 路径后，去掉其最后一个 /
 * @param {*} dir
 * @param {*} pluginPath
 * @returns
 */
function getPluginPagesPath(dir, pluginPath) {
    const baseDir = path.join(dir, pluginPath)
    return baseDir.substr(0, baseDir.length - 1)
}

exports.getPluginPagesPath = getPluginPagesPath

function resolvePath(dir) {
    return dir.split(path.sep).join('/')
}

exports.resolvePath = resolvePath

function camelize2line(str) {
    return str.replace(/[A-Z]/g, str => `-${str.toLowerCase()}`)
}

exports.camelize2line = camelize2line

function getSiblingPath(dir, dest, root) {
    dir = dir.split(path.sep)
    while (dir.length) {
        const src = dir.join(path.sep)
        const fss = fs.readdirSync(src)
        for (let i = 0; i < fss.length; i++) {
            const file = path.resolve(src, fss[i])
            const stat = fs.statSync(file)
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
                if (!target[key]) Object.assign(target, {[key]: {}})
                merge(target[key], source[key])
            } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
                target[key] = target[key].concat(source[key])
            } else {
                Object.assign(target, {[key]: source[key]})
            }
        }
    }
    return merge(target, ...sources)
}

/**
 * 主要是用来处理小程序 Page 配置项中的 components 配置的，将 components 的值最终转化为页面 json 文件中的 usingComponents 的配置项，不对 npm 包做处理
 * Page 中的 components 配置项的值中使用放在 components 中的自定义组件的时候，可以用 &(相对路径) 或者 ~(绝对路径) 来替代真实路径，构架工具会自动替换为真实路径
 * 使用 npm 包组件的时候，直接配置包名即可，工具不会对其做特殊处理的
 * @param {*} components
 * @param {*} modName
 * @param {*} modPath
 * @param {*} pwd 页面所在目录
 * @param {*} root
 * @returns
 */
function toComponent(components, modName, modPath, pwd, root) {
    let componentPath
    // 相对 subPage 模块
    if (modPath.startsWith('&')) {
        modPath = modPath.replace('&', '')
        // 获取 components 相对路径
        const componentsPath = getSiblingPath(pwd, 'components', root)
        if (!componentsPath) {
            components[modName] = null
            delete components[modName]
            log.warn(`cannot find components in ${pwd}`)
            return
        }
        // 获取 components 目录在项目中的相对路径
        componentPath = resolvePath(path.relative(pwd, componentsPath))
        // 获取 subPackage 内部 component
    } else if (modPath.startsWith('~')) {
        // 绝对路径
        modPath = modPath.replace('~', '')
        componentPath = '/components'
    }

    if (componentPath) {
        // 取 basename 的原因：存在这样的组件：~cards/card-lottery，确实是要取 / 分割的最后一个路径名
        const componentName = path.basename(modPath)
        // 首页的 path.dirname(modPath) 反正都是 . ，其它有 cards/card-order 的待验证
        if (path.dirname(modPath) !== '.') {
            componentPath = `${componentPath}/${path.dirname(modPath)}`
        }

        // 拼接成了 E:xxx/components/coupon-info/coupon-info 这样
        components[modName] = `${componentPath}/${componentName}/${componentName}`
        // console.log('component ' + modName + ': ' + components[modName]);
    } else {
        // 走 @smartbreeze 的 npm 包的，进来了这里
        components[modName] = modPath
    }
}

/**
 * 根据组件公共目录和组件目录来获取组件 js 的名字
 * @param {*} root 项目根目录
 * @param {*} componentPath 统一存放组件的公共目录，如：components 目录
 * @param {*} componentName 组件文件夹
 */
function getComponentFileName(root, componentPath, componentName) {
    const files = fs.readdirSync(path.join(root, `${componentPath}/${componentName}`))
    let filename = ''
    for (const file of files) {
        // 仅获得以 .js 结尾的文件的名字
        if (file.endsWith('.js')) {
            filename = file.replace('.js', '')
        }
    }
    // console.log(`filename: ${filename}`);
    return `${componentPath}/${componentName}/${filename}`
}

exports.getComponentFileName = getComponentFileName

exports.toComponent = toComponent

function resolveComponent(content, file, config = {}) {
    const pageConfig = {
        usingComponents: {}
    }
    // config.commonPageConfig  小程序插件有默认的，小程序本身没有默认的
    if (config.commonPageConfig) {
        merge(pageConfig, config.commonPageConfig)
        if (config.commonPageConfig.usingComponents) {
            const {usingComponents} = config.commonPageConfig
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
    content = content.replace(/@component\(['"](.*)['"]\)[;]?/g, (input, mod) => {
        toComponent(pageConfig.usingComponents, mod, mod, file.dirname)
        return ''
    })

    // 替换 components 声明组件（eslint）
    // components: {
    // shortcut: '~shortcut', 顶层 components
    // 'card-myposter-user': '&cards/card-myposter-user', 当前 subPage components
    // "list": "@xbreeze/micro-list" node_modules | default
    // }

    // 小程序构建之后，pageConfig 里面只有 usingComponents 的配置
    // 插件构建之后，pageConfig 里面有 navigationStyle 配置。。。，貌似还是在 genIdentifierComponents 里面被加上的

    // 页面中的 components 配置在这里，通过 babel 转换为 ast，然后被提取出来成为了 useComponents
    content = genIdentifierComponents(content, file.dirname, pageConfig, config.root)
    // 获取 json 文件的路径名
    let jsonFile = file.path.replace(file.extname, '.json')
    const platformJsonFile = `${file.path.replace(file.extname, '')}.${config.platform}.json`

    if (config.enableEnvsResolve && fs.existsSync(platformJsonFile)) {
        jsonFile = platformJsonFile
    }
    // 页面 js 中的 components 配置 json 要和页面 json 中的配置合并
    if (fs.existsSync(jsonFile)) {
        // 自身存在json 文件的目录，建议是和默认配置合并，而不是直接覆盖，当前小程序插件就存在这样的问题
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

    // json 文件的配置应该能覆盖全局的配置，而不是全局的怎么都覆盖 json 文件的  { "navigationStyle": "default" },
    return {
        content,
        componentJson: JSON.stringify(merge({navigationStyle: 'default'}, jsonFile, pageConfig), null, 4)
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
    // @babel/traverse 用于遍历 @babel/parse 生成的 ast
    traverse(ast, {
        enter(path) {
            // components 的类型在 babel 中被定义为 identifier
            if ((isIdentifier(path.node) && path.node.name === 'components') || (isStringLiteral(path.node) && path.node.value === 'components')) {
                const parentNode = path.parent
                const {value} = parentNode
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
                const {value} = path.parent
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
    const stream = through2.obj(function (file, enc, callback) {
        this.push(file)
        return callback()
    })
    stream.write(file)
    stream.end()
    return stream
}

exports.createStreamFromFile = createStreamFromFile

/**
 * 取出项目根目录中配置的 plugins, subPackages 相关信息 ，合并到 app.json 中，以后切换 .env 或者切换分支，不需要再去更改插件 appid，如果要更改插件 appid 或者版本，去对应环境的配置文件中更改就好，不会对其它环境造成污染
 * 解决了随意改动版本和 appid 带来的发布错乱问题
 * @param {*} param0
 * @param {*} appConf
 */
exports.genPlugins = function ({plugins, subPackages}, appConf = {}) {
    // 主包的 plugins 配置合并(已验证)
    appConf.plugins = Object.assign(appConf.plugins, plugins)
    const appPks = appConf.subPackages
    // 分包的相关 plugins 配置合并(已验证)
    if (appPks && appPks.length && subPackages) {
        appPks.forEach(ele => {
            const conf = subPackages[ele.root]
            // 也可配置分包插件的其它配置，然后一起合并
            if (conf) {
                Object.assign(ele, conf)
            }
        })
    }

    if (plugins) {
        appConf.plugins = appConf.plugins || []
        Object.assign(appConf.plugins, plugins)
    }
}

/**
 * 根据项目配置来产出 project.config.json
 * @param {*} config
 */
exports.genarateProjectConfJson = function (config) {
    // console.log('genarateProjectConfJson:');
    // console.log(config);
    const {root, publicPath, projectPath, cmdArgv, appConfig, env, platform, packageJson} = config
    const targetPath = path.resolve(root, publicPath, projectPath)
    const fileName = CONF_FILENAME_MAP[platform]
    // 项目根目录有 project.config.json 的话，优先读取项目根目录，如果项目根目录下没有，就从工具内部的模板读取
    const templatePath = path.join(root, fileName)
    let projectConfJSON
    if (fs.existsSync(templatePath)) {
        projectConfJSON = fs.readFileSync(templatePath).toString('utf-8')
        projectConfJSON = JSON.parse(projectConfJSON)
    } else {
        projectConfJSON = require(`../templates/${platform}.conf.js`).project;

    }
    // pluginRoot 和 miniprogramRoot 是不变化的
    const isPlugin = cmdArgv.plugin
    if (isPlugin) {
        config.miniprogramRoot = PLUGIN_MINIPROGRAM_ROOT
        config.pluginRoot = PLUGIN_ROOT
        projectConfJSON.miniprogramRoot = PLUGIN_MINIPROGRAM_ROOT
        projectConfJSON.pluginRoot = PLUGIN_ROOT
    }
    // 目前仅 微信 平台的开发需要 appId
    if (platform == 'wechat') {
        projectConfJSON.appid = appConfig.appId
        let projectname = packageJson.title
        // 名称中没有包含插件 2 字，自动添加 plugin 标志
        if (isPlugin) {
            if (projectname) {
                if (projectname && projectname.indexOf('插件') == -1) projectname += '-plugin'
            } else console.log('请在项目根目录的 package.json 中添加 title 属性来配置项目名')
        }

        projectConfJSON.projectname = `${projectname}-${env}`
    }

    projectConfJSON.compileType = isPlugin ? 'plugin' : 'miniprogram'
    projectConfJSON = JSON.stringify(projectConfJSON, null, 4)
    // 插件需要设置  miniprogramRoot 和 pluginRoot，如果没有对应的目录，就顺便生成
    if (!fs.existsSync(targetPath)) {
        mkdirp.sync(targetPath)
    }
    console.log(path.join(targetPath, fileName))
    fs.writeFileSync(path.join(targetPath, fileName), projectConfJSON)
}

exports.isHTTP = function (str) {
    if (!str) return false
    return /^(https?:)?\/\//.test(String(str))
}
exports.isBase64 = function (str) {
    if (!str) return false
    return /^data:image\/([^;]+);base64,/.test(str)
}

function reRequire(module_path) {
    const mod_path = require.resolve(module_path)
    let module = require.cache[mod_path]
    if (module && module.parent) {
        module.parent.children.splice(module.parent.children.indexOf(module), 1)
    }
    module = require.cache[mod_path] = undefined
    return require(mod_path)
}

exports.reRequire = reRequire

const toHash = function (content, len) {
    const hash = crypto.createHash('sha1')
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
        const svgo = new SVGO()
        return svgo.optimize(content).then(re => encodeSvg(re.data))
    }
    return Promise.resolve(encodeSvg(content))
}

exports.normalizeUrl = function (url) {
    return url.split(path.sep).join('/')
}

class Cache {
    constructor(conf) {
        this.key = `__FILE_CACHE_${conf.namespace}`
        // @ .ovestack 暂时换成了 .aixy，备注下
        this.cachePath = path.resolve(process.cwd(), `node_modules/.aixy/${this.key}`)
        if (fs.existsSync(this.cachePath)) {
            shelljs.rm('-r', this.cachePath)
        }
        shelljs.mkdir('-p', this.cachePath)
    }

    get(filename) {
        const hash = toHash(filename)
        const cachePath = path.join(this.cachePath, hash)
        if (fs.existsSync(cachePath)) {
            return fs.readFileSync(cachePath)
        }
    }

    set(filename, cache) {
        const hash = toHash(filename)
        fs.writeFileSync(path.join(this.cachePath, hash), cache)
        return cache
    }
}

exports.Cache = Cache

const logger = {
    log(...args) {
        return log.apply(
            null,
            args.map(text => colors.green(text))
        )
    },
    error(...args) {
        return log.apply(
            null,
            args.map(text => colors.red(text))
        )
    },
    warn(...args) {
        return log.apply(
            null,
            args.map(text => colors.yellow(text))
        )
    }
}

exports.logger = logger

function toRenderConsts(consts) {
    const re = {}
    Object.keys(consts).forEach(key => {
        const val = consts[key]
        if (key.indexOf('.')) {
            key = key.split('.')
            let index = 0
            let pre = re
            while (index < key.length - 1) {
                const newKey = key.slice(index, ++index)
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
// webpack 中 definePlugin 的功能就是如此，替换 js 和 tpl 文件中使用的常量
exports.definePlugin = function (
    consts,
    conf = {
        exclude: []
    }
) {
    const constsKeys = Object.keys(consts)
    return through2.obj((file, enc, callback) => {
        if (file.isBuffer() && /\.(js|tpl)$/.test(file.extname) && constsKeys && constsKeys.length && !anymatch(conf.exclude, file.path)) {
            try {
                let content = file.contents.toString()
                switch (file.extname) {
                    case '.js':
                        // 值替换
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
    return through2.obj((file, enc, callback) => {
        if (file.isBuffer() && file.extname === '.js') {
            try {
                let content = file.contents.toString()
                switch (config.platform) {
                    case 'alipay':
                        // wx. 替换为 my.
                        content = content.replace(new RegExp('\\bwx.\\b', 'gm'), 'my.')
                        break
                    case 'tt':
                        // wx. 替换为 tt.
                        content = content.replace(new RegExp('\\bwx.\\b', 'gm'), 'tt.')
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

const camelize = function (prop) {
    return prop.replace(/^([a-z])/gi, (all, letter) => letter.toUpperCase())
}

exports.camelize = camelize

var adapterHtml = function (tree, platform) {
    tree.forEach(item => {
        if (item.type === 'tag') {
            switch (platform) {
                case 'alipay':
                    // 支付宝统一为 wxs 方式导入 js
                    if (item.name === 'wxs') {
                        item.name = 'import-sjs'
                        if (item.attribs) {
                            item.attribs.name = item.attribs.module || ''
                            item.attribs.from = item.attribs.src || ''
                            if (item.attribs.from) {
                                item.attribs.from = item.attribs.from.replace(/\.wxs/, '.sjs')
                            }
                            delete item.attribs.module
                            delete item.attribs.src
                        }
                    }
                    break
                case 'tt':
                    if (item.name === 'wxs') {
                        item.name = 'sjs'
                        if (item.attribs) {
                            if (item.attribs.src) {
                                item.attribs.src = item.attribs.src.replace(/\.wxs/, '.sjs')
                            }
                        }
                    }
                    break
            }
            // import-sjs wxs
            Object.keys(item.attribs).forEach(attr => {
                const value = item.attribs[attr]
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
    return through2.obj((file, enc, callback) => {
        if (file.isBuffer() && file.extname === '.tpl') {
            try {
                let content = file.contents.toString()
                switch (config.platform) {
                    case 'alipay':
                    case 'tt':
                        // 用于编辑 XML/HTML/RSS，产生流，为什么要这么做呢？
                        var tree = htmlparser2.parseDOM(content, {
                            xmlMode: true,
                            decodeEntities: true
                        })
                        content = htmlparser2.DomUtils.getOuterHTML(adapterHtml(tree, config.platform), {
                            xmlMode: true,
                            decodeEntities: false
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
    return through2.obj((file, enc, callback) => {
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
                                    const _sourcePath = path.join(
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
                                        const platformSource = `${sourcePath}.${conf.platform}`
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
