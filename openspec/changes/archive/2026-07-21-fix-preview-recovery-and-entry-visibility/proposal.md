## Why

本轮人工测试暴露了预览补拍入口、证件汇总展示和二次进入恢复路由的回归风险：用户已采集的数据可能在界面上不可见，或二次进入后停留在不可继续拍摄的 camera 页。需要用 hotfix 方式补齐失败测试并最小修复，避免扩大流程重构。

## What Changes

- 修正现场类拍摄页左侧语境：`scene45` 和 `sceneSupplement` 展示为案件级“现场照片”，但车牌号、VIN、车损仍保持车辆语境。
- 最终预览页车损 `+` 入口不再依赖车牌/VIN 完成状态，只受单车车损数量上限和总照片数量限制；模块二预览保持现有体验。
- 模块三预览页和最终预览页展示同一车辆同一证件下已采集的电子版、实物正页和实物副页，并固定展示顺序。
- 同 ticket 二次进入时补齐预览型步骤恢复 URL；camera 页遇到非拍摄步骤或未知步骤时安全重定向，确认照片时只允许合法拍摄步骤保存。
- 不自动提交 git，不 push，不修改无关文件。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `preview-flow`: 预览页入口可见性、证件汇总展示和最终预览补拍入口边界补强。
- `camera-capture`: 同 ticket 恢复路由和 camera 页非拍摄步骤防御补强。

## Impact

- 影响代码：`pages/index` 恢复路由、`packageD/pages/camera` 拍摄页状态与确认防御、`packageD/pages/preview` 预览展示与入口条件。
- 影响测试：补充或调整 `__tests__` 下预览、证件、恢复路由和 camera 防御相关 Jest 测试。
- 不涉及后端接口、数据 schema、依赖安装、git commit、push 或发版动作。
