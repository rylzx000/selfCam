const storage = require('../../utils/storage')
const constants = require('../../utils/constants')
const permission = require('../../utils/permission')
const envConfig = require('../../utils/env-config')

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

    wx.showActionSheet({
      itemList: appEnvs.concat(clearLabel),
      success: (res) => {
        if (!res || typeof res.tapIndex !== 'number') {
          return
        }

        if (res.tapIndex === appEnvs.length) {
          this.clearAppEnvSelection()
          return
        }

        this.saveAppEnvSelection(appEnvs[res.tapIndex])
      }
    })
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
      const permissionResult = await permission.ensureStartCapturePermissions()
      console.log('[index] permission result:', permissionResult)

      if (!permissionResult.cameraGranted) {
        console.warn('[index] start blocked: camera permission denied')
        return
      }

      await this.startCaptureFlow()
    } catch (err) {
      console.warn('[index] start capture failed:', err)
      this.showStartFailedToast()
    } finally {
      this.isStartingCapture = false
    }
  },

  startCaptureFlow() {
    const cache = storage.initCache()
    console.log('[index] initCache:', cache)

    const vehicle = storage.createVehicle(0)
    cache.vehicles.push(vehicle)
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
    storage.saveCache(cache)

    console.log('[index] saved cache:', storage.loadCache())

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

  showStartFailedToast() {
    if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({ title: '\u5f00\u59cb\u91c7\u96c6\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5', icon: 'none' })
    }
  }
})
