## Why

车牌号和车损拍摄页当前会根据设备是否提供 `wx.createInferenceSession` 在运行时重新启用 AI，缺少可审计、可恢复的业务级总开关，无法在不制造模型失败或环境异常的前提下临时关闭 AI 识别与自动拍照。需要把 AI 业务启用状态与设备推理能力分离，并让关闭状态静默退化为稳定的手动拍照流程。

## What Changes

- 在集中 AI 配置中增加业务总开关，并预留车牌与车损子开关；本次总开关默认关闭。
- 区分 `aiFeatureEnabled`、`aiAvailable` 与 `aiEnabled`，业务开关关闭时不得因设备支持推理而重新开启 AI。
- 业务开关关闭时，不创建或加载车牌、车损检测器，不下载模型、不创建推理会话，也不启动实时帧监听、检测循环、自动拍照定时器或车损自动捕获引擎。
- 业务开关关闭时，不展示 AI 初始化、识别中、不可用或模型失败提示，不产生 AI 不可用或模型加载失败的错误日志与错误上报，拍照按钮统一显示“点击拍照”。
- 保留车牌、车损、模块切换、多车辆、最多 10 张、补拍、确认、重拍和完成弹层等现有手动拍照流程。
- 增加回归测试，验证关闭状态的静默手动模式，并验证将总开关恢复为 `true` 后现有 AI 初始化逻辑仍可用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `ai-auto-capture`: 增加业务级启停约束；关闭时 AI 全链路不得运行，页面静默使用手动拍照，重新开启后继续沿用现有设备能力检测与自动抓拍逻辑。

## Impact

- 受影响代码：`packageD/utils/ai-config.js`、`packageD/pages/camera/camera.js`、`packageD/pages/camera/camera.wxml`。
- 受影响测试：`__tests__/camera-ai-start.test.js`。
- 受影响规格：`ai-auto-capture`。
- 不修改上传接口、缓存结构、后端字段、页面路由、照片质量检查、检测器实现或模型地址。
