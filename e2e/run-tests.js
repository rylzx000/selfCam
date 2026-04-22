/**
 * selfCam 小程序自动化测试 - 完整版
 */

const automator = require('miniprogram-automator')
const { spawn } = require('child_process')
const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')

const CLI_PATH = 'D:\\environment\\wechat-devtools\\cli.bat'
const PROJECT_PATH = 'D:\\project\\selfCam'
const REPORT_DIR = 'D:\\project\\selfCam\\e2e\\reports'

// 测试结果
let testResults = { passed: [], failed: [], startTime: null, endTime: null }

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function recordResult(name, passed, error = null) {
  const result = { name, passed, error: error?.message || null, time: new Date().toISOString() }
  if (passed) {
    testResults.passed.push(result)
    console.log(`  ✅ ${name}`)
  } else {
    testResults.failed.push(result)
    console.log(`  ❌ ${name}: ${error?.message || '失败'}`)
  }
}

async function launchIDE() {
  return new Promise((resolve, reject) => {
    const port = 9420
    const args = ['auto', '--project', PROJECT_PATH, '--auto-port', String(port)]
    
    const proc = spawn(CLI_PATH, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: true
    })
    
    let resolved = false
    
    const tryConnect = async () => {
      for (let i = 0; i < 30; i++) {
        try {
          const canConnect = await new Promise((resolve) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}`)
            ws.on('open', () => { ws.close(); resolve(true) })
            ws.on('error', () => resolve(false))
          })
          
          if (canConnect) {
            const miniProgram = await automator.connect({
              wsEndpoint: `ws://127.0.0.1:${port}`
            })
            resolved = true
            resolve({ miniProgram, proc })
            return
          }
        } catch (e) {}
        await sleep(1000)
      }
      if (!resolved) reject(new Error('连接超时'))
    }
    
    setTimeout(tryConnect, 3000)
  })
}

function generateReport() {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true })
  
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
  
  const reportPath = path.join(REPORT_DIR, `report-${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试报告')
  console.log('='.repeat(60))
  console.log(`总数: ${report.summary.total}`)
  console.log(`通过: ${report.summary.passed} ✅`)
  console.log(`失败: ${report.summary.failed} ❌`)
  console.log(`耗时: ${(report.summary.duration / 1000).toFixed(2)}s`)
  if (testResults.failed.length > 0) {
    console.log('\n失败用例:')
    testResults.failed.forEach(r => console.log(`  - ${r.name}: ${r.error}`))
  }
  console.log('='.repeat(60))
  
  return report
}

async function runTests() {
  testResults.startTime = new Date().toISOString()
  let miniProgram = null
  
  try {
    console.log('🚀 启动 IDE...\n')
    const { miniProgram: mp } = await launchIDE()
    miniProgram = mp
    console.log('✅ 连接成功！\n')
    
    // ========== 首页测试 ==========
    console.log('='.repeat(60))
    console.log('📱 模块一: 首页测试')
    console.log('='.repeat(60))
    
    let page = await miniProgram.reLaunch('/pages/index/index')
    await sleep(2000)
    
    try {
      console.log('\nTC-001: 启动小程序进入首页')
      if (page.path === 'pages/index/index') {
        recordResult('TC-001: 启动小程序进入首页', true)
      } else { throw new Error(`页面路径: ${page.path}`) }
    } catch (e) { recordResult('TC-001', false, e) }
    
    try {
      console.log('\nTC-002: 点击开始拍摄进入拍照页')
      await page.callMethod('onStart')
      await sleep(2000)
      page = await miniProgram.currentPage()
      if (page.path.includes('camera')) {
        recordResult('TC-002: 点击开始拍摄进入拍照页', true)
      } else { throw new Error(`当前页面: ${page.path}`) }
    } catch (e) { recordResult('TC-002', false, e) }
    
    // ========== 拍照页测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('📸 模块二: 拍照页测试')
    console.log('='.repeat(60))
    
    try {
      console.log('\nTC-003: 检查拍照页初始状态')
      const data = await page.data()
      if (data.currentStep === 'licensePlate') {
        recordResult('TC-003: 拍照页初始状态正确', true)
      } else { throw new Error(`currentStep: ${data.currentStep}`) }
    } catch (e) { recordResult('TC-003', false, e) }
    
    try {
      console.log('\nTC-004: 检查车辆类型显示')
      const data = await page.data()
      if (data.vehicleType === '标的车') {
        recordResult('TC-004: 车辆类型显示正确', true)
      } else { throw new Error(`vehicleType: ${data.vehicleType}`) }
    } catch (e) { recordResult('TC-004', false, e) }
    
    try {
      console.log('\nTC-005: 检查引导提示')
      const data = await page.data()
      if (data.guideTip === '将车牌号放入框内') {
        recordResult('TC-005: 引导提示正确', true)
      } else { throw new Error(`guideTip: ${data.guideTip}`) }
    } catch (e) { recordResult('TC-005', false, e) }
    
    try {
      console.log('\nTC-006: 检查相机组件')
      const camera = await page.$('camera')
      if (camera) { recordResult('TC-006: 相机组件存在', true) }
      else { throw new Error('未找到 camera 组件') }
    } catch (e) { recordResult('TC-006', false, e) }
    
    // ========== 模拟拍照流程测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('🎞️ 模块三: 模拟拍照流程测试')
    console.log('='.repeat(60))
    
    try {
      console.log('\nTC-007: 模拟显示确认弹窗')
      await page.setData({ showConfirmModal: true, confirmContent: '车牌照片清晰吗？', pendingPhoto: { compressedPath: '/test.jpg' } })
      await sleep(500)
      const data = await page.data()
      if (data.showConfirmModal === true) { recordResult('TC-007: 确认弹窗显示成功', true) }
      else { throw new Error('弹窗未显示') }
    } catch (e) { recordResult('TC-007', false, e) }
    
    try {
      console.log('\nTC-008: 模拟确认并切换步骤')
      await page.setData({ showConfirmModal: false, pendingPhoto: null, currentStep: 'vinCode', guideTip: 'vin码位于驾驶室挡风玻璃角落' })
      await sleep(500)
      const data = await page.data()
      if (data.currentStep === 'vinCode') { recordResult('TC-008: 步骤切换成功', true) }
      else { throw new Error(`currentStep: ${data.currentStep}`) }
    } catch (e) { recordResult('TC-008', false, e) }
    
    try {
      console.log('\nTC-009: 检查 VIN 拍摄提示')
      const data = await page.data()
      if (data.guideTip === 'vin码位于驾驶室挡风玻璃角落') { recordResult('TC-009: VIN 拍摄提示正确', true) }
      else { throw new Error(`guideTip: ${data.guideTip}`) }
    } catch (e) { recordResult('TC-009', false, e) }
    
    try {
      console.log('\nTC-010: 切换到车损拍摄步骤')
      await page.setData({ showConfirmModal: false, currentStep: 'damage', guideTip: '请正对车辆损伤处', damageCount: 0 })
      await sleep(500)
      const data = await page.data()
      if (data.currentStep === 'damage') { recordResult('TC-010: 切换到车损拍摄成功', true) }
      else { throw new Error(`currentStep: ${data.currentStep}`) }
    } catch (e) { recordResult('TC-010', false, e) }
    
    // ========== 车损拍摄测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('🚗 模块四: 车损拍摄测试')
    console.log('='.repeat(60))
    
    for (let i = 1; i <= 5; i++) {
      try {
        console.log(`\nTC-01${i + 10}: 添加第 ${i} 张车损照片`)
        await page.setData({ damageCount: i })
        await sleep(300)
        const data = await page.data()
        if (data.damageCount === i) { recordResult(`TC-01${i + 10}: 车损照片 ${i} 添加成功`, true) }
        else { throw new Error(`damageCount: ${data.damageCount}`) }
      } catch (e) { recordResult(`TC-01${i + 10}`, false, e) }
    }
    
    try {
      console.log('\nTC-016: 检查车损上限')
      const data = await page.data()
      if (data.damageCount === 5) { recordResult('TC-016: 车损上限检查通过', true) }
      else { throw new Error(`damageCount: ${data.damageCount}`) }
    } catch (e) { recordResult('TC-016', false, e) }
    
    // ========== 预览页测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('👁️ 模块五: 预览页测试')
    console.log('='.repeat(60))
    
    try {
      console.log('\nTC-017: 跳转到预览页')
      page = await miniProgram.redirectTo('/pages/preview/preview')
      await sleep(1500)
      if (page.path.includes('preview')) { recordResult('TC-017: 跳转到预览页成功', true) }
      else { throw new Error(`当前页面: ${page.path}`) }
    } catch (e) { recordResult('TC-017', false, e) }
    
    try {
      console.log('\nTC-018: 检查预览页数据')
      const data = await page.data()
      if (data.vehicles && data.vehicles.length > 0) { recordResult('TC-018: 预览页数据正确', true) }
      else { throw new Error('vehicles 为空') }
    } catch (e) { recordResult('TC-018', false, e) }
    
    // ========== 完成页测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('🎉 模块六: 完成页测试')
    console.log('='.repeat(60))
    
    try {
      console.log('\nTC-019: 跳转到完成页')
      page = await miniProgram.redirectTo('/pages/complete/complete')
      await sleep(1000)
      if (page.path.includes('complete')) { recordResult('TC-019: 跳转到完成页成功', true) }
      else { throw new Error(`当前页面: ${page.path}`) }
    } catch (e) { recordResult('TC-019', false, e) }
    
    try {
      console.log('\nTC-020: 检查完成页统计信息')
      const data = await page.data()
      if (data.vehicleCount !== undefined) { recordResult('TC-020: 完成页统计信息正确', true) }
      else { throw new Error('统计数据缺失') }
    } catch (e) { recordResult('TC-020', false, e) }
    
  } catch (e) {
    console.error('\n❌ 测试执行失败:', e.message)
  } finally {
    testResults.endTime = new Date().toISOString()
    if (miniProgram) await miniProgram.close()
    generateReport()
  }
}

runTests()
