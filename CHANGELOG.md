# selfCam 变更记录

所有重要变更都记录在此文件中，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## [v1.2.6] - 2026-04-28

### 新增

- 新增 `__tests__/complete-page.test.js`，覆盖完成页三指标展示映射、旧摘要字段回退、返回修改保留缓存和完成退出直接清缓存的既有行为。

### 变更

- `pages/complete/complete.js` 改为读取缓存摘要中的 `vehicleCount`、`damagePhotoCount` 和 `documentPhotoCount`，不再在页面层保留质量提示相关状态。
- `pages/complete/complete.wxml` 保持原始横屏居中成功页结构，只将白色统计框从“车辆数 / 照片数”调整为“车辆数 / 车损照片 / 单证照片”。
- `pages/complete/complete.wxss` 仅做统计卡片的轻微收紧，保持成功图标、主标题、提示文案和底部按钮的原始视觉风格。
- `utils/cache-selectors.js` 在现有 `getCacheSummary(cache)` 上补充 `damagePhotoCount` 与 `documentPhotoCount`，供完成页直接读取。
- 同步更新 `PRDS/PRD.md`、`PRDS/UI.md` 和 `PRDS/tech.md`，让产品、UI 和技术说明与当前完成页轻量实现一致。

### 修复

- 移除完成页中已不再使用的质量提示卡片依赖，避免页面说明与当前实现不一致。

---

## [v1.2.5] - 2026-04-27

### 新增

- 新增统一环境配置模块 `utils/env-config.js`，统一读取 `wx.getAccountInfoSync().miniProgram.envVersion` 并收口 `develop / trial / release` 默认策略。
- 新增 `__tests__/env-config.test.js`，覆盖环境识别、`wx` 缺失安全降级、异常保护，以及 develop / trial / release 默认开关行为。
- 新增 `docs/env-config-design.md`，说明环境配置收口目标、三套环境策略、生产禁用项与后续扩展方式。

### 变更

- `utils/ai-config.js`、`utils/runtime-logger.js`、`utils/quality-config-loader.js`、`app.js` 与 `pages/camera/camera.js` 最小接入统一环境配置模块，减少散落环境判断。
- `release` 环境下的调试日志、调试上传、开发面板和 mock 默认策略统一由 `env-config` 兜底控制。
- 强化 `docs/codex-review-workflow.md`，要求 `review.diff` 与 `review-summary.md` 基于同一份“本轮相关文件列表”生成，并用 diff 文件头判断是否混入旧任务文件。

### 修复

- 修复 `utils/ai-config.js` 中 `DEBUG_LOG.enabled` 在 `release` 环境下可能被误判为开启的问题。
- 修复审查材料工作流中“`review-summary.md` 已切到本轮任务，但 `review.diff` 仍是旧任务内容”的规则漏洞。

---

## [v1.2.4] - 2026-04-26

### 新增

- 新增独立的端上轻质检图片分析模块 `utils/photo-quality.js`，支持拍后单张照片的模糊、偏暗、过曝和预留的过近/过远检测结构。
- 新增 `__tests__/photo-quality.test.js`，覆盖 disabled、清晰图、偏暗、过曝、模糊、多问题叠加、子开关关闭、阈值生效和异常输入安全降级场景。
- 新增 `docs/photo-quality-design.md`，说明轻质检设计目标、检测项、配置控制、性能策略、局限与后续接入方向。

### 变更

- 将轻质检默认 `processing.maxEdge` 调低为 `640`，降低端上像素分析开销。
- 明确 `enabled=false` 的返回语义：`level='good'`、`suggestRetake=false`、`reasons=['disabled']`，避免后续 UI 误判为质量告警。
- 保持轻质检模块独立实现，不接入页面主流程，不改拍后确认流程和现有拍摄顺序。

### 修复

- 修复 `docs/photo-quality-design.md` 的 UTF-8 中文文档内容，清理旧乱码并重新整体重写。

---

## [v1.2.3] - 2026-04-24

### 新增

- 新增端上轻质检三层配置体系，包含默认配置、静态 JSON 配置加载、本地短缓存和统一读取入口。
- 新增轻质检默认配置、远程静态 JSON mock 文件与统一配置设计文档。
- 新增 `quality-config` 相关 Jest 测试，覆盖默认值、merge、sanitize、缓存命中/过期、降级与加载失败不阻断主流程。

### 变更

- 轻质检配置默认 source 策略按微信小程序 `envVersion` 区分：`develop / trial` 默认 `mock`，`release` 默认远程静态 JSON。
- `release` 环境未配置远程地址时改为告警并降级到默认配置，不再静默使用 `mock`。
- `initQualityConfig()` 增加内存配置过期判断，过期后允许重新加载配置。

### 修复

- 修复 `docs/quality-config-design.md` 的 UTF-8 编码与中文显示问题，确保在 VS Code、GitHub、PowerShell 中可正常查看。

---

## [v1.2.2] - 2026-04-24

### 新增

- 新增本地缓存 schema 治理骨架，包括 `schemaVersion`、`migrate`、`validate`、`repair`。
- 新增缓存摘要/选择器模块，统一提供车辆、单证、当前流程和完成页摘要能力。
- 新增安全恢复与短期上下文清理能力，包括 `loadCacheForResume()`、`clearRetakeContext()`、`clearPreviewFlags()`、`clearCompletionContext()`、`clearTransientContext()`。
- 新增异常链路与恢复边界测试，补齐 `workflow-state`、`storage`、`storage-schema`、`cache-selectors` 的故障注入覆盖。
- 新增测试文档与本地测试结果输出，支持将 Jest 摘要、原始输出和覆盖率摘要写入 `reports/test/`。

### 变更

- 将前端流程恢复规则统一为“事实优先，历史状态辅助”，优先依据修复后的缓存和安全恢复结果决定页面状态。
- 将 `complete`、`preview`、`document`、`camera` 的关键缓存读取收口到统一入口，减少页面自行拼装和容错判断。
- 保持现有页面路径、主流程顺序和 UI 主体不变，仅增强缓存入口鲁棒性和恢复边界控制。

### 修复

- 修复 `retakeMode`、`fromPreview`、`completion context` 残留导致的误恢复问题。
- 修复坏 JSON、旧格式 `workflowState`、越界 `currentVehicleIndex`、脏 `vehicles/documents` 等场景下可能触发的恢复崩溃风险。
- 修复缓存结构合法但业务上下文已过期时仍被机械恢复的问题，过期上下文现在会安全回落到 `PREVIEWING` 或 `CAPTURING`。

---

## [v1.2.1] - 2026-04-24

### 新增

- 新增最小前端工作流状态机模块与页面轻量同步 helper。
- 新增 `workflow-state` 相关单元测试，覆盖状态恢复与持久化边界。

### 变更

- 将状态恢复规则调整为“事实优先，历史状态辅助”。
- 收敛页面中的状态写入点，只保留拍摄、确认、预览、重拍、单证、完成等关键业务节点。
- 后续同类小改动继续按 `v1.2.x` 补丁版本递增。

### 修复

- 修复 `DOCUMENTING`、`LOCAL_COMPLETED` 恢复过度依赖缓存状态的问题。
- 修复 `complete` 页面进入时可能主动推进完成态的问题。
- 修复单证拍照/选图在用户尚未成功保存前就提前切换状态的问题。

---

## [v1.2.0] - 2026-04-23

### 新增

- 车损拍摄新增面积方向引导箭头，复用车牌同款蓝白静态箭头方案。
- 车损识别面积过小时提示“请靠近一点”。
- 车损识别面积过大时提示“请稍微远离”。

### 变更

- 车牌检测间隔单独调整为 `800ms`，减少周期性预览抓图对相机预览的影响。
- AI 覆盖层状态更新改为 `setDataIfChanged()`，避免相同状态反复刷新。
- 产品、UI、技术架构、AI 集成文档和 AI 测试用例同步到当时实现。

### 修复

- 优化车牌拍摄时移动摄像头出现的真机掉帧、卡顿感。
- 移除车牌和车损检测器每轮检测的高频日志输出。

---

## [v1.1.0] - 2026-04-22

### 新增

- 接入车牌 AI 自动拍照能力。
- 接入车损 AI 自动拍照能力，支持 `SEEK / HOLD / SHOOT` 稳定流。
- 支持 ONNX 模型下载到 `wx.env.USER_DATA_PATH` 后本地复用。
- 预览页照片增加拍摄来源标签，可区分 AI 自动拍摄与手动拍摄。
- 新增 `versions/v1.1.0/` 本地封板归档目录。

### 变更

- 车牌距离提示箭头改为“静态帧 + JS 定时切换”方案，替代覆盖层复杂动效。
- 车损拍摄左侧信息区精简。
- 单证资料继续以预览页底部区域为主入口，独立 `document` 页面保留为备用。

### 修复

- 修复车损状态提示偶发乱码问题。
- 修复车牌距离提示在真机上频闪不稳定、偶发中断的问题。
- 修复文档与代码长期不一致的问题。

---

## [v1.0.0] - 2026-04-01

### 新增

- 首页、拍照页、预览页、完成页主流程落地。
- 支持车牌、VIN、车损照片采集。
- 支持多车辆与单证资料拍照/相册上传。
- 支持照片预览、删除、重拍。
- 支持本地缓存与照片压缩。

---

## 版本历史

| 版本 | 日期 | 类型 | 说明 |
| --- | --- | --- | --- |
| v1.2.5 | 2026-04-27 | 封板补丁版 | 环境配置与调试开关收口，补齐 env-config 测试与审查工作流规则 |
| v1.2.4 | 2026-04-26 | 封板补丁版 | 端上轻质检拍后分析模块落地，补齐测试、设计文档与 disabled 语义修正 |
| v1.2.3 | 2026-04-24 | 封板补丁版 | 端上轻质检三层配置体系落地，补齐环境策略、缓存降级、测试与设计文档 |
| v1.2.2 | 2026-04-24 | 封板补丁版 | workflow-state 收敛、本地缓存治理三步补齐、异常链路测试与测试文档落地 |
| v1.2.1 | 2026-04-24 | 补丁版 | 前端状态机骨架接入、恢复收紧与单证流程修正 |
| v1.2.0 | 2026-04-23 | 封板版 | 车损距离引导与车牌真机流畅度优化 |
| v1.1.0 | 2026-04-22 | 封板归档版 | AI 自动拍照增强与文档对齐 |
| v1.0.0 | 2026-04-01 | 正式版 | 首个正式发布版本 |

---

*最后更新：2026-04-28*
