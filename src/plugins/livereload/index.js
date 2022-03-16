const HtmlWebpackPlugin = require('html-webpack-plugin');

/* jshint node:true */
const crypto = require('crypto');
const lr = require('tiny-lr');
const anymatch = require('anymatch');
const {hasOwn} = requireMod('utils');

const servers = {};

function LiveReloadPlugin(options) {
    this.options = options || {};
    this.defaultPort = 35729;
    this.port = typeof this.options.port === 'number' ? this.options.port : this.defaultPort;
    this.ignore = this.options.ignore || null;
    this.quiet = this.options.quiet || false;
    this.useSourceHash = this.options.useSourceHash || false;
    // Random alphanumeric string appended to id to allow multiple instances of live reload
    this.instanceId = crypto.randomBytes(8).toString('hex');

    // add delay, but remove it from options, so it doesn't get passed to tinylr
    this.delay = this.options.delay || 0;
    delete this.options.delay;

    this.lastHash = null;
    this.lastChildHashes = [];
    this.protocol = this.options.protocol ? `${this.options.protocol}:` : '';
    this.hostname = this.options.hostname || '" + location.hostname + "';
    this.server = null;
    this.sourceHashs = {};
}

function arraysEqual(a1, a2) {
    return a1.length == a2.length && a1.every((v, i) => v === a2[i]);
}

function getPort() {
    const srv = require('net').createServer(sock => {
        sock.end('Hello world\n');
    });
    return new Promise((resolve, reject) => {
        srv.listen(0, () => {
            resolve(srv.address().port);
            srv.close();
        });
    });
}

Object.defineProperty(LiveReloadPlugin.prototype, 'isRunning', {
    get() {
        return !!this.server;
    },
});

function generateHashCode(str) {
    const hash = crypto.createHash('sha256');
    hash.update(str);
    return hash.digest('hex');
}

function fileIgnoredOrNotEmitted(data) {
    if (Array.isArray(this.ignore)) {
        return !anymatch(this.ignore, data[0]) && data[1].emitted;
    }
    return !data[0].match(this.ignore) && data[1].emitted;
}

function fileHashDoesntMatches(data) {
    if (!this.useSourceHash) return true;

    const sourceHash = generateHashCode(data[1].source());
    if (hasOwn(this.sourceHashs, data[0]) && this.sourceHashs[data[0]] === sourceHash) {
        return false;
    }

    this.sourceHashs[data[0]] = sourceHash;
    return true;
}

LiveReloadPlugin.prototype.start = function start(watching, cb) {
    const {quiet} = this;
    if (servers[this.port]) {
        this.server = servers[this.port];
        cb();
    } else {
        const listen = function () {
            this.server = servers[this.port] = lr(this.options);

            this.server.errorListener = function serverError(err) {
                this.logger.error(`Live Reload disabled: ${err.message}`);
                if (err.code !== 'EADDRINUSE') {
                    this.logger.error(err.stack);
                }
                cb();
            };

            this.server.listen(this.port, err => {
                if (!err && !quiet) {
                    this.logger.info(`Live Reload listening on port ${this.port}\n`);
                }
                cb();
            });
        }.bind(this);

        if (this.port === 0) {
            getPort().then(port => {
                this.port = port;
                listen();
            });
        } else {
            listen();
        }
    }
};

LiveReloadPlugin.prototype.done = function done(stats) {
    const {hash} = stats.compilation;
    const childHashes = (stats.compilation.children || []).map(child => child.hash);
    // @FIXME: 获取hash发生变化的文件
    const include = Object.keys(stats.compilation.assets)
        .filter(fileIgnoredOrNotEmitted.bind(this))
        .filter(fileHashDoesntMatches.bind(this))
        .map(data => data[0]);
    if (this.isRunning && hash !== this.lastHash) {
        this.lastHash = hash;
        this.lastChildHashes = childHashes;
        setTimeout(() => {
            this.server.notifyClients(['reload']);
        }, this.delay);
    }
};

LiveReloadPlugin.prototype.failed = function failed() {
    this.lastHash = null;
    this.lastChildHashes = [];
};

LiveReloadPlugin.prototype.autoloadJs = function autoloadJs() {
    return [
        '// webpack-livereload-plugin',
        '(function() {',
        '  if (typeof window === "undefined") { return };',
        `  var id = "webpack-livereload-plugin-script-${this.instanceId}";`,
        '  if (document.getElementById(id)) { return; }',
        '  var el = document.createElement("script");',
        '  el.id = id;',
        '  el.async = true;',
        `  el.src = "${this.protocol}//${this.hostname}:${this.port}/livereload.js";`,
        '  document.getElementsByTagName("head")[0].appendChild(el);',
        '}());',
        '',
    ].join('\n');
};

LiveReloadPlugin.prototype.scriptTag = function scriptTag(source) {
    const js = this.autoloadJs();
    if (this.options.appendScriptTag && this.isRunning) {
        return js + source;
    }
    return source;
};

LiveReloadPlugin.prototype.applyCompilation = function applyCompilation(compilation) {
    // compilation.mainTemplate.hooks.startup.tap('LiveReloadPlugin', this.scriptTag.bind(this))

    // processAssets
    HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync('LiveReloadPlugin', (data, cb) => {
        // if (!data.plugin.options.chunks || !data.plugin.options.chunks.length) {
        //     data.html += `<script>${this.autoloadJs()}</script>`
        // }
        if (this.options.appendScriptTag && this.isRunning) {
            data.html += `<script>${this.autoloadJs()}</script>`;
        }
        cb(null, data);
    });
};

LiveReloadPlugin.prototype.apply = function apply(compiler) {
    this.compiler = compiler;
    this.logger = compiler.getInfrastructureLogger('livereload-plugin');
    compiler.hooks.compilation.tap('LiveReloadPlugin', this.applyCompilation.bind(this));
    compiler.hooks.watchRun.tapAsync('LiveReloadPlugin', this.start.bind(this));
    compiler.hooks.done.tap('LiveReloadPlugin', this.done.bind(this));
    compiler.hooks.failed.tap('LiveReloadPlugin', this.failed.bind(this));
};

module.exports = LiveReloadPlugin;
