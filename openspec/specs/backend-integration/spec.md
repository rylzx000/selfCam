# backend-integration Specification

## Purpose
定义辅助拍照 ticket 初始化、后端车辆与上传项映射、图片逐张上传、完成提交、mock 隔离及安全错误日志要求。

## Implementation Status

- `aux-photo-mapper.js` 已支持保存初始化返回的 `caseUploadItems`。
- 当前 `upload-state.js` 仅组装车辆级车牌、VIN、车损和证件照片，尚未把 `SCENE_45`、`SCENE_SUPPLEMENT` 加入上传队列。
- 下方案件级上传要求属于已确认目标接口，完成前端实现前不得将现场照片描述为已经上传。
## Requirements
### Requirement: ticket 初始化与状态拦截

系统 MUST 在辅助拍照入口使用 ticket 调用初始化能力，并根据后端 ticket 状态决定是否创建、恢复或阻止采集流程。

#### Scenario: 有效 ticket 初始化
- **WHEN** 入口包含有效 ticket 且初始化接口返回可采集状态、车辆和上传项
- **THEN** 系统建立辅助拍照缓存和后端车辆映射
- **AND** 系统进入新采集或可恢复页面

#### Scenario: 不可继续的 ticket
- **WHEN** 初始化结果或本地恢复状态表明 ticket 已完成、过期或撤销
- **THEN** 系统阻止进入上传和完成流程
- **AND** 系统向用户展示轻量状态提示

### Requirement: 后端上传项映射

系统 SHALL 将案件级现场照片、车辆级识别照片、车损照片和证件照片映射到后端定义的上传项，并保留图片类型、排序、来源元数据及适用的案件或车辆归属信息。

#### Scenario: 初始化案件级上传项
- **WHEN** 初始化结果包含 `caseUploadItems`
- **THEN** 系统把 `SCENE_45` 和 `SCENE_SUPPLEMENT` 保存为案件级上传槽位
- **AND** 系统保留 `SCENE_SUPPLEMENT.maxCount`，前端 mock 和测试数据按最多 3 张补充现场照片同步口径
- **AND** 系统不得把案件级上传项写入任一车辆的 `uploadItems`

### Requirement: 图片逐张上传与可恢复重试

系统 MUST 使用 JSON Base64 请求逐张上传图片，成功项在后续重试中不得重复上传，失败项可以从持久化状态继续。

#### Scenario: 部分图片上传失败
- **WHEN** 上传队列中的某一图片失败
- **THEN** 系统停止或标记当前上传会话为失败并保存失败项
- **AND** 用户重试时只继续未成功的图片

#### Scenario: 上传中断后恢复
- **WHEN** 页面退出或进程中断后重新进入且存在可恢复上传会话
- **THEN** 系统从缓存恢复已成功、失败和待上传状态
- **AND** 已成功图片不得重新上传

### Requirement: 完成接口独立于图片上传

系统 SHALL 仅在全部图片上传成功后调用完成接口，并把完成失败与图片上传失败分开记录和重试。

#### Scenario: 全部上传成功
- **WHEN** 上传会话中的全部图片状态为成功
- **THEN** 系统调用完成接口
- **AND** 完成成功后进入可结束状态或完成页

#### Scenario: 完成接口失败
- **WHEN** 图片已全部上传但完成接口失败
- **THEN** 系统保留图片成功记录并标记完成失败
- **AND** 用户重试时只重新调用完成接口

### Requirement: 环境与 mock 隔离

系统 MUST 根据小程序环境和项目配置选择真实接口或本地 mock；release 环境不得静默使用 mock 数据替代真实后端。

#### Scenario: 开发环境 mock ticket
- **WHEN** develop 环境启用 mock 且 ticket 符合 mock 规则
- **THEN** 系统可以使用本地 mock 初始化、上传和完成能力
- **AND** mock 行为不得写入真实后端

#### Scenario: release 环境配置不完整
- **WHEN** release 环境缺少真实接口地址或请求能力
- **THEN** 系统安全失败并记录配置问题
- **AND** 系统不得自动回退到 mock 完成业务

### Requirement: 错误日志安全上报

系统 SHALL 仅上报允许的 error 级事件和安全摘要字段，不得上传密钥、cookie、图片 Base64、请求体或本地图片路径。

#### Scenario: 真实请求失败
- **WHEN** 初始化、图片上传或完成请求失败
- **THEN** 系统通过 runtime logger 记录并按白名单上报错误摘要
- **AND** 日志使用 ticket 关联业务且不包含敏感内容

#### Scenario: warning 或 mock 失败
- **WHEN** 事件级别不是 error 或请求属于本地 mock 流程
- **THEN** 系统不得把该事件上传到在线错误日志接口

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

