/**
 * 检查 miniProgram 和 page 的可用方法
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
    
    proc.stderr.on('data', (data) => {
      const output = data.toString()
      if (output.includes('auto')) {
        console.log('[CLI]', output.trim())
      }
    })
    
    const tryConnect = async (attempts) => {
      for (let i = 0; i < attempts; i++) {
        try {
          const canConnect = await new Promise((resolve) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}`)
            ws.on('open', () => { ws.close(); resolve(true) })
            ws.on('error', () => resolve(false))
          })
          
          if (canConnect) {
            console.log('WebSocket 就绪，连接 automator...')
            
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
  console.log('=== 检查 API ===\n')
  
  const { miniProgram } = await launchIDE()
  
  console.log('✅ 连接成功！\n')
  
  // 检查 miniProgram 的方法
  console.log('miniProgram 可用方法:')
  console.log('  ', Object.getOwnPropertyNames(Object.getPrototypeOf(miniProgram)).join(', '))
  
  // 获取页面
  console.log('\n获取页面...')
  const page = await miniProgram.reLaunch('/pages/index/index')
  await new Promise(r => setTimeout(r, 2000))
  
  console.log('\npage 可用方法:')
  console.log('  ', Object.getOwnPropertyNames(Object.getPrototypeOf(page)).join(', '))
  
  // 尝试不同的 API
  console.log('\n尝试各种 API:')
  
  // data
  try {
    const data = await page.data()
    console.log('  page.data():', typeof data, data ? JSON.stringify(data).substring(0, 200) : 'null/undefined')
  } catch (e) {
    console.log('  page.data() 错误:', e.message)
  }
  
  // $
  try {
    const el = await page.$('button')
    console.log('  page.$("button"):', el ? '找到元素' : '未找到')
    if (el) {
      console.log('    element 方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(el)).join(', '))
    }
  } catch (e) {
    console.log('  page.$() 错误:', e.message)
  }
  
  // $$
  try {
    const els = await page.$$('button')
    console.log('  page.$$("button"):', els ? els.length + ' 个' : '未找到')
  } catch (e) {
    console.log('  page.$$() 错误:', e.message)
  }
  
  // callMethod
  try {
    const result = await page.callMethod('onLoad')
    console.log('  page.callMethod("onLoad"):', result)
  } catch (e) {
    console.log('  page.callMethod() 错误:', e.message)
  }
  
  // waitFor
  try {
    await page.waitFor(1000)
    console.log('  page.waitFor(): OK')
  } catch (e) {
    console.log('  page.waitFor() 错误:', e.message)
  }
  
  // path
  try {
    const path = page.path
    console.log('  page.path:', path)
  } catch (e) {
    console.log('  page.path 错误:', e.message)
  }
  
  await miniProgram.close()
  console.log('\n完成！')
}

main().catch(e => console.log('错误:', e))
