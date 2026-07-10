## Context

selfCam 是微信小程序分包项目，当前核心流程由开始页、拍照页、预览页、证件页和完成页组成，并包含本地缓存恢复、AI 自动抓拍、辅助拍照后端上传、轻质检及多层自动化测试。现有知识分布在产品文档、技术设计、测试清单、页面代码、工具模块和 Jest/e2e 测试中。

本次工作是 existing artifacts baseline conversion：建立对现状的结构化描述，而不是设计新功能。OpenSpec 内容默认使用简体中文，change id、spec id 和目录使用英文 kebab-case，`Requirement`、`Scenario`、`ADDED` 等固定结构关键字保留英文。

## Goals / Non-Goals

**Goals:**

- 用六个能力规格覆盖当前主要产品与技术能力。
- 每个 spec 同时记录文档、代码和测试来源，便于追溯。
- 从现有测试提炼可执行的验收场景。
- 明确现状限制和文档/实现冲突，避免把推测写成事实。
- 通过 OpenSpec 严格校验，为后续 archive 和增量变更建立基础。

**Non-Goals:**

- 不修改业务代码、测试代码、接口、缓存、页面或配置。
- 不复制 `docs/`、`PRDS/` 的完整正文。
- 不重命名或迁移现有中文文档。
- 不在本 change 中解决历史文档与实现之间的全部差异。
- 不在未经确认的情况下执行 archive、commit 或 push。

## Decisions

### 1. 先建立 change delta，再归档为主规格

六项能力均作为 `baseline-existing-selfcam/specs/<spec-id>/spec.md` 下的 `ADDED Requirements`。完成校验和人工审核后，再单独执行 archive。

**替代方案：** 直接写入 `openspec/specs/`。  
**未采用原因：** 绕过 proposal、design、tasks 和 delta 审核流程，不利于追踪基线形成过程。

### 2. 按能力边界拆分六个 spec

| Spec | 边界 |
|---|---|
| `camera-capture` | 通用拍照流程、确认/重拍、容量与恢复 |
| `ai-auto-capture` | AI 检测、门控、自动触发与降级 |
| `vehicle-info` | 现场环境、车牌、VIN 和多车归属 |
| `preview-flow` | 多模式预览、证件、补拍/删除与完成流转 |
| `backend-integration` | ticket、后端车辆、上传、complete 和日志 |
| `quality-and-tests` | 轻质检、配置降级和验证策略 |

交叉规则只在一个 spec 中定义，其他 spec 通过来源路径和场景关系引用，避免重复产生不同口径。

### 3. 采用“索引 + 规范提炼”，不迁移全文

每个 spec 保留“当前能力说明”“关联来源”“已知限制 / 待确认点”，规范内容集中在 `ADDED Requirements`。以下内容只引用：

- API 完整请求/响应字段表和环境地址。
- UI 全量文案、布局尺寸和视觉参数。
- AI 模型下载地址、完整阈值表和算法实现细节。
- 测试文档的完整操作步骤、测试数据和历史版本记录。
- 代码实现和缓存对象的完整字段定义。

### 4. 事实来源采用交叉验证

来源优先级不是简单覆盖关系：

1. 当前代码描述实际实现路径。
2. 自动化测试描述已经被验证的行为和边界。
3. `docs/`、`PRDS/` 描述业务目标、设计意图和手工验收材料。
4. 冲突内容进入“已知限制 / 待确认点”，不擅自改成目标状态。

### 5. 验收场景从现有测试提炼

单元测试用于提炼模块级规则，e2e 用于提炼跨页面和一致性规则。测试文档中标记为未完成或仅人工验证的项目，只记录为待确认，不写成已验证事实。

### 6. 使用 Comet 做阶段守卫，不修改配置

本次按 design、build、verify 三阶段推进。Comet 仅用于约束执行顺序和最终检查，不修改 `.comet/config.yaml`，也不引入额外运行状态文件。

## Source Mapping

| Spec | 文档 | 代码 | 测试 |
|---|---|---|---|
| `camera-capture` | `PRDS/PRD.md`、`PRDS/tech.md`、`PRDS/UI.md`、`docs/test-cases.md`、`docs/abnormal-flow-test-cases.md` | `packageD/pages/index/`、`packageD/pages/camera/`、`packageD/utils/workflow-state.js`、`packageD/utils/storage.js`、`packageD/utils/storage-schema.js` | `__tests__/workflow-state.test.js`、`__tests__/workflow-recovery.test.js`、`__tests__/camera-ai-start.test.js`、`e2e/specs/capacity-boundary.spec.js`、`e2e/specs/delete-retake-replenish.spec.js` |
| `ai-auto-capture` | `PRDS/auto-capture-ai.md`、`docs/ai-auto-capture-test-cases.md`、`docs/env-config-design.md` | `packageD/utils/ai-config.js`、`plate-detector.js`、`damage-auto-capture-engine.js`、`damage-phase-controller.js`、`frame-utils.js`、`model-cache.js` | `__tests__/damage-capture-modules.test.js`、`camera-ai-start.test.js`、`model-cache.test.js`、`ai-realtime-log.test.js` |
| `vehicle-info` | `PRDS/模块一：现场环境及车辆信息设计.md`、三阶段流程文档、`PRDS/PRD.md` | `packageD/pages/camera/`、`packageD/pages/preview/`、`storage-schema.js`、`cache-selectors.js`、`aux-photo-mapper.js` | `__tests__/module-one-preview.test.js`、`aux-photo-mapper.test.js`、`e2e/specs/module-one-two-flow.spec.js`、`multi-vehicle-chaos.spec.js` |
| `preview-flow` | `PRDS/预览页多模式交互设计.md`、`PRDS/UI.md`、三阶段流程说明 | `packageD/pages/preview/`、`document/`、`complete/`、`packageD/utils/documents.js`、`album.js` | `__tests__/preview-driving-license.test.js`、`preview-layout.test.js`、`complete-page.test.js`、`document-upload-entry.test.js`、`e2e/specs/submit-consistency.spec.js` |
| `backend-integration` | `docs/辅助拍照微信小程序接口对接文档.md`、`docs/env-config-design.md`、`PRDS/tech.md` | `aux-photo-api.js`、`aux-photo-mapper.js`、`upload-state.js`、`env-config.js`、`bootstrap.js`、`runtime-logger.js` | `__tests__/aux-photo-api.test.js`、`upload-state.test.js`、`error-log-upload.test.js`、`env-config.test.js`、`bootstrap.test.js` |
| `quality-and-tests` | `docs/photo-quality-design.md`、`quality-config-design.md`、`test-run-guide.md`、`test-cases.md`、`abnormal-flow-test-cases.md` | `photo-quality.js`、`quality-config.js`、`quality-config-loader.js`、`responsive-ui.js` | `__tests__/photo-quality.test.js`、`quality-config.test.js`、`camera-photo-quality.test.js`、`camera-layout.test.js`、全部 `e2e/specs/` |

## Risks / Trade-offs

- [历史文档可能落后于代码] → 以代码和本轮可定位的自动化测试为现状证据，并记录冲突。
- [六个能力存在交叉] → 使用明确边界表，一个规则只在一个 spec 中成为规范性要求。
- [测试名称不能覆盖全部实现细节] → 只提炼可从测试名称、断言和代码路径确认的行为。
- [部分场景仅有手工用例] → 标记为待确认，不声明已经自动化验证。
- [基线规格可能过度具体] → 只保留稳定业务规则，不复制阈值、布局像素或报文字段全集。

## Migration Plan

1. 完成 proposal、design、tasks 和六个 delta spec。
2. 运行 `openspec validate baseline-existing-selfcam --strict --no-interactive`。
3. 修复格式、映射和场景问题，并核对只修改 OpenSpec 文件。
4. 由用户审核规格内容。
5. 审核通过后，单独确认是否执行 `openspec archive baseline-existing-selfcam`。

回滚方式：在 archive 前如需撤销，应通过新的 Git 提交还原本 change 下的 OpenSpec 文件；archive 后按 OpenSpec 归档修正流程处理。业务代码和原始文档不受影响。

## Open Questions

- 现场 45 度照片缺失时目前采用提示后继续，是否长期保持非硬拦截策略。
- 车损照片的产品文档历史上存在 4/5/10 张口径，基线按当前代码和现行测试使用每车最多 10 张。
- 全局 50 张容量限制是否属于稳定业务规则，还是仅当前端保护边界。
- 部分 AI 手工测试尚未标记完成，后续是否需要补真机验收结果。
- `document` 独立页面与预览页内证件采集入口的长期职责边界是否继续保留。
