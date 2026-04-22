/**
 * 使用 CLI 启动自动化模式，然后连接测试
 */

const automator = require('miniprogram-automator')
const { spawn } = require('child_process')
const http = require('http')

const CLI_PATH = 'D:\\environment\\wechat-devtools\\cli.bat'
const PROJECT_PATH = 'D:\\project\\selfCam'

console.log('🚀 启动 IDE 自动化模式...\n')

// 启动 CLI auto 模式
const proc = spawn(CLI_PATH, ['auto', '--project', PROJECT_PATH], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true
})

let detectedPort = null

proc.stderr.on('data', (data) => {
  const output = data.toString()
  console.log('[CLI]', output.trim())
  
  // 解析端口号
  const portMatch = output.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/)
  if (portMatch) {
    detectedPort = parseInt(portMatch[1])
    console.log(`\n✅ 检测到端口: ${detectedPort}\n`)
  }
})

proc.on('error', (err) => {
  console.log('[ERROR]', err.message)
})

// 等待启动后连接
setTimeout(async () => {
  if (!detectedPort) {
    console.log('❌ 未检测到端口')
    proc.kill()
    process.exit(1)
    return
  }
  
  console.log('🔗 连接 IDE...')
  console.log(`   WebSocket: ws://127.0.0.1:${detectedPort}`)
  
  try {
    const miniProgram = await automator.connect({
      wsEndpoint: `ws://127.0.0.1:${detectedPort}`
    })
    
    console.log('✅ 连接成功！\n')
    
    // 测试页面
    console.log('📱 测试页面操作...')
    const page = await miniProgram.reLaunch('/pages/index/index')
    await page.waitFor(1000)
    
    // 截图
    const fs = require('fs')
    const screenshotDir = 'D:\\project\\selfCam\\e2e\\screenshots'
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true })
    }
    await page.screenshot({ path: `${screenshotDir}/test-homepage.png` })
    console.log('📷 截图已保存')
    
    // 获取页面数据
    const data = await page.data()
    console.log('页面数据:', {
      currentStep: data.currentStep,
      vehicleType: data.vehicleType,
      guideTip: data.guideTip
    })
    
    // 点击按钮
    const button = await page.$('button')
    if (button) {
      console.log('✅ 找到按钮')
      await page.tap('button')
      await page.waitFor(2000)
      
      const currentPage = await miniProgram.currentPage()
      console.log('当前页面:', currentPage.path)
    }
    
    console.log('\n✅ 测试完成！')
    
    // 断开连接
    await miniProgram.close()
    
  } catch (e) {
    console.log('❌ 连接失败:', e.message)
  }
  
  proc.kill()
  process.exit(0)
}, 8000)

console.log('等待 IDE 启动...')
