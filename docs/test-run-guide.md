# selfCam 测试运行与结果查看指引

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

### 相关已有

- `__tests__/workflow-state.test.js`
- `__tests__/storage.test.js`
- `__tests__/cache-selectors.test.js`
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

- `npm test -- --runInBand`：13 个测试套件、102 个用例通过。
- `npm run test:automator`：1 个测试套件、12 个页面自动化用例通过。

## 哪些场景仍建议手工验证

- `complete` 页面“返回修改”后的真实跳转与再次进入
- “退出小程序”后的缓存清理和重新进入
- `camera -> preview -> retake -> document -> complete` 全主链路
- 真机/开发者工具下的强退、挂起、恢复
- 页面返回栈相关行为，例如 `navigateBack` / `redirectTo` 分支

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

## v1.3.4 同步备注

- 本版本仅收敛首页权限申请、相册保存失败轻提示和开始采集防重复点击。
- 不修改 UI 样式，不修改拍照、缓存、重拍、补拍、预览主流程。
- 项目未主动调用 backgroundFetch 相关 API，本版本不新增相关处理。

---

## v1.3.4 新增测试覆盖

本版本新增和调整的 Jest 用例集中在以下文件：

- `__tests__/permission.test.js`：覆盖相机必需权限、相册可选权限、相机拒绝阻断、相册拒绝放行。
- `__tests__/index-permission.test.js`：覆盖首页开始采集防重复点击、权限拒绝不跳转、相册拒绝仍跳转、跳转异常轻提示。
- `__tests__/album.test.js`：覆盖确认照片路径选择、保存成功不弹业务 toast、普通失败轻提示、权限拒绝静默。
- `__tests__/camera-ai-start.test.js`：覆盖确认照片保存失败不阻断流程、重新拍摄不保存到系统相册。

本轮执行：

```powershell
npm test -- --runInBand
```

结果：16 个测试套件、115 个用例通过。
