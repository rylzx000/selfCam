# selfCam 版本信息

## 当前版本

**版本号**: v1.2.2  
**发布日期**: 2026-04-24  
**状态**: 已封板（本地）

---

## 版本概述

`v1.2.2` 是基于 `v1.2.1` 的一次补丁封板，核心目标是把前端流程地基改造完整收口：一方面完成 `workflow-state` 与本地缓存治理三步，另一方面补齐异常链路测试、测试文档与本地结果记录，确保后续回归和上线前复测可复盘。

### 本版本重点

- 收敛前端 `workflow-state`，统一页面恢复和状态切换的事实优先规则。
- 完成本地缓存 schema、迁移、校验、修复与安全恢复策略。
- 引入缓存摘要/选择器模块，减少页面散落的缓存读取和统计逻辑。
- 补齐异常链路 Jest 测试、故障注入测试、手工异常清单和测试运行指引。
- 生成 `reports/test/` 本地测试结果文件，沉淀可追踪的封板依据。

---

## v1.2.2 变更摘要

### workflow-state 与恢复边界

- 统一 `IDLE / CAPTURING / CONFIRMING / PREVIEWING / RETAKING / DOCUMENTING / LOCAL_COMPLETED` 的状态语义。
- 明确恢复策略为“事实优先，历史状态辅助”，避免历史 checkpoint 反向污染当前流程。
- 对 `PREVIEWING`、`DOCUMENTING`、`LOCAL_COMPLETED`、`RETAKING` 的恢复边界增加了更保守的降级策略。

### 本地缓存治理

- 增加 `schemaVersion`，并补齐 `migrate / validate / sanitize / repair`。
- 新增 `loadCacheForResume()` 与短期上下文清理辅助函数，用于处理 `retakeMode`、`fromPreview`、completion context 等残留。
- 让 `camera / preview / document / complete` 优先消费修复后的缓存或安全恢复后的缓存，减少页面直接理解底层结构。

### 测试与复盘材料

- 新增 `workflow-recovery`、`storage-resume`、`cache-selectors.edge` 等测试文件。
- 新增 `docs/abnormal-flow-test-cases.md` 与 `docs/test-run-guide.md`。
- 将 Jest 原始输出、摘要和覆盖率摘要写入 `reports/test/`，作为本地封板验证记录。

---

## 历史版本

| 版本 | 发布日期 | 状态 | 说明 |
| --- | --- | --- | --- |
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
git checkout v1.2.1
```

如果后续需要把 `v1.2.2` 作为正式标签发布，建议在本地提交后再创建对应 tag。

---

## 下一步版本建议

建议后续继续按 `v1.2.x` 补丁版本递增，优先考虑：

- 页面返回栈相关自动化回归
- `complete` 退出与返回修改的真机验证补强
- 多车场景下更高频的异常交错操作测试

---

*最后更新：2026-04-24*
