## Why

当前测试体系已覆盖较多规则和链路，但存在“测试通过却验证旧规则”的漂移：车损 5 张上限、证件入口原生菜单、模块三缺证件 toast 等旧口径仍残留在 e2e 或说明文档中。

需要先建立一份产品规则矩阵，作为测试与开发共同使用的单一事实源，避免后续 Jest、页面可操作性测试和 automator/e2e 继续固化错误理解。

## What Changes

- 新增 `docs/product-rule-matrix.md`，集中定义模块一、模块二、模块三、最终预览、断点续传和异常场景的规则矩阵。
- 最小同步 `docs/test-flow-route-matrix.md` 和 `docs/test-run-guide.md`，标记测试矩阵和运行说明均以产品规则矩阵为准。
- 在文档中明确当前已知规则漂移点，指导下一轮修正 Jest/e2e 与页面可操作性测试。
- 不修改业务代码、不修改 Jest/e2e 测试代码、不提交、不归档、不 push。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `quality-and-tests`：明确产品规则矩阵是测试设计和自动化验收的单一事实源，并要求测试说明标记旧规则漂移点。

## Impact

- 文档：新增 `docs/product-rule-matrix.md`；更新 `docs/test-flow-route-matrix.md`、`docs/test-run-guide.md`。
- OpenSpec/Comet：新增轻量 change `align-product-rule-matrix` 的 proposal/design/tasks 与 `quality-and-tests` delta spec。
- 不影响业务代码、接口、缓存 schema、上传链路和现有测试实现。
