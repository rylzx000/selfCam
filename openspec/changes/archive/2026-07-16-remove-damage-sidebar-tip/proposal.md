## Why

车损拍摄页左侧栏在首张车损前展示“请对准车损处，点击下方按钮拍照”轻提示。该提示与拍照按钮、取景区域引导和车损拍摄指引重复，用户反馈为冗余信息，希望任何时候都不展示。

## What Changes

- 删除拍照页车损左侧栏的 `damage-tip` 轻提示块。
- 保留拍照按钮、取景区域步骤提示、AI 状态提示和车损远/中/近拍摄指引。
- 更新相机页相关 Jest 断言，确保该提示不再出现在 WXML 中。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `camera-capture`: 车损拍摄页左侧栏不再展示冗余轻提示，不改变拍照、确认、重拍、查看已拍、完成车损或 AI 自动拍照逻辑。

## Impact

- 页面：`packageD/pages/camera/camera.wxml`。
- 测试：`__tests__/camera-ai-start.test.js`。
- 不修改后端接口、缓存结构、拍照页业务逻辑、拍摄指引弹层或上传流程。
