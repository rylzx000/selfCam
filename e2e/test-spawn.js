/**
 * 测试直接启动 CLI
 */

const { spawn } = require('child_process')
const path = require('path')

const cliPath = 'D:\\environment\\微信web开发者工具\\cli.bat'
const projectPath = 'D:\\project\\selfCam'
const port = 9527

console.log('启动 CLI...')
console.log('CLI 路径:', cliPath)
console.log('项目路径:', projectPath)
console.log('端口:', port)

const args = ['auto', '--project', projectPath, '--auto-port', String(port)]

console.log('参数:', args.join(' '))

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
  console.log('[ERROR]', err.message)
})

proc.on('exit', (code) => {
  console.log('[EXIT] 退出码:', code)
})

// 等待 30 秒
setTimeout(() => {
  console.log('\n30 秒后结束测试...')
  proc.kill()
  process.exit(0)
}, 30000)

console.log('\n等待输出...')
