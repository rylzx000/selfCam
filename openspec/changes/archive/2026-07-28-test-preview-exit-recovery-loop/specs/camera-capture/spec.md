## ADDED Requirements

### Requirement: 后端 blocked ticket 状态优先于本地恢复缓存
系统 MUST 在同 `ticket` 二次进入时优先使用后端 `init` 返回的 blocked 状态判断是否允许继续，不得让本地旧缓存把用户带入旧预览闭环。

#### Scenario: blocked ticket 不恢复本地预览缓存
- **WHEN** 首页开始采集时后端 `init` 返回 `COMPLETED`、`EXPIRED` 或 `REVOKED`
- **AND** 本地仍存在同 `ticket` 的可恢复预览缓存
- **THEN** 系统不得恢复本地缓存或跳转预览页
- **AND** 系统提示对应 blocked 状态文案
