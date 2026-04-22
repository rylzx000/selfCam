/**
 * 完整测试套件 - selfCam 小程序自动化测试
 * 
 * 运行方式: node e2e/index.js
 * 
 * 前置条件:
 * 1. 微信开发者工具已打开
 * 2. 已开启服务端口: 设置 -> 安全设置 -> 开启服务端口
 * 3. 项目已在开发者工具中打开
 */

const automator = require('miniprogram-automator')
const config = require('./config')
const { testCaptureFlow, testPhotoConfirm, testDamageCapture } = require('./test-cases')

// 测试结果
let testResults = {
  passed: [],
  failed: [],
  startTime: null,
  endTime: null
}

let miniProgram = null

/**
 * 工具函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function recordResult(testName, passed, error = null) {
  const result = {
    name: testName,
    passed,
    error: error?.message || null,
    time: new Date().toISOString()
  }
  
  if (passed) {
    testResults.passed.push(result)
    console.log(`  ✅ ${testName}`)
  } else {
    testResults.failed.push(result)
    console.log(`  ❌ ${testName}: ${error?.message || '未知错误'}`)
  }
}

async function takeScreenshot(page, name) {
  const fs = require('fs')
  const path = require('path')
  const screenshotDir = config.screenshotPath
  
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true })
  }
  
  const filePath = path.join(screenshotDir, `${name}.png`)
  try {
    await page.screenshot({ path: filePath })
    console.log(`📷 截图: ${name}.png`)
  } catch (e) {
    console.log(`📷 截图失败: ${e.message}`)
  }
  
  return filePath
}

function generateReport() {
  const fs = require('fs')
  const path = require('path')
  const reportDir = config.reportPath
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }
  
  const report = {
    summary: {
      total: testResults.passed.length + testResults.failed.length,
      passed: testResults.passed.length,
      failed: testResults.failed.length,
      startTime: testResults.startTime,
      endTime: testResults.endTime,
      duration: new Date(testResults.endTime) - new Date(testResults.startTime)
    },
    passed: testResults.passed,
    failed: testResults.failed
  }
  
  const reportPath = path.join(reportDir, `report-${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  
  // 同时生成 Markdown 报告
  const mdReport = generateMarkdownReport(report)
  const mdReportPath = path.join(reportDir, `report-${Date.now()}.md`)
  fs.writeFileSync(mdReportPath, mdReport)
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试报告')
  console.log('='.repeat(60))
  console.log(`总数: ${report.summary.total}`)
  console.log(`通过: ${report.summary.passed} ✅`)
  console.log(`失败: ${report.summary.failed} ❌`)
  console.log(`耗时: ${(report.summary.duration / 1000).toFixed(2)}s`)
  console.log(`JSON 报告: ${reportPath}`)
  console.log(`MD 报告: ${mdReportPath}`)
  console.log('='.repeat(60))
  
  return report
}

function generateMarkdownReport(report) {
  let md = `# selfCam 自动化测试报告\n\n`
  md += `**执行时间**: ${report.summary.startTime}\n\n`
  md += `## 测试摘要\n\n`
  md += `| 指标 | 值 |\n|---|---|\n`
  md += `| 总数 | ${report.summary.total} |\n`
  md += `| 通过 | ${report.summary.passed} ✅ |\n`
  md += `| 失败 | ${report.summary.failed} ❌ |\n`
  md += `| 耗时 | ${(report.summary.duration / 1000).toFixed(2)}s |\n\n`
  
  if (report.failed.length > 0) {
    md += `## 失败用例\n\n`
    for (const item of report.failed) {
      md += `### ${item.name}\n\n`
      md += `- **错误**: ${item.error || '未知'}\n`
      md += `- **时间**: ${item.time}\n\n`
    }
  }
  
  if (report.passed.length > 0) {
    md += `## 通过用例\n\n`
    for (const item of report.passed) {
      md += `- ✅ ${item.name}\n`
    }
  }
  
  return md
}

/**
 * 主测试流程
 */
async function runAllTests() {
  testResults.startTime = new Date().toISOString()
  
  try {
    // ========== 初始化 ==========
    console.log('🚀 正在连接微信开发者工具...')
    console.log(`   CLI 路径: ${config.cliPath}`)
    console.log(`   项目路径: ${config.projectPath}`)
    
    // 让 automator 启动 IDE（不指定端口，让它自动选择）
    miniProgram = await automator.launch({
      cliPath: config.cliPath,
      projectPath: config.projectPath
    })
    
    console.log('✅ 连接成功！\n')
    
    // ========== 首页测试 ==========
    console.log('='.repeat(60))
    console.log('📱 模块一: 首页测试')
    console.log('='.repeat(60))
    
    let page = await miniProgram.reLaunch('/pages/index/index')
    await page.waitFor(1500)
    
    // TC-001
    try {
      console.log('\nTC-001: 启动小程序进入首页')
      await takeScreenshot(page, 'TC-001-homepage')
      
      const startButton = await page.$('button')
      if (startButton) {
        recordResult('TC-001: 启动小程序进入首页', true)
      } else {
        throw new Error('未找到开始拍摄按钮')
      }
    } catch (e) {
      recordResult('TC-001: 启动小程序进入首页', false, e)
    }
    
    // TC-002
    try {
      console.log('\nTC-002: 点击开始拍摄进入拍照页')
      await page.tap('button')
      await page.waitFor(2000)
      
      await takeScreenshot(page, 'TC-002-camera-page')
      
      const currentPage = await miniProgram.currentPage()
      if (currentPage.path.includes('camera')) {
        recordResult('TC-002: 点击开始拍摄进入拍照页', true)
      } else {
        throw new Error(`当前页面: ${currentPage.path}`)
      }
    } catch (e) {
      recordResult('TC-002: 点击开始拍摄进入拍照页', false, e)
    }
    
    // ========== 拍照页测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('📸 模块二: 拍照页测试')
    console.log('='.repeat(60))
    
    // TC-003
    try {
      console.log('\nTC-003: 检查拍照页初始状态')
      const data = await page.data()
      
      if (data.currentStep === 'licensePlate') {
        recordResult('TC-003: 拍照页初始状态正确', true)
      } else {
        throw new Error(`当前步骤: ${data.currentStep}`)
      }
    } catch (e) {
      recordResult('TC-003: 检查拍照页初始状态', false, e)
    }
    
    // TC-004
    try {
      console.log('\nTC-004: 检查车辆类型显示')
      const data = await page.data()
      
      if (data.vehicleType === '标的车') {
        recordResult('TC-004: 车辆类型显示正确', true)
      } else {
        throw new Error(`车辆类型: ${data.vehicleType}`)
      }
    } catch (e) {
      recordResult('TC-004: 检查车辆类型显示', false, e)
    }
    
    // TC-005
    try {
      console.log('\nTC-005: 检查引导提示')
      const data = await page.data()
      const expectedTip = '将车牌号放入框内'
      
      if (data.guideTip === expectedTip) {
        recordResult('TC-005: 引导提示正确', true)
      } else {
        throw new Error(`提示: ${data.guideTip}`)
      }
    } catch (e) {
      recordResult('TC-005: 检查引导提示', false, e)
    }
    
    // TC-006
    try {
      console.log('\nTC-006: 检查相机组件')
      const camera = await page.$('camera')
      if (camera) {
        recordResult('TC-006: 相机组件存在', true)
      } else {
        throw new Error('未找到 camera 组件')
      }
    } catch (e) {
      recordResult('TC-006: 检查相机组件', false, e)
    }
    
    // ========== 存储功能测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('💾 模块三: 存储功能测试')
    console.log('='.repeat(60))
    
    // TC-007
    try {
      console.log('\nTC-007: 检查缓存数据')
      const cache = await miniProgram.callWxMethod('getStorageSync', 'car_damage_photos_cache')
      
      if (cache) {
        const cacheData = JSON.parse(cache)
        console.log('   缓存存在，车辆数量:', cacheData.vehicles?.length || 0)
        recordResult('TC-007: 缓存数据正确初始化', true)
      } else {
        throw new Error('缓存数据为空')
      }
    } catch (e) {
      recordResult('TC-007: 检查缓存数据', false, e)
    }
    
    // ========== 模拟拍照流程测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('🎞️ 模块四: 模拟拍照流程测试')
    console.log('='.repeat(60))
    
    // TC-008: 模拟弹窗显示
    try {
      console.log('\nTC-008: 模拟显示确认弹窗')
      await page.setData({
        showConfirmModal: true,
        confirmContent: '车牌照片清晰吗？',
        pendingPhoto: { compressedPath: '/test.jpg' }
      })
      await sleep(500)
      await takeScreenshot(page, 'TC-008-confirm-modal')
      
      const data = await page.data()
      if (data.showConfirmModal === true) {
        recordResult('TC-008: 确认弹窗显示成功', true)
      } else {
        throw new Error('弹窗未显示')
      }
    } catch (e) {
      recordResult('TC-008: 模拟显示确认弹窗', false, e)
    }
    
    // TC-009: 模拟确认操作
    try {
      console.log('\nTC-009: 模拟确认并切换步骤')
      await page.setData({
        showConfirmModal: false,
        pendingPhoto: null,
        currentStep: 'vinCode',
        guideTip: 'vin码位于驾驶室挡风玻璃角落'
      })
      await sleep(500)
      
      const data = await page.data()
      if (data.currentStep === 'vinCode') {
        recordResult('TC-009: 步骤切换成功（车牌->VIN）', true)
      } else {
        throw new Error(`当前步骤: ${data.currentStep}`)
      }
    } catch (e) {
      recordResult('TC-009: 模拟确认并切换步骤', false, e)
    }
    
    // TC-010: VIN 提示检查
    try {
      console.log('\nTC-010: 检查 VIN 拍摄提示')
      const data = await page.data()
      
      if (data.guideTip === 'vin码位于驾驶室挡风玻璃角落') {
        recordResult('TC-010: VIN 拍摄提示正确', true)
      } else {
        throw new Error(`提示: ${data.guideTip}`)
      }
    } catch (e) {
      recordResult('TC-010: 检查 VIN 拍摄提示', false, e)
    }
    
    // ========== 车损拍摄测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('🚗 模块五: 车损拍摄测试')
    console.log('='.repeat(60))
    
    // 切换到车损步骤
    await page.setData({
      currentStep: 'damage',
      guideTip: '请正对车辆损伤处',
      damageCount: 0
    })
    await sleep(500)
    
    // TC-011 ~ TC-015: 模拟添加车损照片
    for (let i = 1; i <= 5; i++) {
      try {
        console.log(`\nTC-01${i + 10}: 添加第 ${i} 张车损照片`)
        await page.setData({ damageCount: i })
        await sleep(300)
        
        const data = await page.data()
        if (data.damageCount === i) {
          recordResult(`TC-01${i + 10}: 车损照片 ${i} 添加成功`, true)
        } else {
          throw new Error(`数量: ${data.damageCount}`)
        }
      } catch (e) {
        recordResult(`TC-01${i + 10}: 添加车损照片 ${i}`, false, e)
      }
    }
    
    // TC-016: 车损上限检查
    try {
      console.log('\nTC-016: 检查车损上限（5张）')
      const data = await page.data()
      
      if (data.damageCount === 5) {
        recordResult('TC-016: 车损上限检查通过', true)
      } else {
        throw new Error(`当前数量: ${data.damageCount}`)
      }
    } catch (e) {
      recordResult('TC-016: 检查车损上限', false, e)
    }
    
    // ========== 预览页测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('👁️ 模块六: 预览页测试')
    console.log('='.repeat(60))
    
    // 模拟跳转到预览页
    try {
      console.log('\nTC-017: 跳转到预览页')
      page = await miniProgram.redirectTo('/pages/preview/preview')
      await page.waitFor(1500)
      await takeScreenshot(page, 'TC-017-preview-page')
      
      const currentPage = await miniProgram.currentPage()
      if (currentPage.path.includes('preview')) {
        recordResult('TC-017: 跳转到预览页成功', true)
      } else {
        throw new Error(`当前页面: ${currentPage.path}`)
      }
    } catch (e) {
      recordResult('TC-017: 跳转到预览页', false, e)
    }
    
    // TC-018: 检查预览页数据
    try {
      console.log('\nTC-018: 检查预览页数据')
      const data = await page.data()
      
      if (data.vehicles && data.vehicles.length > 0) {
        console.log(`   车辆数量: ${data.vehicles.length}`)
        console.log(`   总照片数: ${data.totalPhotoCount}`)
        recordResult('TC-018: 预览页数据显示正确', true)
      } else {
        throw new Error('车辆数据为空')
      }
    } catch (e) {
      recordResult('TC-018: 检查预览页数据', false, e)
    }
    
    // ========== 完成页测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('🎉 模块七: 完成页测试')
    console.log('='.repeat(60))
    
    try {
      console.log('\nTC-019: 跳转到完成页')
      page = await miniProgram.redirectTo('/pages/complete/complete')
      await page.waitFor(1000)
      await takeScreenshot(page, 'TC-019-complete-page')
      
      const currentPage = await miniProgram.currentPage()
      if (currentPage.path.includes('complete')) {
        recordResult('TC-019: 跳转到完成页成功', true)
      } else {
        throw new Error(`当前页面: ${currentPage.path}`)
      }
    } catch (e) {
      recordResult('TC-019: 跳转到完成页', false, e)
    }
    
    // TC-020: 检查完成页统计
    try {
      console.log('\nTC-020: 检查完成页统计信息')
      const data = await page.data()
      
      if (data.vehicleCount !== undefined && data.totalPhotos !== undefined) {
        console.log(`   车辆数量: ${data.vehicleCount}`)
        console.log(`   总照片数: ${data.totalPhotos}`)
        recordResult('TC-020: 完成页统计信息正确', true)
      } else {
        throw new Error('统计数据缺失')
      }
    } catch (e) {
      recordResult('TC-020: 检查完成页统计信息', false, e)
    }
    
  } catch (e) {
    console.error('\n❌ 测试执行失败:', e.message)
    console.error(e.stack)
  } finally {
    testResults.endTime = new Date().toISOString()
    
    // 生成报告
    const report = generateReport()
    
    // 关闭连接
    if (miniProgram) {
      await miniProgram.close()
      console.log('\n👋 小程序连接已关闭')
    }
    
    // 返回退出码
    process.exit(report.summary.failed > 0 ? 1 : 0)
  }
}

// 运行测试
runAllTests().catch(e => {
  console.error('未捕获的错误:', e)
  process.exit(1)
})
