/**
 * 测试 camera 页面
 */

const automator = require('miniprogram-automator')
const { spawn } = require('child_process')
const WebSocket = require('ws')

const CLI_PATH = 'D:\\environment\\wechat-devtools\\cli.bat'
const PROJECT_PATH = 'D:\\project\\selfCam'

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
    
    const tryConnect = async (attempts) => {
      for (let i = 0; i < attempts; i++) {
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
        
        await new Promise(r => setTimeout(r, 1000))
      }
      
      if (!resolved) {
        resolved = true
        reject(new Error('连接超时'))
      }
    }
    
    setTimeout(() => tryConnect(30), 3000)
  })
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('=== 测试 Camera 页面 ===\n')
  
  const { miniProgram } = await launchIDE()
  console.log('✅ 连接成功！\n')
  
  // 从首页开始
  let page = await miniProgram.reLaunch('/pages/index/index')
  await sleep(2000)
  console.log('1. 首页路径:', page.path)
  
  // 调用 onStart 跳转到 camera
  console.log('\n2. 调用 onStart 跳转到 camera...')
  await page.callMethod('onStart')
  await sleep(2000)
  
  // 获取当前页面
  page = await miniProgram.currentPage()
  console.log('   当前页面:', page.path)
  
  // 检查 camera 页面数据
  console.log('\n--- Camera 页面数据 ---')
  const data = await page.data()
  console.log('currentStep:', data.currentStep)
  console.log('vehicleType:', data.vehicleType)
  console.log('guideTip:', data.guideTip)
  console.log('damageCount:', data.damageCount)
  console.log('showConfirmModal:', data.showConfirmModal)
  
  // 检查元素
  console.log('\n--- Camera 页面元素 ---')
  
  // camera 组件
  try {
    const camera = await page.$('camera')
    console.log('camera:', camera ? '找到' : '未找到')
  } catch (e) {
    console.log('camera 错误:', e.message)
  }
  
  // view 元素
  try {
    const views = await page.$$('view')
    console.log('view 数量:', views.length)
  } catch (e) {}
  
  // text 元素
  try {
    const texts = await page.$$('text')
    console.log('text 数量:', texts.length)
    for (let i = 0; i < texts.length; i++) {
      try {
        const tData = await texts[i].data()
        console.log(`  text[${i}] data:`, tData)
      } catch (e) {}
    }
  } catch (e) {}
  
  // 测试 setData
  console.log('\n--- 测试 setData ---')
  await page.setData({
    showConfirmModal: true,
    confirmContent: '测试弹窗'
  })
  await sleep(500)
  
  const newData = await page.data()
  console.log('showConfirmModal:', newData.showConfirmModal)
  console.log('confirmContent:', newData.confirmContent)
  
  // 测试步骤切换
  console.log('\n--- 测试步骤切换 ---')
  await page.setData({
    showConfirmModal: false,
    currentStep: 'vinCode',
    guideTip: 'vin码位于驾驶室挡风玻璃角落'
  })
  await sleep(500)
  
  const stepData = await page.data()
  console.log('currentStep:', stepData.currentStep)
  console.log('guideTip:', stepData.guideTip)
  
  // 测试车损步骤
  console.log('\n--- 测试车损步骤 ---')
  await page.setData({
    currentStep: 'damage',
    guideTip: '请正对车辆损伤处',
    damageCount: 0
  })
  await sleep(500)
  
  const damageData = await page.data()
  console.log('currentStep:', damageData.currentStep)
  console.log('damageCount:', damageData.damageCount)
  
  // 模拟添加车损照片
  await page.setData({ damageCount: 3 })
  await sleep(300)
  const updatedData = await page.data()
  console.log('damageCount 更新后:', updatedData.damageCount)
  
  console.log('\n✅ 测试完成！')
  
  await miniProgram.close()
}

main().catch(e => console.log('错误:', e))
