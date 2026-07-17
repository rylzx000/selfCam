# Comet Design Handoff

- Change: integrate-case-level-upload-items
- Phase: design
- Mode: compact
- Context hash: edef792c143c6f63f488bb8ff807d9e816b64eb1496b1b0ad705a095fbf8ff47

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/integrate-case-level-upload-items/proposal.md

- Source: openspec/changes/integrate-case-level-upload-items/proposal.md
- Lines: 1-31
- SHA256: 8cf744ed5f0977d377c85a2b7b5c21485c747787656337fe8caff2d513f0a924

```md
## Why

当前新拍照流程已经把现场照片保存在案件级缓存中，并在最终总预览页统一提交，但上传队列尚未完整接入后端通过 `init.caseUploadItems[]` 下发的案件级拍照项。若继续只依赖车辆级 `vehicles[].uploadItems[]`，现场 45 度和现场补充照片可能被静默跳过或错误绑定车辆，无法满足真实后端配置和最终统一上传要求。

## What Changes

- 解析并缓存 `init.caseUploadItems[]`，至少支持 `SCENE_45` 和 `SCENE_SUPPLEMENT`。
- 在最终统一上传队列中加入案件级现场照片：
  - `scenePhotos.scene45` 生成 `SCENE_45` 上传项，`sortNo = 1`。
  - `scenePhotos.supplements[]` 最多生成 3 个 `SCENE_SUPPLEMENT` 上传项，`sortNo = 1..3`。
- 案件级上传请求体不包含 `vehicleId` 字段；车辆级上传保持必须携带 `vehicleId`。
- 案件级上传项缺失时返回明确配置错误：`AUX_CASE_UPLOAD_ITEM_MISSING` / `案件级拍照项未下发，请联系后台配置。`。
- 旧 `document` 页保持文件存在，但不得再创建上传会话或触发旧上传逻辑；误入时安全跳回新流程最终预览或阻止旧上传副作用。
- 更新接口对接文档，保持“最小化接口改造”口径，不引入本轮不实现的 `missingItems`、批量上传或 complete 协议变化。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `backend-integration`：初始化映射、上传队列和上传请求体需要区分案件级拍照项与车辆级拍照项，并明确案件级配置缺失错误。

## Impact

- 代码：`packageD/utils/aux-photo-mapper.js`、`packageD/utils/upload-state.js`、`packageD/utils/aux-photo-api.js`、`packageD/pages/document/document.js`。
- 测试：按现有 Jest 结构补充或更新 mapper、上传队列、上传 API 和旧 document 入口测试。
- 文档：`docs/辅助拍照微信小程序接口对接文档.md` 说明 `caseUploadItems[]`、案件级不传 `vehicleId`、车辆级仍传 `vehicleId`、complete 不变。
- 接口边界：init、uploadPhotoBase64、complete 路径不变；上传仍是一张照片一个请求；不要求后端新增 `requiredPassed` 或 `missingItems`。

```

## openspec/changes/integrate-case-level-upload-items/design.md

- Source: openspec/changes/integrate-case-level-upload-items/design.md
- Lines: 1-60
- SHA256: 8fc97047e42bb59f6564b2a27d4454cc6f7b99f41c3ad6a5f60b33f450aac5f8

```md
## Context

辅助拍照当前稳定流程是模块一采集案件级现场环境和车辆车牌/VIN，模块二采集车辆级车损，模块三补充车辆证件，最终总预览页统一逐张上传并调用 complete。现有后端初始化已经通过车辆维度的 `vehicles[].uploadItems[]` 提供车辆级上传槽位，本轮需要接入新增的案件级 `caseUploadItems[]`，让现场 45 度和现场补充照片使用真实后端配置。

约束：

- init、uploadPhotoBase64、complete 接口路径不变。
- 上传仍是一张照片一个请求，不改批量上传。
- complete 返回和处理逻辑不变，不新增 `missingItems`、`requiredPassed` 等后端协议要求。
- 旧 `document` 页面文件不删除，但不能再产生上传副作用。

## Goals / Non-Goals

**Goals:**

- 在初始化映射中缓存 `caseUploadItems[]`，形成按 `photoType` 查询的案件级上传项结构。
- `buildUploadItems` 将现场主照片和最多 3 张补充现场照片加入最终上传队列，且不绑定 `vehicleId`。
- `uploadPhotoBase64` 区分案件级与车辆级照片，请求体只在车辆级包含 `vehicleId`。
- 案件级上传项缺失时以 `AUX_CASE_UPLOAD_ITEM_MISSING` 明确失败，不静默跳过现场照片。
- 旧 `document` 页误入时阻止旧上传逻辑，并引导到新流程最终预览。

**Non-Goals:**

- 不修改后端接口路径、字段名或 complete 协议。
- 不恢复每个模块完成时上传，也不恢复旧 document 页上传。
- 不删除旧 document 页面文件。
- 不新增后端缺项校验协议或 missingItems 处理。
- 不改变车辆级车牌、VIN、车损、驾驶证、行驶证上传逻辑。

## Decisions

1. **案件级上传项按 `photoType` 缓存。**  
   使用 `caseUploadItemsByPhotoType` 或等价结构，保持和车辆级 `uploadItemsByPhotoType` 相同的查询语义。替代方案是在上传队列构建时遍历数组查找，但会分散缺项处理并增加重复逻辑。

2. **上传队列负责发现案件级配置缺失。**  
   `buildUploadItems` 能直接看到缓存中的现场照片和 `caseUploadItems`，因此在照片存在但案件级上传项缺失时立即抛出 `AUX_CASE_UPLOAD_ITEM_MISSING`。替代方案是在 API 层才报错，但 API 层无法判断缺失是否来自 init 配置还是调用方遗漏。

3. **API 层继续做最终请求体防线。**  
   `uploadPhotoBase64` 通过 `SCENE_45`、`SCENE_SUPPLEMENT` 判定案件级照片：不校验 `vehicleId`，也不把 `vehicleId` 写入请求体；其他 photoType 保持车辆级校验。这样即使调用方传入空 `vehicleId`，案件级请求体也不会携带该字段。

4. **旧 document 页采用安全阻断而非删除。**  
   保留页面文件和可测试入口，`onSubmit` 只提示并跳转新最终预览页，不再调用上传会话创建函数。这样避免误入口导致副作用，同时不扩大到路由清理或文件删除。

## Risks / Trade-offs

- [Risk] 后端未下发 `caseUploadItems[]` 时现场照片无法上传。→ Mitigation：前端用明确错误提示暴露配置问题，不静默跳过。
- [Risk] 不同后端环境 `uploadItemId` 字段命名存在兼容差异。→ Mitigation：沿用现有 mapper 对车辆上传项的字段适配方式，仅新增案件级同构映射。
- [Risk] 旧 document 页仍可能被历史入口打开。→ Mitigation：`onSubmit` 阻断上传副作用，并跳转到新流程最终预览页。

## Migration Plan

1. 创建 OpenSpec change 并补充 backend-integration delta spec。
2. 修改 mapper、上传队列、API 请求体和旧 document 页入口。
3. 更新接口文档，明确后端需下发 `caseUploadItems[]`。
4. 补充 Jest 覆盖案件级映射、上传队列、请求体和旧入口阻断。
5. 运行指定 node 语法检查、相关 Jest、OpenSpec strict validate 和 `git diff --check`。

## Open Questions

- 后端需确认生产环境会为 `SCENE_45` 和 `SCENE_SUPPLEMENT` 下发有效 `uploadItemId`，否则前端将按配置错误阻断提交。

```

## openspec/changes/integrate-case-level-upload-items/tasks.md

- Source: openspec/changes/integrate-case-level-upload-items/tasks.md
- Lines: 1-21
- SHA256: ba5ca72f7d613dbad3fb85129f54af98cf362fd3d6fbcf3aadc56656136f2267

```md
## 1. OpenSpec 与接口设计

- [ ] 1.1 创建 `integrate-case-level-upload-items` change，并补齐 proposal、design、backend-integration delta spec 和 tasks。
- [ ] 1.2 更新接口对接文档，说明 `caseUploadItems[]`、案件级不传 `vehicleId`、车辆级仍传 `vehicleId`、complete 不变。

## 2. 初始化映射与上传队列

- [ ] 2.1 在 init mapper 中解析并缓存 `caseUploadItems[]`，形成按 `photoType` 查询的案件级上传项结构。
- [ ] 2.2 在 `buildUploadItems` 中加入 `SCENE_45` 上传项，`sortNo = 1`，不包含 `vehicleId`。
- [ ] 2.3 在 `buildUploadItems` 中加入最多 3 张 `SCENE_SUPPLEMENT` 上传项，`sortNo = 1..3`，不包含 `vehicleId`。
- [ ] 2.4 当现场照片存在但案件级 `uploadItemId` 缺失时，抛出 `AUX_CASE_UPLOAD_ITEM_MISSING` 明确错误。

## 3. 上传 API 与旧入口保护

- [ ] 3.1 修改 `uploadPhotoBase64`，案件级照片请求体不含 `vehicleId`，车辆级照片继续校验并发送 `vehicleId`。
- [ ] 3.2 修改旧 `document` 页 `onSubmit`，阻止创建 uploadSession 或触发旧上传，并安全跳转新最终预览。

## 4. 测试与验证

- [ ] 4.1 补充 mapper、upload-state、aux-photo-api、document 相关 Jest 用例。
- [ ] 4.2 运行指定 node 语法检查、相关 Jest、`openspec validate --all --strict` 和 `git diff --check`。

```

## openspec/changes/integrate-case-level-upload-items/specs/backend-integration/spec.md

- Source: openspec/changes/integrate-case-level-upload-items/specs/backend-integration/spec.md
- Lines: 1-45
- SHA256: cd443235962cbc5120ecf194c3a845dcfe9b010405e243ec44379291f572a3a1

```md
## ADDED Requirements

### Requirement: 案件级拍照项参与最终统一上传

系统 MUST 使用初始化接口下发的 `caseUploadItems[]` 作为案件级现场照片的上传项来源，并且只在最终总预览提交时把案件级照片加入逐张上传队列。

#### Scenario: 上传现场 45 度照片
- **WHEN** 最终总预览提交时缓存存在 `scenePhotos.scene45`，且初始化缓存中存在 `SCENE_45` 案件级拍照项
- **THEN** 系统生成一条 `photoType = SCENE_45`、`sortNo = 1`、`uploadItemId` 来自 `caseUploadItems` 的上传项
- **AND** 该上传项不得包含 `vehicleId`

#### Scenario: 上传现场补充照片
- **WHEN** 最终总预览提交时缓存存在 `scenePhotos.supplements[]`，且初始化缓存中存在 `SCENE_SUPPLEMENT` 案件级拍照项
- **THEN** 系统最多按前 3 张生成 `photoType = SCENE_SUPPLEMENT` 的上传项
- **AND** 系统按照片顺序写入 `sortNo = 1..3`
- **AND** 每条案件级上传项不得包含 `vehicleId`

#### Scenario: 案件级拍照项未下发
- **WHEN** 缓存存在现场 45 度照片或现场补充照片，但初始化缓存缺少对应案件级 `uploadItemId`
- **THEN** 系统不得静默跳过该现场照片上传
- **AND** 系统返回 `AUX_CASE_UPLOAD_ITEM_MISSING` 错误
- **AND** 错误提示为“案件级拍照项未下发，请联系后台配置。”

### Requirement: 上传请求体按案件级和车辆级区分归属

系统 MUST 在调用 `uploadPhotoBase64` 时按 `photoType` 区分案件级与车辆级照片归属；案件级照片不得发送 `vehicleId` 字段，车辆级照片仍必须发送有效 `vehicleId`。

#### Scenario: 案件级上传请求体
- **WHEN** 上传 `SCENE_45` 或 `SCENE_SUPPLEMENT` 图片
- **THEN** 请求体包含 `ticket`、`photoType`、`uploadItemId`、`sortNo` 和图片 Base64 等既有必要字段
- **AND** 请求体不得包含 `vehicleId` 字段，包括空字符串或 `null`

#### Scenario: 车辆级上传请求体
- **WHEN** 上传车牌号、VIN、车损、驾驶证或行驶证图片
- **THEN** 请求体必须包含对应车辆的 `vehicleId`
- **AND** 缺少 `vehicleId` 时系统继续按既有车辆级上传校验报错

### Requirement: 旧 document 页不得触发旧上传

系统 SHALL 保留旧 `document` 页面文件，但在新三模块流程下不得从该页面创建上传会话、触发旧上传或恢复旧 document 页上传路径。

#### Scenario: 误入旧 document 页并点击提交
- **WHEN** 用户或旧入口误打开 `document` 页面并触发 `onSubmit`
- **THEN** 系统不得调用旧的 `createUploadSession` 或旧上传逻辑
- **AND** 系统提示或跳转到新流程最终总预览页

```
