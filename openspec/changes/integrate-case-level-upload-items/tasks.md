## 1. OpenSpec 与接口设计

- [x] 1.1 创建 `integrate-case-level-upload-items` change，并补齐 proposal、design、backend-integration delta spec 和 tasks。
- [x] 1.2 更新接口对接文档，说明 `caseUploadItems[]`、案件级不传 `vehicleId`、车辆级仍传 `vehicleId`、complete 不变。

## 2. 初始化映射与上传队列

- [x] 2.1 在 init mapper 中解析并缓存 `caseUploadItems[]`，形成按 `photoType` 查询的案件级上传项结构。
- [x] 2.2 在 `buildUploadItems` 中加入 `SCENE_45` 上传项，`sortNo = 1`，不包含 `vehicleId`。
- [x] 2.3 在 `buildUploadItems` 中加入最多 3 张 `SCENE_SUPPLEMENT` 上传项，`sortNo = 1..3`，不包含 `vehicleId`。
- [x] 2.4 当现场照片存在但案件级 `uploadItemId` 缺失时，抛出 `AUX_CASE_UPLOAD_ITEM_MISSING` 明确错误。

## 3. 上传 API 与旧入口保护

- [x] 3.1 修改 `uploadPhotoBase64`，案件级照片请求体不含 `vehicleId`，车辆级照片继续校验并发送 `vehicleId`。
- [x] 3.2 修改旧 `document` 页 `onSubmit`，阻止创建 uploadSession 或触发旧上传，并安全跳转新最终预览。

## 4. 测试与验证

- [x] 4.1 补充 mapper、upload-state、aux-photo-api、document 相关 Jest 用例。
- [x] 4.2 运行指定 node 语法检查、相关 Jest、`openspec validate --all --strict` 和 `git diff --check`。
