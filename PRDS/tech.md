# 技术架构文档

> 项目名称：车辆损失辅助拍照工具
> 代码基线：v1.1.0（`package.json`）
> 文档状态：已按当前实现对齐
> 最后更新：2026-04-22

---

## 一、技术栈

| 层级 | 当前方案 | 说明 |
| --- | --- | --- |
| 运行环境 | 微信小程序原生 | 不依赖跨端框架 |
| 页面层 | `wxml + wxss + js` | 原生页面与组件 |
| 相机 | `camera` + `wx.createCameraContext()` | 负责预览与拍照 |
| 覆盖层 | `cover-view` / `cover-image` | 显示辅助框、箭头、状态文字 |
| 图片压缩 | `wx.compressImage` | 拍照后压缩到较小体积 |
| 本地存储 | `wx.setStorageSync` | 保存拍摄过程缓存 |
| AI 推理 | `wx.createInferenceSession` + ONNX | 车牌 / 车损检测 |
| AI 模型交付 | 运行时下载到 `wx.env.USER_DATA_PATH` | 避免主包体积过大 |

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
│  ├─ compress.js
│  ├─ constants.js
│  ├─ ai-config.js
│  ├─ plate-detector.js
│  ├─ damage-detector.js
│  ├─ frame-utils.js
│  ├─ damage-auto-capture-engine.js
│  ├─ damage-phase-controller.js
│  ├─ damage-tracker.js
│  ├─ damage-motion-estimator.js
│  ├─ damage-frame-scorer.js
│  └─ runtime-logger.js
├─ PRDS/
└─ docs/
```

---

## 三、页面职责

### 1. `pages/index`

- 展示开始页说明
- 初始化第一辆车
- 清空或重建拍摄缓存
- 跳转到 `pages/camera`

### 2. `pages/camera`

核心职责：

- 读取缓存并恢复当前车辆 / 当前步骤
- 初始化相机上下文
- 管理 AI 检测循环
- 管理辅助框、顶部引导、底部 AI 状态
- 触发拍照、压缩、确认
- 保存照片并推进流程

### 3. `pages/preview`

核心职责：

- 汇总并展示所有车辆照片与单证
- 支持重拍、删除、补拍、补充车损
- 支持添加三者车
- 集成单证资料上传
- 完成提交前的二次询问

### 4. `pages/document`

- 保留为备用单证页
- 当前主流程默认不使用

### 5. `pages/complete`

- 汇总缓存中的车辆数和照片数
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
  damages: []
}
```

### 照片元信息

`normalizePhotoMeta()` 会为照片补齐：

- `captureMode`：`auto` / `manual`
- `captureTrigger`：`ai_auto` / `manual_button` 等
- `aiDetection`：检测元信息

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
  -> 生成 pendingPhoto
  -> 显示确认态
  -> 确认后写入 storage
```

压缩策略：

- 使用 `wx.compressImage`
- 目标控制在 300KB 左右
- 压缩后的 `compressedPath` 作为后续展示与缓存主路径

---

## 八、AI 自动拍照架构

### 1. 模型路径与下载

`utils/ai-config.js` 当前配置：

```js
const PLATE_MODEL_PATH = `${wx.env.USER_DATA_PATH}/plate.onnx`
const DAMAGE_MODEL_PATH = `${wx.env.USER_DATA_PATH}/damage.onnx`
const MODEL_HOST = 'http://192.168.100.100:8000'
```

说明：

- 模型不随主包直接打包
- 首次需要从远程地址下载到 `USER_DATA_PATH`
- 推理能力依赖 `wx.createInferenceSession`
- 若推理不可用，则自动降级为手动拍照

### 2. AI 调度入口

`pages/camera/camera.js`

关键方法：

- `initAICapability()`
- `ensureDetector(step)`
- `resumeAIDetection()`
- `startAIDetectionLoop(step)`
- `checkAutoCaptureReady(step, framePayload)`
- `triggerAutoCapture(step, aiDetection)`

### 3. 检测节奏

来自 `AUTO_CAPTURE` 配置：

- 通用检测间隔：`650ms`
- 自动拍照冷却：`2500ms`
- 车损预览轮询：`280ms`
- 车损检测器按 `detectorEveryNFrames = 3` 降频执行

---

## 九、车牌自动拍照实现

### 1. 检测组件

- `PlateDetector`
- `PlateFrameUtils`

### 2. 当前判定参数

```js
AUTO_CAPTURE.PLATE = {
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

技术目的：

- 降低 `camera + cover-view` 原生覆盖层内复杂 CSS 动画带来的不稳定
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
  seekCenterThreshold: 0.34,
  minAreaRatio: 0.5,
  maxAreaRatio: 1,
  holdMinDwellMs: 240,
  holdStableFrames: 2,
  holdQualityThreshold: 0.28,
  holdStabilityThreshold: 0.42,
  holdCenterThreshold: 0.26,
  lostGraceMs: 600,
  lostResetMs: 1200,
  lowQualityThreshold: 0.18
}
```

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

只有 `phaseState.captureReady === true` 且存在最佳候选帧时，最终才会触发自动拍照。

---

## 十一、预览页实现细节

### 1. 照片汇总

`pages/preview/preview.js` 会把车辆照片和单证统一拼装为 `allPhotos`，供全屏预览使用。

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

### 3. 进度点逻辑

当前底部进度点并不是按“至少 1 张车损”计算完成，而是按：

- 标的车：车牌完成 + VIN 完成 + 车损数量达到 `MAX_DAMAGES`
- 三者车：同样要求车损数量达到 `MAX_DAMAGES`

这与 `storage.checkVehicleComplete()` 的“至少 1 张车损即完整”存在差异，是当前实现现状。

---

## 十二、当前已知实现备注

### 1. 文档与主流程差异已清理

本次文档更新后，已明确以下现状：

- 车损流程为稳定判定流，不是远近搜索流
- 车牌箭头为两整组静态帧切换，不是覆盖层复杂动画
- 单证主入口在预览页底部，不是独立页面

### 2. 仍需关注的实现差异

- 预览页进度点的“完成”定义与实际允许提交条件不完全一致
- `document` 页面仍保留在路由中，但不是主流程入口
- AI 模型地址当前仍是局域网开发地址，正式发布前需替换为可访问的正式静态资源地址
