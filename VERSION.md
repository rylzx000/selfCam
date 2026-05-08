# selfCam 版本信息

## 当前版本

**版本号**: v1.3.7
**发布日期**: 2026-05-08
**状态**: SIT 体验版日志、AI 与横屏相机兼容性优化

---

## 版本概述

`v1.3.7` 是当前 SIT 体验版对外测试版本。本轮聚焦真机兼容性：收敛 We分析实时日志上报范围，保留本地 runtime 日志完整性，避免高频页面和流程日志挤掉关键模型失败信息；同时为车牌/车损推理 session 创建增加有效性校验和一次稳模式重试，解决部分 Android 机型 AI 不可加载的问题；追加修复部分横屏机型拍照页相机区被短边 `rpx` 换算压小的问题，并将车牌/车损 AI 检测抽帧从低清 `takePhoto` 改为 `CameraContext.onCameraFrame`，避免 iPhone12 真机连续快门。缓存、上传、模型 URL、模型缓存清理和自动拍照判断算法保持不变。

### 本版本重点

- We分析仅上报 AI 排障关键事件：模型下载失败、缓存写入失败、session 创建/加载失败、AI 初始化失败和诊断探针等。
- 本地 runtime 日志仍完整保留 `camera/page_show`、`workflow/transition`、`ai/resume_detection_*` 等普通日志。
- We分析 payload 精简为反馈编号、环境、模型、阶段、错误、设备和 session 尝试信息，降低 `UserLog:fail Log Size Exceed` 风险。
- 车牌/车损 `wx.createInferenceSession` 返回后先校验 session、`onLoad`、`onError` 是否有效，避免无效 session 触发 TypeError。
- 推理 session 首次仍使用 `precisionLevel=1`；失败后只重试一次 `precisionLevel=4` 稳模式。
- 稳模式重试不重新下载模型、不清理模型缓存、不修改模型 URL，也不改变拍照流程和自动拍照算法。
- 拍照页相机区按横屏长边复刻旧版 `400rpx x 300rpx` 视觉尺寸，避免部分机型横屏下相机区缩小。
- 车牌、VIN、车损辅助框随相机区等比例缩放，但 AI 判断仍使用固定虚拟 `400 x 300` 坐标系。
- 车牌/车损 AI 检测抽帧使用 `CameraContext.onCameraFrame` 和 `frame-size="medium"`，检测循环不再调用低清 `cameraContext.takePhoto()`；车损 `selectedFramePath` 候选帧成片逻辑保持不变。

## v1.3.7 变更摘要

### AI 推理兼容性

- `utils/plate-detector.js` 与 `utils/damage-detector.js` 在访问 `session.onLoad` 前增加 session 有效性校验。
- fast `precisionLevel=1` 创建失败、返回无效 session 或触发 `onError` 时，自动重试一次 stable `precisionLevel=4`。
- 两次均失败时抛出结构化错误，包含 `stage/modelName/modelPath/attemptName/precisionLevel/errMsg`，交给相机页现有 AI 不可用降级逻辑处理。

### We分析实时日志

- `runtime-logger` 仅将白名单 AI 排障事件转发到 `wx.getRealtimeLogManager()`，降低实时日志体积。
- We分析 payload 精简，不再透传完整 payload；本地日志仍保留完整 payload。
- `forceWarn` / `forceError` 仍保留强制上报能力，但同样使用精简 payload。

### 拍照页横屏适配

- `pages/camera/camera.js` 新增相机页布局计算，优先按横屏窗口长边复刻旧版 `rpx` 尺寸，仅在三栏总宽或总高放不下时等比缩小。
- `pages/camera/camera.wxss` 将车牌框、VIN 框、车损框和距离提示箭头改为相对相机区的百分比布局，避免显示尺寸变化后覆盖层错位。
- `getPlateCaptureBox()`、`getDamageCaptureBox()`、`checkFrameStatus(..., 400, 300)` 与车损 `canvasWidth/canvasHeight = 400/300` 均保持不变。

### AI 检测抽帧修复

- `pages/camera/camera.wxml` 为 `camera` 增加 `frame-size="medium"`，用于车牌/车损 AI 检测实时帧。
- `takeAIPreviewPhoto()` 保留原方法名，但改为读取 `latestAIFrame` 并通过离屏 canvas 转临时图片路径，继续复用现有 `detector.detect(imagePath)`。
- 检测循环无实时帧时跳过当前轮，不回退到 `cameraContext.takePhoto()`，避免 iPhone12 真机连续快门。

### 测试与文档同步

- `package.json` 与 `package-lock.json` 版本号提升到 `1.3.7`。
- 新增/调整 runtimeLogger 与 AI session 单元测试，覆盖无效 session、稳模式重试、We分析白名单、黑名单和 payload 精简。
- 新增 `__tests__/camera-layout.test.js`，覆盖正常横屏机型尺寸不回退、竖屏 `safeArea` 不压窄相机区、宽屏机型无需机型白名单即可放大。
- 本轮验证通过 `node --check utils/plate-detector.js`、`node --check utils/damage-detector.js`、`node --check utils/runtime-logger.js`。
- 本轮验证通过 `npm test -- --runInBand`，21 个测试套件、194 个用例通过。
- 追加验证通过 `npx jest --runInBand`，21 个测试套件、197 个用例通过。

---

## 历史版本

| 版本 | 发布日期 | 状态 | 说明 |
| --- | --- | --- | --- |
| v1.3.7 | 2026-05-08 | SIT 体验版日志、AI 与横屏相机兼容性优化 | 收敛 We分析实时日志，补充推理 session 稳模式重试，修复部分机型横屏相机区缩小 |
| v1.3.6 | 2026-05-07 | SIT 体验版诊断增强 | 业务环境切换、SIT 模型地址、安全校验、模型缓存隔离、AI 实时日志与代码质量扫描修复 |
| v1.3.5 | 2026-04-30 | 已封板（本地） | 每辆车行驶证资料上传、缓存兼容、提交风险提示与三页背景统一 |
| v1.3.4 | 2026-04-29 | 已封板（本地） | 权限申请与相册保存瘦身，保留失败轻提示和开始采集防重复点击 |
| v1.3.3 | 2026-04-28 | 已封板（本地） | 补齐微信开发者工具 miniprogram-automator + Jest 自动化测试入口，覆盖首批回归与破坏性测试场景 |
| v1.3.2 | 2026-04-28 | 已封板（本地） | 修复预览页车损补拍回流和车损 AI 首次启动时机，同步 VIN 引导与确认态文案 |
| v1.3.1 | 2026-04-28 | 已封板（本地） | 首页横屏单屏品牌入口，补齐 logo 资源与版本/PRDS/测试文档同步 |
| v1.2.6 | 2026-04-28 | 已封板（本地） | 完成页轻量收口，统计卡片改为车辆数、车损照片和单证照片 |
| v1.2.5 | 2026-04-27 | 已封板（本地） | 环境配置与调试开关收口，补齐 env-config 测试与审查工作流规则 |
| v1.2.4 | 2026-04-26 | 已封板（本地） | 端上轻质检拍后分析模块落地，补齐测试、设计文档与 disabled 语义修正 |
| v1.2.3 | 2026-04-24 | 已封板（本地） | 端上轻质检三层配置体系落地，补齐环境策略、缓存降级、测试与设计文档 |
| v1.2.2 | 2026-04-24 | 已封板（本地） | workflow-state 收敛、本地缓存治理、异常链路测试与测试文档落地 |
| v1.2.1 | 2026-04-24 | 已封板 | 前端状态机骨架接入、恢复收紧与单证流程修正 |
| v1.2.0 | 2026-04-23 | 已封板 | 车损距离引导与车牌真机流畅度优化 |
| v1.1.0 | 2026-04-22 | 已归档 | AI 自动拍照增强版，完成本地封板 |
| v1.0.0 | 2026-04-01 | 已归档 | 首个正式版本 |

---

## 回滚方式

当前推荐优先回滚到已经存在的 Git 标签，例如：

```powershell
git fetch --tags
git checkout v1.3.4
```

如果后续需要把 `v1.3.7` 作为正式标签发布，建议在本地提交后再创建对应 tag。

---

*最后更新：2026-05-08*
