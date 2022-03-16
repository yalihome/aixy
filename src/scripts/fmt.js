const lintStaged = require('lint-staged');
const Config = require('../config');
const {logger, isFunction} = require('../utils');

if (isFunction(Config.resolveArgs)) {
    const args = Config.resolveArgs('fmt') || {};
    lintStaged(args)
        .then(success => {
            if (success) {
                logger.log('Fmt successful!');
            } else {
                return Promise.reject(new Error('Fmt failed!'));
            }
        })
        .catch(e => {
            logger.error(e);
            process.exit(1);
        });
}
