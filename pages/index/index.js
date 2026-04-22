const storage = require('../../utils/storage')
const constants = require('../../utils/constants')

Page({
  data: {
    
  },

  onLoad() {
    console.log('[index] onLoad')
    // 清除之前的缓存，开始新的拍摄
    storage.clearCache()
  },

  onStart() {
    console.log('[index] onStart')
    
    // 初始化缓存
    const cache = storage.initCache()
    console.log('[index] initCache:', cache)
    
    // 创建第一辆车（标的车）
    const vehicle = storage.createVehicle(0)
    cache.vehicles.push(vehicle)
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
    storage.saveCache(cache)
    
    console.log('[index] saved cache:', storage.loadCache())
    
    // 跳转到拍照页
    wx.navigateTo({
      url: '/pages/camera/camera',
      success: () => {
        console.log('[index] navigateTo camera success')
      },
      fail: (err) => {
        console.error('[index] navigateTo camera failed:', err)
      }
    })
  }
})
