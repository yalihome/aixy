const path = require('path');
const fs = require('fs');
const loaderUtils = require('loader-utils');
const {hasOwn} = requireMod('utils');

let routeMap = {
    _pwd: '',
    _parent: '',
    root: {},
};

let DIR;

function removeCircular(obj) {
    for (const i in obj) {
        if (hasOwn(obj, i)) {
            if (i[0] === '_') {
                obj[i] = null;
                delete obj[i];
            }
            if (typeof obj[i] === 'object') {
                removeCircular(obj[i]);
            }
        }
    }
}

function resolvePath(dir) {
    return dir.split(path.sep).join('/');
}

function getCloseSub(map) {
    let el = map;
    while (el) {
        if (el._isSub) {
            return el;
        }
        el = el._parent;
    }
}

function getReleativeSubPath(realPath) {
    const index = realPath.lastIndexOf('@sub');
    if (index !== -1) {
        return resolvePath(realPath.slice(index + 4));
    }
}

function getComponentName(realPath) {
    return Camelize(
        resolvePath(
            path
                .dirname(realPath)
                .replace(DIR, '')
                .replace(/\/@sub/g, '')
        )
    );
}

function getComponentFile(realPath) {
    return resolvePath(realPath.replace(DIR, ''));
}

function Camelize(prop) {
    if (prop.indexOf('/') === 0) {
        prop = prop.slice(1);
    }
    return prop.replace(/\/([a-z])/gi, (all, letter) => letter.toUpperCase());
}

function handleMatchPath(basename) {
    if (basename.endsWith('$')) {
        basename = `${basename.substr(0, basename.length - 1)}?`;
    }
    basename = basename.replace(/\$/g, ':');
    return basename;
}

function genRouterMap(dir, map, parent) {
    const fss = fs.readdirSync(dir);
    map._parent = parent;
    map._pwd = resolvePath(dir).replace(DIR, '');
    fss.forEach(f => {
        var basename = path.basename(f);
        let realPath = path.resolve(dir, f);
        if (basename[0] === '_') return;
        const stat = fs.statSync(realPath);
        if (stat.isDirectory()) {
            let subDescribe = false;
            try {
                fs.accessSync(path.join(realPath, '.sub'));
                subDescribe = true;
            } catch (err) {
                console.log(`router.v1 ????????????`);
                console.log(err);
            }
            if (subDescribe) {
                map.subRoutes = map.subRoutes || {};
                map.subRoutes[`/${basename}`] = {};
                genRouterMap(realPath, map.subRoutes[`/${basename}`], map.subRoutes);
            } else if (basename === '@sub') {
                map.subRoutes = {};
                map.subRoutes._isSub = true;
                genRouterMap(realPath, map.subRoutes, map);
            } else {
                const el = getCloseSub(map);
                if (el) {
                    basename = getReleativeSubPath(realPath);
                    el[basename] = {};
                    genRouterMap(realPath, el[basename], el);
                } else {
                    basename = resolvePath(`${map._pwd}/${basename}`);
                    routeMap[basename] = {};
                    genRouterMap(realPath, routeMap[basename], routeMap);
                }
            }
        } else {
            const extname = path.extname(realPath);
            if (extname !== '.js') return;
            basename = path.basename(realPath).replace(extname, '');
            const dirname = path.dirname(realPath).split(path.sep).pop();
            if (basename === dirname.split(path.sep).pop()) {
                realPath = resolvePath(realPath);
                map.file = getComponentFile(realPath);
                map.name = getComponentName(realPath);
            }
        }
    });
    return map;
}

module.exports = function (content) {
    if (!DIR) {
        const OPTIONS = loaderUtils.getOptions(this);
        DIR = resolvePath(OPTIONS.pagesPath);
        genRouterMap(DIR, routeMap.root, routeMap);
        removeCircular(routeMap);
        let {root} = routeMap;
        delete routeMap.root;
        root.subRoutes = routeMap;
        routeMap = JSON.stringify(
            {
                '/': root,
            },
            null,
            4
        );
        root = null;
    }
    this.cacheable();
    content = content.replace('__ROUTE_MAP__', routeMap);
    return content;
};
