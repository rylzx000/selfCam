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
