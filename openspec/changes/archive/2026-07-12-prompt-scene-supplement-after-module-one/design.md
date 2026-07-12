## 实现说明

### 缓存状态

在主缓存根级新增布尔标记 `sceneSupplementPromptShown`，默认 `false`。缓存创建、迁移、清洗和修复时保留布尔值；点击提示弹层任一按钮时写入 `true`。

### 弹层触发

预览页在 `loadData()` 更新模块一摘要后检查是否需要展示弹层。触发条件：

- 当前为 `moduleOne` 预览模式；
- 模块一主链路已完成：整车 45 度现场照片已完成，且所有车辆的车牌号和 VIN 均完成；
- `sceneSupplementPromptShown !== true`；
- 当前不是补拍、重拍或大图预览返回上下文。

现场 45 度照片缺失时继续优先走现有“现场照片未采集”提示，不展示补充现场信息提示。

### 去拍摄/没有了流程

弹层复用 `wx.showModal`。确认“去拍摄”时先写入 `sceneSupplementPromptShown = true`，再设置 `currentStep = sceneSupplement`、`sceneSupplementIndex = 第一个可用槽位`、`fromPreview = true`、`previewReturnMode = moduleOne` 并进入相机页。取消“没有了”时仅写入标记并停留模块一预览页。

### 三张上限

统一使用 `constants.LIMITS.MAX_SCENE_SUPPLEMENTS = 3`。保存、拍摄入口拦截、模块一预览槽位、最终预览计数、mock 和测试预期均引用该常量；后端接口路径与字段名称保持不变。
