# selfCam 测试运行与结果查看指引

## 规则事实源与当前漂移提示

- 测试设计、测试修正和验收口径以 `docs/product-rule-matrix.md` 为准；本文只说明如何运行与查看测试结果。
- 历史版本章节中的“本轮执行”结果仅记录当时运行情况，不代表当前分支已经通过同一验证。
- 本轮已按产品规则矩阵修正已知 e2e 旧规则：车损 10 张上限与第 11 张拒绝、证件入口先开自定义面板、模块三缺证件不再 toast；同时补充测试实现漂移门禁。
- 本轮新增真实点击 smoke，覆盖模块三证件入口、模块二车损补拍、最终预览删空后补拍、10 张车损上限入口不可见、`E+F` 补副页关键路径；更广的多车与真机触摸区域仍待后续抽测。
- `actionSheet`、`callCurrentPageMethod`、`setData`、quality guard 等保留英文，是因为它们是微信原生能力、测试工具方法、框架 API 或项目内门禁名称。

## v1.5.x 三阶段采集与拍摄指引测试目标

- 覆盖模块一从现场照片进入，完成现场照片、标的车/三者车车牌号和 VIN 后进入模块一预览页。
- 覆盖模块一预览页确认后进入模块二第一辆车车损拍摄，不重复进入旧车牌号/VIN 流程。
- 覆盖模块二每辆车车损最多 10 张，未满 10 张时预览页只展示一个补拍 `+` 入口。
- 覆盖模块二完成后通过统一弹层进入模块三证件信息页。
- 覆盖模块三按车辆分组展示驾驶证和行驶证，电子证件 1 张或实物正页 + 副页满足其一即视为提交完成；无照片时展示整体入口，只有电子证件时不补实物，实物链路已开始但正副页未齐全时展示另一侧 `+` 并打开实物证件面板。
- 覆盖最终预览按现场环境、车辆信息、车损照片、证件信息分组展示，并在提交前才询问是否保存到本地相册。
- 覆盖 45 度现场照片和车损拍摄指引：首次进入自动弹窗，左侧小图标可再次唤起，关闭后恢复当前拍摄步骤。
- 覆盖拍摄指引弹窗展示期间不卸载 `camera` 组件，避免关闭弹窗后相机加载失败。

## v1.5.x 推荐验证方式

提交前优先跑轻量检查：

```powershell
node --check packageD/pages/camera/camera.js
npm test -- --runInBand __tests__/camera-ai-start.test.js
```

新增静态质量门禁可单独运行：

```powershell
npm test -- --runInBand __tests__/quality-guards.test.js
```

该门禁覆盖以下只读检测：

- 流程矩阵一致性：读取 `docs/test-flow-route-matrix.md` 和 `__tests__/workflow-route-matrix.test.js`，要求已声明自动化覆盖的矩阵 ID 能在 Jest 文件中找到；明确 `需真机`、`抽测`、`暂未覆盖`、`不覆盖` 的行不强制。
- 无 `mode` 老预览跳转：扫描 `packageD/pages/**/*.js`、`packageD/pages/**/*.wxml`、`packageD/utils/**/*.js`，覆盖字符串字面量、`PREVIEW_PAGE_URL` 和 `previewUrl` 变量跳转；`previewUrl` 仅在最近有效赋值来自 `getPreviewPageUrl(...)` 时放行，只允许 `moduleOne`、`moduleTwo`、`moduleThree`、`final` 四类新三阶段预览模式。
- 过期文案：扫描当前三阶段主流程页面、`packageD/utils/ai-config.js`、`PRDS/PRD.md`、`PRDS/UI.md`、`PRDS/tech.md` 和 `PRDS/查勘采集助手三阶段采集流程说明.md`，用正则匹配旧自动拍照提示、身份证作为当前采集项、带 `12123` 的证件叫法和过期车损数量变体；AI 专项文档、AI 状态枚举和 AI 调试/日志说明中的自动拍照状态文案属于允许范围。
- 测试实现规则漂移：扫描 `e2e/**/*.js` 和 `__tests__/**/*.js`，拦截明确旧规则短语，例如车损“5 张满图”、第 6 张拒绝、证件入口立即断言原生 `actionSheet`、模块三缺证件旧 toast；历史文档说明不纳入此门禁，避免误伤复盘记录。
- 包体素材：扫描 `packageD/assets`，图片阈值为 500KB，并禁止 `.zip`、`.tmp`、`.psd`、`.sketch`、原始大图和 `.tmp-*` 临时文件进入分包素材目录。
- OpenSpec / Comet 临时产物：扫描 `openspec/changes` 下 active change 和 archive change，禁止 `.tmp-*`、`*.tmp`、zip 临时包、明显临时目录或编辑器备份文件；正常 `.comet.yaml`、`.openspec.yaml`、`.comet/*.jsonl` 和 skill snapshot 元数据不受影响。

破坏性/异常/乱序/恢复/边界类覆盖地图见 `docs/destructive-stress-test-coverage.md`。本轮第一批新增或补强的轻量 Jest 用例建议在统一验证阶段按需执行：

```powershell
node --check __tests__/camera-ai-start.test.js
node --check __tests__/workflow-route-matrix.test.js
node --check __tests__/preview-upload-overlay.test.js
npm test -- --runInBand __tests__/module-one-preview.test.js __tests__/camera-ai-start.test.js __tests__/workflow-route-matrix.test.js __tests__/preview-upload-overlay.test.js __tests__/upload-state.test.js
```

这些用例重点覆盖模块一现场补充一次性弹层、模块二少于 3 张车损软确认防重复推进、最终预览全局乱序删除补拍、上传中断恢复和完成失败重试。

仍需微信开发者工具或真机验证的场景：相机权限、真实拍照文件写入、`wx.chooseMedia` 弹层、真机返回栈、真实相册权限、模型推理效果和连续拍摄性能。

微信开发者工具验证时，建议用 `ticket=mock-2&reportNo=MOCK_REGIST_NO` 跑完整主流程：开始页进入模块一、模块一预览、模块二多车车损、模块三证件信息、最终预览、上传成功和完成页。

### 后续测试补强顺序

1. 继续扩展页面可操作性测试：本轮已补关键真实点击 smoke，下一步补模块一空槽、多车删除补拍和更多证件 `E/F/B` 组合。
2. 继续扩展 automator smoke：本轮已覆盖 10 张上限入口不可见和 `E+F` 补副页，下一步覆盖多车满图、上传失败恢复和真机返回栈。
3. 按矩阵继续补 Jest 规则空白，确保新增断言只固化当前产品规则。
4. 再按需运行定向 e2e 或 `npm run test:e2e:p0`；不默认运行重型全量 e2e。

## v1.4.9 新增测试目标

- 覆盖辅助拍照异常日志上报：错误日志复用辅助拍照 `baseUrl`，调用 `reportMiniappError` 单条上报。
- 覆盖只上传 `error` 级白名单事件，`warning`、诊断快照、缺少 `ticket` 和 `mock-*` ticket 均不上报后台。
- 覆盖 `init / uploadPhotoBase64 / complete` 真实请求失败进入 `runtimeLogger.error('api', 'request_failed', ...)`。
- 覆盖上报失败静默处理，不弹窗、不阻断拍照、上传或完成采集流程。

## v1.4.9 重点测试文件

- `__tests__/error-log-upload.test.js`
- `__tests__/aux-photo-api.test.js`
- `__tests__/env-config.test.js`

## v1.4.9 推荐验证方式

提交前优先跑轻量检查：

```powershell
node --check packageD/utils/runtime-logger.js
node --check packageD/utils/env-config.js
node --check packageD/utils/aux-photo-api.js
npm test -- --runInBand __tests__/error-log-upload.test.js
npm test -- --runInBand __tests__/aux-photo-api.test.js
npm test -- --runInBand __tests__/env-config.test.js
```

微信开发者工具验证时，优先使用非敏感测试 ticket 触发一条 `camera_error` 或辅助拍照接口失败；mock ticket 不应触发后台异常日志请求。

## v1.4.8 新增测试目标

- 覆盖辅助拍照 ticket 状态前端拦截：`COMPLETED / EXPIRED / REVOKED` 在首页 `init` 返回后只提示，不申请相机权限、不跳转、不恢复缓存、不新建缓存。
- 覆盖 `data.ticketStatus` 优先、`data.status` 兼容，以及状态 trim 后转大写判断。
- 覆盖 `CREATED / OPENED / UPLOADING` 等非拦截状态继续原流程；同 `ticket` 可恢复缓存时先调用 `init`，非拦截后再恢复原缓存。
- 覆盖预览页本地 blocked `cache.auxPhoto.ticketStatus` 防御：不调用 `uploadPhotoBase64` 或 `complete`。

## v1.4.6 新增测试目标

- 覆盖辅助拍照 Base64 上传闭环：`uploadPhotoBase64` 逐张上传、`complete` 完成提交、单张失败后只重试未成功照片、`complete` 失败后只重试完成提交。
- 覆盖上传中断恢复：重新进入预览页时恢复 `uploadSession`，把中断中的 `uploading` 项回落到 `pending`，继续剩余上传。
- 覆盖辅助拍照 mock 联调：`mock-*` ticket、`mock:aux-photo` 本地服务、`SELF_CAM_AUX_PHOTO_HOST` 本地 baseUrl 覆盖。
- 覆盖实物/电子行驶证三类上传项与车辆只读约束：`DRIVING_LICENSE_FRONT`、`DRIVING_LICENSE_BACK`、`DRIVING_LICENSE_ELECTRONIC`。

## v1.4.6 重点测试文件

- `__tests__/aux-photo-api.test.js`
- `__tests__/preview-upload-overlay.test.js`
- `__tests__/upload-state.test.js`
- `__tests__/workflow-state.test.js`
- `__tests__/env-config.test.js`

## v1.4.6 推荐验证方式

开发期优先按下面顺序联调：

```powershell
npm run mock:aux-photo
```

在微信开发者工具里设置：

```javascript
wx.setStorageSync('SELF_CAM_AUX_PHOTO_HOST', 'http://127.0.0.1:8787')
```

然后再用 `mock-1`、`mock-2` 或 `mock-3` ticket 验证：

- `init` 是否按 ticket 返回车辆数、车牌号、`ticketStatus`、`registNo`
- 预览页是否先统一展示上传遮罩，再逐张调用 `uploadPhotoBase64`
- 失败后是否只重试未成功照片
- 中断恢复后是否继续未完成队列
- `complete` 成功后是否进入完成页

## 2026-05-11 新增测试目标

- 覆盖正常横屏机型不启用高分辨率 UI 缩放，文字、按钮和取景框继续走原有 `rpx` / WXSS 表现。
- 覆盖 nova13 / OpenHarmony 横屏启用 `px` UI 缩放，拍照页提示文字、按钮、边框和预览页标题、缩略图、底部按钮、行驶证面板同步放大。
- 覆盖宽于 4:3 的实时帧按 aspect-fill 裁剪映射、正方形/窄帧按高度贴合并左右补边映射到虚拟 `400 x 300` 坐标，自动拍照阈值不变。
- 覆盖微信小程序实时日志透传布局、帧映射、自动拍照 gate 关键信息和失败原因，同时过滤原始帧字节和完整检测对象。

## 2026-05-11 重点测试文件

- `__tests__/camera-layout.test.js`
- `__tests__/preview-layout.test.js`
- `__tests__/damage-capture-modules.test.js`
- `__tests__/ai-realtime-log.test.js`
- `__tests__/camera-ai-start.test.js`

## v1.3.8 新增测试目标

- 覆盖车牌/车损模型创建 session 时统一使用 `precisionLevel=0`、`allowNPU=false`、`allowQuantize=false`。
- 覆盖旧的 `precisionLevel=1/4` 尝试逻辑不再作为模型加载路径。
- 建议真机补充验证 `wx.getInferenceEnvInfo` 成功、失败或不支持时均不阻断模型加载。

## v1.3.8 重点测试文件

- `__tests__/ai-realtime-log.test.js`

## v1.3.7 新增测试目标

- 覆盖拍照页横屏相机区布局计算，避免正常机型被主动缩小。
- 覆盖横屏页面遇到竖屏 `safeArea` 返回值时，不把相机区宽度压成短边。
- 覆盖宽屏机型不依赖机型白名单也能按横屏长边放大相机区。

## v1.3.7 新增测试文件

- `__tests__/camera-layout.test.js`

## v1.3.5 本次新增测试目标

- 覆盖每辆车行驶证资料的旧缓存兼容、实体/电子完成态、上传替换、删除和串车隔离。
- 覆盖辅助拍照车辆列表以后端 `init` 返回为准，预览页不提供手动新增/删除三者车入口；完成采集时直接进入行驶证风险提示和后续上传闭环。
- 覆盖行驶证上传来源差异：拍照来源只写缓存，最终保存由预览页完成采集统一触发；相册来源不重复保存。
- 覆盖最终相册保存：保存确认弹框、跳过保存、权限拒绝、批量保存、重复进入完成页不重复保存。
- 覆盖通用确认弹窗遮罩点击只关闭弹窗，不触发取消按钮业务动作。

## v1.3.5 新增测试文件

- `__tests__/vehicle-documents.test.js`
- `__tests__/preview-driving-license.test.js`

## 本次新增测试的目标

- 补齐 `workflow-state`、`storage-schema`、`storage`、`cache-selectors` 的异常链路与恢复边界测试。
- 用故障注入覆盖坏 JSON、旧缓存、索引越界、残留上下文、长时间挂起恢复等高风险场景。
- 把测试结果落到本地文件，保证可复盘，而不是只看终端输出。

## 本次重点覆盖范围

- `workflow-state`
  - 非法状态迁移
  - 事实优先的状态恢复
  - `PREVIEWING` / `DOCUMENTING` / `LOCAL_COMPLETED` 的恢复边界
- `storage` / `storage-schema`
  - schema 迁移、修复、安全恢复
  - `retakeMode` / `fromPreview` / completion context 清理
  - `loadCacheForResume()` 的安全返回
- `cache-selectors`
  - 空缓存、缺字段、异常字段下的稳定摘要
  - 重拍上下文识别与边界统计

## 测试文件列表

### 本次新增

- `__tests__/workflow-recovery.test.js`
- `__tests__/storage-resume.test.js`
- `__tests__/cache-selectors.edge.test.js`
- `__tests__/camera-layout.test.js`

### 相关已有

- `__tests__/workflow-state.test.js`
- `__tests__/storage.test.js`
- `__tests__/cache-selectors.test.js`
- `__tests__/module-one-preview.test.js`
- `__tests__/aux-photo-mapper.test.js`
- `__tests__/damage-capture-modules.test.js`

### 微信开发者工具页面自动化

- `jest.config.js`
- `e2e/jest.config.js`
- `e2e/setup.js`
- `e2e/config.js`
- `e2e/specs/current-regression.spec.js`
- `e2e/support/automator.js`
- `e2e/support/fixtures.js`

## 如何运行单元测试

### 只跑 Jest

```powershell
npm test
```

### 生成本地结果文件

```powershell
New-Item -ItemType Directory -Force -Path reports/test | Out-Null
npx jest --runInBand --coverage --coverageReporters=json-summary --coverageReporters=text-summary --json --outputFile=reports/test/jest-results.json *> reports/test/jest-output.txt
```

### 生成摘要文件

```powershell
@'
const fs = require('fs')
const path = require('path')

const resultsPath = path.join('reports', 'test', 'jest-results.json')
const coveragePath = path.join('coverage', 'coverage-summary.json')
const summaryPath = path.join('reports', 'test', 'jest-summary.txt')
const coverageSummaryPath = path.join('reports', 'test', 'coverage-summary.txt')

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
const lines = [
  'selfCam Jest Summary',
  `GeneratedAt: ${new Date().toISOString()}`,
  `Success: ${results.success}`,
  `Suites: ${results.numPassedTestSuites}/${results.numTotalTestSuites}`,
  `Tests: ${results.numPassedTests}/${results.numTotalTests}`,
  `RuntimeMs: ${results.testResults.reduce((sum, item) => sum + (item.endTime - item.startTime), 0)}`,
  '',
  'Test Files:'
]

results.testResults.forEach((item) => {
  lines.push(`- ${item.name}: ${item.status}`)
})

lines.push('', 'Manual Checklist: docs/abnormal-flow-test-cases.md')
fs.writeFileSync(summaryPath, lines.join('\n'))

if (fs.existsSync(coveragePath)) {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
  const total = coverage.total || {}
  const coverageLines = [
    'selfCam Coverage Summary',
    `Lines: ${total.lines ? total.lines.pct : 'n/a'}%`,
    `Statements: ${total.statements ? total.statements.pct : 'n/a'}%`,
    `Functions: ${total.functions ? total.functions.pct : 'n/a'}%`,
    `Branches: ${total.branches ? total.branches.pct : 'n/a'}%`
  ]
  fs.writeFileSync(coverageSummaryPath, coverageLines.join('\n'))
}
'@ | node -
```

## 如何查看测试结果文件

- `reports/test/jest-output.txt`
  - 完整 Jest 控制台输出
- `reports/test/jest-summary.txt`
  - 本次运行的汇总信息
- `reports/test/coverage-summary.txt`
  - 覆盖率摘要
- `reports/test/jest-results.json`
  - 原始 Jest JSON 结果
- `docs/abnormal-flow-test-cases.md`
  - 手工异常链路清单

## 页面自动化如何运行

仓库当前复用已有 `miniprogram-automator` 与 `e2e/` 目录，Jest 版页面自动化是默认入口：

```powershell
npm run test:automator
```

等价命令：

```powershell
npm run test:e2e
```

只跑首页、VIN 与确认态烟测：

```powershell
npm run test:automator:smoke
```

只跑新增容量边界：

```powershell
npm run test:e2e:capacity
```

只跑新增复杂操作/破坏性子集：

```powershell
npm run test:e2e:chaos
```

只跑真实点击 smoke：

```powershell
$env:E2E_TIMEOUT_MS='180000'
npx jest --config e2e/jest.config.js --runInBand e2e/specs/real-click-smoke.spec.js --detectOpenHandles
```

真实点击 smoke 依赖微信开发者工具 automator 端口，必须串行运行；不要与其他 e2e 命令并行，否则会共享 `9420` 端口和小程序缓存，导致连接被关闭或状态互相污染。

只跑本轮 P0 e2e：

```powershell
npm run test:e2e:p0
```

跑完整页面自动化：

```powershell
npm run test:e2e:full
```

旧版脚本仍保留为：

```powershell
npm run test:automator:legacy
```

### 页面自动化运行前提

- 已安装微信开发者工具
- 已开启开发者工具服务端口
- `e2e/config.js` 或环境变量中的 CLI 路径可用
- 本机允许 automator 连接正在打开的项目

### Windows 下 CLI 路径配置

默认建议把微信开发者工具安装在 `D:\environment` 下，例如：

```text
D:\environment\wechat-devtools\cli.bat
```

如本机路径不同，可在当前 PowerShell 会话中设置：

```powershell
$env:WECHAT_DEVTOOLS_CLI="D:\environment\wechat-devtools\cli.bat"
```

兼容旧变量名：

```powershell
$env:WECHAT_CLI_PATH="D:\environment\wechat-devtools\cli.bat"
```

其他可选环境变量：

```powershell
$env:MINIPROGRAM_PROJECT_PATH="D:\project\selfCam"
$env:MINIPROGRAM_AUTOMATOR_PORT="9420"
$env:E2E_TIMEOUT_MS="90000"
```

本轮已在本机运行：

- `node --check pages\preview\preview.js`：通过。
- `node --check components\confirm-modal\confirm-modal.js`：通过。
- `git diff --check`：通过。
- `npm test -- --runInBand`：18 个测试套件、156 个用例通过。
- `npm run test:e2e:p0`：5 个 e2e 测试文件、12 个 P0 用例通过。

## 哪些场景仍建议手工验证

- `complete` 页面不展示“返回修改”，重复进入不重复提交
- “退出小程序”后的缓存清理和重新进入
- `camera -> preview -> retake -> document -> complete` 全主链路
- 真机/开发者工具下的强退、挂起、恢复
- 页面返回栈相关行为，例如 `navigateBack` / `redirectTo` 分支
- `mock:aux-photo` 启动后在微信开发者工具里手工走一次 `init -> preview overlay -> upload -> complete`
- 真机只做后端联调和最终回归，不把开发者工具的 mock 结果当成真机结果

## 常见失败定位建议

- `loadCache()` / `loadCacheForResume()` 相关失败
  - 先看 `reports/test/jest-output.txt` 里的 `[storage]` 日志
  - 再看 `storage-schema` 的 `resolveSafeResumeCache()` 分支是否命中
- `workflow-state` 相关失败
  - 先看 `inferStateFromCache()` 的事实条件：`retakeMode`、`fromPreview`、`currentStep`
  - 再看 checkpoint 是否被判定为 fresh
- `cache-selectors` 相关失败
  - 先看输入缓存是否经过 `storage.loadCache()` 或 `loadCacheForResume()`
  - 再看 selector 是否拿到越界索引、缺失数组或异常 `workflowState`
- 页面自动化失败
  - 先确认微信开发者工具是否已启动并开启服务端口
  - 再确认 `e2e` 脚本中的 CLI 路径与项目路径是否可用

---

## v1.3.5 新增测试覆盖

本版本新增和调整的 Jest 用例集中在以下文件：

- `__tests__/vehicle-documents.test.js`：覆盖旧缓存兼容、实体/电子完成态、`E/F/B` 八状态采集矩阵、模式切换不删图、上传替换、删除后完成态重算、拍照/相册来源差异。
- `__tests__/preview-driving-license.test.js`：覆盖预览页每辆车行驶证数据写入、证件弹层操作链、电子 + 实物单侧继续补齐入口、提交弹窗顺序、风险提示、继续完成、标的车和三者车数据隔离、遮罩点击关闭。

本轮执行：

```powershell
npm test -- --runInBand
```

结果：18 个测试套件、130 个用例通过。

---

## v1.3.4 同步备注

- 本版本仅收敛首页权限申请、相册保存失败轻提示和开始采集防重复点击。
- 不修改 UI 样式，不修改拍照、缓存、重拍、补拍、预览主流程。
- 项目未主动调用 backgroundFetch 相关 API，本版本不新增相关处理。

---

## v1.3.4 新增测试覆盖

本版本新增和调整的 Jest 用例集中在以下文件：

- `__tests__/permission.test.js`：覆盖相机必需权限、首页不预申请相册权限、最终保存时申请相册权限、曾拒绝后引导设置。
- `__tests__/index-permission.test.js`：覆盖首页开始采集防重复点击、相机权限拒绝不跳转、跳转异常轻提示。
- `__tests__/album.test.js`：覆盖确认照片路径选择、单张保存结果、批量保存去重、权限拒绝和部分失败汇总。
- `__tests__/camera-ai-start.test.js`：覆盖确认照片只推进缓存和 AI 恢复，不再保存到系统相册；重新拍摄不保存到系统相册。
- `__tests__/preview-album-save.test.js`：覆盖完成采集最终保存弹框顺序、跳过保存、权限拒绝和批量保存。
- `__tests__/complete-page.test.js`：覆盖完成页按保存成功、跳过、部分失败和权限拒绝展示不同提示。

本轮执行：

```powershell
npm test -- --runInBand
```

结果：16 个测试套件、115 个用例通过。
