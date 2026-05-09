# selfCam 版本信息

## 当前版本

**版本号**: v1.3.8
**发布日期**: 2026-05-09
**状态**: SIT 体验版模型加载修复

---

## 版本概述

`v1.3.8` 是当前 SIT 体验版对外测试版本。本轮聚焦模型加载失败修复：车牌/车损检测器在创建推理 session 前先轻量调用 `wx.getInferenceEnvInfo` 记录环境信息，并统一使用已验证机型可加载的 `wx.createInferenceSession` 参数，解决部分真机返回 `invalid session` 导致 AI 不可用的问题。拍照逻辑、AI 检测循环、预处理、后处理、页面、缓存和上传逻辑保持不变。

### 本版本重点

- 车牌/车损 `loadSession` 创建 session 前会尝试调用一次 `wx.getInferenceEnvInfo`。
- `getInferenceEnvInfo` 成功、失败或不支持都只记录日志，不阻断后续模型加载。
- 车牌/车损 `wx.createInferenceSession` 统一使用 `precisionLevel=0`、`allowNPU=false`、`allowQuantize=false`。
- 保留现有 runtimeLogger、结构化错误、session 有效性校验和 `onLoad/onError` 处理。
- 不修改拍照、AI 检测循环、预处理、后处理、页面、缓存和上传逻辑。

## v1.3.8 变更摘要

### AI 推理兼容性

- `utils/plate-detector.js` 与 `utils/damage-detector.js` 新增轻量 `checkInferenceEnv()`。
- 创建推理 session 前先尝试读取 `wx.getInferenceEnvInfo`，结果仅用于日志排障。
- 旧的 `precisionLevel=1/4` 尝试逻辑收敛为固定 CPU 兼容参数：`precisionLevel=0`、`allowNPU=false`、`allowQuantize=false`。
- session 无效或加载失败时仍抛出结构化错误，交给相机页现有 AI 不可用降级逻辑处理。

### 版本同步

- `package.json` 与 `package-lock.json` 版本号提升到 `1.3.8`。
- `CHANGELOG.md`、`VERSION.md` 和 AI 相关 PRD/技术文档同步到当前模型加载策略。

### 测试与文档同步

- 调整 AI session 相关单元测试，覆盖新的 `precisionLevel=0` 固定参数。
- 本轮验证通过 `node --check utils/plate-detector.js`、`node --check utils/damage-detector.js`。
- 本轮验证通过 `npm test -- --runInBand`，21 个测试套件、199 个用例通过。

---

## 历史版本

| 版本 | 发布日期 | 状态 | 说明 |
| --- | --- | --- | --- |
| v1.3.8 | 2026-05-09 | SIT 体验版模型加载修复 | 车牌/车损推理创建前记录推理环境，并统一使用 `precisionLevel=0`、禁用 NPU 与量化 |
| v1.3.7 | 2026-05-08 | SIT 体验版日志、AI 与横屏相机兼容性优化 | 收敛 We分析实时日志，补充推理 session CPU-safe 重试，修复部分机型横屏相机区缩小 |
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

如果后续需要把 `v1.3.8` 作为正式标签发布，建议在本地提交后再创建对应 tag。

---

*最后更新：2026-05-09*
