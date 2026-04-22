/**
 * selfCam 小程序 - 快速压力测试 (精简版)
 */

const automator = require('miniprogram-automator')
const { spawn } = require('child_process')
const WebSocket = require('ws')
const fs = require('fs')
const path = require('path')

const CLI_PATH = 'D:\\environment\\wechat-devtools\\cli.bat'
const PROJECT_PATH = 'D:\\project\\selfCam'
const REPORT_DIR = 'D:\\project\\selfCam\\e2e\\reports'

let testResults = { passed: [], failed: [], startTime: null, endTime: null }
let miniProgram = null

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function withTimeout(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${name} 超时 (${ms}ms)`)), ms)
    )
  ])
}

function recordResult(name, passed, error = null) {
  const result = { name, passed, error: error?.message || null, time: new Date().toISOString() }
  if (passed) {
    testResults.passed.push(result)
    console.log(`  ✅ ${name}`)
  } else {
    testResults.failed.push(result)
    console.log(`  ❌ ${name}: ${error?.message || '失败'}`)
  }
}

async function launchIDE() {
  return new Promise((resolve, reject) => {
    const port = 9420
    const args = ['auto', '--project', PROJECT_PATH, '--auto-port', String(port)]
    const proc = spawn(CLI_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true, detached: true })
    
    const tryConnect = async () => {
      for (let i = 0; i < 30; i++) {
        try {
          const canConnect = await new Promise((resolve) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}`)
            ws.on('open', () => { ws.close(); resolve(true) })
            ws.on('error', () => resolve(false))
          })
          if (canConnect) {
            const miniProgram = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` })
            resolve({ miniProgram, proc })
            return
          }
        } catch (e) {}
        await sleep(1000)
      }
      reject(new Error('连接超时'))
    }
    setTimeout(tryConnect, 3000)
  })
}

function generateReport() {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true })
  
  const report = {
    summary: {
      total: testResults.passed.length + testResults.failed.length,
      passed: testResults.passed.length,
      failed: testResults.failed.length,
      startTime: testResults.startTime,
      endTime: testResults.endTime,
      duration: new Date(testResults.endTime) - new Date(testResults.startTime)
    },
    passed: testResults.passed,
    failed: testResults.failed
  }
  
  fs.writeFileSync(path.join(REPORT_DIR, `stress-test-${Date.now()}.json`), JSON.stringify(report, null, 2))
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 压力测试报告')
  console.log('='.repeat(60))
  console.log(`总数: ${report.summary.total}`)
  console.log(`通过: ${report.summary.passed} ✅`)
  console.log(`失败: ${report.summary.failed} ❌`)
  console.log(`耗时: ${(report.summary.duration / 1000).toFixed(2)}s`)
  if (testResults.failed.length > 0) {
    console.log('\n失败用例:')
    testResults.failed.forEach(r => console.log(`  - ${r.name}: ${r.error}`))
  }
  console.log('='.repeat(60))
}

async function runTests() {
  testResults.startTime = new Date().toISOString()
  
  try {
    console.log('🚀 启动 IDE...\n')
    const { miniProgram: mp } = await launchIDE()
    miniProgram = mp
    console.log('✅ 连接成功！\n')
    
    console.log('='.repeat(60))
    console.log('🔥 selfCam 小程序 - 快速压力测试')
    console.log('='.repeat(60))
    
    // 测试1: 快速跳转
    console.log('\n📌 测试1: 快速页面跳转 (5次)')
    for (let i = 0; i < 5; i++) {
      await miniProgram.reLaunch('/pages/index/index')
      await sleep(200)
      await miniProgram.reLaunch('/pages/camera/camera')
      await sleep(200)
    }
    recordResult('测试1: 快速页面跳转', true)
    
    // 测试2: 空缓存访问
    console.log('\n📌 测试2: 空缓存状态')
    await miniProgram.callWxMethod('clearStorageSync')
    await sleep(200)
    await miniProgram.reLaunch('/pages/camera/camera')
    await sleep(500)
    recordResult('测试2: 空缓存状态', true)
    
    // 测试3: 损坏数据
    console.log('\n📌 测试3: 损坏数据状态')
    await miniProgram.callWxMethod('setStorageSync', 'car_damage_photos_cache', 'invalid')
    await sleep(200)
    await miniProgram.reLaunch('/pages/index/index')
    await sleep(500)
    recordResult('测试3: 损坏数据状态', true)
    
    // 测试4: 正常流程
    console.log('\n📌 测试4: 正常流程')
    await miniProgram.callWxMethod('clearStorageSync')
    await sleep(200)
    let page = await miniProgram.reLaunch('/pages/index/index')
    await sleep(500)
    await page.callMethod('onStart')
    // wx.navigateTo 是异步的，需要更长时间等待跳转完成
    await sleep(2000)
    page = await miniProgram.currentPage()
    if (page && page.path.includes('camera')) {
      const data = await page.data()
      if (data.currentStep === 'licensePlate') {
        recordResult('测试4: 正常流程', true)
      } else {
        recordResult('测试4: 正常流程', false, new Error('步骤错误: ' + data.currentStep))
      }
    } else {
      recordResult('测试4: 正常流程', false, new Error('页面错误: ' + (page ? page.path : 'null')))
    }
    
    // 测试5: 数据操作
    console.log('\n📌 测试5: 数据操作')
    page = await miniProgram.currentPage()
    if (page) {
      await page.setData({ damageCount: 3 })
      await sleep(200)
      const data = await page.data()
      if (data.damageCount === 3) {
        recordResult('测试5: 数据操作', true)
      } else {
        recordResult('测试5: 数据操作', false, new Error('数据错误'))
      }
    } else {
      recordResult('测试5: 数据操作', false, new Error('页面丢失'))
    }
    
    // 测试6: 页面跳转链 (简单版)
    console.log('\n📌 测试6: 页面跳转链')
    try {
      // 先刷新一下连接状态
      await miniProgram.currentPage()
      await sleep(500)
      
      await withTimeout(
        (async () => {
          console.log('    → 跳转到首页')
          await miniProgram.reLaunch('/pages/index/index')
          await sleep(500)
          console.log('    → 跳转到拍照页')
          await miniProgram.reLaunch('/pages/camera/camera')
          await sleep(500)
          console.log('    → 返回首页')
          await miniProgram.reLaunch('/pages/index/index')
          await sleep(500)
        })(),
        30000,
        '测试6'
      )
      recordResult('测试6: 页面跳转链', true)
    } catch (e) {
      recordResult('测试6: 页面跳转链', false, e)
    }
    
    // 测试7: 边界值
    console.log('\n📌 测试7: 边界值测试')
    await miniProgram.reLaunch('/pages/camera/camera')
    await sleep(300)
    page = await miniProgram.currentPage()
    await page.setData({ damageCount: -1 })
    await sleep(100)
    await page.setData({ damageCount: 999 })
    await sleep(100)
    await page.setData({ damageCount: 5 })
    await sleep(100)
    recordResult('测试7: 边界值测试', true)
    
    // 测试8: 重复操作
    console.log('\n📌 测试8: 重复操作 (3次)')
    for (let i = 0; i < 3; i++) {
      await miniProgram.reLaunch('/pages/index/index')
      await sleep(300)
    }
    recordResult('测试8: 重复操作', true)
    
  } catch (e) {
    console.error('\n❌ 测试执行失败:', e.message)
  } finally {
    testResults.endTime = new Date().toISOString()
    if (miniProgram) await miniProgram.close()
    generateReport()
  }
}

runTests()
