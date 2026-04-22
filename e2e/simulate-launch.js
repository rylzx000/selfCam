/**
 * 模拟 automator.launch 的启动逻辑，但捕获详细输出
 */

const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const WebSocket = require('ws')

const cliPath = 'D:\\environment\\wechat-devtools\\cli.bat'
const projectPath = 'D:\\project\\selfCam'

// 获取空闲端口
async function getFreePort(startPort) {
  return new Promise((resolve) => {
    const net = require('net')
    const server = net.createServer()
    server.listen(startPort, () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', () => resolve(startPort + 1))
  })
}

async function main() {
  const port = await getFreePort(9420)
  
  console.log('=== 模拟 automator.launch ===\n')
  console.log('CLI 路径:', cliPath)
  console.log('项目路径:', projectPath)
  console.log('端口:', port)
  
  // 构建 CLI 参数
  const args = ['auto', '--project', projectPath, '--auto-port', String(port)]
  console.log('CLI 参数:', args.join(' '))
  
  // 启动 CLI
  console.log('\n启动 CLI...\n')
  
  const proc = spawn(cliPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  })
  
  proc.stdout.on('data', (data) => {
    console.log('[STDOUT]', data.toString())
  })
  
  proc.stderr.on('data', (data) => {
    console.log('[STDERR]', data.toString())
  })
  
  proc.on('error', (err) => {
    console.log('[PROCESS ERROR]', err)
  })
  
  proc.on('exit', (code) => {
    console.log('[EXIT] 退出码:', code)
  })
  
  // 等待 CLI 启动
  console.log('等待 CLI 启动...\n')
  
  // 尝试连接 WebSocket
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000))
    
    console.log(`[${i + 1}] 尝试连接 ws://127.0.0.1:${port}`)
    
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`)
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          console.log('  ✅ WebSocket 连接成功!')
          ws.close()
          resolve(true)
        })
        ws.on('error', (err) => {
          console.log('  ❌ 连接失败:', err.message.substring(0, 50))
          ws.terminate()
          resolve(false)
        })
      }).then(result => {
        if (result) {
          console.log('\n✅ 测试成功! automator 应该能工作')
          proc.kill()
          process.exit(0)
        }
      })
    } catch (e) {
      console.log('  ❌ 错误:', e.message)
    }
  }
  
  console.log('\n❌ 所有尝试都失败了')
  proc.kill()
  process.exit(1)
}

main()
