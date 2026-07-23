## Context

相机页的确认弹窗状态是页面实例内的临时态，不应跨页面跳转后继续参与 `onUnload` 自动保存。当前 VIN 最后一张确认后使用 `wx.navigateTo` 跳模块一预览，旧相机页未卸载且未清临时态；后续 `wx.reLaunch` 进入车损页触发旧相机页卸载时，缓存步骤已经变成 `DAMAGE`，从而把 VIN 图误存为车损。

## Goals / Non-Goals

**Goals:**

- VIN 最后一张确认进入模块一预览前，清理 `showConfirmModal`、`pendingPhoto`、`qualityHintText`。
- 进入模块二车损拍摄时清理不应从模块一或预览补拍继承的一次性拍摄上下文。
- 用测试覆盖真实页面生命周期和上传污染防护。

**Non-Goals:**

- 不修改上传接口或后端字段。
- 不重构拍摄步骤、缓存 schema 或页面路由架构。
- 不改变已有补拍/重拍后的返回语义。

## Decisions

- 主修放在相机页 VIN 最后一张确认分支：保存 VIN 后立即清理临时确认态，再跳转模块一预览，从源头阻止 `onUnload` 二次保存。
- 预览页进入车损拍摄时只清理一次性拍摄上下文，例如 `retakeMode`、`fromPreview`、`captureReturnStrategy`、`sceneSupplementIndex`，不清理车辆、照片数组或应保留的业务缓存。
- 上传层不改生产逻辑，仅补测试约束：当 `damages` 为空或只包含真实车损图时，`buildUploadItems` 构造的 `DAMAGE` 项不得使用 VIN 路径或 `localPhotoId`。

## Risks / Trade-offs

- 清理范围过大可能破坏补拍/重拍返回逻辑，因此仅在“模块一预览进入车损拍摄”这一新流程入口清理一次性上下文。
- 如果其他直接跳转分支仍保留确认态，后续可能出现同类二次保存；本轮会用测试至少覆盖 VIN 最后一张分支，并在排查中对相近分支做最小修复。
