---
comet_change: integrate-case-level-upload-items
role: technical-design
canonical_spec: openspec
archived-with: 2026-07-17-integrate-case-level-upload-items
status: final
---

# 案件级拍照项接入设计

## 背景

新拍照流程已经以模块一、模块二、模块三和最终总预览作为主路径。现场 45 度照片和现场补充照片属于案件级，不属于任何车辆；车辆级车牌、VIN、车损、驾驶证和行驶证继续使用 `vehicles[].uploadItems[]`。本轮只接入后端通过 `init.caseUploadItems[]` 下发的案件级拍照项，并保持最终总预览页统一逐张上传。

## 方案

1. `aux-photo-mapper.js` 在初始化映射时读取 `caseUploadItems[]`，归一化每个上传项并生成 `caseUploadItemsByPhotoType`。该结构只用于案件级照片，不写入任一车辆。
2. `upload-state.js` 的 `buildUploadItems` 在车辆级队列之前或之后加入案件级现场照片：
   - `scenePhotos.scene45` 生成 `SCENE_45`，`sortNo = 1`。
   - `scenePhotos.supplements[]` 最多取前 3 张生成 `SCENE_SUPPLEMENT`，`sortNo = 1..3`。
   - 两类上传项均不设置 `vehicleId`。
3. `aux-photo-api.js` 以 `SCENE_45`、`SCENE_SUPPLEMENT` 判定案件级照片。案件级不校验 `vehicleId`，请求体不包含该字段；车辆级保持原有 `vehicleId` 校验和请求字段。
4. `packageD/pages/document/document.js` 保留文件，但 `onSubmit` 不再调用 `uploadState.createUploadSession(cache)` 或旧上传逻辑；误入时提示并跳转新流程最终预览页。

## 错误处理

- 案件级照片存在但缺少对应 `uploadItemId` 时，抛出或返回：
  - `code = AUX_CASE_UPLOAD_ITEM_MISSING`
  - `message = 案件级拍照项未下发，请联系后台配置。`
- 车辆级缺少 `vehicleId` 时，继续按既有车辆级错误处理，不改错误语义。
- complete 接口不变，图片上传全部成功后继续走现有完成逻辑。

## 测试策略

- mapper：验证 `caseUploadItems[]` 能解析到 `caseUploadItemsByPhotoType`。
- upload-state：验证 `SCENE_45`、最多 3 张 `SCENE_SUPPLEMENT`、排序、无 `vehicleId`、缺配置错误。
- aux-photo-api：验证案件级请求体不含 `vehicleId`，车辆级仍含 `vehicleId` 且缺失时报错。
- document：验证旧页 `onSubmit` 不创建 uploadSession、不触发旧上传，并尝试跳转最终预览。

## 非目标

- 不删除旧 document 页面文件。
- 不恢复模块完成时上传。
- 不修改 init、uploadPhotoBase64、complete 路径。
- 不新增 missingItems、requiredPassed 或批量上传协议。
