const storage = require('../../utils/storage')
const constants = require('../../utils/constants')
const permission = require('../../utils/permission')

Page({
  data: {

  },
  isStartingCapture: false,

  onLoad() {
    console.log('[index] onLoad')
    storage.clearCache()
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
