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

仓库已有 `miniprogram-automator` 与 `e2e/` 基础，默认入口如下：

```powershell
npm run test:automator
```

或：

```powershell
node e2e/run-tests.js
```

### 页面自动化运行前提

- 已安装微信开发者工具
- 已开启开发者工具服务端口
- `e2e/config.js` 或相关脚本中的 CLI 路径可用
- 本机允许 automator 连接正在打开的项目

### 本次为什么不把页面自动化作为主交付

- 这类脚本依赖外部 IDE 和服务端口，不是纯 Node/Jest 环境
- 当前任务重点是缓存治理与恢复边界，更适合先把单元测试和故障注入做扎实
- 若上线前有稳定的开发者工具环境，建议再执行一次主链路自动化或真机手工回归

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
