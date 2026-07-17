## Context

预览页补拍入口的上下文写入基本完整：`fromPreview` 表示从预览页进入相机，`previewReturnMode` 表示应返回的预览模式，例如 `moduleOne`、`moduleTwo`、`moduleThree` 或 `final`。问题集中在相机页确认照片后的出口逻辑。

## Fix Strategy

### 1. 统一预览返回出口

在 `camera.js` 内复用或封装已有 `goToPreviewPage()` / `getPreviewPageUrl()` 逻辑，让从预览页进入相机的确认分支不再硬编码 `navigateToModuleOnePreviewPage()`。

### 2. 修复 45 度确认分支

`SCENE_45` 确认分支保存照片后：

- 如果 `flowContext.fromPreview` 为真，回到来源预览模式。
- 如果 `flowContext.fromPreview` 为假，保持原主流程，继续进入车牌拍摄。

### 3. 收口其他同类分支

`SCENE_SUPPLEMENT`、`LICENSE_PLATE`、`VIN_CODE` 的预览返回分支使用同一返回出口，避免最终总预览补拍后被带回模块一预览。

### 4. 修复重拍兜底

车辆照片 `retakeMode` 保存成功后，`navigateBack` 失败时使用当前缓存推导出的预览 URL，而不是固定普通预览页。

### 5. 补齐路由矩阵防线

新增人工可读矩阵和独立 Jest 表驱动测试，把模块一、模块二、模块三、最终预览和兜底跳转拆成可追踪用例 ID。测试先覆盖真实入口方法，例如确认照片、查看已拍、阶段切换、证件来源选择和 `navigateBack` 失败兜底，再根据失败用例最小修复路由上下文。

### 6. 限定 `previewReturnMode` 生效边界

`previewReturnMode` 只代表“从预览进入相机后应回到哪个预览模式”。普通相机页点击查看已拍时，应根据当前拍摄步骤推导模块预览；不能因为缓存中残留旧的 `previewReturnMode` 而跳到错误来源，例如模块二车损查看已拍误回最终总预览。

## Non-Goals

- 不修改预览页入口结构。
- 不修改缓存 schema。
- 不调整上传、相册保存、证件上传或 AI 检测逻辑。
- 不引入新页面或新业务能力。

## Risks

- 预览返回依赖 `previewReturnMode`，需要用测试覆盖 `moduleOne` 与 `final` 两类关键来源。
- 主流程首次拍摄 45 度后的推进不能被误改，因此需要保留自然流程测试。
- 缓存当前不会自动清理 `previewReturnMode`，因此普通“查看已拍”必须用测试覆盖 stale 模式风险。
