## 实现说明

本次属于拍照页展示层轻量优化，只删除车损信息卡内首张车损前的 `damage-tip` 视图块。该视图只承担左侧栏轻提示展示，不参与拍照流程状态、按钮可用性、AI 检测或缓存写入。

## 边界

- 保留 `constants.GUIDE_TIPS.damage`，因为它仍用于流程上下文、取景区域步骤提示和既有测试。
- 保留 `aiStatusText` 相关提示，AI 功能开启或不可用时仍按原逻辑展示。
- 保留拍摄指引入口和车损远/中/近弹层，不修改指引图片、弹层结构和确认逻辑。

## 验证

- `node --check packageD/pages/camera/camera.js`
- `npm test -- --runInBand --runTestsByPath __tests__/camera-ai-start.test.js`
- 额外尝试运行 `__tests__/camera-layout.test.js` 时，当前失败原因是测试内 `ai-config` mock 缺少 `AI_FEATURES`，与本次删除 `damage-tip` 无关；本次不扩大修复。
