const path = require('path')
const fs = require('fs')
const template = require('@babel/template').default

const DEF_OPTION = {
    ext: /(less|stylus|css|scss)/
}
module.exports = function ({types}) {
    const buildImport = template(`
        import 'STYLEFILE';
    `)
    return {
        visitor: {
            Program(root, {opts, filename}) {
                var conf = Object.assign({}, DEF_OPTION, opts)
                if (!conf.enable) return
                let requiredFiles = fs.readdirSync(path.dirname(filename)).filter(file => {
                    return path.parse(file).name === path.parse(filename).name && conf.ext.test(path.extname(file))
                })
                if (requiredFiles.length) {
                    requiredFiles.forEach(file => {
                        root.unshiftContainer(
                            'body',
                            buildImport({
                                STYLEFILE: types.stringLiteral(`./${file}`)
                            })
                        )
                    })
                }
            }
        }
    }
}
