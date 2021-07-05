const shelljs = require('shelljs')
const path = require('path')
const utils = requireMod('utils')
const WebpackBaseConfig = require('../@base/default/config')
function pwdPath(filePath) {
    return path.join(process.cwd(), filePath)
}

function syncServer() {
    shelljs.mkdir('-p', pwdPath('server/conf/@conf'))
    shelljs.cp('-r', `${pwdPath('@server/business/*')}`, pwdPath('server/business'))
    shelljs.cp('-r', `${pwdPath('@server/conf/*')}`, pwdPath('server/conf/@conf'))
    shelljs.cp('-r', pwdPath('@server/custom'), pwdPath('@server/filter'), pwdPath('@server/route'), pwdPath('server/'))
}

exports.profile = 'angularjs'

exports.init = function (Config) {
    class ProfileConfig extends WebpackBaseConfig(Config) {
        constructor() {
            super()
            var self = this
            this.setConfig({
                dlls: [],
                entry: resolveApp('./components/boot/boot.js'),
                root: resolveApp('./components'),
                templateFile: resolveApp('./views/index.ejs'),
                componentModulesPath: resolveApp('./component_modules'),
                remUnit: 0,
                viewsPath: resolveApp('./views'),
                devServer: {
                    livereload: true,
                    useBuildInServer: true
                },
                consts: {
                    ...this.config.consts,
                    get ASSERT_PATH() {
                        return JSON.stringify(`${self.config.urlPrefix}${self.config.assertPath}`)
                    }
                },
                hmrPath: `http://${utils.getIp()}:{port}/__webpack_hmr`
            })
        }
        onInit(env) {
            shelljs.mkdir('-p', resolveApp('./server/private/log'))
            syncServer()
        }
        onRestart() {
            syncServer()
        }
    }
    return ProfileConfig
}
