const Config = require('../config')
const config = Config.config
const webpack = require('webpack')
const connect = require('connect') //中间件框架
const serveStatic = require('serve-static')
const webpackMiddleware = require('webpack-dev-middleware')
const hotMiddleware = require('webpack-hot-middleware')
const nodemon = require('nodemon')
const webpackConfFile = resolvePath('profile', config.profile, 'webpack.dev.conf')
const utils = requireMod('utils')
const ENV = 'development'
const {logger} = require('../utils')
const {writeFile} = require('fs')
const path = require('path')

//初始化，也就是创建 server/private/log 文件和同步 @server 到 server 目录
Config.trigger('onInit', ENV)

// @TODO: DLL
if (config.enableDll) {
    //启用 dll 的话，就引入 dll 配置，也就是缓存
    const dllConf = require(resolvePath('profile', config.profile, 'webpack.dll.conf'))
    //调用一次 webpack
    let compiler = webpack(dllConf)
    //开始读取 record 之前调用
    compiler.run(err => {
        if (!err) {
            devServe()
        }
    })
} else {
    devServe()
}
// webpack 的 devServer 是怎么和 项目的 node server.js 结合在一起的
function devServe() {
    var devServerConf = config.devServer || {}
    utils.getPort().then(port => {
        port = devServerConf.port || port
        var webpackConf = require(webpackConfFile)
        if (devServerConf.hot) {
            // add hot-reload related code to entry chunks
            // https://github.com/webpack-contrib/webpack-hot-middleware#client
            Object.keys(webpackConf.entry).forEach(function (name) {
                webpackConf.entry[name] = [`webpack-hot-middleware/client?noInfo=true&path=${config.hmrPath.replace('{port}', port)}&reload=true`].concat(webpackConf.entry[name])
            })
        }
        //合并配置到 this.config
        Config.trigger('onConfig', webpackConf, ENV)
        //将这些配置写入文件查看
        writeFile(path.join(process.cwd(), 'test.json'), JSON.stringify(webpackConf), {flag: 'a'}, err => {
            if (!err) {
                console.log('保存配置成功')
            }
        })
        var compiler = webpack(webpackConf)
        // console.log('最终配置：');
        // console.log(webpackConf);

        let wdmLogger = compiler.getInfrastructureLogger('webpack-dev-middleware')
        var app = connect()
        if (devServerConf.hot) {
            // https://github.com/webpack-contrib/webpack-hot-middleware#middleware
            app.use(
                hotMiddleware(compiler, {
                    log: false
                    // heartbeat: 10 * 1000
                })
            )
        }
        var wdmInstance = webpackMiddleware(compiler, {
            publicPath: config.publicPath,
            writeToDisk: true
        })
        app.use(wdmInstance)
        if (devServerConf.middleware) {
            app.use(devServerConf.middleware)
        }
        app.use(
            serveStatic(config.publicPath, {
                etag: false,
                lastModified: false
            })
        )
        app.listen(port, () => {
            logger.log(`<i> [webpack-dev-middleware] listen on ${port}.`)
        })
        wdmInstance.waitUntilValid(stats => {
            if (!stats.hasErrors()) {
                Config.trigger('onDone', stats, ENV)
                //初始化完毕，启动监听
                serve()
            } else {
                Config.trigger('onError', stats, ENV)
            }
        })
        process.on('SIGINT', function () {
            if (wdmInstance) {
                wdmInstance.close()
            }
            process.exit()
        })
    })
}

var inited = false
function serve() {
    if (!config.devServer || !config.devServer.useBuildInServer) return
    if (!inited) {
        inited = true
        nodemon({
            watch: '@server/*',
            script: 'server/server.js'
        })
        nodemon
            .on('start', function () {
                Config.trigger('onStart')
            })
            .on('quit', function () {
                Config.trigger('onExit')
                process.exit()
            })
            .on('restart', function () {
                Config.trigger('onRestart')
            })
    }
}

process
    .on('unhandledRejection', err => {
        logger.error(err.stack)
    })
    .on('uncaughtException', err => {
        logger.error(err.stack)
    })
