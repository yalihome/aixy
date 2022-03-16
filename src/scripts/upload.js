const Config = require('../config');

const {config} = Config;
const path = require('path');
const ci = require('miniprogram-ci');
const fs = require('fs');
const {isFunction, logger} = require('../utils');

const {versionDesc} = require(path.resolve(process.cwd(), 'package.json'));
let args = {
    projectConf: {},
    execConf: {},
};
if (isFunction(Config.resolveArgs)) {
    args = Config.resolveArgs('upload') || {};
}

let project = '';
switch (config.profile) {
    case 'microapp':
        var projectConf = {
            appid: config.appConfig.appId,
            type: 'miniProgram',
            projectPath: path.resolve(config.publicPath, config.projectPath),
            privateKeyPath: path.join(process.cwd(), 'private.key'),
            ignores: ['node_modules/**/*'],
            ...args.projectConf,
        };
        if (!fs.existsSync(projectConf.privateKeyPath)) {
            throw new Error('privateKey not exists');
            // return logger.error('privateKey not exists');
        }
        if (!fs.existsSync(path.join(projectConf.projectPath, 'project.config.json'))) {
            const projectConfJSON = fs.readFileSync(resolvePath('profile', config.profile, 'project.config.json')).toString('utf-8');
            projectConfJSON.replace('${appid}', config.appConfig.appId).replace('${projectname}', config.appConfig.name);
            fs.writeFileSync(path.join(projectConf.projectPath, 'project.config.json'), projectConfJSON);
        }
        project = new ci.Project(projectConf);
        (async () => {
            logger.log('📦 [npm] npm packing');
            await ci.packNpm(project, {
                ignores: [],
                reporter: infos => {
                    logger.log(`📦 [npm] npm packed in ${infos.pack_time}ms`);
                },
                ...args.execConf,
            });
            switch (config.cmdArgv.type) {
                case 'preview':
                    logger.log('⌛ [preview] task start');
                    await ci.preview({
                        project,
                        desc: 'generate by aixy', // 此备注将显示在“小程序助手”开发版列表中
                        setting: {
                            es7: true,
                        },
                        qrcodeFormat: 'terminal',
                        onProgressUpdate: e => {
                            if (e._status && e._status === 'done') {
                                logger.log(`file processed: ${e._msg}`);
                            }
                        },
                        ...args.execConf,
                    });
                    break;
                default:
                    logger.log('⌛ [upload] task start');
                    await ci.upload({
                        project,
                        version: config.version,
                        desc: versionDesc || 'generate by aixy',
                        setting: {
                            es7: true,
                        },
                        onProgressUpdate: e => {
                            if (e._status && e._status === 'done') {
                                logger.log(`file processed: ${e._msg}`);
                            }
                        },
                        ...args.execConf,
                    });
                    break;
            }
        })().catch(err => {
            logger.error(err);
        });
        break;
}
