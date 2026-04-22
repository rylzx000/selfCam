/**
 * 深入检查页面结构和数据
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

async function main() {
  console.log('=== 深入检查页面 ===\n')
  
  const { miniProgram } = await launchIDE()
  
  console.log('✅ 连接成功！\n')
  
  // 获取页面
  let page = await miniProgram.reLaunch('/pages/index/index')
  
  console.log('页面路径:', page.path)
  console.log('等待页面加载...')
  await page.waitFor(3000)
  
  // 检查数据
  console.log('\n--- 页面数据 ---')
  const data = await page.data()
  console.log('data():', JSON.stringify(data, null, 2))
  
  // 尝试各种选择器
  console.log('\n--- 尝试选择器 ---')
  
  const selectors = [
    'button',
    'view',
    'view button',
    '.btn',
    '[type="primary"]',
    'view[class*="btn"]',
    'image',
    'text',
    'navigator'
  ]
  
  for (const sel of selectors) {
    try {
      const el = await page.$(sel)
      if (el) {
        console.log(`  ${sel}: 找到!`)
        // 尝试获取元素信息
        try {
          const size = await el.size()
          console.log(`    size: ${JSON.stringify(size)}`)
        } catch (e) {}
        try {
          const elData = await el.data()
          console.log(`    data: ${JSON.stringify(elData)}`)
        } catch (e) {}
      } else {
        console.log(`  ${sel}: 未找到`)
      }
    } catch (e) {
      console.log(`  ${sel}: 错误 - ${e.message}`)
    }
  }
  
  // 获取所有元素
  console.log('\n--- 获取所有 view 元素 ---')
  try {
    const views = await page.$$('view')
    console.log('view 数量:', views.length)
    for (let i = 0; i < Math.min(5, views.length); i++) {
      try {
        const data = await views[i].data()
        console.log(`  view[${i}] data:`, JSON.stringify(data))
      } catch (e) {}
    }
  } catch (e) {
    console.log('错误:', e.message)
  }
  
  // 获取所有元素
  console.log('\n--- 获取所有元素 ---')
  try {
    const all = await page.$$('*')
    console.log('总元素数量:', all.length)
  } catch (e) {
    console.log('错误:', e.message)
  }
  
  // 尝试调用页面方法
  console.log('\n--- 调用页面方法 ---')
  try {
    await page.callMethod('onStart')
    await page.waitFor(1000)
    console.log('调用了 onStart')
    
    // 检查当前页面
    const currentPage = await miniProgram.currentPage()
    console.log('当前页面:', currentPage.path)
  } catch (e) {
    console.log('callMethod 错误:', e.message)
  }
  
  // 尝试设置数据
  console.log('\n--- 设置页面数据 ---')
  try {
    await page.setData({ test: 'hello' })
    const newData = await page.data()
    console.log('设置后 data():', JSON.stringify(newData))
  } catch (e) {
    console.log('setData 错误:', e.message)
  }
  
  await miniProgram.close()
  console.log('\n完成！')
}

main().catch(e => console.log('错误:', e))
