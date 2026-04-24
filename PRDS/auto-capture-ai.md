# AI 自动拍照集成文档

> 项目名称：车辆损失辅助拍照工具
> 代码基线：v1.2.1（`package.json`）
> 文档状态：已按当前实现对齐
> 最后更新：2026-04-24

---

## 一、目标

当前 AI 自动拍照的目标不是“识别到就拍”，而是：

- 实时检测目标
- 判断是否进入有效拍摄区域
- 判断是否达到稳定条件
- 触发自动拍照
- 始终保留手动拍照兜底

适用范围：

- 车牌：启用 AI 自动拍照
- VIN：当前不启用 AI 自动拍照
- 车损：启用 AI 自动拍照，但策略更保守

---

## 二、模型与资源交付

### 1. 模型路径

```js
const PLATE_MODEL_PATH = `${wx.env.USER_DATA_PATH}/plate.onnx`
const DAMAGE_MODEL_PATH = `${wx.env.USER_DATA_PATH}/damage.onnx`
```

### 2. 下载地址

```js
const MODEL_HOST = 'http://192.168.100.100:8000'
const PLATE_MODEL_URL = `${MODEL_HOST}/plate.onnx`
const DAMAGE_MODEL_URL = `${MODEL_HOST}/damage.onnx`
```

### 3. 当前策略

- 模型运行时下载到本地
- 依赖 `wx.createInferenceSession`
- 若推理能力不可用，自动降级到手动拍照

---

## 三、集成位置

AI 自动拍照全部集成在：

- `pages/camera/camera.js`

相关模块：

- `utils/plate-detector.js`
- `utils/damage-detector.js`
- `utils/frame-utils.js`
- `utils/damage-auto-capture-engine.js`
- `utils/damage-phase-controller.js`
- `utils/ai-config.js`

---

## 四、统一调度方式

### 1. 初始化

`initAICapability()` 完成：

- 创建 `PlateFrameUtils`
- 创建 `DamageAutoCaptureEngine`
- 判断当前环境是否支持推理
- 设置 `aiAvailable / aiEnabled / aiStatusText`

### 2. 检测循环

`resumeAIDetection()` 会根据当前步骤决定是否开启循环。

仅以下步骤会进入 AI 检测：

- `licensePlate`
- `damage`

以下情况会暂停 AI：

- 当前是 VIN 步骤
- 当前正处于确认弹窗
- 页面离开中
- 相机还未完成初始化

### 3. 统一触发入口

检测结果最终都会进入：

```js
checkAutoCaptureReady(step, framePayload)
```

由它产出：

- `captureReady`
- `statusText`
- `aiDetection`

若 `captureReady = true`，再进入：

```js
triggerAutoCapture(step, aiDetection)
```

---

## 五、车牌自动拍照

### 1. 当前配置

```js
AUTO_CAPTURE.PLATE = {
  detectInterval: 800,
  minConsecutiveFrames: 3,
  minAreaRatio: 0.35,
  maxAreaRatio: 1.5,
  scoreThreshold: 0.7,
  iouThreshold: 0.5,
  targetSize: 640
}
```

### 2. 判定条件

需要同时满足：

- 识别到车牌
- 车牌中心进入车牌捕获框
- 中心偏移足够小
- 面积比在 `0.35 ~ 1.5`
- 连续稳定帧达到 3 帧

### 3. 页面状态

当前车牌页常见状态文案：

- `正在识别车牌…`
- `已识别到目标`
- `请保持稳定`
- `已稳定，即将拍摄`
- `请靠近一点`
- `请稍微后退`
- `请调整目标位置`

### 4. 距离箭头实现

这是当前实现里最明确的一处真机稳定性优化。

#### 结构

- WXML 中预置两组整帧静态箭头
- 每组包含 6 个 `cover-image`
- 两组只是蓝白配色对调

#### 帧定义

- A 帧：`1/3/5 蓝，2/4/6 白`
- B 帧：`1/3/5 白，2/4/6 蓝`

#### 运行方式

- `plateBlinkFrame` 在 `a / b` 间切换
- `startPlateBlink()` 使用 `setInterval(..., 400)`
- 检测丢失时不立即清空箭头，而是：
  - 普通清理延时：`900ms`
  - 方向消失后的短清理：`500ms`
- 同一套切帧逻辑现在同时服务于车牌与车损提示层
- 相机覆盖层状态刷新使用 `setDataIfChanged()` 去重，避免重复状态造成额外重绘

#### 设计原因

- 微信小程序 `camera + cover-view` 原生层对复杂 CSS 无限动画不稳定
- 两整组静态帧切换比多元素动画更稳
- 车牌检测间隔单独降为 `800ms`，减少周期性 `takePhoto(low)` 对预览帧率的影响
- 当前方案优先保证真机稳定性

---

## 六、车损自动拍照

### 1. 当前实现原则

车损自动拍照已经收敛为“保守稳定流”，不是旧版“远离/靠近搜索流”。

当前阶段机：

```text
SEEK -> HOLD -> SHOOT
```

### 2. 引擎结构

`DamageAutoCaptureEngine` 内部包含：

- `DamageTracker`
- `DamageMotionEstimator`
- `DamagePhaseController`
- `DamageFrameScorer`

### 3. 当前流程

#### SEEK

- 目标刚进入有效识别状态
- 需要检测质量、面积比例、中心偏移满足基本门槛
- 连续命中达到 `seekMinDetectedFrames = 2` 后进入 `HOLD`

页面文案：

- `请对准车损处`
- `已识别到车损`
- `请靠近一点`
- `请稍微远离`

#### HOLD

- 已经识别到目标，开始要求稳定
- 需要满足更严格的质量、稳定度、中心偏移门槛
- 达到停留时间与稳定帧阈值后进入 `SHOOT`

页面文案：

- `请保持稳定`

#### SHOOT

- 达到自动拍照条件
- 若已有可用候选帧，则立即准备自动拍照

页面文案：

- `已稳定，即将拍摄`

### 4. 当前关键参数

```js
AUTO_CAPTURE.DAMAGE_FLOW.phase = {
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

### 5. 车损面积引导

当前车损页不是旧版“远近搜索流”，但在已识别到车损后，仍会基于面积比例给出轻量方向提示：

- `areaRatio < 0.5`
  - 显示向前静态箭头
  - 底部状态切为 `请靠近一点`
- `areaRatio > 1.0`
  - 显示向后静态箭头
  - 底部状态切为 `请稍微远离`
- `0.5 <= areaRatio <= 1.0`
  - 收起箭头
  - 恢复 `SEEK / HOLD / SHOOT` 自身的状态文案

实现方式与车牌保持一致：

- 仍是两整组静态箭头帧
- 仍由 `plateBlinkFrame` 控制 `a / b` 两帧切换
- 仍保留短暂延时清理，避免检测抖动导致提示一闪一灭

### 6. 候选帧选择

在 `HOLD` 或 `SHOOT` 阶段，只要有检测框和 `previewPath`，就会把候选帧送入 `DamageFrameScorer`。

最终自动拍照成立条件：

- `phaseState.captureReady = true`
- `frameScorer.getBestCandidate()` 返回有效候选帧

也就是说，当前不是“状态一到就拍”，而是“状态到位且有最佳候选帧才拍”。

### 7. 丢帧与容错

当前容错逻辑：

- `HOLD` 阶段短暂丢失时，允许 `lostGraceMs = 600` 的缓冲
- 若持续丢失达到 `lostResetMs = 1200`，重置回 `SEEK`
- 重置后重新显示 `请对准车损处`

---

## 七、调试与日志

### 1. 开发态调试信息

非 `release` 环境下，车损步骤会显示调试文本，内容来自：

```js
formatDamageDebugText(debug, searchState)
```

当前格式包含：

- `phase`
- `seen`
- `hold`
- `q`
- `s`
- `c`
- `area`

### 2. 运行日志

`runtime-logger` 会记录：

- 页面生命周期
- AI 初始化
- 自动拍照触发
- 车损保存流程
- 页面跳转失败与降级

---

## 八、降级策略

以下情况统一降级到手动拍照：

- `wx.createInferenceSession` 不可用
- 模型加载失败
- 检测长期不稳定
- 当前步骤本身不支持自动拍照（VIN）

用户侧保证：

- 手动拍照按钮始终可点
- 自动拍照失败不阻断流程
- 自动拍照结果也允许重拍和替换

---

## 九、当前实现结论

与旧文档相比，当前系统已经有三点关键收敛：

- 车牌距离引导采用“两整组静态帧切换”，不再依赖覆盖层复杂动画
- 车牌检测已单独降频并过滤重复覆盖层刷新，减少移动摄像头时的预览卡顿
- 车损面积引导已复用同一套静态箭头切帧方案，只在面积过小或过大时提示靠近/远离
- 车损自动拍照采用 `SEEK / HOLD / SHOOT` 稳定流，不再使用 `0.72x / 1.42x` 的远近搜索式交互

后续如果继续迭代 AI 体验，建议仍以“真机稳定优先、手动兜底优先”为前提。
