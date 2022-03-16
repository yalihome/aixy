const path = require('path');
const Config = require('../config');
const {tar, isFunction, logger} = require('../utils');

if (isFunction(Config.resolveArgs)) {
    const args = Config.resolveArgs('pack');
    if (args) {
        tar(args.src, args.dest, args.conf).then(() => {
            logger.log(`📦 tar ${path.basename(args.dest)} generated`);
        });
    }
}
