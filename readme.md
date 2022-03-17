### aixy 是什么？

&emsp;&emsp;aixy 是一个小型的的自研的前端多框架、多平台构建工具；目前已支持 angularjs(老旧项目)、Vue1、Vue2、微信小程序/插件、支付宝小程序/插件的构建；目前网页端构建的实现是基于 webpack，小程序端构建的实现基于 gulp；未来如果有更优秀更适合的开源构建工具出现，也是可以继续集成封装在 aixy 内的

### aixy 的优势

&emsp;&emsp;因之前的工作中网页端经历了不同时期的项目的不同构建工具，命令不统一，某些工具还无法接入 npm，导致维护起来特别麻烦，严重影响工作效率，所以我们放弃了之前一直使用的 fis 系列封装的构建工具，转入了使用更易上手、扩展性更好、应用更广泛的 webpack

&emsp;&emsp;而小程序端选择 gulp， 而不是 webpack，主要是小程序的项目源文件和产出文件是一对一的，gulp 的这种流式操作与小程序更加贴合；

&emsp;&emsp;因没有现成的完整的解决方案能解决眼前的问题，故将两者统一封装到 aixy ，统一了命令和规范，再配合组件化服务化，接入 npm，基本上我们每次开发，90% 以上的注意力都集中在了需求的实现上，工作效率得了到很大的提升，新人的上手速度也更快；

### aixy 的一些简单规范

&emsp;&emsp;无论小程序还是网页，aixy 要求页面(pages)和组件(components)目录下的文件默认分为3个同名的 .js、.less、.tpl 文件，网页端的话除开 .less，也可以使用 sass、stylus；小程序端的话，样式文件也可以是 .wxss、.acss 这种平台原生的，模板文件的话也可以是 .wxml、.axml 这种平台原生的，原生小程序代码和遵循 aixy 规范的代码在同一个小程序中共存也是可以的，目前已经成功的实践过将别的公司开发的小程序代码接入 aixy

### 提供的功能
##### 小程序端

* Less 预编译
* Less import 文件目录自动计算
* 多皮肤
* 页面引用的组件的目录自动识别生成(包括分包)
* 非页面/非组件 js 文件引用目录自动生成(包括分包)
* 图片自动转 base64/SVG 嵌入
* 本地以相对路径引入的图片 url 自动拼接图片云服务域名
* 图片 hash 强缓存 
* 多项目共享内容合并策略
* 全局自动注入公共内容至页面模板
* 环境变量注入模板/js
* app.json 与 plugin.json 配置自动生成
* 多平台多环境产出
##### 网页端
* 项目路由按目录自动生成
* 页面 js 的同名 css 自动引入
* Less 引入路径 alias 
* 多皮肤构建
* 版本控制
* webpack内置 server 和外部 server
### 安装
```
npm install aixy -g
```

### 使用
项目运行起来的必要条件：配置文件(override.config.js + .env) + 命令行
#### 1. override.config.js

用于自定义项目和 aixy 内部传给 webpack/gulp 的配置

**小程序端**的所有可用配置，示例代码如下：
```
// profile 用于指明当前编译类型，可选类型如下：v1(vue1)、vue(vue2)、microapp(小程序)
exports.profile = 'microapp'
//项目下的多皮肤相关配置
const themeData = require('./components/common/theme')
//当次编译时的皮肤值，取自系统变量
const COLOR = process.env.THEME_COLOR || 'default'
//用户自定义的项目配置，会覆盖 aixy  内部默认的配置，init 函数的参数 Config 是 aixy 内部的默认配置类，init 函数返回的类最终会在 aixy 内部实例化，作为编译的全局配置使用
exports.init = function (Config) {
    class ProjectConfig extends Config {
        constructor() {
            super();
            // setConfig 为父类提供的方法，通过它，自定义的配置会和 aixy 内部配置合并，得到真正的应用配置
            this.setConfig({
                //传给 less.js 的参数， modifyVars 配置的变量会覆盖开发者写在项目 .less 文件中的同名变量，这是实现多皮肤的关键
                lessOptions: {  
                    modifyVars: themeData[COLOR],
                    OSS_PATH: JSON.stringify(this.config.imageDomain)
                },
                enableTheme: false,  //多皮肤编译开关，默认关闭
                themes: ['red'],  //当前项目所具有的全部皮肤种类
                themeData,     //不同皮肤的 less 变量值配置对象，具体如何配置后面细说
                themePrefix：'_T-'  //多皮肤公共前缀，默认值为 _T-，一般不建议改动
                indexPage: 'pages/mall/mall',   //小程序首页路径，默认为 pages/index/index
                publicPath:  ''    //项目构建产出目录，不建议用户在这里配置，取值何来，后面细说
                imageDomain: ''    //图片云服务地址目录，不建议用户在这里配置，取值何来，后面细说
                assetsDir: ['images/**/*'],   //项目中不需要处理的图片，通常放在小程序根目录下的 images 目录
                assertPath: '' //需要上传到图片服务器的图片被提取出来的存放目录，不建议用户在这里配置，取值何来，后面细说
                useHash: true,   //是否对上传运云服务的图片添加 hash，默认开启
                hashLen: 8,  //图片 hash 长度，默认为 8
                ignoreHash: [],  //指定不需要带 hash 的图片
                //可用在 模板 和 js 文件中的替换常量，健名可以随意，不一定非得是 process.env[pro] 这样
                consts: {  
                    'process.env.OSS_PATH': this.config.imageDomain
                },
                prefix: '@ext'  //内容共享目录，每个小程序根目录下的这个目录内部的内容最终都会合并到项目根目录，默认为 @ext，一般不做改动
            });
        }
    }
    return ProjectConfig
}
```
* **themeData**

多皮肤样式变量的配置文件格式如下：
```
module.exports = {
    red: {
        primaryColor: '#fff000',
        bgColor: '#fefefe'
    },
    blue: {
        primaryColor: '#8e8e8e',
        bgColor: '#cecece' 
    }
}

```
* **publicPath**

项目的产出目录，其默认值为 `project/${PLATFORM}/${NODE_ENV}` ，是根据用户在 .env 文件中设置的 PLATFORM 和 NODE_ENV 系统变量值自动计算而来，不需要用户手动设置

* **imageDomain**

项目的图片云服务地址，因开发过程中 NODE_ENV 有 sandbox、production 之分，故而 imageDomain 的值设置在项目根目录下的 @conf 目录下的环境配置 js 文件中，NODE_ENV = sandbox 时，对应的配置文件为 @conf/config.sandbox.js ，NODE_ENV = production 时，对应的配置文件为 @conf/config.js ，less 编译完毕后，less 中的相对路径引用的图片的前缀都变成了 `${imageDomain}/${enterprise}`

* **assertPath**

less 中以相对路径引用的图片的踢去地址，其默认值为：`public/${enterprise}`，enterprise 是通过 package.json 配置的；编译完毕后，在这个目录下你就会发现，所有你需要上传到云服务的图片，aixy 都帮你按照原路径提取出来了，你只需要将整个 `public/${enterprise}` 文件夹扔到云服务器上就行了

**网页端**的所有可用配置，示例代码如下：

```
//项目下的多皮肤相关配置
var theme = require('./components/common/theme')
var {
    version
} = require('./package.json');

//当次编译时的皮肤值，取自系统变量
const COLOR = process.env.THEME_COLOR;

// profile 用于指明当前编译类型，可选类型如下：v1(vue1)、vue(vue2)、microapp(小程序)
exports.profile = 'v1'

exports.init = function(Config) {
    class MyConfig extends Config {
        constructor() {
            super()
            this.config.styleLoaderOptions = {
                less: {
                    lessOptions: {
                        globalVars: theme['blue']
                    }
                }
            }
            if (COLOR && theme[COLOR]) {
                this.config.assertPath = `theme_${COLOR}/${version}`
                this.config.styleLoaderOptions.less.lessOptions.modifyVars = theme[COLOR]
            }
        }
        onInit(env) {
            // 获取到 aixy 全局配置时候的钩子，此时 webpack 配置文件还未加载
        }
        onConfig(webpackConf, env){
            //webpack 环境关联配置文件已经获取到，用户可在此对配置进行修改，下一步就是执行  compiler = webpack(webpackConfig) 了
        }
        onDone(stats, env){
            // webpack 编译首次成功之后的钩子，stats 参数中可以获取到出错的具体信息
        }
        onError(stats, env){
            // webpack 首次编译失败之后的钩子，stats 参数中可以获取到出错的具体信息，env 表示当前环境为 sandbox/prod
        }
    }
    return MyConfig
}
```

#### 2. .env 

在此文件中以键值对方式配置的变量最终会被添加到 peocess.env 环境变量中，可配置项如下
```
NODE_ENV=sandbox
PLATFORM=wechat
```

*NODE_ENV* 可取值为 sandbox | production  表示当前环境是沙箱还是生产
*PLATFORM* 可取值为 wechat | alipay | tt  表示编译的小程序归属平台
在.env 设置的配置，最终也会被放入 **consts** 中，这样用户就能在 .js 和 .tpl 文件中以为 process.env[pro] 的方式使用他们，同时，consts 还提供了 APP_BUILD_TIME(当前构建时间) 、 APP_VERSION(当前小程序版本号)  两个环境变量供开发者使用

#### 3. aixy 命令行

常用命令如下：

* **build**   生产构建命令，与 dev 命令的区别在于会开启压缩混淆等系列优化能力，不会启动 server
* **dev**   开发构建命令，会启动本地 nodejs server
* **pack**   打包产出目录文件到 .zip，为小程序端常用功能
* **upload**   通过微信官方提供的 miniprogram-ci 扩展的上传小程序代码的能力，此功能目前暂未完成测试
* **fmt**   调用 prettier，检查代码是不是不规范
* **clean**   用于删除项目根目录下 node_modules/.cache 内容

常用选项如下：

* **--watch**   生产构建命令，与 dev 命令的区别在于会开启压缩混淆等系列优化能力，不会启动 server
* **--theme**   开发构建命令，会启动本地 nodejs server
* **--plugin**   打包产出目录文件到 .zip，为小程序端常用功能
* **--optimize**   通过微信官方提供的 miniprogram-ci 扩展的上传小程序代码的能力，此功能目前暂未完成测试

#### 网页端

#### 小程序端

### 关于未来

* 虽然目前 aixy 编译微信和支付宝的小程序/插件，都没有问题，未来即使再扩展其它小程序的编译，都是很容易实现的，但是，要做到一份代码同时可以编译到微信、支付宝、百度、抖音，且还能正常运行，目前是还没有完全实现的；作者最近正在找工作，这个事情暂时推后，不过下一个阶段应该就是去研究一下 Taro 的某些实现，虽然我不打算迁过去 Taro(不支持插件)，但是我觉得 Taro 的某些思路还是很值得参考的；路过的有想法的朋友可以踊跃贡献思路
* 目前刚好在准备面试，并且我自己是 Vue 技术栈的，索性现在就开始研究 Vue3 了，最近 vue3 的构建功能可能会逐步完善
* 后续会参照 vite-create 开发一个初始化小工具 aixy-create，用于提供各个框架的初始化模板，原生和 TS 版本的都会有
* 近两年在网页端花费的时间比小程序少上很多，所以小程序的编译功能就更加丰富，后面会根据小程序的经验，逆向对网页端的功能进行扩展
* 以上，敬请期待


简介：
        aixy 为目前公司自研的前端构建工具，公司的管理后台(除开标标准版 scrm)、移动端、小程序均可使用；aixy 在网页端基于 webpack5，在小程序端基于 gulp4；公司的项目分为 管理后台、H5移动端、小程序端；管理后台目前使用的前端框架为 ng，H5移动端目前使用的 前端框架为 vue1，小程序端目前使用的是都是原生。
       上面提到的标准版 scrm 使用的构建工具为 dirve，起源自 uc 的 scrat，scrat 基于 fis2，因维护 scrat 的开发者弃坑，且 fis3 已更新，所以公司在 scrat 的基础上手动将 fis2 升级到了 fis3，重新发布了新的构建工具 dirve，这就是 dirve 的由来。
        aixy 的前身是公司自研的构建工具 ovestack，目前某些旧的项目还在使用 ovestack。
        aixy 自身的某些特性有借鉴 dirve(比如 ?__inline 引入图片)，但是它本身和 dirve 没有任何关系，是基于 webpack 和 gulp 的新构建工具。
        无论是网页还是小程序项目，在使用 aixy 编译后，编译后的文件都会产出在当前项目的根目录的 dist/public 目录下，小程序产出在 dist 目录，网页端产出在 public 目录；对于微信小程序项目，如果当前 .env 文件中 NODE_ENV 的配置为 sandbox，则构建最终产出在 dist/wechat/sandbox 中，如果是支付宝项目，.env 中配置 PLATFORM=alipay，最终产出在 dist/alipay/sandbox 中；发布到生产的时候，master 分支的 .env 的 NODE_ENV 为 production。
        目前基于 aixy 的小程序，其页面或组件默认是由 js、tpl、less 三个文件组成，如果想使用小程序原生的 wxss、wxml 文件的话(支付宝的话就是 acss 和 axml)，aixy 也是支持的，也就是说，如果以后接收了其他公司开发的小程序的源码，我们也是可以引入 aixy 的。

使用：
引入 aixy 构建的项目中必须得加上以下两个文件
.env    配合 dotenv 包使用，其中的 key=value 形式的配置最终均会挂载到 process.env 环境变量，这些配置都能在当前项目的 js 或者 tpl 中使用的，在 js 中直接使用即可，在 tpl 中使用要带双花括号，以下为两个常用的配置
PROJECT_ENV  决定了当前项目的各种配置文件的加载，目前好像仅仅在小程序端有使用到，可配置值为 sandbox 或 prod
NODE_ENV  决定了构建工具内部各种配置文件的加载，可配置值为 sandbox 或 production
PLATFORM  默认不需要配置，且默认值为 wechat，用于指明当前编译的小程序是 微信还是支付宝，还是抖音小程序
除开以上两个配置，开发者是可以在 .env 中自定义自己需要的配置的，然后在页面 和 js 中使用
override.config.js    用于自定义项目配置，这个配置最终会传入 aixy 内部，随着每次编译命令的运行而生成工具内部的初始化配置，此配置文件需要导出 profile 属性 和 init 函数，aixy 工具源码中的 全局配置 和 profile 目录下前端框架对应的配置文件与 override.config.js 结构都是一样的

常用命令：
    可在命令行输入 aixy -h 查看 aixy 常用命令和选项，目前常用命令有：
dev   
网页端：本地开发时运行，提供开发 devServer ，并提供 livereload 的能力
小程序：编译小程序模板、js、样式文件、处理图片、自动生成配置等
build  
网页端：发布时运行，不提供devServer，会启用压缩混淆等功能，wabpack 会启用 chunk 分割等优化能力
小程序：在 dev 的基础上多运行一个 optimize 任务，对 css 文件进行压缩
fmt
调用 lint-staged 检测代码书写是否规范，一般我们结合 git 的 pre-commit 钩子来使用
pack
打包构建产出文件
clean
清除 node_module 缓存，用于解决 npm 包正确安装，却无法正常运行的问题；此命令不常使用
generate
从 git 模板仓库中的模板生成对应类型的初始化的项目
upload
借助微信官方提供的 miniprogram-ci，一键上传小程序，具体参考官方文档(https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.htm)，此命令目前也不常用
常用选项：
--watch   编译时启动项目监听
--plugin   启动小程序插件编译，编译小程序插件的时候，必须带上此选项
--theme    多皮肤编译，如果当前项目有多皮肤要求，生产构建的时候必须带上
--optimize    编译小程序的时候启动优化任务，生产构建的时候是默认开启的

提供的能力：
网页端
支持 ng、vue1、react、vue3
业务页面路由自动生成
devServer
liveReload
webpack 能提供的能力，基本都可用
多皮肤
小程序端
多皮肤
大图片自自动接入图片云服务、小图片转 base64 或 svg 以及 图片缓存
项目监听
自动生成页面对应的同名 json文件，然后页面要引入组件可以通过在页面配置项中( Page({   }) )通过配置 components: { card: "&card",  list: "~/list" } ，然后经过工具，自动生成对应组件路径(&对应生成相对路径，~对应生成绝对路径)
project.config.json 文件、主包/分包 app.json  目录/插件配置自动生成 、 plugin.json 目录自动生成；项目根目录下的 @config 目录下的环境配置文件可用于配置不同环境的插件配置以及分包插件配置，这些配置最终会被构建工具根据当前环境读取合并到 app.json 
项目配置或环境变量注入页面(前面的 .env)
@ext 目录内容合并到主包
支持多平台编译(初级版，非一套代码多端编译)
压缩混淆


配置：
网页端配置
assertPath   默认值为 package.json 中 platform 和 version 拼接的路径(mobile/3.0.0)，也就是资源产出目录
urlPrefix  等同于 webpack 配置 output.publicPath
publicPath  等同于 webpack 配置 output.path
nodeModulesPath 最终会合并到 webpack 的 resolve.modules 配置中，指明webpack  解析时候的搜索文件范围
enableDll  是否启用 DllReferencePlugin 插件， 目前都是默认不开启
consts  传给 webpack definePlugin 插件，用来定义编译的时候可以在页面上被替换的常量
packageJson  工具内部获取了当前项目的 package.json ，赋值给了它
ENV_VARS  来自 .env 的环境变量(不在 overrideConfig 文件配置)
cmdArgv  转化后的命令行选项对象(不在 overrideConfig 文件配置)
entry  页面 js 入口文件的绝对路径，网页端默认为 components/boot/boot.js
root  项目业务文件所在的位置，网页端默认为 components 目录，很多插件、loader 都只需要应用在这个目录即可
templateFile  index.html 的位置，给 html-webpack-plugin 使用
viewsPath  指定 html-webpack-plugin 的 template 页所在目录，如果有值，则会自动遍历目录，检测目录下有多少 html/ejs 文件，然后对应的生成  html-webpack-plugin  配置
devServer  默认为 { livereload: true, useBuildInServer: true }，livereload 为 true 会开启 LiveReloadPlugin 插件，开启 livereload 能力，devServer 配置仅在 aixy dev 时有效
styleLoaderOptions   { less: { /* less-loader 相关配置*/ }}，用于重写工具内部默认的 style-loader/css-loader/style-loader 的配置
profile  此配置主要为了告诉工具去 profile 下的哪个目录找对应的文件

小程序端配置
root  项目根目录，在 js 中，其别名为 @，在 less 中，其别名为 ~
assertPath  图片资源构建产出到 public 目录的地址(插件的配置貌似需要修正)
publicPath  所有资源产出目录  dist/wechet/sandbox
pagesPath  项目的 pages 目录的绝对地址
projectPath  默认为 project
consts  用来定义编译的时候可以在页面上被替换的常量
ENV_VARS  同上
cmdArgv  同上 { plugin: true, theme: true }
packageJon  同上
themePrefix  编译时使用的样式前缀，目前小程序项目代码中的 __theme__ 的值，还没有和这个统一，所以不建议修改这个配置
ignorePath   可配置不需要编译的小程序目录
lessOptions  传给工具内 gulp-less 的配置，用于编译 less
assetsDir  本地图片存放地址(不会被工具编译，转为云服务图片地址 或者 bae64 或者 svg)
imageDomain  图片云服务域名
indexPage   设置小程序的首页
useHash  css 文件中的图片资源被替换上图片服务域名后，是否添加 hash，启用缓存
hashLen   图片启用缓存后的 hash 位数
alias  别名
prefix  其配置的目录下的所有文件都会合并到根目录
themes  项目需要的皮肤种类 ['pink', 'blue']，这里不需要配置 default 皮肤
themeData  不同皮肤的颜色 配置({  pink: { primaryColor: 'red' }  })
platform  用于区分平台类型(wechat、alipay) 以进行平台差异化编译

关于未来
标准版产品 scrm 目前使用的构建工具为上一代的 dirve(基于 fis3)，最近的目标是：统一为 aixy；因为标准版 scrm 和 天河城 scrm 采用的路由规则是不一样的 ，两个代表性后台项目的业务文件的路径和路由映射可能要先搞清楚，然后在此基础上预估一下更换的难度
标准版 scrm 项目如果想 引入 vue/react，可以考虑将新的基于 aixy 的独立项目(基于 vue 或 react 框架) 通过 iframe 嵌入到 scrm，两者可通过 websocket 互通身份(接口有身份就会有数据)，scrm 可通过路由变化来触发 iframe 加载新项目，待项目运行稳定，公司人手充足，可在适当的时候考虑花点时间将原本的 scrm 的前端 ng 框架彻底更换掉，以避免未来技术上的断层
后续，如果有新的客户的管理端项目，建议不再使用 ng， 转为使用 vue/react，目前 aixy 本身是已经内部支持 react/vue2 甚至 vue3 的，但是功能实现不一定是完善的，需要 aixy 的下一任维护者去持续跟进
H5端，建议升级 Vue 至 vue3/react，对比前面 3 件事情，这个应该难度较低，可以考虑优先处理
小程序端，目前 aixy 将项目单独编译至支付宝、小程序项目都是没有问题的，但是一份代码同时编译为支付宝代码 或者 微信小程序代码目前还未彻底达成(有部分设想的实现)，建议下一任 aixy 的维护者在深入对比平台差异后，从 Taro 和 uniapp 处借鉴跨平台的经验，对比下，是将 aixy 的一份代码多平台构建能力完善 还是直接迁移到 uniapp/taro