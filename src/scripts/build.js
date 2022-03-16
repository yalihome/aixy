const Config = require('../config');

const {config} = Config;
const webpack = require('webpack');

const webpackConfFile = resolvePath('profile', config.profile, 'webpack.prod.conf');
const webpackConfig = require(webpackConfFile);
const ENV = 'production';

Config.trigger('onConfig', webpackConfig, ENV);
Config.trigger('onInit', ENV);

webpack(webpackConfig, (err, stats) => {
    if (err) {
        Config.trigger('onError', err, ENV);
        throw err;
    }
    process.stdout.write(
        stats.toString({
            hash: true,
            version: true,
            timings: true,
            builtAt: true,
            colors: true,
            modules: false,
            children: false,
            chunks: false,
            chunkModules: false,
            assets: false,
            chunkOrigins: false,
        })
    );
    // process.stdout.write(stats.toString())
    Config.trigger('onDone', stats, ENV);
});
