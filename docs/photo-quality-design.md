# 端上轻质检模块设计

## 设计目标

本轮目标是在不改页面主流程、不接后端接口、不引入大型图像处理依赖的前提下，先落一套独立、可测试、可配置的拍后轻质检模块。

当前模块需要满足以下要求：

- 对单张照片进行轻量质量分析
- 输出统一、稳定的检测结果结构
- 所有开关和阈值统一从 `quality-config` 读取
- 算法逻辑尽量保持纯函数，方便 Jest 测试
- 分离“像素分析”和“图片读取”两个层次，降低后续接入成本

本轮对应的主要文件如下：

- `utils/photo-quality.js`
- `__tests__/photo-quality.test.js`

## 为什么只做拍后轻质检，不做实时检测

当前阶段只做拍后单张检测，不做实时预览帧检测，主要原因如下：

- 实时检测会持续占用 CPU 和内存，更容易影响小程序相机预览流畅度
- 当前项目已经完成状态机、缓存治理和配置体系，拍后检测更适合小步推进
- 拍后单张分析链路更简单，更容易把配置、算法、降级和测试先收口
- 当前业务目标不是强制拦截，而是先提供“建议重拍”的基础能力

因此，本轮模块的定位是：

- 只分析单张照片
- 只输出检测结果
- 不修改拍摄顺序
- 不强制用户重拍

## 检测项说明

### 1. 模糊检测

模糊检测用于判断照片是否缺乏足够清晰的边缘信息。

- 输入：降采样后的像素数据
- 输出指标：`blurScore`
- 计算方式：统计相邻像素的亮度差，计算简易边缘密度，再映射到 `0 ~ 1`
- 判定方式：当 `blurScore < thresholds.blur` 时，返回 `blur`

说明：

- 这不是 AI 模型，也不是高成本卷积算法
- 当前实现更偏向轻量启发式锐度估计，适合端上快速执行

### 2. 偏暗检测

偏暗检测用于判断照片整体是否过暗，或者暗部占比是否过高。

- 输出指标：`brightness`、`darkRatio`
- 计算方式：
  - `brightness` 表示平均亮度
  - `darkRatio` 表示暗像素比例
- 判定方式：
  - `brightness < thresholds.dark`
  - 或暗像素比例超过内部安全阈值

### 3. 过曝检测

过曝检测用于判断照片整体是否过亮，或者高亮区域占比是否过高。

- 输出指标：`brightness`、`brightRatio`
- 计算方式：
  - `brightness` 表示平均亮度
  - `brightRatio` 表示高亮像素比例
- 判定方式：
  - `brightness > thresholds.bright`
  - 或高亮像素比例超过内部安全阈值

### 4. 疑似过近 / 过远

本轮先保留能力结构，不引入复杂识别模型。

当前策略如下：

- 如果调用方未来能提供类似 `subjectCoverage` 的轻量占比信息，模块可以根据启发式阈值输出 `too_near` 或 `too_far`
- 如果没有这类输入，本轮默认不主动触发过近或过远原因

## 配置项如何控制检测

模块内部不写死核心阈值，而是统一通过：

```js
const qualityConfig = require('./quality-config')
qualityConfig.getQualityConfig()
```

读取配置。

当前会使用到的配置项包括：

- `enabled`
- `blurEnabled`
- `exposureEnabled`
- `brightnessEnabled`
- `nearFarEnabled`
- `showUserHint`
- `saveQualityMeta`
- `thresholds.blur`
- `thresholds.dark`
- `thresholds.bright`
- `processing.maxEdge`
- `processing.timeoutMs`

控制规则如下：

- `enabled=false` 时直接返回 `reasons=['disabled']`
- 同时返回 `level='good'`、`suggestRetake=false`，避免后续页面把“系统关闭质检”误判为质量告警
- 子开关关闭时，只跳过对应检测，不影响其他检测项
- `maxEdge` 控制最大处理边长，避免对原图全尺寸直接做计算
- `timeoutMs` 用于保护单次分析时长，避免异常场景拖慢主流程
- `showUserHint` 和 `saveQualityMeta` 会透传到结果中的 `behavior` 字段，供后续页面和存储层使用

## 性能策略

为了适配小程序端，本轮只做轻量统计，不做重型图像处理。

当前主要统计项包括：

- 平均亮度
- 暗部比例
- 高亮比例
- 简单对比度
- 简单锐度 / 模糊指标

性能控制方式如下：

- 当输入尺寸超过 `processing.maxEdge` 时，先进行降采样
- 默认 `processing.maxEdge=640`，优先控制端上像素分析开销
- 像素分析基于降采样后的灰度图，不直接对原图做重计算
- 算法以单次线性扫描为主，避免引入大型图像处理库
- `filePath` 读取与像素分析分层，后续可以单独替换采样实现

## 当前局限

当前模块属于“轻质检”，不是高精度图像理解能力，主要局限包括：

- 不能识别具体业务目标是否完整入镜
- 不能仅靠像素准确判断“离得太近”还是“离得太远”
- 对极端场景仍可能存在启发式误差
- 当前只做拍后单张分析，不做实时预览帧分析

因此，本轮模块只输出：

- `level`
- `suggestRetake`
- `reasons`
- `metrics`

不会强制拦截用户流程。

## 后续如何接入拍后确认页

后续如果要接入拍后确认流程，建议保持当前模块边界不变，只补一层调用：

1. 在拍照完成并拿到压缩后图片后，使用 `filePath` 或 canvas 采样数据调用 `analyzePhotoQuality()`
2. 根据结果中的 `suggestRetake` 和 `reasons` 决定是否展示提示
3. 根据 `behavior.showUserHint` 决定是否给用户展示提示语
4. 根据 `behavior.saveQualityMeta` 决定是否把 `metrics / reasons / configVersion` 写入本地缓存或后续上传参数

推荐接入位置：

- 拍后确认页进入前
- 或拍照成功、压缩完成之后，进入预览页前的轻量分析节点

这样后续如果要把提示展示到确认页，只需要补调用和展示逻辑，不需要重写算法层。

### 拍后确认接入说明

本轮已经完成拍后确认流程的最小接入，接入点位于：

- `packageD/pages/camera/camera.js` 的拍照处理链路
- 时机是“拍照成功并压缩完成后、进入确认弹层前”

当前接入规则如下：

- 页面层调用 `analyzePhotoQuality()` 完成一次拍后分析
- 如果 `showUserHint=true` 且结果 `suggestRetake=true`，则在现有确认区域展示一条轻提示
- 如果 `saveQualityMeta=true`，则把标准化后的 `quality` 结果写入照片对象
- 如果 `showUserHint=false`，则不展示提示，但仍可按配置决定是否保存质量元数据
- 如果 `saveQualityMeta=false`，则不写入 `quality` 字段
- 如果 `quality.enabled=false`，则不展示提示，流程保持原样
- 如果分析失败或超时，用户仍然可以继续确认保存照片

### 完成页摘要接入说明

在拍后确认已经把 `quality` 元数据写入照片对象后，完成页不应再自己遍历所有车辆和照片做质量判断，而应统一通过摘要层读取结果。

当前接入方式如下：

- `storage-schema` 继续负责标准化照片对象上的 `quality` 字段，保证旧缓存和新缓存结构兼容
- `cache-selectors` 新增 `getQualitySummary(cache)`，用于对所有已保存照片做只读汇总
- `getCacheSummary(cache)` 挂出 `qualitySummary`，供 `preview`、`complete` 等摘要层页面统一消费
- `complete` 页只负责展示一条轻提示，不在页面中写复杂遍历或阈值判断逻辑

当前 `qualitySummary` 至少包含：

- `totalPhotos`
- `analyzedCount`
- `riskCount`
- `suggestRetakeCount`
- `riskReasons`
- `riskPhotos`
- `failedCount`
- `disabledCount`
- `lowConfidenceCount`
- `unanalyzedCount`

完成页展示规则如下：

- 当 `riskCount=0` 时，不额外打扰用户
- 当存在风险照片时，展示“有 X 张照片可能存在模糊或偏暗问题，建议返回修改”这类轻提示
- 提示是否展示继续受 `quality-config.showUserHint` 控制
- 即使不展示提示，摘要数据仍然可以计算
- 页面仍允许用户直接完成，不做强制返回修改

风险识别规则如下：

- `suggestRetake=true` 且存在可操作原因（如 `blur`、`dark`、`overexposed`）时，计入风险照片
- `disabled` 不算风险
- `analyze_failed` 不算风险，也不会阻断流程
- 旧照片没有 `quality` 字段时，按“未分析”处理，不报错

## 注意事项

为避免后续接入时出现误用，当前模块需要注意以下几点：

- 不要在页面中重复实现阈值判断，应统一调用 `photo-quality` 模块
- 不要把 `disabled` 结果当成质量不合格，它只表示系统层关闭了轻质检
- 不要把当前模块输出当成强制拦截依据，本轮只提供建议重拍能力
- 不要跳过 `quality-config` 直接在业务层写死阈值
- 如果后续接入图片路径分析，建议优先走降采样后的 canvas 采样数据，避免直接处理大图
