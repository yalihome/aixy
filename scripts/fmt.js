const Config = require('../config')
const {logger, isFunction} = require('../utils')
const lintStaged = require('lint-staged')

if (isFunction(Config.resolveArgs)) {
    let args = Config.resolveArgs('fmt') || {}
    lintStaged(args)
        .then(success => {
            if (success) {
                logger.log('Fmt successful!')
            } else {
                return Promise.reject('Fmt failed!')
            }
        })
        .catch(e => {
            logger.error(e)
            process.exit(1)
        })
}
