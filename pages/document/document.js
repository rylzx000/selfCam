const storage = require('../../utils/storage')
const cacheSelectors = require('../../utils/cache-selectors')
const constants = require('../../utils/constants')
const compress = require('../../utils/compress')
const workflow = require('../../utils/workflow-state')
const workflowPage = require('../../utils/workflow-page')
const uploadState = require('../../utils/upload-state')

const TOTAL_PHOTO_LIMIT_TIP = `最多${constants.LIMITS.MAX_TOTAL_PHOTOS}张，请先删除`

function getRemainingTotalPhotoCount(cache) {
  const summary = cacheSelectors.getCacheSummary(cache)
  return Math.max(constants.LIMITS.MAX_TOTAL_PHOTOS - summary.totalPhotos, 0)
}

function showTotalPhotoLimitToast() {
  wx.showToast({
    title: TOTAL_PHOTO_LIMIT_TIP,
    icon: 'none'
  })
}

Page({
  data: {
    documents: [],
    showActionSheet: false,
    selectedIndex: null,
    workflowState: workflow.STATES.IDLE
  },

  onLoad() {
    if (storage.loadCacheForResume()) {
      workflowPage.syncPageWorkflowState(this, workflow.STATES.DOCUMENTING, {
        page: 'document'
      })
    }
    this.loadData()
  },

  onShow() {
    if (storage.loadCacheForResume()) {
      workflowPage.syncPageWorkflowState(this, workflow.STATES.DOCUMENTING, {
        page: 'document'
      })
    }
    this.loadData()
  },

  loadData() {
    const cache = storage.loadCacheForResume()
    const documentSummary = cacheSelectors.getDocumentSummary(cache)

    if (!cache) {
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    this.setData({
      documents: documentSummary.documents
    })
  },

  onBack() {
    wx.navigateBack()
  },

  onAddDocument() {
    this.setData({ showActionSheet: true })
  },

  onCloseActionSheet() {
    this.setData({ showActionSheet: false })
  },

  stopPropagation() {},

  onTakePhoto() {
    this.setData({ showActionSheet: false })

    const cacheBeforeChoose = storage.loadCache()
    if (!cacheBeforeChoose) {
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    if (getRemainingTotalPhotoCount(cacheBeforeChoose) <= 0) {
      showTotalPhotoLimitToast()
      return
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: async (res) => {
        wx.showLoading({ title: '处理中...' })
        try {
          const photo = await compress.compressImage(res.tempFiles[0].tempFilePath)
          photo.source = 'camera'

          const cache = storage.loadCache()
          if (!cache) {
            wx.hideLoading()
            wx.redirectTo({ url: '/pages/index/index' })
            return
          }

          cache.documents.push(photo)
          storage.saveCache(cache)

          this.loadData()
          wx.hideLoading()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: '处理失败', icon: 'none' })
        }
      }
    })
  },

  onChooseAlbum() {
    this.setData({ showActionSheet: false })

    const cache = storage.loadCache()
    const documentSummary = cacheSelectors.getDocumentSummary(cache)

    if (!cache) {
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    const remainingTotalCount = getRemainingTotalPhotoCount(cache)
    if (remainingTotalCount <= 0) {
      showTotalPhotoLimitToast()
      return
    }

    wx.chooseMedia({
      count: Math.min(documentSummary.remainingCount, remainingTotalCount),
      mediaType: ['image'],
      sourceType: ['album'],
      success: async (res) => {
        wx.showLoading({ title: '处理中...' })
        try {
          let addedCount = 0
          for (const file of res.tempFiles) {
            if (addedCount >= remainingTotalCount) {
              break
            }
            const photo = await compress.compressImage(file.tempFilePath)
            photo.source = 'album'
            cache.documents.push(photo)
            addedCount += 1
          }
          storage.saveCache(cache)

          this.loadData()
          wx.hideLoading()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: '处理失败', icon: 'none' })
        }
      }
    })
  },

  onPreviewDocument(e) {
    const { index } = e.currentTarget.dataset
    const urls = this.data.documents.map((document) => document.compressedPath)
    const current = this.data.documents[index].compressedPath

    wx.previewImage({ urls, current })
  },

  onDeleteDocument(e) {
    const { index } = e.currentTarget.dataset

    wx.showModal({
      title: '',
      content: '确定删除这张照片？',
      success: (res) => {
        if (res.confirm) {
          storage.deleteDocument(index)
          this.loadData()
        }
      }
    })
  },

  onSubmit() {
    const cache = storage.loadCache()

    if (!cache) {
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    cache.uploadSession = uploadState.createUploadSession(cache)
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    storage.saveCache(cache)

    workflowPage.syncPageWorkflowState(this, workflow.STATES.UPLOADING, {
      page: 'document',
      pageAction: 'upload_start'
    })
    wx.redirectTo({ url: '/pages/preview/preview' })
  }
})
