# selfCam 微信开发者工具自动化测试

本目录用于在微信开发者工具中运行 `miniprogram-automator + Jest` 自动化测试。当前测试以回归和破坏性测试为主，不修改业务流程。

## 前置条件

1. 已安装微信开发者工具。
2. 微信开发者工具已开启服务端口：
   `设置 -> 安全设置 -> 开启服务端口`
3. 已在微信开发者工具中打开本项目：
   `D:\project\selfCam`

## Windows CLI 路径配置

默认路径：

```powershell
D:\environment\wechat-devtools\cli.bat
```

如果你的安装路径不同，在当前 PowerShell 窗口设置：

```powershell
$env:WECHAT_DEVTOOLS_CLI='D:\environment\wechat-devtools\cli.bat'
```

也可以使用兼容变量：

```powershell
$env:WECHAT_CLI_PATH='D:\environment\wechat-devtools\cli.bat'
```

项目路径可选覆盖：

```powershell
$env:MINIPROGRAM_PROJECT_PATH='D:\project\selfCam'
```

## 运行命令

```powershell
npm run test:automator
```

等价命令：

```powershell
npm run test:e2e
```

只跑冒烟子集：

```powershell
npm run test:automator:smoke
```

保留旧版自定义 runner：

```powershell
npm run test:automator:legacy
```

## 当前覆盖

- 首页冒烟：标题、拍摄须知、开始采集、进入拍照页。
- VIN 提示：VIN 步骤显示前挡风玻璃左下角 VIN 引导。
- 确认态文案：不出现“是否清晰？”类问句，按钮为“确认使用 / 重新拍摄”。
- 预览页添加图片异常：相册成功、取消、失败，以及拍照添加成功后 loading/actionSheet 状态关闭。
- 车损识别启动时机：`cameraInitialized=false` 后触发 `onCameraInitDone`，会再次尝试恢复 AI 检测，且不保留多个检测 timer。
- 破坏性测试：连续确认/重拍、连续打开关闭添加弹层、连续 initdone、快速切换步骤、损坏缓存恢复。

## 仍需真机手测

- 真实相机权限授权、拒绝授权和系统权限弹窗。
- 真机拍照、相册选择、图片压缩耗时和大图内存压力。
- 车损模型真实加载、推理性能、自动拍照准确率。
- 低端机横屏相机预览、cover-view 覆盖层渲染和卡顿。
- 微信开发者工具无法完全模拟的相册取消/系统级异常。

## 2026-05 P0 e2e 扩充

新增范围：

- `capacity-boundary.spec.js`：单车满图、50 张总容量上限、删除后容量释放。
- `delete-retake-replenish.spec.js`：删除第一张/中间/最后/全部车损后补拍，校验顺序、索引、旧图清理和 cache。
- `multi-vehicle-chaos.spec.js`：多车满图下删除 A 车、重拍 B 车，校验车辆间 damages/documents 不串车。
- `submit-consistency.spec.js`：多车满图加单证补齐后完成页统计，以及删除/重拍后最终 cache/payload 不带旧图。
- `recovery-chaos.spec.js`：删除/补拍/重拍后退出重进，校验页面统计与 cache 一致。

新增运行命令：

```powershell
npm run test:e2e:capacity
npm run test:e2e:chaos
npm run test:e2e:p0
npm run test:e2e:full
```

仍需真机手测：

- 真实相机授权、拒绝授权、系统权限弹窗。
- 真机拍照、相册选择、系统压缩耗时、大图内存压力。
- 真实 50 张图片下的设备存储、预览滑动、删除确认和上传体验。
- AI 模型真实加载、车损自动识别、自动拍照准确率。
- 微信开发者工具无法完整模拟的系统级相册取消、权限异常和低端机横屏渲染。
