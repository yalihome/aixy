const path = require('path')
const BasicEffectRulePlugin = require('webpack/lib/rules/BasicEffectRulePlugin')
const BasicMatcherRulePlugin = require('webpack/lib/rules/BasicMatcherRulePlugin')
const DescriptionDataMatcherRulePlugin = require('webpack/lib/rules/DescriptionDataMatcherRulePlugin')
const RuleSetCompiler = require('webpack/lib/rules/RuleSetCompiler')
const UseEffectRulePlugin = require('webpack/lib/rules/UseEffectRulePlugin')

const ruleSetCompiler = new RuleSetCompiler([
    new BasicMatcherRulePlugin('test', 'resource'),
    new BasicMatcherRulePlugin('mimetype'),
    new BasicMatcherRulePlugin('dependency'),
    new BasicMatcherRulePlugin('include', 'resource'),
    new BasicMatcherRulePlugin('exclude', 'resource', true),
    new BasicMatcherRulePlugin('conditions'),
    new BasicMatcherRulePlugin('resource'),
    new BasicMatcherRulePlugin('resourceQuery'),
    new BasicMatcherRulePlugin('resourceFragment'),
    new BasicMatcherRulePlugin('realResource'),
    new BasicMatcherRulePlugin('issuer'),
    new BasicMatcherRulePlugin('compiler'),
    new DescriptionDataMatcherRulePlugin(),
    new BasicEffectRulePlugin('type'),
    new BasicEffectRulePlugin('sideEffects'),
    new BasicEffectRulePlugin('parser'),
    new BasicEffectRulePlugin('resolve'),
    new BasicEffectRulePlugin('generator'),
    new UseEffectRulePlugin()
])

module.exports = Config =>
    class WebpackBaseConfig extends Config {
        constructor() {
            super()
            this.setConfig({
                importSameNameStyle: true
            })
        }
        getLoader(rules, match) {
            return rules.filter(rawRule => {
                var rule = Object.assign({}, rawRule)
                delete rule.include
                const ruleSet = ruleSetCompiler.compile([
                    {
                        rules: [rule]
                    }
                ])
                var matchedRule = ruleSet.exec({
                    resource: match
                })
                return matchedRule.length
            })
        }
        resolveArgs(cmd) {
            const {name, version} = this.config.packageJson
            switch (cmd) {
                case 'pack':
                    let ts = new Date().toISOString().replace(/[^0-9]/g, '')
                    return {
                        src: '',
                        dest: resolveApp(`${[name, `v${version}`, ts].join('-')}.zip`),
                        conf: {
                            C: this.config.publicPath
                        }
                    }
                case 'fmt':
                    return {
                        configPath: path.resolve(__dirname, 'lint-staged.config.js')
                    }
            }
        }
    }
