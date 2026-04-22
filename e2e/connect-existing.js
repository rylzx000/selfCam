/**
 * 连接已运行的 IDE 进行测试
 */

const automator = require('miniprogram-automator')

// IDE 当前运行的端口（从调试结果获取）
const IDE_PORT = 45148
const PROJECT_PATH = 'D:\\project\\selfCam'

console.log('🔗 连接已运行的 IDE...')
console.log(`   端口: ${IDE_PORT}`)
console.log(`   项目: ${PROJECT_PATH}`)

async function runTests() {
  let miniProgram = null
  
  try {
    // 直接连接已运行的 IDE
    miniProgram = await automator.connect({
      wsEndpoint: `ws://127.0.0.1:${IDE_PORT}`
    })
    
    console.log('✅ 连接成功！\n')
    
    // 测试基本操作
    console.log('📱 测试页面操作...')
    
    const page = await miniProgram.reLaunch('/pages/index/index')
    await page.waitFor(1500)
    
    // 获取页面数据
    const data = await page.data()
    console.log('页面数据:', JSON.stringify(data, null, 2).substring(0, 500))
    
    // 检查按钮
    const button = await page.$('button')
    console.log('按钮存在:', !!button)
    
    // 截图
    const fs = require('fs')
    const screenshotDir = 'D:\\project\\selfCam\\e2e\\screenshots'
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true })
    }
    await page.screenshot({ path: `${screenshotDir}/test-homepage.png` })
    console.log('📷 截图已保存')
    
    console.log('\n✅ 测试完成！')
    
    // 断开连接（不关闭 IDE）
    await miniProgram.close()
    
  } catch (e) {
    console.log('❌ 错误:', e.message)
    
    if (miniProgram) {
      await miniProgram.close()
    }
  }
}

runTests()
