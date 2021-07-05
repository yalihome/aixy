module.exports = function(content) {
    content = content.replace(/__inline/g, 'require')
    content = content.replace(/__uri/g, 'require')
    return content
}