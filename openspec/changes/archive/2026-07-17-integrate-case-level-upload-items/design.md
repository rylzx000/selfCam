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
