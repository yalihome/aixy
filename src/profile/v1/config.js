const shelljs = require('shelljs');
const path = require('path');

const utils = requireMod('utils');
const WebpackBaseConfig = require('../@base/default/config');

//RES_USEHASH
const {CDN_DOMAIN} = process.env;
function pwdPath(filePath) {
    return path.join(process.cwd(), filePath);
}

function syncServer() {
    shelljs.mkdir('-p', pwdPath('server/conf/@conf'));
    shelljs.cp('-r', `${pwdPath('@server/conf/*')}`, pwdPath('server/conf/@conf'));
    shelljs.cp('-r', pwdPath('@server/custom'), pwdPath('@server/route'), pwdPath('server/'));
}

exports.profile = 'v1';

process.env.BROWSERSLIST = '> 1%, last 4 versions, last 4 iOS major versions';

exports.init = function (Config) {
    class ProfileConfig extends WebpackBaseConfig(Config) {
        constructor() {
            super();
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
                    useBuildInServer: true,
                },
                pwa: false,
                hmrPath: `http://${utils.getIp()}:{port}/__webpack_hmr`,
            });
            if (CDN_DOMAIN) {
                this.config.urlPrefix = `${CDN_DOMAIN}${this.config.urlPrefix}`;
            }
        }

        onInit() {
            shelljs.mkdir('-p', resolveApp('./server/private/log'));
            syncServer();
        }

        onRestart() {
            syncServer();
        }
    }
    return ProfileConfig;
};
