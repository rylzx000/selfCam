/**
 * 使用 HTTP API 直接连接微信开发者工具
 * 绕过 miniprogram-automator 的 launch 问题
 */

const http = require('http')

// IDE 服务端口
const IDE_PORT = 10428
const IDE_HOST = '127.0.0.1'

// 项目路径
const PROJECT_PATH = 'D:/project/selfCam'

/**
 * 发送 HTTP 请求到 IDE
 */
function ideRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: IDE_HOST,
      port: IDE_PORT,
      path: path,
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          if (res.statusCode === 200 || res.statusCode === 302) {
            resolve(data)
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    
    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

/**
 * 测试 IDE 连接
 */
async function testConnection() {
  console.log('🔍 测试 IDE 连接...\n')
  
  try {
    // 测试连接 - 使用 v2 API
    const result = await ideRequest('/v2/status')
    console.log('✅ IDE 连接成功！')
    console.log(`   端口: ${IDE_PORT}`)
    return true
  } catch (e) {
    // 如果 status 不可用，尝试其他方式
    try {
      const result = await ideRequest('/v2/open?project=' + encodeURIComponent(PROJECT_PATH))
      console.log('✅ IDE 连接成功！')
      console.log(`   端口: ${IDE_PORT}`)
      return true
    } catch (e2) {
      console.log('❌ IDE 连接失败:', e.message)
      return false
    }
  }
}

/**
 * 测试自动化接口
 */
async function testAutomation() {
  console.log('\n📋 测试自动化接口...\n')
  
  const tests = []
  
  // 测试 1: 检查自动化接口
  try {
    console.log('TC-01: 检查自动化接口')
    const result = await ideRequest('/automation')
    console.log('✅ 自动化接口可用')
    tests.push({ name: 'TC-01', passed: true })
  } catch (e) {
    console.log('❌ 自动化接口不可用:', e.message)
    tests.push({ name: 'TC-01', passed: false, error: e.message })
  }
  
  // 测试 2: 获取当前页面
  try {
    console.log('\nTC-02: 获取当前页面')
    const result = await ideRequest('/v2/getcurrentpage')
    console.log('✅ 当前页面:', result)
    tests.push({ name: 'TC-02', passed: true })
  } catch (e) {
    console.log('❌ 获取页面失败:', e.message)
    tests.push({ name: 'TC-02', passed: false, error: e.message })
  }
  
  // 测试 3: 检查项目状态
  try {
    console.log('\nTC-03: 检查项目状态')
    const result = await ideRequest('/v2/open?project=' + encodeURIComponent(PROJECT_PATH))
    console.log('✅ 项目已打开')
    tests.push({ name: 'TC-03', passed: true })
  } catch (e) {
    console.log('❌ 项目打开失败:', e.message)
    tests.push({ name: 'TC-03', passed: false, error: e.message })
  }
  
  // 测试 4: 编译项目
  try {
    console.log('\nTC-04: 编译项目')
    const result = await ideRequest('/v2/build?project=' + encodeURIComponent(PROJECT_PATH))
    console.log('✅ 编译请求已发送')
    tests.push({ name: 'TC-04', passed: true })
  } catch (e) {
    console.log('❌ 编译请求失败:', e.message)
    tests.push({ name: 'TC-04', passed: false, error: e.message })
  }
  
  return tests
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60))
  console.log('selfCam 小程序自动化测试 (HTTP API 模式)')
  console.log('='.repeat(60))
  
  // 测试连接
  const connected = await testConnection()
  if (!connected) {
    console.log('\n⚠️ 请确保:')
    console.log('   1. 微信开发者工具已打开')
    console.log('   2. 服务端口已开启 (设置 → 安全设置)')
    console.log('   3. 端口号正确 (当前: ' + IDE_PORT + ')')
    process.exit(1)
  }
  
  // 测试自动化接口
  const results = await testAutomation()
  
  // 输出报告
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试报告')
  console.log('='.repeat(60))
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  
  console.log(`总数: ${results.length}`)
  console.log(`通过: ${passed} ✅`)
  console.log(`失败: ${failed} ❌`)
  
  if (failed > 0) {
    console.log('\n失败用例:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`)
    })
  }
  
  console.log('='.repeat(60))
}

main().catch(console.error)
