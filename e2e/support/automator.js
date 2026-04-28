const fs = require('fs')
const { spawn } = require('child_process')
const WebSocket = require('ws')
const automator = require('miniprogram-automator')
const config = require('../config')
const { STORAGE_KEY } = require('./fixtures')

async function launchMiniProgram() {
  if (!fs.existsSync(config.cliPath)) {
    throw new Error(`未找到微信开发者工具 cli.bat: ${config.cliPath}`)
  }

  try {
    return await automator.launch({
      cliPath: config.cliPath,
      projectPath: config.projectPath,
      port: config.port,
      timeout: config.timeout
    })
  } catch (error) {
    return launchMiniProgramWithCliFallback(error)
  }
}

async function canConnectWs(port) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const timer = setTimeout(() => {
      ws.close()
      resolve(false)
    }, 1000)

    ws.on('open', () => {
      clearTimeout(timer)
      ws.close()
      resolve(true)
    })
    ws.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}

async function waitForWs(port, timeoutMs = config.timeout) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnectWs(port)) return true
    await wait(1000)
  }
  return false
}

async function launchMiniProgramWithCliFallback(launchError) {
  const port = config.port

  if (!(await canConnectWs(port))) {
    const args = ['auto', '--project', config.projectPath, '--auto-port', String(port)]
    const proc = spawn(config.cliPath, args, {
      stdio: 'ignore',
      shell: true,
      detached: true
    })
    proc.unref()

    const ready = await waitForWs(port)
    if (!ready) {
      throw new Error(`无法启动微信开发者工具自动化端口 ${port}: ${launchError.message}`)
    }
  }

  return automator.connect({
    wsEndpoint: `ws://127.0.0.1:${port}`
  })
}

async function closeMiniProgram(miniProgram) {
  if (miniProgram && typeof miniProgram.close === 'function') {
    await miniProgram.close()
  }
}

async function wait(ms = 300) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function seedCache(miniProgram, cache) {
  await miniProgram.evaluate(function (payload) {
    var key = payload.key
    var value = payload.value
    wx.setStorageSync(key, JSON.stringify(value))
  }, {
    key: STORAGE_KEY,
    value: cache
  })
}

async function readCache(miniProgram) {
  return miniProgram.evaluate(function (payload) {
    var key = payload.key
    const raw = wx.getStorageSync(key)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  }, {
    key: STORAGE_KEY
  })
}

async function corruptCache(miniProgram) {
  await miniProgram.evaluate(function (payload) {
    var key = payload.key
    wx.setStorageSync(key, '{bad json')
  }, {
    key: STORAGE_KEY
  })
}

async function textOf(page, selector) {
  const element = await page.$(selector)
  if (!element) return ''
  return element.text()
}

async function allText(page) {
  const nodes = []
  for (const selector of ['text', 'view', 'button', 'cover-view']) {
    const matches = await page.$$(selector)
    nodes.push(...matches)
  }
  const chunks = []

  for (const node of nodes) {
    try {
      const text = await node.text()
      if (text) chunks.push(text)
    } catch (error) {
      // 某些原生节点没有 text 能力，忽略即可。
    }
  }

  return chunks.join('\n')
}

async function waitForCondition(check, timeoutMs = 3000, intervalMs = 100) {
  const startedAt = Date.now()
  let lastError = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await check()
      if (result) return result
    } catch (error) {
      lastError = error
    }
    await wait(intervalMs)
  }

  if (lastError) throw lastError
  throw new Error(`等待条件超时: ${timeoutMs}ms`)
}

async function installWxMediaMocks(miniProgram, mode = 'success') {
  await miniProgram.evaluate(function (payload) {
    var mode = payload.mode
    wx.__e2eMedia = {
      mode,
      chooseMediaCalls: 0,
      compressImageCalls: 0,
      getFileInfoCalls: 0,
      showLoadingCalls: 0,
      hideLoadingCalls: 0,
      loadingVisible: false,
      showActionSheetCalls: 0,
      toastTitles: []
    }

    wx.chooseMedia = function (options) {
      options = options || {}
      wx.__e2eMedia.chooseMediaCalls += 1
      setTimeout(function () {
        if (mode === 'success') {
          options.success && options.success({
            tempFiles: [{ tempFilePath: 'wxfile://tmp/e2e-document.jpg', size: 1024 }]
          })
        } else if (mode === 'cancel') {
          options.fail && options.fail({ errMsg: 'chooseMedia:fail cancel' })
        } else {
          options.fail && options.fail({ errMsg: 'chooseMedia:fail e2e' })
        }
        options.complete && options.complete({})
      }, 0)
    }

    wx.compressImage = function (options) {
      options = options || {}
      wx.__e2eMedia.compressImageCalls += 1
      setTimeout(function () {
        options.success && options.success({ tempFilePath: 'wxfile://tmp/e2e-compressed.jpg' })
        options.complete && options.complete({})
      }, 0)
    }

    wx.getFileInfo = function (options) {
      options = options || {}
      wx.__e2eMedia.getFileInfoCalls += 1
      setTimeout(function () {
        options.success && options.success({ size: 1024 })
        options.complete && options.complete({})
      }, 0)
    }

    wx.showLoading = function () {
      wx.__e2eMedia.showLoadingCalls += 1
      wx.__e2eMedia.loadingVisible = true
    }

    wx.hideLoading = function () {
      wx.__e2eMedia.hideLoadingCalls += 1
      wx.__e2eMedia.loadingVisible = false
    }

    wx.showToast = function (options) {
      options = options || {}
      wx.__e2eMedia.toastTitles.push(options.title || '')
    }

    wx.showActionSheet = function (options) {
      options = options || {}
      wx.__e2eMedia.showActionSheetCalls += 1
      options.success && options.success({ tapIndex: 0 })
      options.complete && options.complete({})
    }
  }, { mode })
}

async function getWxMediaState(miniProgram) {
  return miniProgram.evaluate(function () {
    return wx.__e2eMedia || null
  })
}

async function patchCameraAiForE2E(miniProgram) {
  await miniProgram.evaluate(function () {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (!page) return null

    if (page.__e2eAiPatched) {
      return page.__e2eAi
    }

    page.__e2eAiPatched = true
    page.__e2eAi = {
      resumeCalls: 0,
      startCalls: 0,
      stopCalls: 0,
      activeLoops: 0,
      reasons: []
    }

    const originalResume = page.resumeAIDetection
    const originalStop = page.stopAIDetectionLoop

    page.stopAIDetectionLoop = function patchedStopAIDetectionLoop() {
      page.__e2eAi.stopCalls += 1
      if (this.detectTimer && page.__e2eAi.activeLoops > 0) {
        page.__e2eAi.activeLoops -= 1
      }
      return originalStop.call(this)
    }

    page.startAIDetectionLoop = function patchedStartAIDetectionLoop(step) {
      page.__e2eAi.startCalls += 1
      if (!this.detectTimer) {
        page.__e2eAi.activeLoops += 1
        this.detectTimer = setTimeout(function () {}, 60000)
      }
      this.__e2eLastStartedStep = step
    }

    page.resumeAIDetection = function patchedResumeAIDetection(reason) {
      page.__e2eAi.resumeCalls += 1
      page.__e2eAi.reasons.push(reason || '')
      return originalResume.call(this, reason)
    }

    return page.__e2eAi
  })
}

async function getCameraAiState(miniProgram) {
  return miniProgram.evaluate(function () {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (!page) return null

    return {
      cameraInitialized: !!page.cameraInitialized,
      hasTimer: !!page.detectTimer,
      currentStep: page.data && page.data.currentStep,
      e2eAi: page.__e2eAi || null
    }
  })
}

async function setCurrentPageFields(miniProgram, fields = {}) {
  await miniProgram.evaluate(function (payload) {
    var fields = payload.fields
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (!page) return
    Object.keys(fields).forEach((key) => {
      page[key] = fields[key]
    })
  }, { fields })
}

module.exports = {
  launchMiniProgram,
  closeMiniProgram,
  wait,
  seedCache,
  readCache,
  corruptCache,
  textOf,
  allText,
  waitForCondition,
  installWxMediaMocks,
  getWxMediaState,
  patchCameraAiForE2E,
  getCameraAiState,
  setCurrentPageFields
}
