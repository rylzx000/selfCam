# 端上轻质检配置设计

## 1. 为什么采用静态 JSON 配置

当前阶段的目标，是先把“端上轻质检”的系统控制能力收口，支持灰度发布、关闭能力和调整阈值，但暂时不接在线平台接口，也不引入数据库或用户可见设置。

静态 JSON 方案适合当前阶段，原因如下：

- 接入成本低，前端可以快速验证配置结构是否合理。
- 配置内容是纯数据，便于后续迁移到在线平台接口。
- 配置获取失败时，容易降级到本地缓存或代码默认值，不阻断拍照主流程。
- JSON 文件中只保存开关、阈值、版本号、缓存时长等非敏感信息，适合前端静态下发。

## 2. 默认配置 / 远程配置 / 本地缓存三层关系

当前实现采用三层配置结构：

1. 默认配置  
文件：`utils/quality-config-default.js`  
作用：代码内兜底配置。即使没有远程配置、没有缓存或网络异常，业务仍然可以拿到一份可运行的配置。

2. 远程静态 JSON 配置  
文件：`utils/quality-config-loader.js`  
作用：通过 HTTPS 地址拉取系统控制配置，用于控制轻质检总开关、子开关、阈值和处理参数。

3. 小程序本地缓存  
存储 Key：`selfcam_quality_config_cache_v1`  
作用：缓存最近一次成功拉取的远程配置。弱网或短时网络抖动时，优先使用未过期缓存。

统一读取入口位于 `utils/quality-config.js`，业务层只通过以下接口获取配置：

- `getQualityConfig()`
- `initQualityConfig()`
- `refreshQualityConfig()`

## 3. 配置字段说明

当前覆盖的轻质检字段如下：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `enabled` | `boolean` | 轻质检总开关 |
| `showUserHint` | `boolean` | 是否允许业务层展示质检提示语 |
| `saveQualityMeta` | `boolean` | 是否保存质检元数据 |
| `blurEnabled` | `boolean` | 是否开启模糊检测 |
| `exposureEnabled` | `boolean` | 是否开启曝光检测 |
| `brightnessEnabled` | `boolean` | 是否开启亮度检测 |
| `nearFarEnabled` | `boolean` | 是否预留开启远近检测 |
| `thresholds.blur` | `number` | 模糊阈值，范围 `0 ~ 1` |
| `thresholds.dark` | `number` | 过暗阈值，范围 `0 ~ 1` |
| `thresholds.bright` | `number` | 过亮阈值，范围 `0 ~ 1` |
| `processing.maxEdge` | `number` | 参与轻质检的图像边长上限，范围 `256 ~ 4096` |
| `processing.timeoutMs` | `number` | 单次处理超时时间，范围 `100 ~ 10000` 毫秒 |
| `configVersion` | `string` | 配置版本号 |
| `expiresInSeconds` | `number` | 本地缓存有效期，单位秒 |

远程配置进入业务前会统一做校验和清洗：

- 布尔值统一转换为 `boolean`
- 数值统一转为数字，并按合理范围裁剪
- 缺失字段回退到默认配置
- 非法根结构直接视为无效配置并降级

## 4. develop / trial / release 的 source 策略

默认 source 策略会结合微信小程序 `envVersion` 决定：

- `develop`：默认使用 `mock`
- `trial`：默认使用 `mock`
- `release`：优先使用已配置的 HTTPS 远程静态 JSON

`release` 环境下如果远程地址未配置：

- 不会静默切到 `mock`
- 会先尝试读取未过期的本地远程缓存
- 如果没有可用缓存，则降级到默认配置
- 同时输出警告日志，提示当前生产环境未配置远程静态 JSON 地址

如果业务显式指定了 source，则按显式指定处理。

## 5. 降级策略

配置获取失败时的降级顺序如下：

1. 未过期的本地缓存
2. 代码默认配置

具体规则：

- 远程请求失败时，不抛出阻断主流程的异常。
- 远程返回非对象、空文本或非法 JSON 时，直接视为无效配置。
- 缓存过期后如果远程刷新失败，不继续使用过期缓存，直接回退默认配置。
- `release` 环境下如果远程地址未配置，不允许使用 `mock` 冒充远程配置。
- 统一入口在任何时刻都至少可以返回一份默认配置。

## 6. 后续如何切换到在线平台接口

后续如果接入在线平台接口，目标是只修改“配置获取层”，不影响业务读取层和算法调用层。

最小改动点如下：

1. 替换 `utils/quality-config-loader.js` 中的远程配置获取实现
2. 根据在线平台返回格式调整 source 解析逻辑
3. 保留默认配置、缓存逻辑、统一读取入口和业务调用方式不变

这样页面、轻质检算法模块以及未来的 `photo-quality.js` 仍然只需要调用：

```js
const { getQualityConfig, initQualityConfig, refreshQualityConfig } = require('../../utils/quality-config')
```

业务层不需要知道配置来自静态 JSON 还是在线平台接口。
