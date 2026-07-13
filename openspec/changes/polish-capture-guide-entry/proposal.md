## Why

拍照页左侧底部的“拍摄指引”入口当前视觉上更像临时小卡片，权重偏高，与“查看已拍”“完成车损”等主操作的层级关系不够自然。OpenDesign 方案二已经验证了更轻量的弱胶囊样式，需要迁移到真实小程序页面。

## What Changes

- 将整车 45 度现场照片和车损照片步骤的左侧拍摄指引入口调整为弱胶囊型样式。
- 入口采用横向布局：左侧轻量示意图标，右侧主文案“拍摄指引”和辅助标签。
- 整车 45 度步骤辅助标签显示“45度”；车损步骤辅助标签显示“远 / 中 / 近”。
- 保留现有点击绑定、`data-guide` 类型和原有拍摄指引弹层逻辑。
- 补充最小结构测试，确认入口展示条件、点击绑定和文案未回退。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `camera-capture`: 优化拍照页左侧再次查看拍摄指引入口的可发现性与视觉层级，不改变拍摄指引弹层、拍照流程或相机生命周期要求。

## Impact

- 小程序页面：`packageD/pages/camera/camera.wxml`、`packageD/pages/camera/camera.wxss`。
- 测试：新增或补充拍照页入口结构相关 Jest 测试。
- OpenSpec：为 `camera-capture` 增加本次 UI 入口样式的 delta spec。
- 不修改弹层内容、弹层逻辑、拍照流程、路由、上传、缓存、AI 开关逻辑、预览页、最终页或证件页。
