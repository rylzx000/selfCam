const storage = require('../../utils/storage')
const cacheSelectors = require('../../utils/cache-selectors')
const workflow = require('../../utils/workflow-state')

function resolvePhotoCount(value, fallback) {
  if (Number.isFinite(value)) {
    return value
  }

  return Number.isFinite(fallback) ? fallback : 0
}

function resolveAlbumSaveMessage(albumSaveSummary = {}) {
  if (albumSaveSummary.decision === 'saved') {
    return '本次照片已保存至手机相册'
  }

  if (albumSaveSummary.decision === 'partial' || albumSaveSummary.decision === 'failed') {
    return '本次照片采集已完成，部分照片未保存至手机相册'
  }

  if (albumSaveSummary.decision === 'skipped' || albumSaveSummary.decision === 'permission_denied') {
    return '本次照片采集已完成，未保存至手机相册'
  }

  return '本次照片采集已完成'
}

Page({
  data: {
    vehicleCount: 0,
    damagePhotoCount: 0,
    documentPhotoCount: 0,
    albumSaveMessage: '本次照片采集已完成',
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
      damagePhotoCount: resolvePhotoCount(summary.damagePhotoCount, summary.photoCounts && summary.photoCounts.damage),
      documentPhotoCount: resolvePhotoCount(summary.documentPhotoCount, summary.photoCounts && summary.photoCounts.document),
      albumSaveMessage: resolveAlbumSaveMessage(summary.albumSaveSummary),
      workflowState: summary.flowContext.workflowState
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
