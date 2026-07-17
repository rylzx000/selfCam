## 1. 拍摄指引入口 UI

- [x] 1.1 调整 `camera.wxml` 中 `side-guide-entry` 内部结构，保留点击绑定、`data-guide` 和展示条件
- [x] 1.2 重写 `camera.wxss` 中入口、图标、主文案、辅助标签和 active 状态样式，迁移弱胶囊气质

## 2. 测试

- [x] 2.1 补充最小 Jest 测试，验证入口结构、绑定、展示条件和文案

## 3. 验证

- [x] 3.1 运行 `openspec validate --all --strict`
- [x] 3.2 运行相关 Jest：`npm test -- --runInBand --runTestsByPath __tests__/camera-ai-start.test.js`
- [x] 3.3 运行新增入口结构测试
