const storage = require('../../utils/storage')
const cacheSelectors = require('../../utils/cache-selectors')
const workflow = require('../../utils/workflow-state')

Page({
  data: {
    vehicleCount: 0,
    totalPhotos: 0,
    documentCount: 0,
    photoCounts: {
      licensePlate: 0,
      vinCode: 0,
      damage: 0,
      document: 0,
      total: 0
    },
    hasRetakeContext: false,
    shouldSuggestBackToEdit: false,
    shouldSuggestBackToEditReasons: [],
    workflowState: workflow.STATES.IDLE
  },

  onLoad() {
    this.loadSummary()
  },

  loadSummary() {
    const cache = storage.loadCacheForResume()
    const summary = cacheSelectors.getCacheSummary(cache)

    if (!summary.hasCache) {
      return
    }

    if (summary.flowContext.workflowState !== workflow.STATES.LOCAL_COMPLETED) {
      wx.redirectTo({ url: '/pages/preview/preview' })
      return
    }

    this.setData({
      vehicleCount: summary.vehicleCount,
      totalPhotos: summary.totalPhotos,
      documentCount: summary.documentCount,
      photoCounts: summary.photoCounts,
      hasRetakeContext: summary.hasRetakeContext,
      shouldSuggestBackToEdit: summary.shouldSuggestBackToEdit,
      shouldSuggestBackToEditReasons: summary.shouldSuggestBackToEditReasons
    })
  },

  onBackToEdit() {
    const cache = storage.loadCache()
    if (cache) {
      storage.saveCache(storage.clearCompletionContext(cache))
    }
    wx.redirectTo({ url: '/pages/preview/preview' })
  },

  onExit() {
    storage.clearCache()

    wx.exitMiniProgram({
      success: () => {
        console.log('退出成功')
      },
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' })
      }
    })
  }
})
