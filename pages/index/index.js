const storage = require('../../utils/storage')
const constants = require('../../utils/constants')
const permission = require('../../utils/permission')
const envConfig = require('../../utils/env-config')
const modelCache = require('../../utils/model-cache')
const auxPhotoApi = require('../../utils/aux-photo-api')
const auxPhotoMapper = require('../../utils/aux-photo-mapper')

const APP_ENV_SWITCH_TAP_COUNT = 7
const APP_ENV_SWITCH_RESET_MS = 1200
const INDEX_PAGE_URL = '/pages/index/index'

Page({
  data: {
    appEnvBadgeText: ''
  },
  isStartingCapture: false,
  appEnvTapCount: 0,
  appEnvTapTimer: null,

  onLoad() {
    console.log('[index] onLoad')
    this.updateAppEnvBadge()
    storage.clearCache()
  },

  onShow() {
    this.updateAppEnvBadge()
  },

  onUnload() {
    this.resetAppEnvTapCount()
  },

  onBrandTap() {
    if (!envConfig.canSwitchAppEnv()) {
      return
    }

    this.appEnvTapCount += 1

    if (this.appEnvTapTimer) {
      clearTimeout(this.appEnvTapTimer)
    }

    if (this.appEnvTapCount < APP_ENV_SWITCH_TAP_COUNT) {
      this.appEnvTapTimer = setTimeout(() => {
        this.resetAppEnvTapCount()
      }, APP_ENV_SWITCH_RESET_MS)
      return
    }

    this.resetAppEnvTapCount()
    this.showAppEnvSelector()
  },

  resetAppEnvTapCount() {
    this.appEnvTapCount = 0

    if (this.appEnvTapTimer) {
      clearTimeout(this.appEnvTapTimer)
      this.appEnvTapTimer = null
    }
  },

  updateAppEnvBadge() {
    const appEnvBadgeText = envConfig.getAppEnvBadgeText()

    if (this.data.appEnvBadgeText !== appEnvBadgeText) {
      this.setData({ appEnvBadgeText })
    }
  },

  showAppEnvSelector() {
    const appEnvs = envConfig.getAvailableAppEnvs()

    if (!appEnvs.length || typeof wx === 'undefined' || typeof wx.showActionSheet !== 'function') {
      return
    }

    const clearLabel = '\u6e05\u9664\u73af\u5883\u9009\u62e9'
    const clearModelCacheLabel = '\u6e05\u9664 AI \u6a21\u578b\u7f13\u5b58'
    const itemList = appEnvs.concat(clearLabel, clearModelCacheLabel)

    wx.showActionSheet({
      itemList,
      success: (res) => {
        if (!res || typeof res.tapIndex !== 'number') {
          return
        }

        if (res.tapIndex === appEnvs.length) {
          this.clearAppEnvSelection()
          return
        }

        if (res.tapIndex === appEnvs.length + 1) {
          this.clearAiModelCacheDebug()
          return
        }

        this.saveAppEnvSelection(appEnvs[res.tapIndex])
      }
    })
  },

  async clearAiModelCacheDebug() {
    const result = await modelCache.clearAiModelCache()
    const hasFailed = !result?.ok || result.results?.some((item) => !!item.errMsg)

    console.log('[AI:model:cache:clear]', result)

    if (hasFailed && typeof wx.showModal === 'function') {
      wx.showModal({
        title: '\u6a21\u578b\u7f13\u5b58',
        content: '\u6a21\u578b\u7f13\u5b58\u90e8\u5206\u6e05\u7406\u5931\u8d25\uff0c\u8bf7\u67e5\u770b\u65e5\u5fd7',
        showCancel: false
      })
      return
    }

    if (typeof wx.showToast === 'function') {
      wx.showToast({
        title: hasFailed
          ? '\u6a21\u578b\u7f13\u5b58\u90e8\u5206\u6e05\u7406\u5931\u8d25'
          : '\u6a21\u578b\u7f13\u5b58\u5df2\u6e05\u7406',
        icon: 'none'
      })
    }
  },

  saveAppEnvSelection(appEnv) {
    if (!envConfig.saveAppEnvOverride(appEnv)) {
      return
    }

    this.notifyAppEnvChanged()
  },

  clearAppEnvSelection() {
    envConfig.clearAppEnvOverride()
    this.notifyAppEnvChanged()
  },

  notifyAppEnvChanged() {
    const relaunch = () => {
      wx.reLaunch({ url: INDEX_PAGE_URL })
    }

    if (typeof wx.showModal === 'function') {
      wx.showModal({
        title: '\u73af\u5883\u5207\u6362',
        content: '\u73af\u5883\u5df2\u5207\u6362\uff0c\u5c06\u91cd\u65b0\u8fdb\u5165\u9996\u9875',
        showCancel: false,
        success: relaunch,
        fail: relaunch
      })
      return
    }

    relaunch()
  },

  async onStart() {
    if (this.isStartingCapture) {
      console.warn('[index] start ignored: capture flow already starting')
      return
    }

    this.isStartingCapture = true
    console.log('[index] onStart')

    try {
      const ticket = this.getLaunchTicket()

      if (this.shouldBlockMissingTicket(ticket)) {
        this.showInvalidTicketToast()
        return
      }

      const permissionResult = await permission.ensureStartCapturePermissions()
      console.log('[index] permission result:', permissionResult)

      if (!permissionResult.cameraGranted) {
        console.warn('[index] start blocked: camera permission denied')
        return
      }

      await this.startCaptureFlow(ticket)
    } catch (err) {
      console.warn('[index] start capture failed:', err)
      this.showStartFailedToast()
    } finally {
      this.isStartingCapture = false
    }
  },

  getLaunchTicket() {
    if (typeof getApp !== 'function') {
      return ''
    }

    const app = getApp()
    const ticket = app && app.globalData && app.globalData.ticket
    return typeof ticket === 'string' ? ticket.trim() : ''
  },

  shouldBlockMissingTicket(ticket) {
    return typeof envConfig.isRelease === 'function'
      && envConfig.isRelease()
      && !ticket
  },

  async startCaptureFlow(ticket = '') {
    if (ticket) {
      const initResponse = await auxPhotoApi.init(ticket)
      const cache = auxPhotoMapper.buildCacheFromInit(initResponse.data || initResponse)
      storage.saveCache(cache)
      console.log('[index] saved aux photo cache:', storage.loadCache())
      return this.navigateToCamera()
    }

    const cache = storage.initCache()
    console.log('[index] initCache:', cache)

    const vehicle = storage.createVehicle(0)
    cache.vehicles.push(vehicle)
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
    storage.saveCache(cache)

    console.log('[index] saved cache:', storage.loadCache())

    return this.navigateToCamera()
  },

  navigateToCamera() {
    return new Promise((resolve, reject) => {
      wx.navigateTo({
        url: '/pages/camera/camera',
        success: () => {
          console.log('[index] navigateTo camera success')
          resolve()
        },
        fail: reject
      })
    })
  },

  showInvalidTicketToast() {
    if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({ title: '链接无效，请联系工作人员重新发送', icon: 'none' })
    }
  },

  showStartFailedToast() {
    if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({ title: '\u5f00\u59cb\u91c7\u96c6\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5', icon: 'none' })
    }
  }
})
