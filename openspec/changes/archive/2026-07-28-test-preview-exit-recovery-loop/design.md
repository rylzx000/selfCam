## Context

当前首页同 `ticket` 恢复逻辑会读取本地缓存并按 `currentStep`、`workflowState`、`uploadSession` 推导目标页。对 `moduleOne`、`moduleTwo`、`moduleThree`、`final` 预览已有带 `mode` 的路径覆盖，但旧 `currentStep=preview` 或泛化 `PREVIEWING` 仍可能恢复到 `/packageD/pages/preview/preview` 无 `mode`。预览页在无 `mode` 时不展示模块底部主操作，用户再次进入同一 `ticket` 可能继续落回该页面。

## Goals / Non-Goals

**Goals:**

- 用 Jest 覆盖首页同 `ticket` 恢复、预览页模式主操作、上传恢复、完成恢复和 blocked ticket 优先级。
- 修复首页恢复、上传缓存写入和 safe resume，使无 `mode` 普通预览不再作为主动恢复目标。
- 用 e2e smoke 描述真实二次进入链路，优先做到可运行；若开发者工具环境不可用，保留测试用例和运行说明。
- 更新测试矩阵说明，明确无 `mode` 普通预览属于高风险恢复路径。
- 更新质量门禁，使裸跳基础预览地址在业务、测试和 e2e 中均需要显式说明。

**Non-Goals:**

- 不扩大到全量 Jest 或重型 automator 验证。
- 不重构整个预览页，不删除预览页文件，不改变上传接口、上传队列或 complete 接口逻辑。

## Decisions

- 新增独立 Jest 文件承载恢复闭环与可退出性测试，避免把高风险路径分散到既有矩阵中。
- 仅对现有测试文件做必要质量门禁补充；不重构已有测试工具。
- e2e smoke 复用 `real-click-smoke.spec.js` 的 automator helper，使用固定 `ticket=mock-2&reportNo=MOCK_REGIST_NO` 和本地缓存种子模拟二次进入。
- 先以失败测试证明当前缺陷，再用最小业务修复让恢复闭环相关测试通过。

## Risks / Trade-offs

- [Risk] 历史 `currentStep=preview` 无法精确还原来源模块。→ 无法推导时兜底进入 `mode=final`，保证存在提交/上传恢复出口。
- [Risk] automator 环境依赖微信开发者工具端口，可能无法稳定运行。→ 只运行新增单文件；若卡住或环境不可用，停止并说明原因。
- [Risk] 质量门禁扩大扫描范围后可能暴露既有测试中的旧规则。→ 将正向裸预览路径改为带 `mode`，仅允许常量、负向断言或页面栈 route 判断保留。
