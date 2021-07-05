const path = require('path')
const fs = require('fs')
const loaderUtils = require('loader-utils')

var routeMap = {
    _pwd: '',
    _parent: '',
    root: {}
}
var depends = []
var routes = []
var DIR

function removeCircular(obj) {
    for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
            if (i[0] === '_') {
                obj[i] = null
                delete obj[i]
            }
            if (typeof obj[i] === 'object') {
                removeCircular(obj[i])
            }
        }
    }
}

function resolvePath(dir) {
    return dir.split(path.sep).join('/')
}

function getCloseSub(map) {
    var el = map
    while (el) {
        if (el._isSub) {
            return el
        }
        el = el._parent
    }
}

function getComponentName(realPath) {
    return Camelize(
        resolvePath(
            path
                .dirname(realPath)
                .replace(DIR, '')
                .replace(/\/@sub/g, '')
                .replace(/[\$\?\:]/g, '')
        )
    )
}

function getComponentFile(realPath) {
    return resolvePath(realPath.replace(DIR, ''))
}

function Camelize(prop) {
    if (prop.indexOf('/') === 0) {
        prop = prop.slice(1)
    }
    return prop.replace(/\/([a-z])/gi, function (all, letter) {
        return letter.toUpperCase()
    })
}

function handleMatchPath(basename) {
    if (basename.endsWith('$')) {
        basename = basename.substr(0, basename.length - 1) + '?'
    }
    basename = basename.replace(/\$/g, ':')
    return basename
}

function genRouterMap(dir, map, parent) {
    var fss = fs.readdirSync(dir)
    map._parent = parent
    map._pwd = resolvePath(dir).replace(DIR, '')
    fss.forEach(function (f) {
        var basename = path.basename(f),
            realPath = path.resolve(dir, f)
        if (basename[0] === '_') return
        var stat = fs.statSync(realPath)
        if (stat.isDirectory()) {
            let subDescribe = false
            try {
                fs.accessSync(path.join(realPath, '.sub'))
                subDescribe = true
            } catch (err) {}
            basename = resolvePath(basename)
            if (subDescribe) {
                map._isSub = true
                map.subRoutes = map.subRoutes || {
                    _parent: map
                }
                basename = handleMatchPath('/' + basename)
                map.subRoutes[basename] = {}
                genRouterMap(realPath, map.subRoutes[basename], map.subRoutes)
            } else {
                basename = handleMatchPath(resolvePath(map._pwd + '/' + basename))
                routeMap[basename] = {}
                genRouterMap(realPath, routeMap[basename], routeMap)
            }
        } else {
            var extname = path.extname(realPath)
            if (!/\.(js|jsx|ts|tsx)$/.test(extname)) return
            basename = path.basename(realPath).replace(extname, '')
            if (basename === 'index') {
                realPath = resolvePath(realPath)
                map.file = getComponentFile(realPath)
                map.name = getComponentName(realPath)
                depends.push({
                    name: map.name,
                    file: map.file
                })
            } else {
                let parentSubNode = getCloseSub(map)
                if (parentSubNode) {
                    basename = (map._pwd + '/' + basename).replace(parentSubNode._pwd, '')
                } else {
                    basename = resolvePath(map._pwd + '/' + basename)
                }
                basename = handleMatchPath(basename)
                realPath = resolvePath(realPath)
                parent[basename] = {
                    file: getComponentFile(realPath),
                    name: Camelize(basename.replace(/[\$\?\:]/g, ''))
                }
                parentSubNode = null
            }
        }
    })
    return map
}

var buildMap = function (rules, routes, isSub) {
    for (var i in rules) {
        if (rules.hasOwnProperty(i)) {
            var rule = rules[i]
            var ret = {
                path: isSub ? i.replace('/', '') : i,
                name: rule.name,
                file: rule.file
            }
            // ret.component = `%${rule.name || 'App'}%`
            if (rule.subRoutes) {
                ret.routes = []
                buildMap(rule.subRoutes, ret.routes, true)
            }
            routes.push(ret)
        }
    }
}

module.exports = function (content) {
    if (!DIR) {
        const OPTIONS = loaderUtils.getOptions(this)
        DIR = resolvePath(OPTIONS.pagesPath)
        genRouterMap(DIR, routeMap.root, routeMap)
        removeCircular(routeMap)
        var root = routeMap.root
        delete routeMap.root
        root.subRoutes = routeMap
        buildMap(
            {
                '/': root
            },
            routes
        )
        routes = JSON.stringify(routes, null, 4).replace(/"%([^("|%)]*)%"/g, '$1')
        routeMap = JSON.stringify(
            {
                '/': root
            },
            null,
            4
        )
        root = null
    }
    this.cacheable()
    content = content.replace('__ROUTER_MAP__', routeMap)
    content = content.replace('__DEPEND__', depends)
    content = content.replace('__ROUTE_CONF__', routes)
    return content
}
