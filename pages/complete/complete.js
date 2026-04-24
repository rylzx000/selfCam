const storage = require('../../utils/storage')
const workflow = require('../../utils/workflow-state')

Page({
  data: {
    vehicleCount: 0,
    totalPhotos: 0,
    workflowState: workflow.STATES.IDLE
  },

  onLoad() {
    this.calculateStats()
  },

  calculateStats() {
    const cache = storage.loadCache()
    if (!cache) return

    // 统计照片数量
    let totalPhotos = 0
    
    cache.vehicles.forEach(v => {
      // 车牌
      if (v.licensePlate && v.licensePlate.status === 'completed') {
        totalPhotos++
      }
      // VIN码
      if (v.vinCode && v.vinCode.status === 'completed') {
        totalPhotos++
      }
      // 车损照片
      if (v.damages && v.damages.length > 0) {
        totalPhotos += v.damages.length
      }
    })
    
    // 单证资料
    if (cache.documents && cache.documents.length > 0) {
      totalPhotos += cache.documents.length
    }

    this.setData({
      vehicleCount: cache.vehicles ? cache.vehicles.length : 0,
      totalPhotos
    })
  },

  // 返回预览页修改
  onBackToEdit() {
    wx.redirectTo({ url: '/pages/preview/preview' })
  },

  onExit() {
    // 清除缓存
    storage.clearCache()
    
    // 退出小程序
    wx.exitMiniProgram({
      success: () => {
        console.log('退出成功')
      },
      fail: () => {
        // 如果退出失败，返回首页
        wx.reLaunch({ url: '/pages/index/index' })
      }
    })
  }
})
