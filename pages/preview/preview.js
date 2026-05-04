const storage = require('../../utils/storage')
const cacheSelectors = require('../../utils/cache-selectors')
const constants = require('../../utils/constants')
const compress = require('../../utils/compress')
const vehicleDocuments = require('../../utils/documents')
const album = require('../../utils/album')
const workflow = require('../../utils/workflow-state')
const workflowPage = require('../../utils/workflow-page')
const envConfig = require('../../utils/env-config')

const DRIVING_LICENSE_MAX_FILE_SIZE = 400 * 1024
const DRIVING_LICENSE_RISK_TIP = '仍有车辆未上传行驶证，会影响定损金额准确性，建议上传。如确实无法提供，请后续联系案件处理人员补充。是否确认提交？'

function buildDrivingLicensePreview(vehicle, index) {
  return {
    ...vehicle,
    previewName: index === 0 ? '您的车' : `其他出险车辆 ${index}`,
    previewTag: index === 0 ? '标的车' : '三者车',
    drivingLicensePreview: vehicleDocuments.buildDrivingLicensePreview(vehicle)
  }
}

function getDrivingLicenseLabel(docSide) {
  return vehicleDocuments.DRIVING_LICENSE_LABELS[docSide] || '行驶证资料'
}

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
    showDrivingLicensePanel: false,
    drivingLicenseMode: 'physical',
    activeDrivingLicenseVehicleIndex: null,
    activeDrivingLicenseSlots: [],
    appEnvBadgeText: '',
    workflowState: workflow.STATES.IDLE
  },

  isLeaving: false,

  onLoad() {
    this.isLeaving = false
    this.updateAppEnvBadge()
    if (storage.loadCacheForResume()) {
      workflowPage.syncPageWorkflowState(this, workflow.STATES.PREVIEWING, {
        page: 'preview'
      })
    }
    this.loadData()
  },

  onShow() {
    this.isLeaving = false
    this.updateAppEnvBadge()

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

  updateAppEnvBadge() {
    const appEnvBadgeText = envConfig.getAppEnvBadgeText()

    if (this.data.appEnvBadgeText !== appEnvBadgeText) {
      this.setData({ appEnvBadgeText })
    }
  },

  loadData() {
    const cache = storage.loadCacheForResume()
    const summary = cacheSelectors.getCacheSummary(cache)

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    const vehicles = summary.vehicles.map(buildDrivingLicensePreview)
    const activeVehicle = vehicles[this.data.activeDrivingLicenseVehicleIndex]
    const drivingLicenseMode = activeVehicle
      ? vehicleDocuments.getDrivingLicenseSelection(activeVehicle)
      : this.data.drivingLicenseMode

    this.setData({
      vehicles,
      documents: summary.documents,
      allPhotos: summary.allPhotos,
      totalPhotoCount: summary.totalPhotos,
      progress: summary.progress,
      canAddThirdVehicle: summary.canAddThirdVehicle,
      drivingLicenseMode,
      activeDrivingLicenseSlots: activeVehicle
        ? vehicleDocuments.buildDrivingLicenseSlots(activeVehicle, drivingLicenseMode)
        : []
    })
  },

  onOpenDrivingLicensePanel(e) {
    const { vehicle } = e.currentTarget.dataset
    const activeVehicle = this.data.vehicles[vehicle]
    const drivingLicenseMode = activeVehicle
      ? vehicleDocuments.getDrivingLicenseSelection(activeVehicle)
      : vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL

    this.setData({
      showDrivingLicensePanel: true,
      drivingLicenseMode,
      activeDrivingLicenseVehicleIndex: vehicle,
      activeDrivingLicenseSlots: activeVehicle
        ? vehicleDocuments.buildDrivingLicenseSlots(activeVehicle, drivingLicenseMode)
        : []
    })
  },

  onCloseDrivingLicensePanel() {
    this.setData({
      showDrivingLicensePanel: false,
      activeDrivingLicenseVehicleIndex: null,
      activeDrivingLicenseSlots: []
    })
  },

  onSwitchDrivingLicenseMode() {
    const nextMode = this.data.drivingLicenseMode === vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC
      ? vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL
      : vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC

    if (this.data.activeDrivingLicenseVehicleIndex !== null) {
      storage.setVehicleDocumentSelection(
        this.data.activeDrivingLicenseVehicleIndex,
        vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE,
        nextMode
      )
    }

    this.setData({
      drivingLicenseMode: nextMode
    })
    this.loadData()
  },

  onTapDrivingLicenseSlot(e) {
    const { side, uploaded } = e.currentTarget.dataset
    const isUploaded = uploaded === true || uploaded === 'true'

    if (isUploaded) {
      return this.openDrivingLicenseDocumentActions(this.data.activeDrivingLicenseVehicleIndex, side)
    }

    return this.openDrivingLicenseSourceSheet(side)
  },

  onTapDrivingLicenseUpload(e) {
    const { vehicle } = e.currentTarget.dataset
    const activeVehicle = this.data.vehicles[vehicle]
    const mode = activeVehicle
      ? vehicleDocuments.getDrivingLicenseSelection(activeVehicle)
      : vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL
    const targetSide = mode === vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC
      ? vehicleDocuments.DRIVING_LICENSE_SIDES.ELECTRONIC
      : vehicleDocuments.DRIVING_LICENSE_SIDES.FRONT_PAGE

    this.setData({
      showDrivingLicensePanel: true,
      drivingLicenseMode: mode,
      activeDrivingLicenseVehicleIndex: vehicle,
      activeDrivingLicenseSlots: activeVehicle
        ? vehicleDocuments.buildDrivingLicenseSlots(activeVehicle, mode)
        : []
    })

    return this.openDrivingLicenseSourceSheet(targetSide)
  },

  onOpenDrivingLicenseDocumentActions(e) {
    const { vehicle, side } = e.currentTarget.dataset
    return this.openDrivingLicenseDocumentActions(vehicle, side)
  },

  openDrivingLicenseDocumentActions(vehicleIndex, docSide) {
    return new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['查看', '重新上传', '删除'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            this.previewDrivingLicenseDocument(vehicleIndex, docSide)
          } else if (res.tapIndex === 1) {
            this.setData({ activeDrivingLicenseVehicleIndex: vehicleIndex })
            await this.openDrivingLicenseSourceSheet(docSide)
          } else if (res.tapIndex === 2) {
            this.confirmDeleteDrivingLicenseDocument(vehicleIndex, docSide)
          }
          resolve()
        },
        fail: () => resolve()
      })
    })
  },

  previewDrivingLicenseDocument(vehicleIndex, docSide) {
    const vehicle = this.data.vehicles[vehicleIndex]
    const current = vehicleDocuments.getDrivingLicenseDocumentBySide(vehicle, docSide)

    if (!current) return

    const urls = vehicleDocuments.getVehicleDocuments(vehicle)
      .filter((document) => document.docType === vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE)
      .map((document) => document.compressedPath)

    wx.previewImage({
      urls,
      current: current.compressedPath
    })
  },

  confirmDeleteDrivingLicenseDocument(vehicleIndex, docSide) {
    wx.showModal({
      title: '',
      content: `确定删除${getDrivingLicenseLabel(docSide)}吗？`,
      confirmText: '删除',
      confirmColor: '#D32F2F',
      success: (res) => {
        if (res.confirm) {
          storage.deleteVehicleDocument(
            vehicleIndex,
            vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE,
            docSide
          )
          this.loadData()
        }
      }
    })
  },

  openDrivingLicenseSourceSheet(docSide) {
    return new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['拍照', '从手机相册选择'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            await this.chooseDrivingLicenseImage(docSide, 'camera')
          } else if (res.tapIndex === 1) {
            await this.chooseDrivingLicenseImage(docSide, 'album')
          }
          resolve()
        },
        fail: () => resolve()
      })
    })
  },

  chooseDrivingLicenseImage(docSide, sourceType) {
    return new Promise((resolve) => {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: [sourceType],
        success: async (res) => {
          const file = res.tempFiles && res.tempFiles[0]
          if (!file || !file.tempFilePath) {
            resolve()
            return
          }

          wx.showLoading({ title: '处理中...' })
          let savedDocument = null

          try {
            const photo = await compress.compressImage(file.tempFilePath, {
              maxFileSize: DRIVING_LICENSE_MAX_FILE_SIZE
            })
            const timestamp = Date.now()

            savedDocument = storage.saveVehicleDocument(this.data.activeDrivingLicenseVehicleIndex, {
              docType: vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE,
              docSide,
              label: getDrivingLicenseLabel(docSide),
              sourceType,
              tempFilePath: file.tempFilePath,
              compressedPath: photo.compressedPath,
              size: file.size,
              compressedSize: photo.fileSize,
              createdAt: timestamp,
              updatedAt: timestamp
            })

            if (!savedDocument) {
              throw new Error('SAVE_VEHICLE_DOCUMENT_FAILED')
            }

            workflowPage.syncPageWorkflowState(this, workflow.STATES.PREVIEWING, {
              page: 'preview',
              pageAction: 'driving_license_saved'
            })

            this.loadData()
            wx.hideLoading()
          } catch (err) {
            wx.hideLoading()
            wx.showToast({ title: '处理失败', icon: 'none' })
            resolve(null)
            return
          }

          if (sourceType === 'camera') {
            try {
              await album.saveConfirmedPhotoToAlbum(savedDocument)
            } catch (err) {
              console.warn('[preview] save_driving_license_album_failed', err)
            }
          }

          resolve(savedDocument)
        },
        fail: () => resolve()
      })
    })
  },

  onPreview(e) {
    const { vehicle, type, damage, docType, docSide } = e.currentTarget.dataset
    const targetId = type === 'vehicleDocument'
      ? `${vehicle}-vehicleDocument-${docType}-${docSide}`
      : damage !== undefined
        ? `${vehicle}-${type}-${damage}`
        : `${vehicle}-${type}`
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

    if (photo.type === 'vehicleDocument') {
      this.setData({
        showPreview: false,
        activeDrivingLicenseVehicleIndex: photo.vehicle
      })
      this.openDrivingLicenseSourceSheet(photo.docSide)
      return
    }

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

    if (photo.type === 'vehicleDocument') {
      wx.showModal({
        title: '',
        content: `确定删除${getDrivingLicenseLabel(photo.docSide)}吗？`,
        confirmText: '删除',
        confirmColor: '#D32F2F',
        success: (res) => {
          if (res.confirm) {
            storage.deleteVehicleDocument(photo.vehicle, photo.docType, photo.docSide)
            this.setData({ showPreview: false })
            this.loadData()
          }
        }
      })
      return
    }

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

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    this.startSubmitFlow(cache)
  },

  startSubmitFlow(cache = storage.loadCache()) {
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    const vehicleSummary = cacheSelectors.getVehicleSummary(cache)

    if (vehicleSummary.canAddThirdVehicle) {
      this.setData({
        showModal: true,
        modalContent: '确认所有车辆损伤均已拍摄，无需增加其他三者车？',
        modalConfirmText: '是，继续提交',
        modalCancelText: '否，添加其他三者车',
        modalType: 'thirdVehicle'
      })
    } else {
      this.checkDrivingLicenseBeforeSubmit(cache)
    }
  },

  checkDrivingLicenseBeforeSubmit(cache = storage.loadCache()) {
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    if (vehicleDocuments.hasIncompleteDrivingLicenseVehicles(cache.vehicles)) {
      this.setData({
        showModal: true,
        modalContent: DRIVING_LICENSE_RISK_TIP,
        modalConfirmText: '确认提交',
        modalCancelText: '返回补充',
        modalType: 'drivingLicenseRisk'
      })
      return
    }

    this.submitComplete()
  },

  onModalConfirm() {
    const modalType = this.data.modalType
    this.setData({ showModal: false })
    if (modalType === 'drivingLicenseRisk') {
      this.submitComplete()
    } else if (modalType === 'thirdVehicle') {
      this.checkDrivingLicenseBeforeSubmit()
    }
  },

  onModalCancel() {
    const modalType = this.data.modalType
    this.setData({ showModal: false })
    if (modalType === 'thirdVehicle') {
      this.addThirdVehicle()
    }
  },

  onModalMaskTap() {
    this.setData({ showModal: false })
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
