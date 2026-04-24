const storage = require('../../utils/storage')
const cacheSelectors = require('../../utils/cache-selectors')
const constants = require('../../utils/constants')
const compress = require('../../utils/compress')
const workflow = require('../../utils/workflow-state')
const workflowPage = require('../../utils/workflow-page')

Page({
  data: {
    vehicles: [],
    documents: [],
    totalPhotoCount: 0,
    progress: {
      step1: 0,
      step2: 0,
      step3: false
    },
    canAddThirdVehicle: false,
    showPreview: false,
    allPhotos: [],
    previewIndex: 0,
    currentPhoto: null,
    actionsVisible: true,
    showActionSheet: false,
    showModal: false,
    modalContent: '',
    modalConfirmText: '',
    modalCancelText: '',
    modalType: '',
    scrollToView: '',
    highlightDocument: false,
    workflowState: workflow.STATES.IDLE
  },

  isLeaving: false,

  onLoad() {
    this.isLeaving = false
    if (storage.loadCacheForResume()) {
      workflowPage.syncPageWorkflowState(this, workflow.STATES.PREVIEWING, {
        page: 'preview'
      })
    }
    this.loadData()
  },

  onShow() {
    this.isLeaving = false

    const cache = storage.loadCacheForResume()
    const flowContext = cacheSelectors.getCurrentFlowContext(cache)

    if (cache && flowContext.fromPreview) {
      storage.saveCache(storage.clearPreviewFlags(cache))
    }

    if (cache) {
      workflowPage.syncPageWorkflowState(this, workflow.STATES.PREVIEWING, {
        page: 'preview'
      })
    }
    this.loadData()
  },

  loadData() {
    const cache = storage.loadCacheForResume()
    const summary = cacheSelectors.getCacheSummary(cache)

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    this.setData({
      vehicles: summary.vehicles,
      documents: summary.documents,
      allPhotos: summary.allPhotos,
      totalPhotoCount: summary.totalPhotos,
      progress: summary.progress,
      canAddThirdVehicle: summary.canAddThirdVehicle
    })
  },

  onPreview(e) {
    const { vehicle, type, damage } = e.currentTarget.dataset
    const targetId = damage !== undefined ? `${vehicle}-${type}-${damage}` : `${vehicle}-${type}`
    const index = this.data.allPhotos.findIndex((photo) => photo.id === targetId)

    if (index >= 0) {
      this.setData({
        showPreview: true,
        previewIndex: index,
        currentPhoto: this.data.allPhotos[index],
        actionsVisible: true
      })
    }
  },

  onSwiperChange(e) {
    const index = e.detail.current
    this.setData({
      previewIndex: index,
      currentPhoto: this.data.allPhotos[index]
    })
  },

  onToggleActions() {
    this.setData({
      actionsVisible: !this.data.actionsVisible
    })
  },

  onClosePreview() {
    this.setData({ showPreview: false })
  },

  onSupplement(e) {
    const { vehicle, type } = e.currentTarget.dataset
    const cache = storage.loadCache()

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    cache.currentVehicleIndex = vehicle
    cache.currentStep = type === 'licensePlate'
      ? constants.SHOOT_STEP.LICENSE_PLATE
      : constants.SHOOT_STEP.VIN_CODE
    cache.fromPreview = true
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  onAddDamage(e) {
    const { vehicle } = e.currentTarget.dataset
    const cache = storage.loadCache()

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    cache.currentVehicleIndex = vehicle
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.fromPreview = true
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  onRetake() {
    const photo = this.data.currentPhoto
    if (!photo) return

    const cache = storage.loadCache()
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    cache.currentVehicleIndex = photo.vehicle
    cache.currentStep = photo.type === 'licensePlate'
      ? constants.SHOOT_STEP.LICENSE_PLATE
      : photo.type === 'vinCode'
        ? constants.SHOOT_STEP.VIN_CODE
        : constants.SHOOT_STEP.DAMAGE
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: photo.vehicle,
      photoType: photo.type,
      damageIndex: photo.damage
    }
    cache.fromPreview = true
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  onDelete() {
    const photo = this.data.currentPhoto
    if (!photo) return

    wx.showModal({
      title: '',
      content: '确定删除该照片吗？',
      success: (res) => {
        if (res.confirm) {
          storage.deletePhoto(photo.vehicle, photo.type, photo.damage)
          this.setData({ showPreview: false })
          this.loadData()
        }
      }
    })
  },

  onAddThirdVehicle() {
    this.addThirdVehicle()
  },

  onSubmit() {
    const cache = storage.loadCache()
    const vehicleSummary = cacheSelectors.getVehicleSummary(cache)

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    if (vehicleSummary.canAddThirdVehicle) {
      this.setData({
        showModal: true,
        modalContent: '是否还有其他三者车？',
        modalConfirmText: '是',
        modalCancelText: '否，下一步',
        modalType: 'thirdVehicle'
      })
    } else {
      this.askDocument()
    }
  },

  askDocument() {
    this.setData({
      showModal: true,
      modalContent: '是否还有单证资料需要提交？如事故证明、银行卡等？',
      modalConfirmText: '是',
      modalCancelText: '否，提交',
      modalType: 'document'
    })
  },

  onModalConfirm() {
    this.setData({ showModal: false })
    if (this.data.modalType === 'thirdVehicle') {
      this.addThirdVehicle()
    } else if (this.data.modalType === 'document') {
      this.scrollToDocument()
    }
  },

  onModalCancel() {
    this.setData({ showModal: false })
    if (this.data.modalType === 'thirdVehicle') {
      setTimeout(() => {
        this.askDocument()
      }, 150)
    } else if (this.data.modalType === 'document') {
      this.submitComplete()
    }
  },

  scrollToDocument() {
    this.setData({
      scrollToView: 'document-section',
      highlightDocument: true
    })

    setTimeout(() => {
      this.setData({ highlightDocument: false })
    }, 3000)
  },

  submitComplete() {
    workflowPage.syncPageWorkflowState(this, workflow.STATES.LOCAL_COMPLETED, {
      page: 'preview',
      pageAction: 'submit_complete'
    })
    this.isLeaving = true
    wx.redirectTo({ url: '/pages/complete/complete' })
  },

  addThirdVehicle() {
    const cache = storage.loadCache()

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    const newIndex = cache.vehicles.length
    if (newIndex <= constants.LIMITS.MAX_THIRD_VEHICLES) {
      const newVehicle = storage.createVehicle(newIndex)
      cache.vehicles.push(newVehicle)
      cache.currentVehicleIndex = newIndex
      cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
      cache.fromPreview = true
      storage.saveCache(cache)

      this.isLeaving = true
      wx.navigateTo({
        url: '/pages/camera/camera',
        fail: () => {
          wx.redirectTo({
            url: '/pages/camera/camera',
            fail: () => {
              wx.reLaunch({ url: '/pages/camera/camera' })
            }
          })
        }
      })
    }
  },

  onDeleteVehicle(e) {
    const { vehicleIndex } = e.currentTarget.dataset
    const vehicle = this.data.vehicles[vehicleIndex]
    const photoCount = vehicle ? (vehicle.completedPhotoCount || 0) : 0

    wx.showModal({
      title: '删除确认',
      content: `确定删除“${vehicle.type}”及其 ${photoCount} 张照片吗？`,
      confirmText: '删除',
      confirmColor: '#D32F2F',
      success: (res) => {
        if (res.confirm) {
          storage.deleteVehicle(vehicleIndex)
          this.loadData()
        }
      }
    })
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
            this.isLeaving = true
            wx.redirectTo({ url: '/pages/index/index' })
            return
          }

          cache.documents.push(photo)
          storage.saveCache(cache)
          workflowPage.syncPageWorkflowState(this, workflow.STATES.DOCUMENTING, {
            page: 'preview',
            pageAction: 'document_saved_from_camera'
          })

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
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    wx.chooseMedia({
      count: documentSummary.remainingCount,
      mediaType: ['image'],
      sourceType: ['album'],
      success: async (res) => {
        wx.showLoading({ title: '处理中...' })
        try {
          for (const file of res.tempFiles) {
            const photo = await compress.compressImage(file.tempFilePath)
            photo.source = 'album'
            cache.documents.push(photo)
          }
          storage.saveCache(cache)
          workflowPage.syncPageWorkflowState(this, workflow.STATES.DOCUMENTING, {
            page: 'preview',
            pageAction: 'document_saved_from_album'
          })

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
      content: '确定删除这张照片吗？',
      confirmText: '删除',
      confirmColor: '#D32F2F',
      success: (res) => {
        if (res.confirm) {
          storage.deleteDocument(index)
          this.loadData()
        }
      }
    })
  }
})
