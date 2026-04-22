/**
 * 直接测试 WebSocket 连接
 */

const WebSocket = require('ws')

const ports = [45148, 32426, 23538, 53146, 9420]

console.log('测试 WebSocket 连接...\n')

for (const port of ports) {
  console.log(`测试端口 ${port}...`)
  
  const ws = new WebSocket(`ws://127.0.0.1:${port}`)
  
  ws.on('open', () => {
    console.log(`  ✅ 端口 ${port} WebSocket 连接成功!`)
    ws.close()
  })
  
  ws.on('error', (err) => {
    console.log(`  ❌ 端口 ${port} 连接失败: ${err.message}`)
  })
}

// 测试带路径的 WebSocket
setTimeout(() => {
  console.log('\n测试带路径的 WebSocket...\n')
  
  for (const port of ports) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    
    ws.on('open', () => {
      console.log(`  ✅ 端口 ${port}/ws 连接成功!`)
      ws.close()
    })
    
    ws.on('error', (err) => {
      console.log(`  ❌ 端口 ${port}/ws 失败: ${err.message.substring(0, 50)}`)
    })
  }
}, 2000)
