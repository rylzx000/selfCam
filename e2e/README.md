# selfCam 小程序自动化测试

基于 `miniprogram-automator` 的微信小程序自动化测试框架。

---

## 前置条件

### 1. 安装微信开发者工具

确保已安装微信开发者工具，路径配置在 `e2e/config.js`:

```js
cliPath: 'D:\\environment\\微信web开发者工具\\cli.bat'
```

### 2. 开启服务端口

在微信开发者工具中：

```
设置 → 安全设置 → ✅ 开启服务端口
```

![](https://res.wx.qq.com/wxdoc/dist/assets/img/open-service-port.aea732a0.png)

### 3. 打开项目

在微信开发者工具中打开本项目：

```
D:\project\selfCam
```

---

## 安装依赖

```bash
cd D:\project\selfCam
npm install
```

---

## 运行测试

### 方式一：运行完整测试套件

```bash
npm run test:automator
```

或直接运行：

```bash
node e2e/index.js
```

### 方式二：在 Node.js 中运行

```js
const { runAllTests } = require('./e2e/index')

runAllTests().then(report => {
  console.log('测试完成:', report.summary)
})
```

---

## 测试覆盖范围

### 模块一：首页测试

| 用例 | 描述 |
|---|---|
| TC-001 | 启动小程序进入首页 |
| TC-002 | 点击开始拍摄进入拍照页 |

### 模块二：拍照页测试

| 用例 | 描述 |
|---|---|
| TC-003 | 检查拍照页初始状态 |
| TC-004 | 检查车辆类型显示 |
| TC-005 | 检查引导提示 |
| TC-006 | 检查相机组件 |

### 模块三：存储功能测试

| 用例 | 描述 |
|---|---|
| TC-007 | 检查缓存数据 |

### 模块四：模拟拍照流程测试

| 用例 | 描述 |
|---|---|
| TC-008 | 模拟显示确认弹窗 |
| TC-009 | 模拟确认并切换步骤 |
| TC-010 | 检查 VIN 拍摄提示 |

### 模块五：车损拍摄测试

| 用例 | 描述 |
|---|---|
| TC-011~TC-015 | 添加车损照片 1-5 张 |
| TC-016 | 检查车损上限 |

### 模块六：预览页测试

| 用例 | 描述 |
|---|---|
| TC-017 | 跳转到预览页 |
| TC-018 | 检查预览页数据 |

### 模块七：完成页测试

| 用例 | 描述 |
|---|---|
| TC-019 | 跳转到完成页 |
| TC-020 | 检查完成页统计信息 |

---

## 测试报告

测试完成后自动生成报告：

```
e2e/reports/
├── report-1234567890.json    # JSON 格式报告
└── report-1234567890.md      # Markdown 格式报告
```

### 报告示例

```markdown
# selfCam 自动化测试报告

**执行时间**: 2026-03-31T06:30:00.000Z

## 测试摘要

| 指标 | 值 |
|---|---|
| 总数 | 20 |
| 通过 | 18 ✅ |
| 失败 | 2 ❌ |
| 耗时 | 45.23s |

## 失败用例

### TC-008: 模拟显示确认弹窗

- **错误**: 弹窗未显示
- **时间**: 2026-03-31T06:30:15.000Z
```

---

## 截图

测试过程中自动截图保存：

```
e2e/screenshots/
├── TC-001-homepage.png
├── TC-002-camera-page.png
├── TC-008-confirm-modal.png
└── ...
```

---

## 目录结构

```
D:\project\selfCam\
├── e2e/
│   ├── config.js           # 测试配置
│   ├── index.js            # 主测试入口
│   ├── run-tests.js        # 测试工具函数
│   ├── test-cases.js       # 测试用例定义
│   ├── screenshots/        # 截图目录
│   └── reports/            # 测试报告目录
├── docs/
│   └── test-cases.md       # 测试用例文档（手动测试）
├── package.json
└── ...
```

---

## 扩展测试

### 添加新测试用例

在 `e2e/test-cases.js` 中添加新的测试函数：

```js
async function testNewFeature(miniProgram, page) {
  console.log('\n📋 测试新功能...\n')
  
  try {
    // 测试逻辑
    const element = await page.$('.new-feature')
    if (element) {
      recordResult('新功能测试', true)
    } else {
      throw new Error('元素未找到')
    }
  } catch (e) {
    recordResult('新功能测试', false, e)
  }
  
  return page
}

module.exports = {
  testNewFeature
}
```

### 在主测试中调用

在 `e2e/index.js` 中引入并调用：

```js
const { testNewFeature } = require('./test-cases')

// 在 runAllTests() 中添加
await testNewFeature(miniProgram, page)
```

---

## 常见问题

### Q: 连接失败 "无法连接到开发者工具"

**A**: 确保已开启服务端口：
- 设置 → 安全设置 → 开启服务端口

### Q: 测试超时

**A**: 在 `e2e/config.js` 中调整超时时间：

```js
timeout: 120000  // 2 分钟
```

### Q: 找不到元素

**A**: 使用 `page.$$()` 查看页面元素：

```js
const elements = await page.$$('button')
console.log('找到按钮数量:', elements.length)
```

### Q: 如何查看页面数据

**A**: 使用 `page.data()` 获取：

```js
const data = await page.data()
console.log('页面数据:', JSON.stringify(data, null, 2))
```

---

## 参考资料

- [miniprogram-automator 官方文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/)
- [微信小程序自动化测试](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/quick-start.html)
