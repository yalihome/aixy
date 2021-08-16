const {
    generate,
    logger
} = require('../utils')
const path = require('path')
const fs = require('fs')
const argv = require('minimist')(process.argv.slice(3))
if (!argv.t && !argv.type) {
    logger.error('type is not specific')
    process.exit(-1)
}
const type = argv.t || argv.type
const [mod, name] = argv._
var templatePath = path.dirname(require.resolve('aixy-template'))
let template = path.join(templatePath, 'template', type, mod)
if (fs.existsSync(template)) {
    try {
        generate(template, path.join(process.cwd(), name), {
            name,
            ...argv
        }, function(dest) {
            logger.log(`${dest} generated`)
        })
    } catch (err) {
        logger.error(err)
    }
}