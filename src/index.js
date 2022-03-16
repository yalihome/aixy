#!/usr/bin/env node
const program = require('commander');
const path = require('path');
const {version, name} = require('../package.json');
const {getProjectConf, spawn, setNodePath, logger} = require('./utils');

setNodePath();

logger.log(`👾 ${name} v${version}`);

program.version(version);
program
    .command('clean')
    .description('clean build path')
    .allowUnknownOption()
    .action(() => {
        spawn('node', [require.resolve('./scripts/clean')].concat(process.argv.slice(2)));
    });
program
    .command('dev')
    .description('run dev mode')
    .allowUnknownOption()
    .option('-d, --dest [dest]', 'specify public path')
    .action(cmdObj => {
        const profile = getProjectConf().profile || 'default';
        let command;
        switch (profile) {
            case 'microapp':
                command = process.platform === 'win32' ? 'gulp.cmd' : 'gulp';
                spawn(
                    path.resolve(__dirname, './node_modules/.bin', command),
                    ['--gulpfile', path.resolve(__dirname, './profile/microapp/gulpfile.js'), '--cwd', process.cwd()].concat(process.argv.slice(3))
                );
                break;
            default:
                process.env.NODE_ENV = 'development';
                // ['E:\gitee\aixy\scripts\dev.js', 'dev']
                // 带命令运行脚本
                spawn('node', [require.resolve('./scripts/dev')].concat(process.argv.slice(2)));
                break;
        }
    });
program.command('plugin [name]', 'require plugin').action(cmdObj => {});
program
    .command('build')
    .description('run build mode')
    .allowUnknownOption()
    .option('-d, --dest [dest]', 'specify public path')
    .action(cmdObj => {
        const profile = getProjectConf().profile || 'default';
        let command;
        switch (profile) {
            case 'microapp':
                command = process.platform === 'win32' ? 'gulp.cmd' : 'gulp';
                spawn(
                    path.resolve(__dirname, './node_modules/.bin', command),
                    ['--gulpfile', path.resolve(__dirname, './profile/microapp/gulpfile.js'), '--cwd', process.cwd()].concat(process.argv.slice(3)).concat('--optimize')
                );
                break;
            default:
                process.env.NODE_ENV = 'production';
                spawn('node', [require.resolve('./scripts/build')].concat(process.argv.slice(2)));
                break;
        }
    });
program
    .command('pack')
    .description('package tar')
    .allowUnknownOption()
    .option('-d, --dest [dest]', 'specify public path')
    .action(cmdObj => {
        spawn('node', [require.resolve('./scripts/pack')].concat(process.argv.slice(2)));
    });
program
    .command('generate')
    .description('generate template')
    .allowUnknownOption()
    .option('-d, --dest [dest]', 'specify public path')
    .action(cmdObj => {
        spawn('node', [require.resolve('./scripts/generate')].concat(process.argv.slice(2)));
    });
program
    .command('fmt')
    .description('code fmt')
    .allowUnknownOption()
    .action(cmdObj => {
        spawn('node', [require.resolve('./scripts/fmt')].concat(process.argv.slice(2)));
    });
program
    .command('upload')
    .description('package upload')
    .allowUnknownOption()
    .action(cmdObj => {
        spawn('node', [require.resolve('./scripts/upload')].concat(process.argv.slice(2)));
    });
program.parse(process.argv);
