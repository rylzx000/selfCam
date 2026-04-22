/**
 * 调试 automator 启动过程
 */

const { spawn } = require('child_process')
const WebSocket = require('ws')

const cliPath = 'D:\\environment\\wechat-devtools\\cli.bat'
const projectPath = 'D:\\project\\selfCam'
const port = 9420

console.log('=== 调试 miniprogram-automator 启动过程 ===\n')

// 模拟 automator 的启动逻辑
const args = ['auto', '--project', projectPath, '--auto-port', String(port)]

console.log('启动命令:', cliPath)
console.log('参数:', args.join(' '))
console.log('端口:', port)
console.log()

const proc = spawn(cliPath, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true
})

let wsConnected = false
let cliReady = false

proc.stdout.on('data', (data) => {
  const output = data.toString()
  console.log('[CLI STDOUT]', output)
  
  // 检查是否准备就绪
  if (output.includes('auto') || output.includes('listening')) {
    cliReady = true
  }
})

proc.stderr.on('data', (data) => {
  const output = data.toString()
  console.log('[CLI STDERR]', output)
  
  // 检查是否准备就绪
  if (output.includes('auto') || output.includes('listening')) {
    cliReady = true
  }
})

proc.on('error', (err) => {
  console.log('[PROCESS ERROR]', err.message)
})

proc.on('exit', (code) => {
  console.log('[PROCESS EXIT] 退出码:', code)
})

// 等待 CLI 启动后尝试 WebSocket 连接
setTimeout(() => {
  console.log('\n尝试 WebSocket 连接...')
  const wsUrl = `ws://127.0.0.1:${port}`
  
  const ws = new WebSocket(wsUrl, {
    perMessageDeflate: false
  })
  
  ws.on('open', () => {
    console.log('✅ WebSocket 连接成功!')
    wsConnected = true
    
    // 发送测试消息
    ws.send(JSON.stringify({ method: 'Page.enable' }))
  })
  
  ws.on('message', (data) => {
    console.log('[WS MESSAGE]', data.toString())
  })
  
  ws.on('error', (err) => {
    console.log('❌ WebSocket 连接失败:', err.message)
  })
  
  ws.on('close', () => {
    console.log('[WS CLOSED]')
  })
}, 5000)

// 30秒后结束
setTimeout(() => {
  console.log('\n=== 测试结束 ===')
  console.log('CLI 准备就绪:', cliReady)
  console.log('WebSocket 连接:', wsConnected)
  proc.kill()
  process.exit(0)
}, 30000)

console.log('等待 CLI 启动...')
