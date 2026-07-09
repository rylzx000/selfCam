# baseline-existing-selfcam

Baseline index for existing selfCam docs and PRDS without migrating full text.

## 用途

- 作为 selfCam 现有文档的 OpenSpec 基线索引。
- 仅记录 `docs/` 和 `PRDS/` 下已有 Markdown 文档的位置、标题和用途。
- 不迁移、不复制、不改写原文档全文；需要业务细节时回源阅读原文件。
- 不包含业务代码改动。

## 索引范围

### docs/

| 文档 | 标题 | 用途 |
|---|---|---|
| `docs/abnormal-flow-test-cases.md` | selfCam 异常链路测试清单 | 异常链路与恢复场景测试索引 |
| `docs/ai-auto-capture-test-cases.md` | selfCam AI 自动拍照功能 - 测试用例 | AI 自动拍照测试用例索引 |
| `docs/codex-review-workflow.md` | Codex 审查材料生成约定 | 审查材料生成规则索引 |
| `docs/env-config-design.md` | 端上环境配置收口设计 | 环境配置设计索引 |
| `docs/packageD-integration.md` | packageD 分包接入说明 | 分包接入说明索引 |
| `docs/photo-quality-design.md` | 端上轻质检模块设计 | 照片质检模块设计索引 |
| `docs/quality-config-design.md` | 端上轻质检配置设计 | 质检配置设计索引 |
| `docs/test-cases.md` | selfCam 车辆定损拍摄小程序 - 测试用例 | 主测试用例集索引 |
| `docs/test-run-guide.md` | selfCam 测试运行与结果查看指引 | 测试运行说明索引 |
| `docs/辅助拍照微信小程序接口对接文档.md` | 辅助拍照微信小程序接口对接文档 | 接口对接说明索引 |

### PRDS/

| 文档 | 标题 | 用途 |
|---|---|---|
| `PRDS/auto-capture-ai.md` | AI 自动拍照集成文档 | AI 自动拍照需求与集成索引 |
| `PRDS/PRD.md` | 产品需求文档（PRD） | 主产品需求索引 |
| `PRDS/requirements.md` | 需求收集文档 | 原始需求收集索引 |
| `PRDS/tech.md` | 技术架构文档 | 技术架构说明索引 |
| `PRDS/UI.md` | UI 设计文档 | UI 设计说明索引 |
| `PRDS/查勘采集流程三阶段优化方案.md` | 查勘采集流程三阶段优化方案 | 三阶段流程方案索引 |
| `PRDS/查勘采集流程优化业务需求文档.md` | 查勘采集流程优化业务需求文档 | 流程优化业务需求索引 |
| `PRDS/查勘采集助手三阶段采集流程说明.md` | 查勘采集助手三阶段采集流程说明 | 三阶段采集流程说明索引 |
| `PRDS/模块一：现场环境及车辆信息设计.md` | 模块一：现场环境及车辆信息设计 | 模块一信息设计索引 |
| `PRDS/预览页多模式交互设计.md` | 预览页多模式交互设计 | 预览页交互设计索引 |

## 后续使用规则

- 新增功能、流程、架构或接口变更时，先基于本索引定位原始文档，再创建独立 OpenSpec change。
- 如果后续确需把某个文档内容转成正式 spec，应单独提出迁移 change，并说明迁移范围。
