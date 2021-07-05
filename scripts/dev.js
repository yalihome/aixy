const Config = require('../config')
const config = Config.config
const webpack = require('webpack')
const connect = require('connect')
const serveStatic = require('serve-static')
const webpackMiddleware = require('webpack-dev-middleware')
const hotMiddleware = require('webpack-hot-middleware')
const nodemon = require('nodemon')
const webpackConfFile = resolvePath('profile', config.profile, 'webpack.dev.conf')
const utils = requireMod('utils')
const ENV = 'development'
const {logger} = require('../utils')

Config.trigger('onInit', ENV)

// @TODO: DLL
if (config.enableDll) {
    const dllConf = require(resolvePath('profile', config.profile, 'webpack.dll.conf'))
    let compiler = webpack(dllConf)
    compiler.run(err => {
        if (!err) {
            devServe()
        }
    })
} else {
    devServe()
}

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
        Config.trigger('onConfig', webpackConf, ENV)
        var compiler = webpack(webpackConf)
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