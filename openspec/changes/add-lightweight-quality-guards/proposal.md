## Why

三阶段采集流程近期补齐了大量路由矩阵和回归用例，但仍缺少一组便宜、可提前失败的静态质量门禁。当前风险主要集中在四类：流程矩阵文档声称已覆盖但 Jest 用例遗漏、三阶段流程重新跳回无 `mode` 老预览、用户可见文案残留旧 AI 自动拍照或过期证件叫法、分包素材误放大图或临时文件。

## What Changes

- 新增轻量 Jest 检测，校验 `docs/test-flow-route-matrix.md` 中声明已覆盖的用例 ID 必须出现在 `__tests__/workflow-route-matrix.test.js`。
- 新增无 `mode` 老预览跳转静态检测，扫描 `packageD/pages/**/*.js`、`packageD/pages/**/*.wxml`、`packageD/utils/**/*.js`。
- 新增过期文案检测，扫描当前三阶段主流程页面和当前主文档，重点拦截误导用户“系统会自动拍照”的主流程引导文案；AI 专项文档、AI 状态枚举和 AI 调试/日志说明中的自动拍照状态文案不作为失败。
- 新增 `packageD/assets` 素材检测，重点覆盖 `packageD/assets/images/capture-guides` 图片大小、禁止源文件和临时文件。
- 新增 OpenSpec / Comet 临时产物检测，扫描 `openspec/changes` 下 active change 与 archive change，但不误伤正常 `.comet` 元数据。
- 新增破坏性压测覆盖清单，集中索引异常、乱序、恢复、边界、接口失败、系统 API 失败类测试覆盖和缺口。
- 补强第一批可自动化破坏性用例：模块二少于 3 张车损软确认防重复推进、最终预览全局乱序删除补拍、上传中断恢复；模块一现场补充一次性弹层和 complete 失败重试复用既有覆盖。
- 补充测试运行说明，标明本轮新增检测如何单独运行。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `quality-and-tests`：增加轻量自动化质量门禁，覆盖流程矩阵一致性、预览跳转、过期文案、分包素材和 OpenSpec / Comet 临时产物风险。
- `quality-and-tests`：增加破坏性压测覆盖地图和首批自动化用例索引，覆盖异常恢复、乱序补拍、边界容量、上传恢复和真机缺口管理。

## Impact

- 测试：新增 `__tests__/quality-guards.test.js`，补强 `__tests__/camera-ai-start.test.js`、`__tests__/workflow-route-matrix.test.js`、`__tests__/preview-upload-overlay.test.js`。
- 文档：补充 `docs/test-run-guide.md` 的轻量质量检测运行说明，新增 `docs/destructive-stress-test-coverage.md`，同步 `docs/test-flow-route-matrix.md`。
- OpenSpec：新增 `add-lightweight-quality-guards` change 及 `quality-and-tests` delta spec。
- 不修改业务代码、页面功能、页面样式、流程逻辑、素材文件或依赖。
