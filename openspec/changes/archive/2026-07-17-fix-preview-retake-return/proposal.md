## Why

模块一预览页删除或重拍“整车45度”现场照片后，重新拍摄并确认时，页面实际跳转到车牌号拍摄，而不是回到来源预览页。该问题会打断用户在预览页的补拍闭环，并可能影响最终总预览中的现场照片、车牌和 VIN 补拍返回目标。

## Root Cause

预览页进入补拍/重拍相机页时已经写入 `fromPreview` 和 `previewReturnMode`，但相机页部分确认分支没有正确消费这些返回上下文：

- `SCENE_45` 确认分支保存照片后无条件推进到 `LICENSE_PLATE`。
- `SCENE_SUPPLEMENT`、`LICENSE_PLATE` 和 `VIN_CODE` 的部分 `fromPreview` 分支固定回模块一预览，未保留最终总预览等来源模式。
- 车辆照片 `retakeMode` 的 `navigateBack` 失败兜底固定跳普通预览页，可能丢失模式参数。

## What Changes

- 统一相机页从预览进入后的确认返回逻辑，优先按 `previewReturnMode` 回到来源预览模式。
- 修复 45 度现场照片从预览补拍/重拍后的确认流转，避免误进入车牌拍摄。
- 保持正常首拍主流程不变：首次 45 度拍摄后仍进入车牌拍摄。
- 补充 Jest 回归用例，覆盖模块一、最终总预览和兜底返回模式。
- 补充流程路由测试矩阵文档与独立表驱动测试集，覆盖模块一、模块二、模块三、最终预览和兜底跳转的同类风险。

## Impact

- 修改页面逻辑：`packageD/pages/camera/camera.js`。
- 修改测试：`__tests__/camera-ai-start.test.js`、`__tests__/module-one-preview.test.js`、`__tests__/workflow-route-matrix.test.js`。
- 新增文档：`docs/test-flow-route-matrix.md`。
- 不新增能力、不改缓存结构、不改接口、不改 UI 文案、不改业务文档。
