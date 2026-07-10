# baseline-existing-selfcam

selfCam 现有成果物的 OpenSpec 基线索引，不迁移原文全文。

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

## 能力规格映射

| Spec | 能力范围 | 主要代码入口 | 主要测试入口 |
|---|---|---|---|
| `camera-capture` | 开始采集、拍照状态、确认/重拍、车损容量、缓存恢复 | `packageD/pages/index/`、`packageD/pages/camera/`、`packageD/utils/workflow-state.js`、`packageD/utils/storage.js` | `__tests__/workflow-state.test.js`、`__tests__/workflow-recovery.test.js`、`__tests__/camera-ai-start.test.js`、`e2e/specs/delete-retake-replenish.spec.js` |
| `ai-auto-capture` | 车牌/车损检测、几何门控、稳定性、冷却、降级 | `packageD/utils/plate-detector.js`、`packageD/utils/damage-auto-capture-engine.js`、`packageD/utils/damage-phase-controller.js`、`packageD/utils/frame-utils.js` | `__tests__/damage-capture-modules.test.js`、`__tests__/camera-ai-start.test.js`、`__tests__/model-cache.test.js` |
| `vehicle-info` | 现场环境、车牌、VIN、多车信息与归属 | `packageD/pages/camera/`、`packageD/pages/preview/`、`packageD/utils/storage-schema.js`、`packageD/utils/aux-photo-mapper.js` | `__tests__/module-one-preview.test.js`、`__tests__/aux-photo-mapper.test.js`、`e2e/specs/module-one-two-flow.spec.js` |
| `preview-flow` | 模块预览、最终预览、补拍/重拍、证件采集、完成页 | `packageD/pages/preview/`、`packageD/pages/document/`、`packageD/pages/complete/`、`packageD/utils/documents.js` | `__tests__/preview-driving-license.test.js`、`__tests__/preview-layout.test.js`、`__tests__/complete-page.test.js`、`e2e/specs/submit-consistency.spec.js` |
| `backend-integration` | ticket 初始化、车辆映射、图片上传、完成提交、错误日志 | `packageD/utils/aux-photo-api.js`、`packageD/utils/aux-photo-mapper.js`、`packageD/utils/upload-state.js`、`packageD/utils/runtime-logger.js` | `__tests__/aux-photo-api.test.js`、`__tests__/upload-state.test.js`、`__tests__/error-log-upload.test.js` |
| `quality-and-tests` | 拍后轻质检、配置降级、验证分级与关键一致性 | `packageD/utils/photo-quality.js`、`packageD/utils/quality-config.js`、`packageD/utils/quality-config-loader.js` | `__tests__/photo-quality.test.js`、`__tests__/quality-config.test.js`、`__tests__/camera-photo-quality.test.js`、`e2e/specs/` |

## 索引原则

- 规格中的业务规则以当前代码、自动化测试和现行文档的交叉验证结果为基础。
- 文档与实现存在冲突时，不静默选择一方；在对应 spec 的“已知限制 / 待确认点”中记录。
- API 完整报文、UI 全量文案、模型参数表、测试步骤和历史版本说明只保留路径引用。
- 本 change 只建立基线，不修改业务代码、测试代码、原有 `docs/` 或 `PRDS/` 文件。
