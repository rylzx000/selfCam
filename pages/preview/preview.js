const storage = require('../../utils/storage')
const cacheSelectors = require('../../utils/cache-selectors')
const constants = require('../../utils/constants')
const compress = require('../../utils/compress')
const vehicleDocuments = require('../../utils/documents')
const album = require('../../utils/album')
const permission = require('../../utils/permission')
const workflow = require('../../utils/workflow-state')
const workflowPage = require('../../utils/workflow-page')
const envConfig = require('../../utils/env-config')
const runtimeLogger = require('../../utils/runtime-logger')
const {
  buildResponsiveStyle,
  normalizeLandscapeWindow,
  resolveResponsiveUiScale
} = require('../../utils/responsive-ui')

const DRIVING_LICENSE_MAX_FILE_SIZE = 400 * 1024
const DRIVING_LICENSE_RISK_TIP = '仍有车辆未上传行驶证，会影响定损金额准确性，建议上传。如确实无法提供，请后续联系案件处理人员补充。是否确认提交？'
const TOTAL_PHOTO_LIMIT_TIP = `最多${constants.LIMITS.MAX_TOTAL_PHOTOS}张，请先删除`

const ALBUM_SAVE_ALL_TIP = '是否保存全部图片至手机相册？建议保存，便于后续案件处理。'
const ALBUM_SAVE_NEW_TIP = '是否保存新增图片至手机相册？建议保存，便于后续案件处理。'

const PREVIEW_BASE_RPX_WIDTH = 750
const PREVIEW_BASE_RPX_HEIGHT = 390

function computeResponsivePreviewLayout(info = {}) {
  const {
    rawWindowWidth,
    rawWindowHeight,
    windowWidth,
    windowHeight,
    safeAreaWidth,
    safeAreaHeight,
    pixelRatio
  } = normalizeLandscapeWindow(info, 844, 390)
  const layoutScale = Math.max(Math.min(windowWidth / PREVIEW_BASE_RPX_WIDTH, windowHeight / PREVIEW_BASE_RPX_HEIGHT), 0.1)
  const {
    needsResponsiveUiScale,
    uiScale,
    uiScaleReason
  } = resolveResponsiveUiScale({ layoutScale, windowWidth, windowHeight, info })

  return {
    rawWindowWidth,
    rawWindowHeight,
    windowWidth,
    windowHeight,
    safeAreaWidth,
    safeAreaHeight,
    pixelRatio,
    layoutScale,
    needsResponsiveUiScale,
    uiScale,
    uiScaleReason,
    pageStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['padding-top', 24 * uiScale],
      ['padding-right', 30 * uiScale],
      ['padding-bottom', 22 * uiScale],
      ['padding-left', 30 * uiScale]
    ]),
    topbarStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['height', 54 * uiScale],
      ['min-height', 54 * uiScale],
      ['margin-bottom', 12 * uiScale]
    ]),
    titleStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['font-size', 28 * uiScale],
      ['line-height', 32 * uiScale]
    ]),
    subtitleStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['margin-top', 4 * uiScale],
      ['font-size', 14 * uiScale],
      ['line-height', 20 * uiScale]
    ]),
    gridViewStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['padding-bottom', 58 * uiScale]
    ]),
    vehicleSectionStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['min-height', 150 * uiScale],
      ['margin-bottom', 12 * uiScale],
      ['padding-top', 14 * uiScale],
      ['padding-right', 16 * uiScale],
      ['padding-bottom', 15 * uiScale],
      ['padding-left', 16 * uiScale],
      ['border-radius', 14 * uiScale]
    ]),
    vehicleHeaderStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['margin-bottom', 12 * uiScale]
    ]),
    vehicleTitleStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['font-size', 18 * uiScale],
      ['line-height', 22 * uiScale]
    ]),
    vehicleTagStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['height', 22 * uiScale],
      ['margin-left', 10 * uiScale],
      ['padding-right', 9 * uiScale],
      ['padding-left', 9 * uiScale],
      ['font-size', 12 * uiScale],
      ['line-height', 22 * uiScale]
    ]),
    deleteButtonStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['height', 26 * uiScale],
      ['padding-right', 10 * uiScale],
      ['padding-left', 10 * uiScale],
      ['border-radius', 8 * uiScale],
      ['font-size', 12 * uiScale],
      ['line-height', 26 * uiScale]
    ]),
    photoGridStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['gap', 10 * uiScale]
    ]),
    photoItemStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['width', 112 * uiScale],
      ['flex-basis', 112 * uiScale]
    ]),
    thumbStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['width', 112 * uiScale],
      ['height', 72 * uiScale],
      ['border-radius', 9 * uiScale]
    ]),
    thumbImageStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['width', 112 * uiScale],
      ['height', 72 * uiScale]
    ]),
    captureBadgeStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['top', 5 * uiScale],
      ['right', 5 * uiScale],
      ['height', 16 * uiScale],
      ['padding-right', 6 * uiScale],
      ['padding-left', 6 * uiScale],
      ['font-size', 10 * uiScale],
      ['line-height', 16 * uiScale]
    ]),
    checkStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['right', 5 * uiScale],
      ['bottom', 5 * uiScale],
      ['width', 18 * uiScale],
      ['height', 18 * uiScale],
      ['font-size', 12 * uiScale],
      ['line-height', 18 * uiScale]
    ]),
    photoLabelStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['margin-top', 6 * uiScale],
      ['font-size', 13 * uiScale],
      ['line-height', 16 * uiScale]
    ]),
    plusStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['font-size', 32 * uiScale]
    ]),
    plusCircleStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['width', 28 * uiScale],
      ['height', 28 * uiScale],
      ['font-size', 22 * uiScale],
      ['line-height', 28 * uiScale]
    ]),
    uploadLicenseTextStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['margin-top', 5 * uiScale],
      ['font-size', 13 * uiScale],
      ['line-height', 16 * uiScale]
    ]),
    bottomBarStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['left', 30 * uiScale],
      ['right', 30 * uiScale],
      ['bottom', 20 * uiScale],
      ['height', 44 * uiScale],
      ['padding-right', 12 * uiScale],
      ['padding-left', 16 * uiScale],
      ['border-radius', 12 * uiScale]
    ]),
    tipIconStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['width', 20 * uiScale],
      ['height', 20 * uiScale],
      ['font-size', 13 * uiScale],
      ['line-height', 20 * uiScale]
    ]),
    tipTextStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['font-size', 13 * uiScale],
      ['line-height', 18 * uiScale]
    ]),
    bottomActionsStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['gap', 10 * uiScale]
    ]),
    primaryButtonStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['height', 32 * uiScale],
      ['min-width', 108 * uiScale],
      ['border-radius', 9 * uiScale],
      ['font-size', 13 * uiScale]
    ]),
    licensePanelStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['width', 430 * uiScale],
      ['padding-top', 18 * uiScale],
      ['padding-right', 20 * uiScale],
      ['padding-bottom', 20 * uiScale],
      ['padding-left', 20 * uiScale],
      ['border-radius', 14 * uiScale]
    ]),
    licensePanelHeaderStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['margin-bottom', 16 * uiScale]
    ]),
    licensePanelTitleStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['font-size', 20 * uiScale],
      ['line-height', 24 * uiScale]
    ]),
    licensePanelCloseStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['width', 28 * uiScale],
      ['height', 28 * uiScale],
      ['font-size', 20 * uiScale],
      ['line-height', 28 * uiScale]
    ]),
    licenseUploadRowStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['gap', 12 * uiScale]
    ]),
    licenseUploadSlotStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['height', 104 * uiScale],
      ['border-radius', 10 * uiScale]
    ]),
    slotImageStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['width', 76 * uiScale],
      ['height', 44 * uiScale],
      ['border-radius', 7 * uiScale]
    ]),
    slotTitleStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['margin-top', 8 * uiScale],
      ['font-size', 14 * uiScale],
      ['line-height', 18 * uiScale]
    ]),
    slotSubtitleStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['margin-top', 3 * uiScale],
      ['font-size', 11 * uiScale],
      ['line-height', 14 * uiScale]
    ]),
    licenseSwitchStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['margin-top', 14 * uiScale],
      ['height', 30 * uiScale],
      ['font-size', 13 * uiScale],
      ['line-height', 30 * uiScale]
    ]),
    previewHeaderStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['height', 44 * uiScale],
      ['padding-right', 16 * uiScale],
      ['padding-left', 16 * uiScale]
    ]),
    previewTextButtonStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['font-size', 14 * uiScale],
      ['padding-top', 6 * uiScale],
      ['padding-right', 12 * uiScale],
      ['padding-bottom', 6 * uiScale],
      ['padding-left', 12 * uiScale]
    ]),
    previewCountStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['font-size', 14 * uiScale]
    ]),
    previewLabelStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['top', 44 * uiScale],
      ['font-size', 14 * uiScale]
    ]),
    previewModeTagStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['top', 66 * uiScale],
      ['font-size', 12 * uiScale],
      ['padding-top', 6 * uiScale],
      ['padding-right', 12 * uiScale],
      ['padding-bottom', 6 * uiScale],
      ['padding-left', 12 * uiScale],
      ['border-radius', 14 * uiScale]
    ]),
    previewFooterStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['height', 50 * uiScale],
      ['gap', 40 * uiScale]
    ]),
    previewButtonStyle: buildResponsiveStyle(needsResponsiveUiScale, [
      ['font-size', 14 * uiScale],
      ['padding-top', 8 * uiScale],
      ['padding-right', 24 * uiScale],
      ['padding-bottom', 8 * uiScale],
      ['padding-left', 24 * uiScale],
      ['border-radius', 6 * uiScale]
    ])
  }
}

function getWindowInfoSnapshot() {
  let systemInfo = {}
  let windowInfo = {}

  try {
    if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
      systemInfo = wx.getSystemInfoSync() || {}
    }
  } catch (error) {
    // 使用默认横屏尺寸兜底
  }

  try {
    if (typeof wx !== 'undefined' && typeof wx.getWindowInfo === 'function') {
      windowInfo = wx.getWindowInfo() || {}
    }
  } catch (error) {
    // 使用系统信息兜底
  }

  return {
    ...systemInfo,
    ...windowInfo,
    safeArea: windowInfo.safeArea || systemInfo.safeArea
  }
}

function getRemainingTotalPhotoCount(cache) {
  const summary = cacheSelectors.getCacheSummary(cache)
  return Math.max(constants.LIMITS.MAX_TOTAL_PHOTOS - summary.totalPhotos, 0)
}

function canAddNewPhoto(cache) {
  return getRemainingTotalPhotoCount(cache) > 0
}

function showTotalPhotoLimitToast() {
  wx.showToast({
    title: TOTAL_PHOTO_LIMIT_TIP,
    icon: 'none'
  })
}

function buildDrivingLicensePreview(vehicle, index) {
  return {
    ...vehicle,
    previewName: vehicle.displayName || (index === 0 ? '您的车' : `其他出险车辆 ${index}`),
    previewTag: vehicle.vehicleRoleName || (index === 0 ? '标的车' : '三者车'),
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
    workflowState: workflow.STATES.IDLE,
    previewLayout: computeResponsivePreviewLayout()
  },

  isLeaving: false,

  onLoad() {
    this.isLeaving = false
    this.updateAppEnvBadge()
    this.updatePreviewLayout('on_load')
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
    this.updatePreviewLayout('on_show')

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

  computePreviewLayout(info = {}) {
    return computeResponsivePreviewLayout(info)
  },

  updatePreviewLayout(reason = 'manual', info = null) {
    const windowInfo = info || getWindowInfoSnapshot()
    const previewLayout = this.computePreviewLayout(windowInfo)
    this.setData({ previewLayout })
    this.logPreviewLayoutSnapshot(previewLayout, reason)
  },

  getFeedbackId() {
    const sessionId = runtimeLogger.getSessionId ? runtimeLogger.getSessionId() : ''
    return sessionId ? `selfCam_${sessionId}` : ''
  },

  roundLogNumber(value) {
    return Number.isFinite(value) ? Number(value.toFixed(4)) : value
  },

  logPreviewLayoutSnapshot(previewLayout = {}, reason = 'layout') {
    const layoutLogKey = `${reason}:${previewLayout.windowWidth}x${previewLayout.windowHeight}:${previewLayout.needsResponsiveUiScale}`
    if (this.previewLayoutRealtimeLogKey === layoutLogKey) {
      return
    }
    this.previewLayoutRealtimeLogKey = layoutLogKey

    runtimeLogger.forceWarn('ai', 'preview_layout_snapshot', {
      feedbackId: this.getFeedbackId(),
      reason,
      ...getWindowInfoSnapshot(),
      rawWindowWidth: previewLayout.rawWindowWidth,
      rawWindowHeight: previewLayout.rawWindowHeight,
      windowWidth: previewLayout.windowWidth,
      windowHeight: previewLayout.windowHeight,
      safeAreaWidth: previewLayout.safeAreaWidth,
      safeAreaHeight: previewLayout.safeAreaHeight,
      pixelRatio: previewLayout.pixelRatio,
      layoutScale: this.roundLogNumber(previewLayout.layoutScale || 0),
      uiScale: this.roundLogNumber(previewLayout.uiScale || 0),
      uiScaleReason: previewLayout.uiScaleReason || '',
      needsResponsiveUiScale: !!previewLayout.needsResponsiveUiScale
    })
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
      const cacheBeforeChoose = storage.loadCache()

      if (!cacheBeforeChoose) {
        this.isLeaving = true
        wx.redirectTo({ url: '/pages/index/index' })
        resolve(null)
        return
      }

      const activeVehicle = cacheBeforeChoose.vehicles[this.data.activeDrivingLicenseVehicleIndex]
      const existingDocument = vehicleDocuments.getDrivingLicenseDocumentBySide(activeVehicle, docSide)

      if (!existingDocument && !canAddNewPhoto(cacheBeforeChoose)) {
        showTotalPhotoLimitToast()
        resolve(null)
        return
      }

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

    if (!canAddNewPhoto(cache)) {
      showTotalPhotoLimitToast()
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

    this.checkAlbumSaveBeforeSubmit(cache)
  },

  checkAlbumSaveBeforeSubmit(cache = storage.loadCache()) {
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    const candidates = cacheSelectors.getAlbumSaveCandidates(cache)
    if (candidates.length === 0) {
      this.submitComplete()
      return
    }

    const hasSavedRecords = Object.keys(cache.albumSaveRecords || {}).some((key) => {
      const record = cache.albumSaveRecords[key]
      return record && record.status === 'saved'
    })

    this.albumSaveCandidates = candidates
    this.setData({
      showModal: true,
      modalContent: hasSavedRecords ? ALBUM_SAVE_NEW_TIP : ALBUM_SAVE_ALL_TIP,
      modalConfirmText: '保存至手机',
      modalCancelText: '暂不保存',
      modalType: 'albumSaveConfirm'
    })
  },

  buildAlbumSaveSummary(decision, total, saved = 0, failed = 0, permissionDenied = 0) {
    return {
      decision,
      total,
      saved,
      failed,
      permissionDenied,
      updatedAt: new Date().toISOString()
    }
  },

  saveAlbumSummary(summary) {
    const cache = storage.loadCache()
    if (!cache) return false

    cache.albumSaveRecords = cache.albumSaveRecords || {}
    cache.albumSaveSummary = summary
    storage.saveCache(cache)
    return true
  },

  getAlbumSaveDecision(result) {
    if (!result || result.total <= 0) {
      return 'none'
    }

    if (result.saved === result.total) {
      return 'saved'
    }

    if (result.permissionDenied > 0 && result.saved === 0) {
      return 'permission_denied'
    }

    if (result.saved > 0 && result.failed > 0) {
      return 'partial'
    }

    return 'failed'
  },

  persistAlbumSaveResult(result) {
    const cache = storage.loadCache()
    if (!cache) return false

    const savedAt = new Date().toISOString()
    cache.albumSaveRecords = cache.albumSaveRecords || {}

    ;(result.results || []).forEach((item) => {
      if (!item || !item.localPhotoId) {
        return
      }

      const status = item.saved
        ? 'saved'
        : item.reason === 'permission_denied'
          ? 'permission_denied'
          : 'failed'

      cache.albumSaveRecords[item.localPhotoId] = {
        status,
        filePath: item.filePath || '',
        savedAt: item.saved ? savedAt : '',
        reason: item.reason || ''
      }
    })

    cache.albumSaveSummary = this.buildAlbumSaveSummary(
      this.getAlbumSaveDecision(result),
      result.total || 0,
      result.saved || 0,
      result.failed || 0,
      result.permissionDenied || 0
    )
    storage.saveCache(cache)
    return true
  },

  buildFailedAlbumSaveResult(candidates, reason) {
    return {
      total: candidates.length,
      saved: 0,
      failed: candidates.length,
      permissionDenied: reason === 'permission_denied' ? candidates.length : 0,
      results: candidates.map((candidate) => ({
        localPhotoId: candidate.localPhotoId,
        filePath: candidate.filePath,
        saved: false,
        reason
      }))
    }
  },

  skipAlbumSaveAndComplete() {
    const candidates = this.albumSaveCandidates || cacheSelectors.getAlbumSaveCandidates(storage.loadCache())
    this.saveAlbumSummary(this.buildAlbumSaveSummary(
      'skipped',
      candidates.length,
      0,
      0,
      0
    ))
    this.submitComplete()
  },

  async saveAlbumCandidatesAndComplete() {
    const cache = storage.loadCache()
    const candidates = cacheSelectors.getAlbumSaveCandidates(cache)

    if (candidates.length === 0) {
      this.submitComplete()
      return
    }

    const granted = await permission.ensureAlbumSavePermission()
    if (!granted) {
      this.persistAlbumSaveResult(this.buildFailedAlbumSaveResult(candidates, 'permission_denied'))
      this.submitComplete()
      return
    }

    let result
    try {
      wx.showLoading({ title: '正在保存照片...' })
      result = await album.savePhotosToAlbumBatch(candidates)
    } catch (err) {
      console.warn('[preview] batch_album_save_failed', err)
      result = this.buildFailedAlbumSaveResult(candidates, 'exception')
    } finally {
      wx.hideLoading()
    }

    this.persistAlbumSaveResult(result)
    this.submitComplete()
  },

  async onModalConfirm() {
    const modalType = this.data.modalType
    this.setData({ showModal: false })
    if (modalType === 'drivingLicenseRisk') {
      this.checkAlbumSaveBeforeSubmit()
    } else if (modalType === 'thirdVehicle') {
      this.checkDrivingLicenseBeforeSubmit()
    } else if (modalType === 'albumSaveConfirm') {
      await this.saveAlbumCandidatesAndComplete()
    }
  },

  onModalCancel() {
    const modalType = this.data.modalType
    this.setData({ showModal: false })
    if (modalType === 'thirdVehicle') {
      this.addThirdVehicle()
    } else if (modalType === 'albumSaveConfirm') {
      this.skipAlbumSaveAndComplete()
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

    const cacheBeforeChoose = storage.loadCache()
    if (!cacheBeforeChoose) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    if (!canAddNewPhoto(cacheBeforeChoose)) {
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
