## Why

OpenSpec 基线、现有 PRDS/接口文档与实际代码之间存在案件级照片上传状态不一致，Comet 工作流规则也与项目“不自动提交”的安全约束冲突。需要在继续使用规格驱动流程前统一事实来源和执行边界，避免后续开发依据错误规格实施。

## What Changes

- 修正 Comet 默认路由范围，保留 full、tweak、hotfix 的自动分类能力。
- 移除 Comet 中未经用户授权自动执行 Git commit 的要求。
- 补齐 OpenSpec 项目上下文、正式规格 Purpose 和已上线交互要求。
- 明确案件级现场照片的接口结构、当前前端上传实现边界和后续实现状态。
- 更新仍标记为当前事实的旧流程文档、接口数量口径和版本状态。
- 保留历史版本记录与已归档 baseline change，不改写历史事实。
- 不修改业务代码、上传实现、页面行为、依赖或运行时配置。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `camera-capture`: 补充 45 度现场照片和车损拍摄指引的稳定交互要求。
- `preview-flow`: 补充模块三、阶段切换弹层和最终提交前相册保存确认要求。
- `backend-integration`: 明确案件级上传项与车辆级上传项的结构边界，并记录当前前端尚未组装案件级上传队列。

## Impact

- 协作规则：`AGENTS.md`、`.codex/rules/`、相关 Comet skill。
- OpenSpec：`openspec/config.yaml`、三个能力 delta spec、六份正式 spec 的 Purpose/状态说明。
- 项目文档：`PRDS/requirements.md`、`PRDS/tech.md`、接口对接文档、`VERSION.md`。
- 不影响 `packageD/`、`__tests__/`、`e2e/` 和后端接口实现。
