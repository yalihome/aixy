const path = require('path');
const {Buffer} = require('buffer');
const fs = require('fs');
const {Compilation} = require('webpack');

let swContent = fs.readFileSync(require.resolve('./sw.js')).toString();
class SWWebpackPlugin {
    constructor(options) {
        this.options = options;
    }

    apply(compiler) {
        // 指定要附加到的事件钩子函数
        compiler.hooks.thisCompilation.tap('SWWebpackPlugin', compilation => {
            compilation.hooks.processAssets.tap(
                {
                    name: 'SWWebpackPlugin',
                    stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
                },
                assets => {
                    const chunkOnlyConfig = {
                        assets: false,
                        cached: false,
                        children: false,
                        chunks: true,
                        chunkModules: false,
                        chunkOrigins: false,
                        errorDetails: false,
                        hash: true,
                        modules: false,
                        reasons: false,
                        source: false,
                        timings: false,
                        version: false,
                    };
                    this.stats = compilation.getStats().toJson(chunkOnlyConfig);
                    swContent = this.makeAssets(swContent);
                    assets[`${this.options.assertPath}/${this.options.filename}`] = {
                        source() {
                            return swContent;
                        },
                        size() {
                            return Buffer.byteLength(this.source(), 'utf8');
                        },
                    };
                }
            );
        });
    }

    makeAssets(content) {
        const urlPrefix = this.options.urlPrefix || '';
        const __CACHE_FILES__ = this.stats.chunks
            .map(chunk => chunk.files)
            .reduce((a, b) => a.concat(b))
            .map(file => {
                if (urlPrefix) {
                    file = path.join(urlPrefix, file);
                }
                return file;
            });
        content = content.replace('__CACHE_NAME__', this.stats.hash);
        content = content.replace('__CACHE_FILES__', JSON.stringify(__CACHE_FILES__));
        return content;
    }
}

module.exports = SWWebpackPlugin;
