## Why

预览页当前在证件上传、模块阶段切换和最终提交前存在多处弹窗/弹层文案不够集中：证件电子/实物选择先走微信原生菜单再进入自定义面板，模块交接弹层包含解释型说明，模块三进入最终预览前还有一条一闪而过的证件缺失 toast。用户已经明确希望把这些交互收敛为更一致的预览页内体验。

## What Changes

- 证件空入口直接打开自定义证件面板，不再先弹电子/实物 `wx.showActionSheet`。
- 自定义证件面板顶部提供 `电子证件 / 实物证件` 分段切换，默认优先使用当前车辆当前证件已有选择，无记录时默认电子证件。
- 删除模块三进入最终预览前的证件缺失 toast，仍允许进入最终预览。
- 调整缺失现场照确认和最终提交前证件缺失风险确认文案。
- 三个模块交接弹层删除解释型说明，改为当前进度清单。
- 同步 `docs/弹窗交互清单.md`。
- 补充/更新相关 Jest 用例，覆盖证件选择、模块交接文案和提交前确认。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `preview-flow`: 优化预览页证件选择、模块交接弹层和提交前风险提示，不改变后端接口、拍照页、上传/完成状态遮罩或无关组件。

## Impact

- 小程序页面：`packageD/pages/preview/preview.js`、`packageD/pages/preview/preview.wxml`、`packageD/pages/preview/preview.wxss`。
- 文档：`docs/弹窗交互清单.md`。
- 测试：预览页证件、模块一预览、相册保存和路由矩阵相关 Jest。
- OpenSpec：为 `preview-flow` 增加本次弹窗交互优化的 delta spec。
- 不修改后端接口、拍照页、上传/完成状态遮罩、备用无关组件或全局依赖。
