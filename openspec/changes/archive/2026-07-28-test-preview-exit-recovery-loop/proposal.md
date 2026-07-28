## Why

用户反馈看完照片预览后返回，再次进入同一 `ticket` 仍回到同一个照片预览页，疑似形成“退不出来”的恢复闭环。现有测试主要证明“能恢复到预览页”，但没有证明恢复后存在可继续、可提交、可重试或可退出的明确路径。

## What Changes

- 补充首页同 `ticket` 恢复闭环的 Jest 覆盖，记录并暴露无 `mode` 普通预览恢复路径。
- 补充预览页各模式可退出性 Jest 覆盖，验证 `moduleOne`、`moduleTwo`、`moduleThree`、`final` 的主操作，以及无 `mode` 普通预览的高风险状态。
- 补充上传态、完成态、后端 blocked ticket 与本地缓存冲突时的恢复测试。
- 补充真实点击二次进入 smoke 场景，用 `ticket=mock-2&reportNo=MOCK_REGIST_NO` 覆盖不清缓存的再次进入路径。
- 补充测试矩阵说明和质量门禁建议，避免测试继续固化无 `mode` 老预览规则。
- 在红灯测试基础上修复首页恢复、上传缓存写入、safe resume 和正向 e2e 路径，使历史 `currentStep=preview` 迁移到明确预览模式。

## Capabilities

### New Capabilities
- 无。

### Modified Capabilities
- `preview-flow`：补充预览恢复后的可退出性验收要求。
- `camera-capture`：补充同 `ticket` 二次进入时以后端 blocked 状态优先于本地缓存的验收要求。

## Impact

- 影响范围包含测试、e2e smoke、测试说明文档、本轮 OpenSpec/Comet 文档，以及与恢复闭环直接相关的最小业务修复。
- 不删除 `packageD/pages/preview/preview` 页面，不重构预览页，不改变上传接口、上传队列或 complete 接口逻辑。
- 新增红灯测试用于证明缺陷存在；修复后相关测试应转绿。
