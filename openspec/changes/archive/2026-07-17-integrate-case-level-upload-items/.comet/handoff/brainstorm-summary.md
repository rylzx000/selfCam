# Brainstorm Summary

- Change: integrate-case-level-upload-items
- Date: 2026-07-13

## 确认的技术方案

本轮采用最小接口改造：`aux-photo-mapper` 解析 init 返回的 `caseUploadItems[]` 并按 `photoType` 缓存；`upload-state` 在最终统一上传队列中加入案件级 `SCENE_45` 和最多 3 张 `SCENE_SUPPLEMENT`；`aux-photo-api` 根据 `photoType` 区分案件级和车辆级请求体；旧 `document` 页阻断旧上传副作用并跳转新最终预览。

## 关键取舍与风险

- 取舍：在上传队列构建阶段暴露案件级配置缺失，避免现场照片被静默跳过。
- 取舍：API 层保留最终归属校验防线，案件级请求体永不写入 `vehicleId`。
- 风险：后端环境未配置 `SCENE_45` 或 `SCENE_SUPPLEMENT` 时最终提交会失败；前端用固定错误码和中文提示暴露配置问题。

## 测试策略

补充 Jest 覆盖 init mapper、案件级上传队列、补充照片排序和上限、案件级请求体无 `vehicleId`、车辆级 `vehicleId` 校验、案件级配置缺失错误，以及旧 `document` 页 `onSubmit` 不创建 uploadSession。

## Spec Patch

无。delta spec 已在 open 阶段覆盖本轮新增验收场景。
