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
