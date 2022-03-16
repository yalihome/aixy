const path = require('path')
const fs = require('fs')

module.exports = {
    '**/*.(js|ts|tsx|html|less|css|vue)': function (files) {
        const cmd = path.resolve(path.dirname(require.resolve('prettier')), 'bin-prettier.js')
        let configFile = path.resolve(process.cwd(), './.prettierrc')
        if (!fs.existsSync(configFile)) {
            configFile = path.resolve(__dirname, './.prettierrc')
        }
        return files.map(filename => `${cmd} --config ${configFile} --write '${filename}'`)
    }
}
