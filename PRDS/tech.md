# 技术架构文档

> 项目名称：车辆损失辅助拍照工具
> 代码基线：v1.4.2（`package.json`）
> 文档状态：已按当前实现对齐
> 最后更新：2026-05-18

---

## 一、技术栈

| 层级 | 当前方案 | 说明 |
| --- | --- | --- |
| 运行环境 | 微信小程序原生 | 不依赖跨端框架 |
| 页面层 | `wxml + wxss + js` | 原生页面与组件 |
| 相机 | `camera` + `wx.createCameraContext()` + `CameraContext.onCameraFrame` | 负责预览、AI 检测抽帧与最终拍照 |
| 覆盖层 | `cover-view` / `cover-image` | 显示辅助框、箭头、状态文字 |
| 图片压缩 | `wx.compressImage` | 拍照后压缩到较小体积 |
| 本地存储 | `wx.setStorageSync` | 保存拍摄过程缓存 |
| AI 推理 | `wx.createInferenceSession` + ONNX | 车牌 / 车损检测 |
| AI 模型交付 | 运行时下载到 `wx.env.USER_DATA_PATH` | 按业务环境和模型 URL 隔离缓存 |
| 实时日志 | `wx.getRealtimeLogManager()` | 仅上报 AI 排障关键事件，本地 runtime 日志保留完整 |
| 后台错误日志（待实现） | 在线平台错误日志接口 + Oracle | 只上传明确报错事件，按 `reportNo` 落库排障 |

---

## 二、项目结构

```text
selfCam/
├─ app.js
├─ app.json
├─ app.wxss
├─ package.json
├─ pages/
│  ├─ index/          # 开始页
│  ├─ camera/         # 拍照页
│  ├─ preview/        # 预览页，含单证区
│  ├─ document/       # 备用单证页
│  └─ complete/       # 完成页
├─ components/
│  └─ confirm-modal/  # 通用确认弹窗
├─ utils/
│  ├─ storage.js
│  ├─ storage-schema.js
│  ├─ compress.js
│  ├─ documents.js
│  ├─ permission.js
│  ├─ album.js
│  ├─ constants.js
│  ├─ ai-config.js
│  ├─ env-config.js
│  ├─ model-cache.js
│  ├─ quality-config-default.js
│  ├─ quality-config-loader.js
│  ├─ quality-config.js
│  ├─ photo-quality.js
│  ├─ plate-detector.js
│  ├─ damage-detector.js
│  ├─ frame-utils.js
│  ├─ damage-auto-capture-engine.js
│  ├─ damage-phase-controller.js
│  ├─ damage-tracker.js
│  ├─ damage-motion-estimator.js
│  ├─ damage-frame-scorer.js
│  ├─ cache-selectors.js
│  ├─ runtime-logger.js
│  └─ realtime-log.js
├─ PRDS/
├─ __tests__/        # 纯 Jest 单元/逻辑测试
├─ e2e/              # 微信开发者工具 miniprogram-automator + Jest 页面自动化
└─ docs/
   └─ backend-integration/ # 后台对接设计文档
```

---

## 三、页面职责

### 1. `pages/index`

- 展示横屏单屏首页品牌 logo、拍摄须知和开始入口
- 非正式版 logo 区域承载隐藏业务环境切换入口
- 初始化第一辆车
- 清空或重建拍摄缓存
- 点击 `开始采集` 后跳转到 `pages/camera`

### 2. `pages/camera`

核心职责：

- 读取缓存并恢复当前车辆 / 当前步骤
- 初始化相机上下文
- 基于横屏窗口尺寸计算相机区显示尺寸，保持 4:3 和三栏布局
- 管理 AI 检测循环
- 管理辅助框、顶部引导、底部 AI 状态
- 触发拍照、压缩、确认
- 在拍后确认前调用端上轻质检模块
- 保存照片并推进流程

相机区布局规则：

- `cameraLayout` 在 `onLoad`、`onShow`、`onResize` 时刷新。
- 布局计算按横屏窗口长边复刻旧版 `400rpx x 300rpx` 视觉尺寸，仅当三栏总宽或总高放不下时等比缩小。
- `safeArea` 只记录诊断信息，不参与主宽度压缩，避免部分横屏设备返回竖屏安全区导致相机区变小。
- 车牌框、VIN 框、车损框和距离提示箭头使用相对相机区的百分比布局。
- 普通 iOS/Android 横屏下，文字、按钮、取景框边框和取景框 inline 样式保持空值，继续走原有 WXSS `rpx` 表现；当 `layoutScale >= 1.3`，或系统为 OpenHarmony/OHOS 横屏时，才输出专用 `px` 缩放样式。
- AI 判断仍使用固定虚拟 `400 x 300` 坐标系，`getPlateCaptureBox()`、`getDamageCaptureBox()`、`checkFrameStatus(..., 400, 300)` 和车损 `canvasWidth/canvasHeight` 不随显示尺寸改变。
- 实时帧检测结果进入 AI 判定前，先通过 `createVirtualCameraMapping()` 映射到虚拟 `400 x 300` 坐标；4:3 帧沿用旧的独立缩放，宽屏帧按相机预览的 aspect-fill 裁剪逻辑换算，正方形/窄于 4:3 的帧按高度贴合并左右补边，业务阈值不随设备分辨率变化。

### 3. `pages/preview`

核心职责：

- 汇总并展示所有车辆照片与每辆车行驶证资料
- 支持重拍、删除、补拍、补充车损
- 支持添加三者车
- 集成车辆级行驶证资料上传、替换、删除和模式切换
- 完成提交前先确认三者车，再提示行驶证风险
- `previewLayout` 复用通用横屏 UI 缩放判定，普通 iOS/Android 横屏保持原 WXSS `rpx` 表现，OpenHarmony/OHOS 横屏或高分辨率横屏才为主列表、缩略图、底栏、行驶证面板和全屏预览浮层输出 `px` 样式。

### 4. `pages/document`

- 保留为备用单证页
- 当前主流程默认不使用

### 5. `pages/complete`

- 汇总缓存中的车辆数、车损照片数和单证照片数
- 直接读取 `cache-selectors.getCacheSummary(cache)` 中的 `vehicleCount`、`damagePhotoCount`、`documentPhotoCount`
- 支持退出小程序
- 支持返回预览继续修改

---

## 四、路由与主流程

`app.json` 当前仍注册以下页面：

```json
{
  "pages": [
    "pages/index/index",
    "pages/camera/camera",
    "pages/preview/preview",
    "pages/document/document",
    "pages/complete/complete"
  ]
}
```

主流程路由：

```text
index
  -> camera（标的车车牌）
  -> camera（VIN）
  -> camera（车损，可连续拍多张）
  -> preview
  -> camera（补拍 / 重拍 / 新增三者车）
  -> preview
  -> complete
```

辅助跳转规则：

- 从预览页返回拍照页时，使用缓存字段 `fromPreview`
- 当 `fromPreview = true` 且 `currentStep` 是车牌/VIN/车损等拍摄步骤时，安全恢复应优先落到 `CAPTURING`，用于预览页补拍或添加车损后继续拍摄
- 拍照页结束后：
  - 若 `fromPreview = true` 且栈内存在预览页，优先 `navigateBack`
  - 否则 `navigateTo` / `redirectTo` 到预览页

---

## 五、缓存与数据结构

缓存 Key：

```js
const STORAGE_KEY = 'car_damage_photos_cache'
```

`utils/storage.js` 中的初始化结构：

```js
{
  vehicles: [],
  documents: [],
  currentStep: 'licensePlate',
  currentVehicleIndex: 0,
  currentDamageCount: 0,
  retakeMode: {
    enabled: false,
    vehicleIndex: null,
    photoType: null,
    damageIndex: null
  },
  fromPreview: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}
```

### 车辆结构

`createVehicle(index)` 当前返回：

```js
{
  id: `vehicle_${Date.now()}`,
  type: index === 0 ? '标的车' : `三者车${index}`,
  licensePlate: { status: 'pending' },
  vinCode: { status: 'pending' },
  damages: [],
  documents: [],
  documentSelections: {
    driving_license: 'physical'
  }
}
```

### 车辆级单证结构

`v1.3.5` 在每辆车对象上增加通用单证结构，当前用于行驶证，后续可扩展驾驶证、身份证、银行卡等类型：

```js
{
  id: 'document_1713777777777_xxx',
  docType: 'driving_license',
  docSide: 'front_page' | 'back_page' | 'electronic',
  label: '行驶证正页' | '行驶证副页' | '电子行驶证',
  vehicleId: 'LOSS_VEHICLE_100001',
  uploadItemId: 'LOSS_VEHICLE_100001_DRIVING_LICENSE_FRONT',
  photoType: 'DRIVING_LICENSE_FRONT' | 'DRIVING_LICENSE_BACK' | 'DRIVING_LICENSE_ELECTRONIC',
  sourceType: 'camera' | 'album',
  tempFilePath: 'wxfile://tmp_license.jpg',
  compressedPath: 'wxfile://tmp_license_compressed.jpg',
  size: 456789,
  compressedSize: 380000,
  createdAt: 1713777777777,
  updatedAt: 1713777777777
}
```

辅助拍照模式下，预览页行驶证槽位由当前车辆 `uploadItems` 对齐后端上传项：实物行驶证正页映射 `DRIVING_LICENSE_FRONT`，副页映射 `DRIVING_LICENSE_BACK`，电子行驶证映射 `DRIVING_LICENSE_ELECTRONIC`。本阶段只在本地缓存保存 `vehicleId/uploadItemId/photoType`，不调用真实 `uploadPhoto`。

车辆级选择方式：

```js
vehicle.documentSelections = {
  driving_license: 'physical' | 'electronic'
}
```

兼容规则：

- 旧缓存车辆没有 `documents` 时补空数组。
- 旧缓存车辆没有 `documentSelections` 时补 `{ driving_license: 'physical' }`。
- schema v2 修复不改变旧车牌、VIN、车损数据。

### 照片元信息

`normalizePhotoMeta()` 会为照片补齐：

- `captureMode`：`auto` / `manual`
- `captureTrigger`：`ai_auto` / `manual_button` 等
- `aiDetection`：检测元信息
- `quality`：轻质检摘要元数据

`quality` 当前采用纯数据结构，至少包含：

```js
{
  level: 'good' | 'warn' | 'bad',
  suggestRetake: true | false,
  reasons: [],
  metrics: {
    brightness: 0,
    darkRatio: 0,
    brightRatio: 0,
    blurScore: 0,
    contrast: 0,
    sampledWidth: 0,
    sampledHeight: 0
  },
  analyzedAt: '2026-04-27T00:00:00.000Z',
  configVersion: '...'
}
```

缓存摘要层会继续在不修改输入 cache 的前提下，生成：

- `qualitySummary.totalPhotos`
- `qualitySummary.analyzedCount`
- `qualitySummary.riskCount`
- `qualitySummary.suggestRetakeCount`
- `qualitySummary.riskReasons`
- `qualitySummary.riskPhotos`
- `qualitySummary.failedCount`
- `qualitySummary.disabledCount`
- `qualitySummary.lowConfidenceCount`
- `qualitySummary.unanalyzedCount`

---

## 六、拍照页状态机

### 1. 业务步骤

由 `utils/constants.js` 定义：

```js
const SHOOT_STEP = {
  LICENSE_PLATE: 'licensePlate',
  VIN_CODE: 'vinCode',
  DAMAGE: 'damage',
  PREVIEW: 'preview'
}
```

正常顺序：

```text
licensePlate -> vinCode -> damage -> preview
```

### 2. 拍照页关键 `data`

`pages/camera/camera.js` 当前维护的关键状态包括：

- `currentStep`
- `guideTip`
- `vehicleType`
- `damageCount`
- `showConfirmModal`
- `pendingPhoto`
- `aiStatusText`
- `aiReady / aiAvailable / aiEnabled / aiLocked`
- `plateFrameState`
- `plateDistanceHint`
- `plateBlinkFrame`
- `damageFrameState`
- `damageAreaRatioText`
- `showDamageDebug`
- `cameraLayout`

### 3. 保存逻辑

拍照后统一进入确认态。确认后：

- 车牌：写入 `currentVehicle.licensePlate`，步骤切到 `VIN`
- VIN：写入 `currentVehicle.vinCode`，步骤切到 `damage`
- 车损：写入 `currentVehicle.damages`

车损步骤下的特殊逻辑：

- 达到 5 张时自动进入预览页
- 未达到 5 张时留在拍照页继续拍
- 用户也可以点击 `完成拍摄` 主动进入预览页

---

## 七、图片处理链路

统一链路：

```text
cameraContext.takePhoto
  -> compress.compressImage()
  -> photoQuality.analyzePhotoQuality()
  -> 生成 pendingPhoto
  -> 显示确认态
  -> 确认后写入 storage
```

补充说明：

- `photoQuality.analyzePhotoQuality()` 只在拍后单张照片上执行，不进入实时预览流
- 质量阈值与开关统一来自 `quality-config`
- 完成页不直接遍历原始 cache，而是统一读取 `cacheSelectors.getCacheSummary(cache)` 中的统计字段
- `qualitySummary` 仍由摘要层统一生成，但当前轻量完成页不直接展示质量提示卡片

压缩策略：

- 使用 `wx.compressImage`
- 目标控制在 300KB 左右
- 压缩后的 `compressedPath` 作为后续展示与缓存主路径

---

## 八、AI 自动拍照架构

### 1. 模型路径与下载

`utils/ai-config.js` 当前配置：

```js
const resolvedAiConfig = envConfig.getAiConfig()
const PLATE_MODEL_PATH = resolvedAiConfig.plateModelPath
const DAMAGE_MODEL_PATH = resolvedAiConfig.damageModelPath
const PLATE_MODEL_URL = resolvedAiConfig.plateModelUrl
const DAMAGE_MODEL_URL = resolvedAiConfig.damageModelUrl
```

说明：

- 模型不随主包直接打包
- 本地模型文件统一写入 `USER_DATA_PATH`，文件名包含模型类型、业务环境和模型 URL hash
- `utils/env-config.js` 维护 `BUSINESS_ENV_ENDPOINTS`，`ai-config.js` 不写死模型地址
- 当前 `sit.modelHost` 为 `https://onlineclaimsit.chinalife-p.com.cn/video/model`
- 当前 `dev.modelHost` 也指向同一 SIT 模型地址，便于开发环境调试复现体验版模型下载与推理问题
- 非 `dev` 业务环境禁止使用 `http`、`localhost`、`127.0.0.1` 和局域网 IP 模型地址
- 拍照页不再从 `ai-config.js` 引入固化的模型 URL / path 常量；创建检测器前实时调用 `envConfig.getAiConfig()` 并通过 `options.aiConfig` 传入检测器
- 创建检测器前打印 `wxEnvVersion`、`appEnv`、`plateModelUrl`、`damageModelUrl`，用于真机确认当前业务环境
- 推理能力依赖 `wx.createInferenceSession`
- 车牌/车损检测器创建推理 session 前会轻量调用 `wx.getInferenceEnvInfo`，结果仅记录日志，不阻断加载。
- 车牌/车损 `wx.createInferenceSession` 统一使用 `precisionLevel=0`、`allowNPU=false`、`allowQuantize=false`，避免部分真机因旧的 `precisionLevel=1/4` 尝试逻辑返回无效 session。
- 若推理不可用，则自动降级为手动拍照

### 2. AI 调度入口

`pages/camera/camera.js`

关键方法：

- `initAICapability()`
- `ensureDetector(step)`
- `resumeAIDetection()`
- `resumeAIDetectionAfterStepReady(reason)`
- `startAIFrameListener(reason)`
- `stopAIFrameListener(reason)`
- `takeAIPreviewPhoto()`
- `startAIDetectionLoop(step)`
- `checkAutoCaptureReady(step, framePayload)`
- `triggerAutoCapture(step, aiDetection)`

启动时机约束：
- `resumeAIDetection()` 会先判断当前步骤、确认态、离页状态、相机初始化状态和已有循环状态。
- `loadCacheData()` 必须在 `setData` 完成后再调用 `resumeAIDetectionAfterStepReady()`，避免 `currentStep` 尚未落定导致车损检测没有启动。
- `onCameraInitDone()` 设置 `cameraInitialized = true` 后，会针对当前步骤再次尝试恢复检测。
- 车牌/车损 AI 检测恢复时启动 `CameraContext.onCameraFrame` 监听，保存最新实时帧到 `latestAIFrame`。
- `takeAIPreviewPhoto()` 不再调用低清 `cameraContext.takePhoto()`，而是将最新实时帧通过离屏 canvas 转成临时图片路径后继续交给 `detector.detect(imagePath)`。
- 若当前没有可用实时帧，则跳过当前检测轮，不回退到低清拍照抽帧。
- 每次停止检测会递增 `aiDetectionRunId`，旧检测循环在异步返回后不再继续调度，避免重复循环。

### 3. 检测节奏

来自 `AUTO_CAPTURE` 配置：

- 通用检测间隔：`650ms`
- 车牌检测间隔：`800ms`
- 自动拍照冷却：`2500ms`
- 车损预览轮询：`280ms`
- 车损 `SEEK` 阶段按 `detectorEveryNFrames = 3` 降频执行；进入 `HOLD / SHOOT` 后每帧执行检测，保证稳定后尽快拿到候选帧
- 以上检测节奏只控制 AI 处理频率；实时帧来源为 `onCameraFrame`，不会触发系统快门。

### 4. 环境配置收口

- `utils/env-config.js` 作为统一环境配置入口
- 统一读取 `wx.getAccountInfoSync().miniProgram.envVersion`，并作为 `wxEnvVersion`
- 支持 `develop / trial / release` 三种微信运行版本，并在 `wx` 不存在或 API 异常时安全降级到 `develop`
- 新增业务环境 `appEnv: dev / sit / pilot / prod`
- 默认映射：`develop -> dev`、`trial -> sit`、`release -> prod`
- `develop / trial` 允许通过本地缓存 `SELF_CAM_APP_ENV` 覆盖业务环境；`release` 强制 `prod`
- 首页隐藏入口负责写入或清除 `SELF_CAM_APP_ENV`，切换后通过 `wx.reLaunch` 重新进入首页
- 同一隐藏入口提供“清除 AI 模型缓存”，只删除当前环境 `plateModelPath` / `damageModelPath` 指向的 onnx 文件，不清除照片、车辆、单证或流程缓存
- `dev / sit / pilot` 在首页、拍照页、预览页显示低权重环境标识，`prod` 不显示
- `app.js`、`utils/ai-config.js`、`utils/runtime-logger.js`、`utils/quality-config-loader.js` 与 `pages/camera/camera.js` 复用这层能力
- `release` 默认关闭调试上传、开发面板与非必要日志，避免各模块继续散落环境判断

---

### 5. 在线平台错误日志对接（待实现）

- 小程序启动参数中的报案号字段名为 `reportNo`。
- 当前阶段不新增缺少 `reportNo` 的入口阻断；接口闭环前，缺少 `reportNo` 时只保留本地日志，不调用后台错误日志接口。
- 后续在 `runtime-logger` 内部增加在线平台错误上传通道，不在每个页面报错点直接调用后台接口。
- 页面和工具模块仍只调用 `runtimeLogger.error(...)` 或 `runtimeLogger.forceError(...)`，由 `runtime-logger` 统一按错误事件白名单过滤、入队和上传。
- 后台错误日志只上传明确失败事件，不上传页面生命周期、正常拍照流程、AI 几何诊断快照或普通调试日志。
- 首批上报事件限定为：
  - `ai_model/download_failed`
  - `ai_model/download_status_failed`
  - `ai_model/cache_copy_failed`
  - `ai_model/model_file_invalid`
  - `ai_model/session_create_failed`
  - `ai_model/session_load_failed`
  - `ai/ai_unavailable`
  - `ai/detector_init_failed`
  - `ai/detect_loop_error`
  - `capture/auto_capture_failed`
  - `camera/camera_error`
  - `api/request_failed`
- 接口按批量设计，前端第一版可单条或小批量发送，最多缓存 20 条待上传错误；失败静默处理，不阻断主流程。
- 详细接口和 Oracle 表设计见 `docs/backend-integration/error-log-api.md`。

---

## 九、车牌自动拍照实现

### 1. 检测组件

- `PlateDetector`
- `PlateFrameUtils`

### 2. 当前判定参数

```js
AUTO_CAPTURE.PLATE = {
  detectInterval: 800,
  minConsecutiveFrames: 3,
  minAreaRatio: 0.35,
  maxAreaRatio: 1.5,
  scoreThreshold: 0.7,
  iouThreshold: 0.5
}
```

### 3. 判定过程

`PlateFrameUtils.checkFrameStatus()` 会根据：

- 目标中心是否在捕获框内
- 中心偏移是否足够小
- 面积比是否在范围内
- 连续稳定帧是否达标

生成：

- `inBox`
- `consecutiveMet`
- `centerAligned`
- `areaRatio`
- `consecutiveCount`
- `mappedBox`
- `frameMapping`

### 4. 距离引导箭头

当前实现已经从 CSS 动画切到 JS 控制的静态帧切换。

实现要点：

- WXML 中预置两组整帧箭头：
  - A 帧：`135 蓝 / 246 白`
  - B 帧：`135 白 / 246 蓝`
- `plateBlinkFrame` 在 `a / b` 间切换
- `startPlateBlink()` 使用 `setInterval(..., 400)` 定时切帧
- `schedulePlateHintClear(900)` 用于检测丢帧时延迟清空提示
- 当方向消失但仍在车牌页时，使用 `500ms` 的更短清理延时
- 车损步骤复用同一套 `plateBlinkFrame`、定时器与清理逻辑，只额外增加 `damageDistanceHint`
- 车牌页高频状态刷新通过 `setDataIfChanged()` 过滤，避免相同状态反复刷新相机覆盖层

技术目的：

- 降低 `camera + cover-view` 原生覆盖层内复杂 CSS 动画带来的不稳定
- 降低周期性预览抓图与覆盖层刷新对相机预览流畅度的影响
- 保证真机表现优先于视觉复杂度

---

## 十、车损自动拍照实现

### 1. 当前实现不是旧版“远离/靠近”搜索流

当前代码已经采用更保守的稳定判断流：

```text
SEEK -> HOLD -> SHOOT
```

不再使用旧文档中的：

- 起始区间 `40%~50%`
- 旧版 `0.72x / 1.42x` 远近倍率流程已下线

### 2. 核心组件

- `DamageDetector`
- `DamageAutoCaptureEngine`
- `DamageTracker`
- `DamageMotionEstimator`
- `DamagePhaseController`
- `DamageFrameScorer`

### 3. 当前流程

`DamageAutoCaptureEngine.update()` 内部做了四层工作：

1. 跟踪：根据当前检测框与历史信息维持目标轨迹
2. 运动估计：计算质量、稳定度、中心偏移、面积比例
3. 阶段控制：`SEEK / HOLD / SHOOT`
4. 候选帧打分：从稳定阶段候选中选出最佳帧

### 4. 当前关键参数

来自 `AUTO_CAPTURE.DAMAGE_FLOW.phase`：

```js
{
  seekMinDetectedFrames: 2,
  seekQualityThreshold: 0.22,
  seekCenterThreshold: 0.42,
  minAreaRatio: 0.5,
  maxAreaRatio: 1,
  holdMinDwellMs: 240,
  holdStableFrames: 2,
  holdQualityThreshold: 0.28,
  holdStabilityThreshold: 0.42,
  holdCenterThreshold: 0.34,
  holdAreaGraceFrames: 2,
  lostGraceMs: 600,
  lostResetMs: 1200,
  lowQualityThreshold: 0.18
}
```

面积口径说明：

- `imageAreaRatio = 检测框面积 / 整张图或整张 canvas 面积`
- `captureAreaRatio = 检测框面积 / 车损取景框面积`
- `areaRatio` 当前等同于 `imageAreaRatio`，下游 `DamagePhaseController / DamageMotionEstimator / DamageFrameScorer` 继续读取 `motion.areaRatio`
- `minAreaRatio = 0.5`、`maxAreaRatio = 1` 仍表示“占车损取景框 50%～100%”的业务标准
- 运行时会按 `captureBoxImageRatio = captureBoxArea / canvasArea` 换算 `effectiveMinAreaRatio / effectiveMaxAreaRatio`，供阶段判断和距离提示使用

### 5. 状态文案来源

`utils/damage-phase-controller.js` 当前使用的状态文案：

- `请对准车损处`
- `已识别到车损`
- `请保持稳定`
- `已稳定，即将拍摄`

### 6. 自动拍照条件

车损自动拍照需要同时满足：

- 检测或跟踪状态健康
- 当前阶段达到 `SHOOT`
- `DamageFrameScorer` 能选出最佳候选帧
- 首次识别到车损时，中心偏移直接使用当前值；HOLD 阶段短暂面积出界允许 2 帧缓冲

只有 `phaseState.captureReady === true` 且存在最佳候选帧时，最终才会触发自动拍照。

### 7. 车损面积引导提示

在车损步骤中，面积引导不再单独走旧版搜索流，而是附着在当前稳定流上：

- 已识别到车损且 `imageAreaRatio < effectiveMinAreaRatio` 时：
  - `damageDistanceHint = 'forward'`
  - 底部状态文案切为 `请靠近一点`
- 已识别到车损且 `imageAreaRatio > effectiveMaxAreaRatio` 时：
  - `damageDistanceHint = 'backward'`
  - 底部状态文案切为 `请稍微远离`
- 当面积重新回到阈值范围内时：
  - 清空 `damageDistanceHint`
  - 恢复 `DamagePhaseController` 产出的正常状态文案

当前业务阈值来源仍是 `AUTO_CAPTURE.DAMAGE_FLOW.phase`：

- `minAreaRatio = 0.5`
- `maxAreaRatio = 1`

实际判断使用换算后的整图比例阈值。例如当前 400x300 canvas、132x132 车损取景框下：

- `captureBoxImageRatio = 132 * 132 / (400 * 300) = 0.1452`
- `effectiveMinAreaRatio = 0.5 * 0.1452 = 0.0726`
- `effectiveMaxAreaRatio = 1 * 0.1452 = 0.1452`

---

## 十一、预览页实现细节

### 1. 照片汇总

`pages/preview/preview.js` 会把车辆照片和单证统一拼装为 `allPhotos`，供全屏预览使用。

车辆级行驶证会作为 `type = 'vehicleDocument'` 的照片项追加到对应车辆照片列表后，复用全屏预览、重拍和删除入口。

### 2. 重拍逻辑

重拍时写入：

```js
retakeMode = {
  enabled: true,
  vehicleIndex,
  photoType,
  damageIndex
}
```

拍照完成后按原位置替换。

行驶证重新上传不进入拍照页主状态机，而是在预览页内调用 `wx.chooseMedia` 重新选择当前 `docType + docSide`，再通过 `storage.saveVehicleDocument()` 替换旧记录。

### 3. 进度点逻辑

当前底部进度点并不是按“至少 1 张车损”计算完成，而是按：

- 标的车：车牌完成 + VIN 完成 + 车损数量达到 `MAX_DAMAGES`
- 三者车：同样要求车损数量达到 `MAX_DAMAGES`

这与 `storage.checkVehicleComplete()` 的“至少 1 张车损即完整”存在差异，是当前实现现状。

### 4. 行驶证完成态

行驶证完成态由 `utils/documents.js` 统一判断：

- `documentSelections.driving_license === 'physical'`：必须同时存在 `front_page` 和 `back_page`。
- `documentSelections.driving_license === 'electronic'`：必须存在 `electronic`。
- 切换实体/电子模式只更新 `documentSelections`，不删除 `documents[]` 中已上传图片。

### 5. 提交前弹窗顺序

`pages/preview/preview.js` 的提交顺序：

```text
onSubmit()
  -> startSubmitFlow()
  -> 若可添加三者车，先显示 thirdVehicle 弹窗
  -> 用户点击“是，继续提交”后 checkDrivingLicenseBeforeSubmit()
  -> 若有车辆行驶证未完成，显示 drivingLicenseRisk 弹窗
  -> 用户点击“确认提交”后 submitComplete()
```

`confirm-modal` 从 `v1.3.5` 起区分三种事件：

- `confirm`：右侧主按钮
- `cancel`：左侧按钮
- `masktap`：点击空白遮罩，只关闭弹窗

### 6. 总照片容量上限

总照片数通过 `cacheSelectors.getCacheSummary(cache).totalPhotos` 统计，范围包含：

- 车辆车牌、VIN、车损照片。
- 车辆级行驶证资料 `vehicle.documents[]`。
- 兼容保留的根级 `documents[]`。

`utils/constants.js` 维护 `LIMITS.MAX_TOTAL_PHOTOS = 50`。以下新增入口必须先检查容量：

- 拍照页 `onConfirmPhoto()`。
- 预览页 `onAddDamage()`、`chooseDrivingLicenseImage()`、`onTakePhoto()`、`onChooseAlbum()`。
- 备用单证页 `onTakePhoto()`、`onChooseAlbum()`。

达到上限时只显示 `最多50张，请先删除`，不写入 cache，不触发新增图片流程。删除任意照片后，容量即时释放。

---

## 十二、测试与自动化

当前测试分两层：

- 默认 `npm test` 运行根级 `jest.config.js` 指定的单元/逻辑测试，不混入微信开发者工具页面自动化。
- `npm run test:automator` 运行 `e2e/jest.config.js`，通过 `miniprogram-automator` 连接或启动微信开发者工具执行页面自动化。

页面自动化当前覆盖：

- 首页冒烟与开始采集跳转
- VIN 提示与确认态文案
- 预览页添加图片成功、取消、失败兜底
- 车损 AI 在 `onCameraInitDone()` 后恢复检测且不重复启动循环
- 连续确认/重拍、连续打开关闭添加图片弹层、快速步骤切换和损坏缓存恢复等破坏性场景
- P0 容量边界、删除补拍、重拍替换、多车满图、提交一致性和恢复乱序场景

自动化环境通过以下变量配置：

- `WECHAT_DEVTOOLS_CLI` / `WECHAT_CLI_PATH`
- `MINIPROGRAM_PROJECT_PATH`
- `MINIPROGRAM_AUTOMATOR_PORT`
- `E2E_TIMEOUT_MS`

新增 e2e 命令：

```powershell
npm run test:e2e:capacity
npm run test:e2e:chaos
npm run test:e2e:p0
npm run test:e2e:full
```

## 十三、当前已知实现备注

### 1. 文档与主流程差异已清理

本次文档更新后，已明确以下现状：

- 车损流程为稳定判定流，不是远近搜索流
- 车牌与车损箭头都为两整组静态帧切换，不是覆盖层复杂动画
- 车牌检测间隔已单独降频到 `800ms`，并过滤重复 `setData`，优先保证移动镜头时的预览流畅度
- 行驶证主入口在预览页每辆车照片列表末尾，不是独立页面

### 2. 仍需关注的实现差异

- 预览页进度点的“完成”定义与实际允许提交条件不完全一致
- `document` 页面和全局 `documents` 数组仍保留兼容，但不是当前行驶证主入口
- AI 模型地址与调试上传地址后续如需接正式静态资源或在线配置，应继续统一扩展到 `env-config`，不要回退到模块内硬编码

---

## v1.3.4 同步备注

- 本版本仅收敛首页权限申请、相册保存失败轻提示和开始采集防重复点击。
- 不修改 UI 样式，不修改拍照、缓存、重拍、补拍、预览主流程。
- 项目未主动调用 backgroundFetch 相关 API，本版本不新增相关处理。

---

## v1.3.4 权限与相册保存技术补充

### `utils/permission.js`

- 模块只保留 `scope.camera` 与 `scope.writePhotosAlbum` 两类权限处理。
- `ensureStartCapturePermissions()` 返回简单结果：`{ cameraGranted, albumGranted }`。
- 相机权限处理流程：
  - 已授权：直接返回 `true`。
  - 未出现过授权结果：调用 `wx.authorize({ scope: 'scope.camera' })`。
  - 已拒绝或授权失败：通过 `wx.showModal` 引导用户进入 `wx.openSetting`。
  - 最终仍未授权：返回 `false`，首页不进入拍摄页。
- 相册权限处理流程：
  - 已授权：返回 `true`。
  - 已拒绝：返回 `false` 并记录日志，不阻断开始采集。
  - 未出现过授权结果：调用 `wx.authorize({ scope: 'scope.writePhotosAlbum' })`，失败返回 `false`。
- 不保留权限状态机、权限历史缓存、重试计时器或 backgroundFetch 相关逻辑。

### `utils/album.js`

- `getConfirmedPhotoPath(photo)` 按 `compressedPath -> tempFilePath -> originalPath -> filePath` 选择保存路径。
- `saveConfirmedPhotoToAlbum(photo)` 只负责触发相册保存并返回结果对象，不向调用方抛出异常。
- 保存成功返回 `{ saved: true, filePath }`，不调用 `wx.showToast`。
- 普通保存失败返回 `{ saved: false, reason: 'save_failed', err }`，并调用 `wx.showToast({ title: '照片未保存到相册，不影响拍摄', icon: 'none' })`。
- 权限拒绝类失败返回 `{ saved: false, reason: 'permission_denied', err }`，只记录日志，不弹失败提示。
- 缺少路径、API 不可用、同步异常等分支都 resolve 失败结果，避免阻断确认流程。
- 不使用 `wx.hideToast` 或延迟隐藏逻辑处理系统原生保存成功提示。

### 页面接入点

- `pages/index/index.js` 在 `onStart()` 中使用 `isStartingCapture` 防重复点击，并用 `try/catch/finally` 确保流程结束后释放锁。
- `startCaptureFlow()` 保留原缓存初始化和 `/pages/camera/camera` 跳转目标，只把 `wx.navigateTo` 包装为 Promise 以便异常兜底。
- `pages/camera/camera.js` 在 `onConfirmPhoto()` 中只写入采集缓存并推进步骤，不再调用相册保存工具。
- `onRetakePhoto()` 不调用相册保存工具，重拍照片不保存到系统相册。
- `pages/preview/preview.js` 在 `完成采集` 的三者车确认、行驶证风险确认之后，统一计算相册保存候选并弹出最终保存确认。
- `utils/cache-selectors.js` 提供 `getAlbumSaveCandidates(cache)`，只返回当前缓存中未保存过、非相册来源且路径去重后的候选图片。
- `utils/album.js` 提供 `savePhotosToAlbumBatch(candidates)`，顺序保存候选图片并返回批量汇总，不逐张弹失败提示。

---

## v1.3.5 行驶证资料技术补充

### 模块职责

- `utils/documents.js`：行驶证类型常量、默认选择模式、旧数据归一化、完成态判断、面板槽位和预览项构建。
- `utils/storage-schema.js`：schema v2 迁移与修复，保证旧缓存车辆补齐 `documents` 和 `documentSelections`。
- `utils/storage.js`：提供 `setVehicleDocumentSelection()`、`saveVehicleDocument()`、`deleteVehicleDocument()`。
- `utils/cache-selectors.js`：将车辆级行驶证纳入 `photoEntries`、`allPhotos`、`documentPhotoCount` 和质量汇总。
- `pages/preview/preview.js`：负责行驶证面板、上传来源选择、压缩、保存相册、替换、删除、预览和提交风险提示。

### 上传链路

```text
点击行驶证上传位
  -> wx.showActionSheet(['拍照', '从手机相册选择'])
  -> wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType })
  -> compress.compressImage(tempFilePath, { maxFileSize: 400 * 1024 })
  -> storage.saveVehicleDocument(vehicleIndex, documentRecord)
  -> camera 来源只记录 sourceType，不立即保存到手机相册
  -> loadData() 刷新预览页
```

### 最终相册保存链路

```text
点击完成采集
  -> 三者车确认
  -> 行驶证风险确认
  -> cacheSelectors.getAlbumSaveCandidates(cache)
  -> 候选为空：直接进入完成页
  -> 候选不为空：弹出是否保存至手机相册
  -> 用户暂不保存：记录 albumSaveSummary.decision = skipped，进入完成页
  -> 用户确认保存：permission.ensureAlbumSavePermission()
  -> album.savePhotosToAlbumBatch(candidates)
  -> 写入 albumSaveRecords 和 albumSaveSummary
  -> 进入完成页
```

- 每张新拍、重拍、上传或替换的照片生成新的 `localPhotoId`。
- `albumSaveRecords` 按 `localPhotoId` 记录保存结果，避免完成页返回修改后二次完成重复保存旧图。
- 替换照片不会继承旧照片的保存记录；删除照片只影响当前缓存，不尝试删除用户手机相册中的旧图。

### 替换与删除

- 保存时按 `docType + docSide` 查找旧记录，存在则替换，不存在则追加。
- 删除时按 `docType + docSide` 移除记录并同步缓存。
- 删除或替换后由 `utils/documents.js` 重新计算当前车辆行驶证完成态。
