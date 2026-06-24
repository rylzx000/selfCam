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

async function installWxMediaMocks(miniProgram, mode = 'success', mockOptions = {}) {
  if (mode && typeof mode === 'object') {
    mockOptions = mode
    mode = mockOptions.mode || 'success'
  }

  await miniProgram.evaluate(function (payload) {
    var mode = payload.mode
    var mockOptions = payload.mockOptions || {}
    wx.__e2eMedia = {
      mode,
      mockOptions,
      chooseMediaCalls: 0,
      compressImageCalls: 0,
      getFileInfoCalls: 0,
      showLoadingCalls: 0,
      hideLoadingCalls: 0,
      loadingVisible: false,
      showActionSheetCalls: 0,
      showModalCalls: 0,
      modalContents: [],
      saveAlbumCalls: 0,
      toastTitles: []
    }

    function buildMediaFiles(options) {
      var requestedCount = Number(options && options.count)
      var count = Number.isFinite(requestedCount) ? Math.max(requestedCount, 0) : 1
      var explicitPaths = Array.isArray(mockOptions.mediaPaths) ? mockOptions.mediaPaths : []
      var defaultMediaCount = count === 0 ? 0 : 1
      var mediaCount = Number.isFinite(mockOptions.mediaCount) ? mockOptions.mediaCount : defaultMediaCount
      var finalCount = explicitPaths.length ? explicitPaths.length : mediaCount
      var files = []

      for (var index = 0; index < finalCount; index += 1) {
        var path = explicitPaths[index] || `wxfile://tmp/e2e-media-${wx.__e2eMedia.chooseMediaCalls}-${index}.jpg`
        files.push({
          tempFilePath: path,
          size: 1024 + index
        })
      }

      return files
    }

    wx.chooseMedia = function (options) {
      options = options || {}
      wx.__e2eMedia.chooseMediaCalls += 1
      setTimeout(function () {
        if (mode === 'success') {
          options.success && options.success({
            tempFiles: buildMediaFiles(options)
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
        var compressedPath = mockOptions.uniqueCompressedPath
          ? `wxfile://tmp/e2e-compressed-${wx.__e2eMedia.compressImageCalls}.jpg`
          : 'wxfile://tmp/e2e-compressed.jpg'
        options.success && options.success({ tempFilePath: compressedPath })
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
      var tapIndex = Number.isInteger(mockOptions.actionSheetTapIndex)
        ? mockOptions.actionSheetTapIndex
        : 0
      options.success && options.success({ tapIndex })
      options.complete && options.complete({})
    }

    wx.showModal = function (options) {
      options = options || {}
      wx.__e2eMedia.showModalCalls += 1
      wx.__e2eMedia.modalContents.push(options.content || '')
      var confirm = mockOptions.modalConfirm !== false
      options.success && options.success({
        confirm,
        cancel: !confirm
      })
      options.complete && options.complete({})
    }

    wx.saveImageToPhotosAlbum = function (options) {
      options = options || {}
      wx.__e2eMedia.saveAlbumCalls += 1
      options.success && options.success({})
      options.complete && options.complete({})
    }
  }, { mode, mockOptions })
}

async function getWxMediaState(miniProgram) {
  return miniProgram.evaluate(function () {
    return wx.__e2eMedia || null
  })
}

async function installAuxUploadMocks(miniProgram) {
  await miniProgram.evaluate(function () {
    const originalGetFileSystemManager = wx.getFileSystemManager
    const originalRequest = wx.request

    wx.__e2eAuxUpload = {
      readFileCalls: 0,
      uploadCalls: 0,
      completeCalls: 0,
      requests: []
    }

    wx.getFileSystemManager = function () {
      const fs = typeof originalGetFileSystemManager === 'function'
        ? originalGetFileSystemManager.call(wx)
        : {}
      const wrappedFs = {}

      Object.keys(fs || {}).forEach(function (key) {
        wrappedFs[key] = fs[key]
      })

      wrappedFs.readFile = function (options) {
        options = options || {}
        const filePath = options.filePath || ''

        if (filePath.indexOf('wxfile://tmp/') === 0) {
          wx.__e2eAuxUpload.readFileCalls += 1
          setTimeout(function () {
            options.success && options.success({ data: 'ZTJldGVzdA==' })
            options.complete && options.complete({})
          }, 0)
          return
        }

        if (fs && typeof fs.readFile === 'function') {
          return fs.readFile(options)
        }

        options.fail && options.fail({ errMsg: 'readFile:fail e2e mock unavailable' })
        options.complete && options.complete({})
      }

      return wrappedFs
    }

    wx.request = function (options) {
      options = options || {}
      const url = options.url || ''
      const data = options.data || {}

      if (url.indexOf('/uploadPhotoBase64') >= 0) {
        wx.__e2eAuxUpload.uploadCalls += 1
        wx.__e2eAuxUpload.requests.push({
          type: 'upload',
          ticket: data.ticket,
          vehicleId: data.vehicleId,
          uploadItemId: data.uploadItemId,
          photoType: data.photoType,
          clientPhotoId: data.clientPhotoId
        })
        setTimeout(function () {
          options.success && options.success({
            statusCode: 200,
            data: {
              success: true,
              code: '0000',
              message: 'e2e upload ok',
              data: {
                uploadRecordId: `E2E_UPLOAD_${data.clientPhotoId || wx.__e2eAuxUpload.uploadCalls}`,
                photoId: `E2E_PHOTO_${data.clientPhotoId || wx.__e2eAuxUpload.uploadCalls}`,
                vehicleId: data.vehicleId,
                uploadItemId: data.uploadItemId,
                photoType: data.photoType,
                duplicate: false,
                itemUploadedCount: Number.isFinite(data.sortNo) ? data.sortNo : 1,
                ticketStatus: 'UPLOADING'
              }
            }
          })
          options.complete && options.complete({})
        }, 0)
        return
      }

      if (url.indexOf('/complete') >= 0) {
        wx.__e2eAuxUpload.completeCalls += 1
        wx.__e2eAuxUpload.requests.push({
          type: 'complete',
          ticket: data.ticket,
          clientUploadCount: data.clientUploadCount
        })
        setTimeout(function () {
          options.success && options.success({
            statusCode: 200,
            data: {
              success: true,
              code: '0000',
              message: 'e2e complete ok',
              data: {
                ticket: data.ticket,
                ticketStatus: 'COMPLETED',
                uploadedCount: Number.isFinite(data.clientUploadCount) ? data.clientUploadCount : 0,
                requiredPassed: true,
                missingItems: [],
                completeTime: '2026-06-24 00:00:00',
                phase2TriggerStatus: 'NOT_ENABLED'
              }
            }
          })
          options.complete && options.complete({})
        }, 0)
        return
      }

      if (typeof originalRequest === 'function') {
        return originalRequest.call(wx, options)
      }

      options.fail && options.fail({ errMsg: 'request:fail e2e mock unavailable' })
      options.complete && options.complete({})
    }
  })
}

async function installCurrentPageCameraMock(miniProgram, tempImagePath = 'wxfile://tmp/e2e-camera-shot.jpg') {
  return miniProgram.evaluate(function (payload) {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (!page) return false

    wx.__e2eCamera = {
      takePhotoCalls: 0,
      tempImagePath: payload.tempImagePath
    }
    page.cameraInitialized = true
    page.cameraContext = {
      takePhoto(options) {
        options = options || {}
        wx.__e2eCamera.takePhotoCalls += 1
        setTimeout(function () {
          options.success && options.success({ tempImagePath: wx.__e2eCamera.tempImagePath })
          options.complete && options.complete({})
        }, 0)
      }
    }
    return true
  }, { tempImagePath })
}

async function getCameraMockState(miniProgram) {
  return miniProgram.evaluate(function () {
    return wx.__e2eCamera || null
  })
}

const CAMERA_RUNTIME_ERROR_PATTERNS = [
  '<camera>: 一个页面只能插入一个',
  'compressImage:fail compress image fail',
  '[camera] photo process failed',
  '[camera] takePhoto failed'
]

function stringifyRuntimeLog(payload) {
  if (payload == null) return ''
  if (typeof payload === 'string') return payload
  if (typeof payload.message === 'string') return payload.message
  if (typeof payload.text === 'string') return payload.text
  if (Array.isArray(payload.args)) {
    return payload.args.map(stringifyRuntimeLog).join(' ')
  }
  if (payload.exceptionDetails) {
    return stringifyRuntimeLog(payload.exceptionDetails)
  }
  try {
    return JSON.stringify(payload)
  } catch (error) {
    return String(payload)
  }
}

function createCameraRuntimeErrorCollector(miniProgram) {
  const errors = []
  const onConsole = (payload) => {
    const message = stringifyRuntimeLog(payload)
    if (CAMERA_RUNTIME_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
      errors.push(message)
    }
  }
  const onException = (payload) => {
    const message = stringifyRuntimeLog(payload)
    if (CAMERA_RUNTIME_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
      errors.push(message)
    }
  }

  miniProgram.on('console', onConsole)
  miniProgram.on('exception', onException)

  return {
    errors,
    detach() {
      miniProgram.removeListener('console', onConsole)
      miniProgram.removeListener('exception', onException)
    },
    assertClean(label = 'camera runtime') {
      if (errors.length) {
        throw new Error(`${label} errors:\n${errors.join('\n')}`)
      }
    }
  }
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

async function callCurrentPageMethodAsync(miniProgram, methodName, ...args) {
  return miniProgram.evaluate(function (payload) {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (!page || typeof page[payload.methodName] !== 'function') return false

    setTimeout(function () {
      page[payload.methodName].apply(page, payload.args || [])
    }, 0)

    return true
  }, { methodName, args })
}

async function saveRetakenDamageForE2E(miniProgram, vehicleIndex, damageIndex, photo) {
  return miniProgram.evaluate(function (payload) {
    const raw = wx.getStorageSync(payload.key)
    const cache = typeof raw === 'string' ? JSON.parse(raw) : raw
    const vehicle = cache && cache.vehicles && cache.vehicles[payload.vehicleIndex]

    if (!vehicle || !Array.isArray(vehicle.damages) || !vehicle.damages[payload.damageIndex]) {
      return false
    }

    vehicle.damages[payload.damageIndex] = payload.photo
    cache.retakeMode = {
      enabled: false,
      vehicleIndex: null,
      photoType: null,
      damageIndex: null
    }
    cache.fromPreview = false
    cache.updatedAt = new Date().toISOString()

    wx.setStorageSync(payload.key, JSON.stringify(cache))
    return true
  }, {
    key: STORAGE_KEY,
    vehicleIndex,
    damageIndex,
    photo
  })
}

async function appendDamageForE2E(miniProgram, vehicleIndex, photo) {
  return miniProgram.evaluate(function (payload) {
    const raw = wx.getStorageSync(payload.key)
    const cache = typeof raw === 'string' ? JSON.parse(raw) : raw
    const vehicle = cache && cache.vehicles && cache.vehicles[payload.vehicleIndex]

    if (!vehicle) {
      return false
    }

    if (!Array.isArray(vehicle.damages)) {
      vehicle.damages = []
    }

    vehicle.damages.push(payload.photo)
    cache.currentVehicleIndex = payload.vehicleIndex
    cache.currentStep = 'damage'
    cache.currentDamageCount = vehicle.damages.length
    cache.retakeMode = {
      enabled: false,
      vehicleIndex: null,
      photoType: null,
      damageIndex: null
    }
    cache.fromPreview = false
    cache.updatedAt = new Date().toISOString()

    wx.setStorageSync(payload.key, JSON.stringify(cache))
    return true
  }, {
    key: STORAGE_KEY,
    vehicleIndex,
    photo
  })
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
  installAuxUploadMocks,
  installCurrentPageCameraMock,
  getCameraMockState,
  createCameraRuntimeErrorCollector,
  patchCameraAiForE2E,
  getCameraAiState,
  setCurrentPageFields,
  callCurrentPageMethodAsync,
  saveRetakenDamageForE2E,
  appendDamageForE2E
}
