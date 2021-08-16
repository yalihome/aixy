const path = require('path')
const fs = require('fs')
const net = require('net')
const os = require('os')
const child_process = require('child_process')
const tar = require('tar')
const colors = require('ansi-colors')
const ejs = require('ejs')
const shelljs = require('shelljs')

function isType(type) {
    return function (el) {
        return Object.prototype.toString.call(el) === '[object ' + type + ']'
    }
}
var isArray = isType('Array')
exports.isArray = isArray
var isObject = isType('Object')
exports.isObject = isObject
var isFunction = isType('Function')
exports.isFunction = isFunction
var isString = isType('String')
exports.isString = isString
var isNumber = isType('Number')
exports.isNumber = isNumber
var isBoolean = isType('Boolean')
exports.isBoolean = isBoolean

var walk = function (dir, reg, cb) {
    var files = fs.readdirSync(dir)
    for (var i = 0, l = files.length; i < l; i++) {
        let file = files[i]
        let truePath = path.join(dir, file)
        let stat = fs.statSync(truePath)
        if (stat.isDirectory()) {
            walk(truePath, reg, cb)
        } else {
            if (reg.test(truePath)) {
                cb(truePath)
            }
        }
    }
}

exports.walk = walk

var readDir = function (dir, cb) {
    var parentPath = path.dirname(dir)
    var files = fs.readdirSync(dir)
    for (var i = 0, l = files.length; i < l; i++) {
        let filename = files[i]
        let fullPath = path.join(dir, filename)
        let stat = fs.statSync(fullPath)
        cb({
            filename,
            fullPath,
            stat
        })
        if (stat.isDirectory()) {
            readDir(fullPath, cb)
        }
    }
}

exports.readDir = readDir

exports.getIp = function () {
    var interfaces = os.networkInterfaces()
    for (let devName in interfaces) {
        let iface = interfaces[devName]
        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i]
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address
            }
        }
    }
    return 'localhost'
}

exports.getPort = function () {
    var srv = net.createServer(function (sock) {
        sock.end('Hello world\n')
    })
    return new Promise((resolve, reject) => {
        srv.listen(0, function () {
            resolve(srv.address().port)
            srv.close()
        })
    })
}

exports.getProjectConf = function () {
    var OverrideConfig = path.resolve(process.cwd(), 'override.config.js')
    if (!fs.existsSync(OverrideConfig)) {
        logger.error('config file [override.config.js] not exists')
        process.exit(-1)
    } else {
        OverrideConfig = require(OverrideConfig)
    }
    return OverrideConfig
}

exports.spawn = function (...args) {
    child_process
        .spawn(...args, {
            env: process.env,
            stdio: 'inherit'
        })
        .on('exit', code => {
            process.exit(code)
        })
}

exports.setNodePath = function () {
    const projectPath = path.resolve(process.cwd(), 'node_modules')
    const localPath = path.resolve(__dirname, '../node_modules')
    const root = child_process.execSync('npm root -g').toString().trim()
    const sep = process.platform === 'win32' ? ';' : ':'
    process.env.NODE_PATH = (process.env.NODE_PATH || '') + [projectPath, localPath, root].join(sep)
}

exports.resolveArgsFromProfile = function (config, cmd) {
    try {
        var configFile = require(require.resolve(`../profile/${config.profile}/config`))
        return configFile.resolveArgs(cmd, config)
    } catch (err) {
        logger.error('profile not exists')
        return
    }
}

exports.tar = function (src, dest, conf = {}) {
    return tar.c(
        {
            file: dest,
            ...conf
        },
        [src]
    )
}

var logger = {
    log(...args) {
        return console.log.apply(
            console,
            args.map(text => {
                return colors.green(text)
            })
        )
    },
    error(...args) {
        return console.log.apply(
            console,
            args.map(text => {
                return colors.red(`❌ ${text}`)
            })
        )
    },
    warn(...args) {
        return console.log.apply(
            console,
            args.map(text => {
                return colors.yellow(`⚠️ ${text}`)
            })
        )
    }
}

exports.logger = logger

// sources 都是如何被转换为 数组的;——target 之后的无论多少个参数，最终都转换为数组
var merge = function (target, ...sources) {
    if (!sources.length) return target
    const source = sources.shift()
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, {[key]: {}})
                merge(target[key], source[key])
            } else if (isArray(source[key]) && isArray(target[key])) {
                target[key] = target[key].concat(source[key])
            } else {
                Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key))
            }
        }
    }
    return merge(target, ...sources)
}

exports.merge = merge

var generate = function (src, dest = process.cwd(), meta = {}, cb) {
    readDir(src, function ({fullPath, filename, relatePath, stat}) {
        let destPath = path.join(dest, path.relative(src, fullPath))
        destPath = destPath.replace(/\$(\w+)/g, function (label, key) {
            return meta[key] || label
        })
        if (fs.existsSync(destPath)) {
            return logger.error(`path [${destPath}] exists`)
        }
        if (stat.isDirectory()) {
            shelljs.mkdir('-p', destPath)
        } else {
            shelljs.mkdir('-p', path.dirname(destPath))
            fs.writeFileSync(
                destPath,
                ejs.render(fs.readFileSync(fullPath).toString('utf-8'), meta, {
                    delimiter: '$'
                })
            )
        }
        cb && cb(destPath)
    })
}

exports.generate = generate
