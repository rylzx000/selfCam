# packageD 分包接入说明

本文档记录当前代码用于接入公司主体小程序的分包形态。当前目标是先在本仓库本地模拟“主包壳 + `packageD` 分包”，确认功能和路径无误后，再按同样目录打包给公司小程序管理员。

## 当前目录形态

- 主包只保留本地调试壳：`app.js`、`app.json`、`app.wxss`、`pages/host/index`。
- 业务代码全部位于 `packageD/`：
  - `packageD/pages/index/index`
  - `packageD/pages/camera/camera`
  - `packageD/pages/preview/preview`
  - `packageD/pages/document/document`
  - `packageD/pages/complete/complete`
  - `packageD/utils/`
  - `packageD/components/`
  - `packageD/assets/`
  - `packageD/mock/`
- 所有业务跳转使用 `/packageD/pages/...` 绝对路径。
- WXML 资源路径使用 `/packageD/assets/...`，不要写成 `/packaged/assets/...` 或 `/assets/...`。

## app.json 形态

本仓库本地调试时，根 `app.json` 只注册主包 host 页，并把业务页声明为 `packageD` 分包：

```json
{
  "pages": [
    "pages/host/index"
  ],
  "subpackages": [
    {
      "root": "packageD",
      "pages": [
        "pages/index/index",
        "pages/camera/camera",
        "pages/preview/preview",
        "pages/document/document",
        "pages/complete/complete"
      ]
    }
  ],
  "lazyCodeLoading": "requiredComponents"
}
```

公司主体小程序接入时，只需要把 `packageD/` 放到主体小程序根目录，并在主体小程序 `app.json` 的 `subpackages` 中追加同样的 `root/pages` 声明。

## 启动方式

公司主体小程序应从自己的主包页面跳转到：

```text
/packageD/pages/index/index?ticket=<ticket>&reportNo=<reportNo>
```

参数说明：

- `ticket`：辅助拍照任务凭证。有值时进入辅助拍照链路；用户点击 `开始采集` 后先调用 `init` 判断 ticket 状态，`COMPLETED / EXPIRED / REVOKED` 只提示并停留首页，非拦截状态才进入权限、缓存恢复、拍照、上传和完成流程。
- `reportNo`：兼容旧入口参数；当前辅助拍照错误日志上报不再依赖该字段，后端按 `ticket` 反查事故号等业务信息。
- 无 `ticket` 时保留本地普通采集流程，不会从旧缓存回捞 ticket。

本仓库本地调试入口为 `pages/host/index`：

- “本地普通采集”跳转到 `/packageD/pages/index/index`。
- “mock-2 辅助拍照”跳转到 `/packageD/pages/index/index?ticket=mock-2&reportNo=MOCK_REGIST_NO`。

## 主包兼容约定

- 分包初始化逻辑位于 `packageD/utils/bootstrap.js`。
- 分包只把上下文写入 `getApp().globalData.selfCam`，不写 `globalData.ticket`，避免污染公司主体小程序全局字段。
- `getApp` 不可用或独立分包运行时，初始化逻辑会降级，不阻断页面加载。
- 原先在 `app.onLaunch` 中做的业务初始化已经移到分包首页 `packageD/pages/index/index` 的 `onLoad/onShow`。

## 打包注意事项

- 本轮先不生成 zip；确认无误后再从 `packageD/` 目录打包。
- `project.config.json` 已忽略测试、文档、脚本、依赖和本地压缩包，避免上传主包调试材料。
- 交付公司管理员的分包应包含 `packageD/` 下的业务代码和资源，不包含本地 `pages/host/` 调试页。

## 本地验证建议

1. 微信开发者工具打开本仓库根目录。
2. 编译后进入 `pages/host/index`。
3. 点击“本地普通采集”，确认可进入普通采集流程。
4. 点击“mock-2 辅助拍照”，确认非拦截状态可进入辅助拍照流程；blocked ticket 状态用单测或后端联调返回 `COMPLETED / EXPIRED / REVOKED` 验证。
5. 使用代码质量扫描确认 `packageD` 分包体积不超过 2MB。
