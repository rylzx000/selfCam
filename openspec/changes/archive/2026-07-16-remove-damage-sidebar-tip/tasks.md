## 1. 车损左侧轻提示

- [x] 1.1 删除 `packageD/pages/camera/camera.wxml` 中车损首张前的 `damage-tip` 轻提示块。
- [x] 1.2 保留拍照按钮、取景区域步骤提示、AI 状态提示和拍摄指引入口。

## 2. 测试与验证

- [x] 2.1 更新 `__tests__/camera-ai-start.test.js`，断言 WXML 不再包含该轻提示和 `damage-tip` 视图块。
- [x] 2.2 运行 `node --check packageD/pages/camera/camera.js`。
- [x] 2.3 运行 `npm test -- --runInBand --runTestsByPath __tests__/camera-ai-start.test.js`。
