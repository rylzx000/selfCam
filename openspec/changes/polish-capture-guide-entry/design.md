## Context

当前 `camera-capture` 规格已经要求用户可通过拍照页左侧入口再次查看 45 度现场照片和车损照片的拍摄指引。真实页面中入口结构位于 `packageD/pages/camera/camera.wxml` 的 `side-guide-entry`，样式位于 `packageD/pages/camera/camera.wxss`。OpenDesign 方案二提供了弱胶囊型视觉参考，目标是在不改业务逻辑的前提下迁移其层级和结构。

## Goals / Non-Goals

**Goals:**

- 让拍摄指引入口更像系统内自然的辅助入口，而非独立小卡片。
- 保持入口比“查看已拍”“完成车损”低权重，但仍可发现、可点击。
- 保留 45 度与车损两类入口的原有展示条件、点击行为和弹层打开能力。
- 补充结构测试，防止入口条件、绑定或文案回退。

**Non-Goals:**

- 不修改拍摄指引弹层内容和弹层逻辑。
- 不修改拍照、确认、重拍、查看已拍、完成车损、上传、缓存或 AI 自动拍照逻辑。
- 不引入新图片资源。
- 不改预览页、最终页、证件页。
- 不重构相机页整体布局。

## Decisions

### 1. 入口结构保留现有外层行为

`side-guide-entry` 外层继续保留 `wx:if="{{currentStep === 'scene45' || currentStep === 'damage'}}"`、`data-guide` 和 `bindtap="onOpenCaptureGuide"`，确保点击仍打开原有拍摄指引弹层。

### 2. 内部改为左图标右文案

入口内部改为左侧 `side-guide-icon`，右侧 `side-guide-copy`。右侧包含主文案 `side-guide-main` 和辅助标签 `side-guide-tag`，分别显示“拍摄指引”和当前步骤标签。

### 3. 复用现有轻量图标

继续复用 `.mini-scene-car` 和 `.mini-damage-steps`，仅调整尺寸、颜色和容器弱化程度，不新增图片或复杂图形。

### 4. 样式贴近 OpenDesign 方案二但适配小程序

迁移方案二的宽度、低高度、弱白背景、轻边框、小圆角、轻 active 状态和两级文案层次，同时使用 WXSS 可用写法，避免引入 Web 专用结构或 SVG。

## Risks / Trade-offs

- [横屏空间] → 车损页左侧同时存在三个入口，样式高度需要保持更矮，最终仍建议在微信开发者工具中确认横屏视觉。
- [WXML 结构测试不等同视觉测试] → Jest 可防止结构回退，但弱胶囊视觉仍需人工或截图确认。
- [OpenDesign 与小程序样式能力差异] → 使用现有 view 图形和 WXSS 实现相同气质，不逐像素迁移 HTML/SVG。
