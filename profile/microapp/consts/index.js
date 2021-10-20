const PLUGIN_MINIPROGRAM_ROOT = 'miniprogram/';
const PLUGIN_ROOT = 'plugin/';
const CONF_FILENAME_MAP = {
    wechat: 'project.config.json',
    alipay: 'mini.project.json'
};

const MAPPER = {
    dev: 'config.dev.js',
    sandbox: 'config.sandbox.js',
    prod: 'config.js'
}
const ENV_MAPPER = {
    development: 'dev',
    sandbox: 'sandbox',
    production: 'prod'
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

module.exports = {
    PLUGIN_MINIPROGRAM_ROOT,
    PLUGIN_ROOT,
    CONF_FILENAME_MAP,
    MAPPER,
    ENV_MAPPER,
    TYPE_MAPPER
};