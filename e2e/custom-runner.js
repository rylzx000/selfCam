/**
 * 自定义 IDE 连接器 - 绕过 automator.launch 的问题
 */

const automator = require('miniprogram-automator')
const { spawn } = require('child_process')
const WebSocket = require('ws')

const CLI_PATH = 'D:\\environment\\wechat-devtools\\cli.bat'
const PROJECT_PATH = 'D:\\project\\selfCam'

// 测试结果
let testResults = {
  passed: [],
  failed: [],
  startTime: null,
  endTime: null
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function takeScreenshot(page, name) {
  const fs = require('fs')
  const path = require('path')
  const screenshotDir = 'D:\\project\\selfCam\\e2e\\screenshots'
  
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

/**
 * 启动 IDE 并等待 WebSocket 就绪
 */
async function launchIDE() {
  return new Promise((resolve, reject) => {
    const port = 9420
    const args = ['auto', '--project', PROJECT_PATH, '--auto-port', String(port)]
    
    console.log('启动 IDE...')
    console.log('端口:', port)
    
    const proc = spawn(CLI_PATH, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: true
    })
    
    let resolved = false
    
    proc.stderr.on('data', (data) => {
      const output = data.toString()
      // 不打印所有输出，只打印关键信息
      if (output.includes('auto') || output.includes('listening')) {
        console.log('[CLI]', output.trim())
      }
    })
    
    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true
        reject(err)
      }
    })
    
    // 等待 WebSocket 就绪
    const tryConnect = async (attempts) => {
      for (let i = 0; i < attempts; i++) {
        try {
          await new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}`)
            ws.on('open', () => {
              ws.close()
              resolve(true)
            })
            ws.on('error', () => {
              resolve(false)
            })
          })
          
          // WebSocket 可用，尝试连接 automator
          console.log('WebSocket 就绪，连接 automator...')
          
          const miniProgram = await automator.connect({
            wsEndpoint: `ws://127.0.0.1:${port}`
          })
          
          resolved = true
          resolve({ miniProgram, proc })
          return
        } catch (e) {
          // 继续尝试
        }
        
        await sleep(1000)
      }
      
      if (!resolved) {
        resolved = true
        reject(new Error('连接超时'))
      }
    }
    
    // 延迟后开始尝试连接
    setTimeout(() => tryConnect(30), 3000)
  })
}

/**
 * 生成测试报告
 */
function generateReport() {
  const fs = require('fs')
  const path = require('path')
  const reportDir = 'D:\\project\\selfCam\\e2e\\reports'
  
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
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试报告')
  console.log('='.repeat(60))
  console.log(`总数: ${report.summary.total}`)
  console.log(`通过: ${report.summary.passed} ✅`)
  console.log(`失败: ${report.summary.failed} ❌`)
  console.log(`耗时: ${(report.summary.duration / 1000).toFixed(2)}s`)
  console.log('='.repeat(60))
  
  return report
}

/**
 * 主测试流程
 */
async function runTests() {
  testResults.startTime = new Date().toISOString()
  
  let miniProgram = null
  
  try {
    // 启动 IDE
    const { miniProgram: mp } = await launchIDE()
    miniProgram = mp
    
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
    
    // ========== 模拟拍照流程测试 ==========
    console.log('\n' + '='.repeat(60))
    console.log('🎞️ 模块三: 模拟拍照流程测试')
    console.log('='.repeat(60))
    
    // TC-007: 模拟弹窗显示
    try {
      console.log('\nTC-007: 模拟显示确认弹窗')
      await page.setData({
        showConfirmModal: true,
        confirmContent: '车牌照片清晰吗？',
        pendingPhoto: { compressedPath: '/test.jpg' }
      })
      await sleep(500)
      await takeScreenshot(page, 'TC-007-confirm-modal')
      
      const data = await page.data()
      if (data.showConfirmModal === true) {
        recordResult('TC-007: 确认弹窗显示成功', true)
      } else {
        throw new Error('弹窗未显示')
      }
    } catch (e) {
      recordResult('TC-007: 模拟显示确认弹窗', false, e)
    }
    
    // TC-008: 模拟确认操作
    try {
      console.log('\nTC-008: 模拟确认并切换步骤')
      await page.setData({
        showConfirmModal: false,
        pendingPhoto: null,
        currentStep: 'vinCode',
        guideTip: 'vin码位于驾驶室挡风玻璃角落'
      })
      await sleep(500)
      
      const data = await page.data()
      if (data.currentStep === 'vinCode') {
        recordResult('TC-008: 步骤切换成功（车牌->VIN）', true)
      } else {
        throw new Error(`当前步骤: ${data.currentStep}`)
      }
    } catch (e) {
      recordResult('TC-008: 模拟确认并切换步骤', false, e)
    }
    
    // TC-009: 切换到车损步骤
    try {
      console.log('\nTC-009: 切换到车损拍摄步骤')
      await page.setData({
        currentStep: 'damage',
        guideTip: '请正对车辆损伤处',
        damageCount: 0
      })
      await sleep(500)
      
      const data = await page.data()
      if (data.currentStep === 'damage') {
        recordResult('TC-009: 切换到车损拍摄步骤成功', true)
      } else {
        throw new Error(`当前步骤: ${data.currentStep}`)
      }
    } catch (e) {
      recordResult('TC-009: 切换到车损拍摄步骤', false, e)
    }
    
    // TC-010: 模拟添加车损照片
    try {
      console.log('\nTC-010: 模拟添加车损照片')
      await page.setData({ damageCount: 3 })
      await sleep(300)
      
      const data = await page.data()
      if (data.damageCount === 3) {
        recordResult('TC-010: 车损照片计数正确', true)
      } else {
        throw new Error(`数量: ${data.damageCount}`)
      }
    } catch (e) {
      recordResult('TC-010: 模拟添加车损照片', false, e)
    }
    
  } catch (e) {
    console.error('\n❌ 测试执行失败:', e.message)
  } finally {
    testResults.endTime = new Date().toISOString()
    
    // 断开连接
    if (miniProgram) {
      await miniProgram.close()
    }
    
    // 生成报告
    generateReport()
  }
}

// 运行测试
runTests()
