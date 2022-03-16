const path = require('path')

module.exports = {
    '**/*.(js|tpl|less|css|json)': function (files) {
        const cmd = path.resolve(path.dirname(require.resolve('prettier')), 'bin-prettier.js')
        const configFile = path.resolve(__dirname, './.prettierrc')
        return files.map(filename => `${cmd} --config ${configFile} --write '${filename}'`)
    }
}
