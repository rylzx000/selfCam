## Why

selfCam 已形成较完整的产品文档、设计文档、测试材料和业务实现，但关键能力分散在 `docs/`、`PRDS/`、代码与测试中，缺少可供后续变更复用的结构化规格基线。现在需要把现有成果物提炼为 OpenSpec 能力规格，降低后续需求变更时的理解偏差，同时继续保留原文档作为详细事实来源。

## What Changes

- 将现有项目成果物整理为 OpenSpec 基线，不新增或改变任何业务功能。
- 为六项核心能力建立可测试的规格：拍照采集、AI 自动抓拍、车辆与现场信息、预览流程、后端集成、质量与测试。
- 为每项能力记录当前能力、关键业务规则、关联文档、关联代码、关联测试、验收场景和已知限制。
- 保留 `docs/`、`PRDS/`、代码和测试文件原路径，只做索引与规则提炼，不迁移全文、不重命名文件。
- 补充 baseline change 的设计说明和任务清单，便于验证后归档为主规格。
- 不修改业务代码、测试代码、Comet 配置或运行时依赖。

## Capabilities

### New Capabilities

- `camera-capture`: 定义开始采集、拍照步骤、照片确认与重拍、车损容量、缓存恢复等拍照主流程规则。
- `ai-auto-capture`: 定义车牌和车损 AI 自动抓拍的启动条件、几何与稳定性门控、冷却、防重复和降级规则。
- `vehicle-info`: 定义现场环境照片、车牌、VIN、多车信息归属和辅助拍照车辆控制规则。
- `preview-flow`: 定义模块一/二/三预览、最终总预览、补拍/重拍/删除、证件采集和完成流转规则。
- `backend-integration`: 定义 ticket 初始化、车辆映射、Base64 图片上传、完成提交、重试和错误日志规则。
- `quality-and-tests`: 定义拍后轻质检、配置降级、测试分级、容量边界、恢复与提交一致性验证规则。

### Modified Capabilities

- 无。当前 `openspec/specs/` 尚无正式业务能力规格，本 change 仅建立现状基线。

## Impact

- 修改范围仅限 `openspec/changes/baseline-existing-selfcam/`。
- 详细资料继续来源于 `docs/`、`PRDS/`、`packageD/`、`__tests__/` 和 `e2e/`。
- 不改变页面行为、接口报文、缓存结构、AI 参数、测试实现或依赖版本。
- 完成严格校验并经人工审核后，可单独执行 archive，将六项能力同步到 `openspec/specs/`。
