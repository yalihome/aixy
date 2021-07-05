const {Compilation} = require('webpack')
const DEF_CONF = {
    output: 'stats.json',
    stats: {
        all: false,
        entrypoints: true,
        version: true,
        builtAt: true,
        hash: true,
        timings: true,
        exclude: [/node_modules/]
    }
}
class Stats {
    constructor(options = {}) {
        this.logger = null
        this.output = options.output || DEF_CONF.output
        this.stats = {
            ...(options.stats || {}),
            ...DEF_CONF.stats
        }
    }
    apply(compiler) {
        this.logger = compiler.getInfrastructureLogger('stats-plugin')
        compiler.hooks.thisCompilation.tap('StatsPlugin', compilation => {
            compilation.hooks.processAssets.tap(
                {
                    name: 'StatsPlugin',
                    stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
                },
                assets => {
                    var result
                    assets[this.output] = {
                        size() {
                            return result ? result.length : 0
                        },
                        source: () => {
                            var stats = compilation.getStats().toJson(this.stats)
                            result = JSON.stringify(stats, null, 4)
                            return result
                        }
                    }
                }
            )
        })
    }
}

module.exports = Stats
