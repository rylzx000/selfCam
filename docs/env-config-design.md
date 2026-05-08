# 端上环境配置收口设计

## 1. 设计目标

本次新增并持续扩展 `utils/env-config.js`，把微信小程序端的环境识别、业务环境、运行时开关、调试策略和配置默认值统一收口，解决以下问题：

- `envVersion` 判断散落在多个模块，后续维护成本高
- `ai-config`、`runtime-logger`、`quality-config` 各自维护环境策略，容易出现不一致
- 生产环境的调试上传、开发面板、mock 默认值缺少统一约束
- Jest 或非小程序运行时下读取 `wx.getAccountInfoSync()` 容易报错
- 业务环境与微信运行版本耦合，无法在 `develop / trial` 下切换 SIT、pilot 等业务后端
- AI 模型缓存文件名固定，切换模型地址后可能复用旧环境模型文件

本次改动只做端上统一配置层和隐藏切换入口，不改拍照主流程，不删除现有能力。

## 2. 为什么要做环境配置收口

在上线前，环境相关判断如果继续散落在 `app.js`、页面文件和工具模块里，会带来几个直接风险：

- 某个模块把 `trial` 当成开发环境，另一个模块又把它当成准生产环境
- 生产环境遗漏关闭调试上传或开发面板
- 新增配置能力时，需要到多个文件重复修改 `envVersion` 逻辑
- 单测环境没有 `wx` 时，配置模块先抛错，反而阻断主流程验证

统一收口后，业务层只依赖 `env-config` 暴露的能力，不再自己读 `wx.getAccountInfoSync().miniProgram.envVersion`。

## 3. 环境识别策略

微信运行版本统一入口：

- `wx.getAccountInfoSync().miniProgram.envVersion`

支持环境：

- `develop`
- `trial`
- `release`

安全降级策略：

- `wx` 不存在时，降级为 `develop`
- `wx.getAccountInfoSync` 不存在时，降级为 `develop`
- `wx.getAccountInfoSync` 抛错时，降级为 `develop`
- 读取到未知环境值时，降级为 `develop`

这样 Jest、Node 侧工具和异常场景都不会因为环境读取失败而阻断业务流程。

业务环境统一入口：

- 默认按微信运行版本映射：`develop -> dev`、`trial -> sit`、`release -> prod`
- `develop / trial` 允许读取本地缓存 `SELF_CAM_APP_ENV` 覆盖业务环境
- `release` 正式版强制 `prod`，不允许本地缓存覆盖

支持业务环境：

- `dev`
- `sit`
- `pilot`
- `prod`

可切换范围：

- `develop`：`dev / sit / pilot`
- `trial`：`sit / pilot`
- `release`：不可切换，固定 `prod`

## 4. develop / trial / release 默认策略

### develop

- 允许 `mock`
- 允许开发调试能力
- 允许本地模型地址
- 允许调试日志上传
- `quality-config` 默认 source 为 `mock`

### trial

- 允许 `mock` 或测试配置
- 默认收紧调试输出
- 默认关闭调试上传
- 默认不展示开发面板
- 业务体验版排查 AI 加载问题期间，`runtime-logger` 临时保留 `info` 级日志；稳定后可改回只保留较高优先级日志
- `quality-config` 默认 source 为 `mock`

### release

- 禁止 `mock` 作为默认生产配置
- 禁止调试上传
- 禁止开发面板
- 禁止默认暴露 AI 调试信息
- 默认关闭非必要日志，只保留更高优先级日志
- `quality-config` 默认 source 为已配置的远程静态 JSON
- 若未配置远程地址，则降级到默认配置，而不是静默切回 `mock`

## 5. 对外接口

`utils/env-config.js` 当前提供以下统一方法：

- `getEnvVersion()`
- `getAppEnv()`
- `getAvailableAppEnvs()`
- `getAppEnvBadgeText()`
- `canSwitchAppEnv()`
- `saveAppEnvOverride()`
- `clearAppEnvOverride()`
- `isDevelop()`
- `isTrial()`
- `isRelease()`
- `getRuntimeFlags()`
- `getDebugConfig()`
- `getAiConfig()`
- `getQualityConfigSourcePolicy()`

其中：

- `getRuntimeFlags()` 负责给应用层提供统一的环境能力开关
- `getDebugConfig()` 负责给调试日志、开发面板、AI 调试信息提供默认策略
- `getAiConfig()` 负责统一业务环境、模型路径、模型地址和模型缓存隔离 key
- `getAppEnvBadgeText()` 负责提供非生产环境右下角透明环境标识文案，`prod` 返回空字符串
- `getQualityConfigSourcePolicy()` 负责给 `quality-config-loader` 提供默认 source 策略

## 5.1 业务环境模型地址

`BUSINESS_ENV_ENDPOINTS` 由 `env-config` 统一维护：

```js
{
  dev: {
    modelHost: 'https://onlineclaimsit.chinalife-p.com.cn/video/model'
  },
  sit: {
    modelHost: 'https://onlineclaimsit.chinalife-p.com.cn/video/model'
  },
  pilot: {
    modelHost: ''
  },
  prod: {
    modelHost: ''
  }
}
```

当前开发环境调试也复用 SIT 模型地址，保证 `develop -> dev` 下真机调试与 SIT 体验版使用同一份远程模型资源。

`getAiConfig()` 返回：

- `wxEnvVersion`
- `appEnv`
- `modelHost`
- `plateModelUrl = modelHost + '/plate.onnx'`
- `damageModelUrl = modelHost + '/damage.onnx'`
- `plateModelPath`
- `damageModelPath`
- `plateModelCacheKey`
- `damageModelCacheKey`

非 `dev` 业务环境禁止使用以下模型地址：

- `http`
- `localhost`
- `127.0.0.1`
- 局域网 IP：`10.*`、`172.16.* - 172.31.*`、`192.168.*`

## 5.2 模型缓存隔离

模型下载仍写入 `wx.env.USER_DATA_PATH`，但文件名不再固定为 `plate.onnx` / `damage.onnx`。

当前策略：

- 文件名包含模型类型、`appEnv` 和模型 URL hash
- `plateModelCacheKey` / `damageModelCacheKey` 同样包含 `appEnv` 与 URL hash
- 切换业务环境后，相机页会基于新的模型路径重新检查当前环境模型是否已下载

示例：

```text
plate-sit-<urlHash>.onnx
damage-pilot-<urlHash>.onnx
```

这样 SIT 与 pilot 不会复用同一个本地模型缓存文件。

拍照页创建 `PlateDetector` / `DamageDetector` 前必须实时调用 `envConfig.getAiConfig()`，通过 `options.aiConfig` 传给检测器。不要从 `ai-config.js` 引入模块加载期固化的 `PLATE_MODEL_URL`、`DAMAGE_MODEL_URL`、`PLATE_MODEL_PATH` 或 `DAMAGE_MODEL_PATH`。

隐藏调试入口提供“清除 AI 模型缓存”能力，仅删除当前 `aiConfig.plateModelPath` 和 `aiConfig.damageModelPath` 指向的本地 onnx 文件，不清除用户照片、车辆/单证/流程缓存或本地日志。清理后下次进入拍照页会重新检查并下载当前环境模型。

## 6. 各类开关说明

当前统一收口的开关主要包括：

- `allowMock`：是否允许默认走 mock 策略
- `allowTestConfig`：是否允许测试态配置
- `allowLocalModelHost`：是否允许本地模型地址
- `allowDebug`：是否默认打开开发调试能力
- `enableDebugUpload`：是否允许调试日志上传
- `showDevPanel`：是否允许展示开发面板
- `showAIPanel`：是否允许展示 AI 调试信息
- `runtimeLoggerLevel`：运行时日志默认保留级别

说明：

- 这些开关都是默认策略，不代表后续不能再接入更细粒度的远程控制
- 生产环境的禁止项由 `env-config` 统一兜底，避免单个模块误开

## 7. 生产环境禁用项

`release` 环境默认禁用以下内容：

- 调试日志上传
- 开发面板
- AI 调试信息展示
- mock 作为默认生产配置
- 本地模型地址
- 非必要运行时日志

注意，这里强调的是“默认禁用”。如果后续要做灰度、白名单或在线开关，也应该在统一环境层扩展，而不是回到各模块散落判断。

## 8. 与现有模块的关系

### ai-config

- 不再在 `ai-config.js` 内部分散写环境判断
- 模型路径、模型地址、调试上传配置统一从 `env-config` 获取
- 真实生产域名、密钥、`AppSecret` 不允许写入前端代码

### runtime-logger

- 是否记录、记录到什么级别、是否允许上传，统一走 `getDebugConfig()`
- 生产环境默认关闭上传，并收紧日志级别
- 即使日志写入或上传失败，也不能阻断拍照主流程

### quality-config

- `quality-config-loader` 不再自己定义环境分类规则
- source 默认策略复用 `getQualityConfigSourcePolicy()`
- 显式指定 `source.type` 的现有能力继续保留，不因为收口而删除

### app.js

- `app.js` 不再自己散落环境判断
- 启动时只读取统一 `runtimeFlags`，把环境信息传给配置初始化

## 9. 后续接在线平台接口时如何扩展

后续如果要接在线配置平台或灰度平台，建议扩展顺序如下：

1. 保留 `env-config` 作为唯一入口
2. 在 `env-config` 内增加“本地默认值 + 远程覆盖值”的 merge 逻辑
3. 保证 `release` 环境的禁止项仍有本地兜底，不能完全依赖远程返回
4. 对远程下发的环境开关做白名单和类型校验
5. 远程配置读取失败时，继续回退到本地默认策略

这样后续即使接入在线平台，也不会破坏当前“配置失败不能阻断主流程”的原则。

## 10. 注意事项

- 不要把真实生产域名、密钥、`AppSecret` 写进前端代码
- 生产环境默认关闭调试上传、开发面板和非必要日志
- 配置模块读取失败时必须安全降级，不能阻断拍照主流程
- 页面文件不要再直接判断 `envVersion`
- 新增环境开关时，优先加到 `env-config`，不要继续分散到各个模块
- 业务环境切换只允许作为隐藏入口，不新增普通用户可见的设置入口
- `release` 必须强制 `prod`，不能被本地缓存覆盖
- 非生产环境标识只用于调试确认，必须保持低权重、透明，不遮挡主流程操作
