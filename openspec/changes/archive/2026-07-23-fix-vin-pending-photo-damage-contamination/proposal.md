## Why

人工测试发现模块一拍完 VIN 后进入模块二车损拍摄时，车损页默认显示“本车已拍 1 张”，且上传数据中第一张车损照片实际是刚才拍摄的 VIN 图。车损最多允许 10 张，但此污染导致用户实际只能再拍 9 张车损照片。

## Root Cause

VIN 最后一张确认后，相机页会把 `pendingPhoto` 写入 `currentVehicle.vinCode`，随后将缓存步骤切到 `MODULE_ONE_PREVIEW` 并通过 `wx.navigateTo` 跳转模块一预览。该分支没有清理相机页临时确认态，旧相机页仍留在页面栈。用户从模块一预览进入车损拍摄时，预览页把缓存步骤切为 `DAMAGE` 并 `wx.reLaunch` 到相机页，旧相机页卸载时仍看到 `showConfirmModal && pendingPhoto`，于是按当前 `DAMAGE` 步骤把旧 VIN 图保存进 `currentVehicle.damages`。

## What Changes

- 补充流程路由矩阵测试，复现旧相机页卸载时 VIN `pendingPhoto` 污染车损数组的问题。
- 补充相机确认后直接跳转分支的临时拍摄状态清理测试。
- 补充上传层防护测试，确保 `DAMAGE` 上传项不得直接使用 VIN 图片路径或 `localPhotoId`。
- 最小修复 VIN 最后一张确认进入模块一预览前未清理 `showConfirmModal`、`pendingPhoto`、`qualityHintText` 的问题。
- 进入模块二车损拍摄时清理不应继承的临时拍摄上下文，避免旧返回策略影响新车损流程。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `camera-capture`: 修复 VIN 确认跳转模块一预览后，旧相机页卸载时二次保存临时照片的行为。
- `preview-flow`: 进入车损拍摄时清理一次性拍摄上下文，保证车损页从真实车损数组计数。
- `backend-integration`: 增加上传项构造的回归测试，防止 VIN 图片被错误作为车损上传。

## Impact

- 影响测试：`__tests__/workflow-route-matrix.test.js`、`__tests__/upload-state.test.js`。
- 影响代码：`packageD/pages/camera/camera.js`、`packageD/pages/preview/preview.js`。
- 不修改上传接口、后端字段、缓存持久化结构或大流程架构。
