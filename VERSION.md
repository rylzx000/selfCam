# selfCam 版本信息

## 当前版本

**版本号**: v1.3.7
**发布日期**: 2026-05-08
**状态**: SIT 体验版日志与 AI 兼容性优化

---

## 版本概述

`v1.3.7` 是当前 SIT 体验版对外测试版本。本轮聚焦 AI 真机排障：收敛 We分析实时日志上报范围，保留本地 runtime 日志完整性，避免高频页面和流程日志挤掉关键模型失败信息；同时为车牌/车损推理 session 创建增加有效性校验和一次稳模式重试，解决部分 Android 机型 AI 不可加载的问题。页面 UI、拍照流程、模型 URL、模型缓存清理和自动拍照算法保持不变。

### 本版本重点

- We分析仅上报 AI 排障关键事件：模型下载失败、缓存写入失败、session 创建/加载失败、AI 初始化失败和诊断探针等。
- 本地 runtime 日志仍完整保留 `camera/page_show`、`workflow/transition`、`ai/resume_detection_*` 等普通日志。
- We分析 payload 精简为反馈编号、环境、模型、阶段、错误、设备和 session 尝试信息，降低 `UserLog:fail Log Size Exceed` 风险。
- 车牌/车损 `wx.createInferenceSession` 返回后先校验 session、`onLoad`、`onError` 是否有效，避免无效 session 触发 TypeError。
- 推理 session 首次仍使用 `precisionLevel=1`；失败后只重试一次 `precisionLevel=4` 稳模式。
- 稳模式重试不重新下载模型、不清理模型缓存、不修改模型 URL，也不改变拍照流程和自动拍照算法。

## v1.3.7 变更摘要

### AI 推理兼容性

- `utils/plate-detector.js` 与 `utils/damage-detector.js` 在访问 `session.onLoad` 前增加 session 有效性校验。
- fast `precisionLevel=1` 创建失败、返回无效 session 或触发 `onError` 时，自动重试一次 stable `precisionLevel=4`。
- 两次均失败时抛出结构化错误，包含 `stage/modelName/modelPath/attemptName/precisionLevel/errMsg`，交给相机页现有 AI 不可用降级逻辑处理。

### We分析实时日志

- `runtime-logger` 仅将白名单 AI 排障事件转发到 `wx.getRealtimeLogManager()`，降低实时日志体积。
- We分析 payload 精简，不再透传完整 payload；本地日志仍保留完整 payload。
- `forceWarn` / `forceError` 仍保留强制上报能力，但同样使用精简 payload。

### 测试与文档同步

- `package.json` 与 `package-lock.json` 版本号提升到 `1.3.7`。
- 新增/调整 runtimeLogger 与 AI session 单元测试，覆盖无效 session、稳模式重试、We分析白名单、黑名单和 payload 精简。
- 本轮验证通过 `node --check utils/plate-detector.js`、`node --check utils/damage-detector.js`、`node --check utils/runtime-logger.js`。
- 本轮验证通过 `npm test -- --runInBand`，20 个测试套件、191 个用例通过。

---

## 历史版本

| 版本 | 发布日期 | 状态 | 说明 |
| --- | --- | --- | --- |
| v1.3.7 | 2026-05-08 | SIT 体验版日志与 AI 兼容性优化 | 收敛 We分析实时日志，补充推理 session 稳模式重试，解决部分机型 AI 不可加载 |
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
