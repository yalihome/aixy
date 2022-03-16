module.exports = {
    project: {
        description: '项目配置文件',
        setting: {
            urlCheck: false,
            es6: true,
            enhance: false,
            postcss: true,
            preloadBackgroundData: false,
            minified: true,
            newFeature: false,
            coverView: true,
            nodeModules: false,
            autoAudits: false,
            showShadowRootInWxmlPanel: true,
            scopeDataCheck: false,
            uglifyFileName: false,
            checkInvalidKey: true,
            checkSiteMap: true,
            uploadWithSourceMap: true,
            compileHotReLoad: false,
            useMultiFrameRuntime: false,
            useApiHook: true,
            babelSetting: {
                ignore: [],
                disablePlugins: [],
                outputPath: ''
            },
            useIsolateContext: true,
            useCompilerModule: true,
            userConfirmedUseCompilerModuleSwitch: false,
            packNpmManually: false,
            packNpmRelationList: []
        },
        compileType: 'miniprogram',
        appid: '${appid}',
        projectname: '${projectname}',
        simulatorType: 'wechat'
    }
}
