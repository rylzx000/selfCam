# selfCam 版本信息

## 当前版本

**版本号**: v1.2.5  
**发布日期**: 2026-04-27  
**状态**: 已封板（本地）

---

## 版本概述

`v1.2.5` 是基于 `v1.2.4` 的一次上线前补丁封板，核心目标是完成环境配置与调试开关收口，并补齐审查材料工作流规则。此次版本不改业务主流程、不接后端接口，重点解决环境判断散落、生产默认策略不统一，以及审查材料生成易混入旧任务的问题。

### 本版本重点

- 新增统一环境配置模块 `utils/env-config.js`，统一收口 `develop / trial / release` 环境判断与默认策略。
- `ai-config`、`runtime-logger`、`quality-config-loader`、`app.js` 和 `pages/camera` 最小接入统一环境层，减少散落环境判断与硬编码。
- 补齐 `env-config` 相关 Jest 测试与中文设计文档，覆盖环境识别、安全降级和生产默认禁用项。
- 修正 `release` 环境下 `DEBUG_LOG.enabled` 的误判，避免其他模块把错误级日志能力当成调试日志已开启。
- 强化 `review.diff` 与 `review-summary.md` 的生成规则，避免审查材料和本轮任务范围不一致。

---

## v1.2.5 变更摘要

### 环境配置收口

- 新增 `utils/env-config.js`，统一提供 `getEnvVersion()`、`getRuntimeFlags()`、`getDebugConfig()`、`getAiConfig()` 和 `getQualityConfigSourcePolicy()`。
- `develop` 默认允许 mock、debug、本地模型地址与调试上传，`trial` 默认收紧调试输出，`release` 默认关闭 mock、调试上传、开发面板和非必要日志。
- `wx` 不存在、`getAccountInfoSync` 缺失或抛错时安全降级到 `develop`，不阻断主流程。

### 模块接入与修复

- `utils/ai-config.js` 改为统一从 `env-config` 获取模型地址和调试配置。
- `utils/runtime-logger.js` 统一按环境日志级别决定是否记录、是否上传，并保持失败不阻断主流程。
- `utils/quality-config-loader.js` 复用 `env-config` 的环境判断与 source 默认策略。
- 修复 `release` 环境下 `DEBUG_LOG.enabled` 可能仍为 `true` 的问题，确保 `DEBUG_LOG.enabled=false`、`DEBUG_LOG.uploadEnabled=false`。

### 文档与审查流程

- 新增 `docs/env-config-design.md`，说明环境配置收口目标、默认策略、生产禁用项和后续在线平台扩展方向。
- 更新 `docs/codex-review-workflow.md`，要求 `review.diff` 和 `review-summary.md` 基于同一份“本轮相关文件列表”生成。
- 审查材料自检改为检查 `diff --git a/<file> b/<file>` 文件头，避免文档示例关键词导致误判。

---

## 历史版本

| 版本 | 发布日期 | 状态 | 说明 |
| --- | --- | --- | --- |
| v1.2.5 | 2026-04-27 | 已封板（本地） | 环境配置与调试开关收口，补齐 env-config 测试与审查工作流规则 |
| v1.2.4 | 2026-04-26 | 已封板（本地） | 端上轻质检拍后分析模块落地，补齐测试、设计文档与 disabled 语义修正 |
| v1.2.3 | 2026-04-24 | 已封板（本地） | 端上轻质检三层配置体系落地，补齐环境策略、缓存降级、测试与设计文档 |
| v1.2.2 | 2026-04-24 | 已封板（本地） | workflow-state 收敛、本地缓存治理三步补齐、异常链路测试与测试文档落地 |
| v1.2.1 | 2026-04-24 | 已封板 | 前端状态机骨架接入、恢复收紧与单证流程修正 |
| v1.2.0 | 2026-04-23 | 已封板 | 车损距离引导与车牌真机流畅度优化 |
| v1.1.0 | 2026-04-22 | 已归档 | AI 自动拍照增强版，完成本地封板 |
| v1.0.0 | 2026-04-01 | 已归档 | 首个正式版本 |

---

## 回滚方式

当前推荐优先回滚到已经存在的 Git 标签，例如：

```powershell
git fetch --tags
git checkout v1.2.4
```

如果后续需要把 `v1.2.5` 作为正式标签发布，建议在本地提交后再创建对应 tag。

---

## 下一步版本建议

建议后续继续按 `v1.2.x` 补丁版本递增，优先考虑：

- 将 `env-config` 扩展为“本地默认值 + 在线平台覆盖值”的统一入口
- 继续收口剩余零散 `console` / 调试开关，避免模块自行判断环境
- 在不改主流程前提下，补齐真机灰度验证与生产配置回归检查

---

*最后更新：2026-04-27*
