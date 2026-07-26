## Context

本次是文档型 tweak：上一轮只读审查确认，当前代码和 Jest 对证件 `E/F/B` 矩阵基本一致，但 e2e 与测试说明仍残留旧规则。现有测试矩阵分散在 `docs/test-flow-route-matrix.md`、`docs/test-run-guide.md`、`docs/destructive-stress-test-coverage.md`、Jest 和 e2e 中，缺少一个能先于测试实现的产品规则事实源。

## Goals / Non-Goals

**Goals:**

- 建立 `docs/product-rule-matrix.md`，按模块和异常场景描述产品规则、页面展示、用户操作、预期结果和建议测试层级。
- 在测试说明文档中明确：流程路由矩阵和测试运行指引必须以产品规则矩阵为准。
- 明确记录当前已知旧规则漂移点，作为下一轮修测试的入口。
- 保持 Comet/OpenSpec change 活跃，不归档。

**Non-Goals:**

- 不修改业务代码、WXML/WXSS、Jest/e2e 测试代码或测试脚本。
- 不重新定义业务流程，不把待确认的断点续传和后端配置变化处理编造成既定规则。
- 不运行重型微信开发者工具 e2e。

## Decisions

### 1. 单独新增产品规则矩阵文档

`docs/product-rule-matrix.md` 作为测试设计的规则入口，避免继续把流程路由矩阵、运行说明或历史变更材料当作产品事实源。流程路由矩阵只保留“路由测试覆盖索引”的职责，运行说明只保留“如何执行和查看结果”的职责。

### 2. 明确测试层级边界

矩阵每条规则标记建议测试层级：Jest 覆盖规则、状态和路由；页面可操作性测试覆盖入口存在、能点、点后去哪；automator/e2e 覆盖真实页面主链路和高风险恢复；手工/真机覆盖相机硬件、权限、横屏适配、真实触摸区域和微信环境差异。

### 3. 漂移点写入文档而不直接修测试

本轮只把已知漂移点标记清楚：车损 5 张旧规则、证件入口旧 actionSheet 假设、模块三缺证件旧 toast、页面方法调用过多和 quality guard 未扫到 e2e。下一轮再按矩阵修 Jest/e2e。

## Risks / Trade-offs

- [Risk] 文档变厚后维护成本增加 → [Mitigation] 把规则矩阵定位为单一事实源，其他测试说明只引用它，不重复整套规则。
- [Risk] 当前未确认的断点续传或后端配置变化被误写成确定规则 → [Mitigation] 使用“待确认”标记，不声明已实现。
- [Risk] 下一轮修测试时遗漏已知漂移点 → [Mitigation] 在矩阵、测试运行指引和 OpenSpec tasks 中重复列出下一轮测试修正入口。
