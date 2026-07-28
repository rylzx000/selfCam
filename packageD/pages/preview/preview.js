const storage = require('../../utils/storage')
const cacheSelectors = require('../../utils/cache-selectors')
const constants = require('../../utils/constants')
const compress = require('../../utils/compress')
const vehicleDocuments = require('../../utils/documents')
const album = require('../../utils/album')
const permission = require('../../utils/permission')
const workflow = require('../../utils/workflow-state')
const workflowPage = require('../../utils/workflow-page')
const uploadState = require('../../utils/upload-state')
const auxPhotoApi = require('../../utils/aux-photo-api')
const envConfig = require('../../utils/env-config')
const runtimeLogger = require('../../utils/runtime-logger')
const {
  buildResponsiveStyle,
  normalizeLandscapeWindow,
  resolveResponsiveUiScale
} = require('../../utils/responsive-ui')

const DRIVING_LICENSE_MAX_FILE_SIZE = 400 * 1024
const MAX_DAMAGES = (constants.LIMITS && constants.LIMITS.MAX_DAMAGES) || 5
const DAMAGE_PHOTO_LIMIT_TIP = `最多${MAX_DAMAGES}张车损，请先删除`
const DRIVING_LICENSE_RISK_TIP = '证件信息不全，建议补充驾驶证和行驶证。如确实无法提供，可后续通过其他方式提供。是否确认提交？'
const TOTAL_PHOTO_LIMIT_TIP = `最多${constants.LIMITS.MAX_TOTAL_PHOTOS}张，请先删除`
const AUX_VEHICLE_LOCKED_TIP = '辅助拍照车辆以后台为准'
const AUX_UPLOAD_ITEM_MISSING_TIP = '当前任务未下发该证件类型'
const MODULE_ONE_MISSING_SCENE_TIP = '现场照片未采集，建议补拍，便于记录事故现场和车辆整体状态。'
const SCENE_SUPPLEMENT_PROMPT_CONTENT = '是否补充其他现场环境或道路相关损失？\n\n如护栏、灯杆、路牌、路面痕迹等'

const ALBUM_SAVE_ALL_TIP = '是否保存全部图片至手机相册？建议保存，便于后续案件处理。'
const ALBUM_SAVE_NEW_TIP = '是否保存新增图片至手机相册？建议保存，便于后续案件处理。'
const AUTO_COMPLETE_DELAY_MS = 1500
const CAPTURE_RETURN_STRATEGY = constants.CAPTURE_RETURN_STRATEGY || {
  CONTINUE_MODULE_ONE: 'continueModuleOne',
  CONTINUE_DAMAGE: 'continueDamage',
  RETURN_PREVIEW: 'returnPreview'
}
const CAPTURE_PREVIEW_SOURCE = constants.CAPTURE_PREVIEW_SOURCE || {
  MODULE_ONE: 'moduleOneCapture',
  MODULE_TWO: 'moduleTwoCapture'
}

const TICKET_BLOCKED_MESSAGES = {
  COMPLETED: '照片已完成采集，请勿重复操作。',
  EXPIRED: '辅助拍照链接已过期，请联系查勘员重新发送链接。',
  REVOKED: '辅助拍照链接已作废，请联系查勘员重新发送链接。'
}

const PREVIEW_MODES = ['moduleOne', 'moduleTwo', 'moduleThree', 'final']
const PREVIEW_MODE_TITLES = {
  moduleOne: '现场环境及车辆信息',
  moduleTwo: '车损照片预览',
  moduleThree: '证件信息',
  final: '最终总预览'
}
const PREVIEW_MODE_SUBTITLES = {
  moduleOne: '请确认现场环境照片和车辆识别信息',
  moduleTwo: '请确认各车辆车损照片',
  moduleThree: '按车辆补充驾驶证和行驶证，可缺失继续',
  final: '提交前统一确认全部采集内容'
}
const PREVIEW_BASE_RPX_WIDTH = 750
const PREVIEW_BASE_RPX_HEIGHT = 390

function normalizePreviewMode(mode) {
  return PREVIEW_MODES.indexOf(mode) >= 0 ? mode : ''
}

function isCachePreviewing(cache = {}) {
  const state = cache.workflowState
  const current = typeof state === 'string' ? state : state && state.current
  return current === workflow.STATES.PREVIEWING || current === 'PREVIEWING'
}

function inferPreviewModeFromCache(cache = {}) {
  const step = cache && cache.currentStep

  if (step === constants.SHOOT_STEP.MODULE_ONE_PREVIEW) {
    return 'moduleOne'
  }

  if (step === constants.SHOOT_STEP.DAMAGE && isCachePreviewing(cache)) {
    return 'moduleTwo'
  }

  if (step === constants.SHOOT_STEP.MODULE_THREE) {
    return 'moduleThree'
  }

  if (step === constants.SHOOT_STEP.FINAL_PREVIEW
    || step === constants.SHOOT_STEP.PREVIEW
    || (cache && cache.uploadSession)) {
    return 'final'
  }

  return 'final'
}

function normalizeTicketStatusFromCache(cache) {
  const rawStatus = cache && cache.auxPhoto && cache.auxPhoto.ticketStatus
  if (typeof rawStatus === 'undefined' || rawStatus === null) {
    return ''
  }

  return String(rawStatus).trim().toUpperCase()
}

function isTicketBlocked(status) {
  return !!TICKET_BLOCKED_MESSAGES[status]
}

function getTicketBlockedMessage(status) {
  return TICKET_BLOCKED_MESSAGES[status] || ''
}

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

function getVehicleDamageCount(vehicle) {
  return Array.isArray(vehicle && vehicle.damages) ? vehicle.damages.length : 0
}

function showDamagePhotoLimitToast() {
  wx.showToast({
    title: DAMAGE_PHOTO_LIMIT_TIP,
    icon: 'none'
  })
}

function buildDrivingLicensePreview(vehicle, index) {
  return {
    ...vehicle,
    previewName: vehicle.displayName || (index === 0 ? '您的车' : `其他出险车辆 ${index}`),
    previewTag: vehicle.vehicleRoleName || (index === 0 ? '标的车' : '三者车'),
    drivingLicensePreview: vehicleDocuments.buildDrivingLicensePreview(vehicle),
    vehicleDocumentPreview: vehicleDocuments.buildVehicleDocumentPreview(vehicle)
  }
}

function getVehicleDocumentLabel(docType, docSide) {
  return vehicleDocuments.getVehicleDocumentLabel(docType, docSide)
}

function getVehicleDocumentBaseLabel(docType) {
  return docType === vehicleDocuments.DOCUMENT_TYPES.DRIVER_LICENSE ? '驾驶证' : '行驶证'
}

function getCurrentPreviewReturnMode(data = {}) {
  if (data.isFinalPreview) return 'final'
  if (data.isModuleThreePreview) return 'moduleThree'
  if (data.isModuleTwoPreview) return 'moduleTwo'
  if (data.isModuleOnePreview) return 'moduleOne'
  return ''
}

function isModuleOneRequiredShootStep(step) {
  return step === constants.SHOOT_STEP.SCENE_45
    || step === constants.SHOOT_STEP.LICENSE_PLATE
    || step === constants.SHOOT_STEP.VIN_CODE
}

function isTemporaryModuleOnePreview(cache = {}, data = {}) {
  return !!(
    data.isModuleOnePreview
    && cache.capturePreviewSource === CAPTURE_PREVIEW_SOURCE.MODULE_ONE
  )
}

function getModuleOneCaptureReturnStrategy(cache = {}, data = {}, nextStep = '', sourceStep = cache.currentStep) {
  if (
    isTemporaryModuleOnePreview({ ...cache, currentStep: sourceStep }, data)
    && isModuleOneRequiredShootStep(nextStep)
  ) {
    return CAPTURE_RETURN_STRATEGY.CONTINUE_MODULE_ONE
  }

  return CAPTURE_RETURN_STRATEGY.RETURN_PREVIEW
}

function getDamageCaptureReturnStrategy(data = {}) {
  return data.isModuleTwoPreview
    ? CAPTURE_RETURN_STRATEGY.CONTINUE_DAMAGE
    : CAPTURE_RETURN_STRATEGY.RETURN_PREVIEW
}

function clearModuleTwoDamageEntryContext(cache = {}) {
  cache.fromPreview = false
  delete cache.captureReturnStrategy
  delete cache.capturePreviewSource
  delete cache.sceneSupplementIndex
  cache.retakeMode = {
    enabled: false,
    vehicleIndex: null,
    photoType: null,
    damageIndex: null
  }
  return cache
}

function isAuxPhotoEnabled(cache) {
  return !!(cache && cache.auxPhoto && cache.auxPhoto.enabled === true)
}

function isVehicleDocumentMode(value) {
  return value === vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC
    || value === vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL
}

function getVehicleDocumentPanelMode(vehicle, docType) {
  const currentSelection = vehicle && vehicle.documentSelections && vehicle.documentSelections[docType]
  const hasDocumentRecord = vehicleDocuments.getVehicleDocuments(vehicle)
    .some((document) => document.docType === docType)

  if (hasDocumentRecord && isVehicleDocumentMode(currentSelection)) {
    return currentSelection
  }

  return vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC
}

function getVehicleDocumentPanelModeBySide(docSide) {
  return docSide === vehicleDocuments.DOCUMENT_SIDES.ELECTRONIC
    ? vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC
    : docSide === vehicleDocuments.DOCUMENT_SIDES.FRONT_PAGE || docSide === vehicleDocuments.DOCUMENT_SIDES.BACK_PAGE
      ? vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL
      : ''
}

function buildHandoffProgress(items) {
  return items.map((text) => ({ text }))
}

function isModuleOneMainComplete(moduleOneSummary = {}) {
  return !!(
    moduleOneSummary.hasScene45
    && Array.isArray(moduleOneSummary.vehicles)
    && moduleOneSummary.vehicles.length > 0
    && moduleOneSummary.vehicles.every((vehicle) => vehicle.hasLicensePlate && vehicle.hasVinCode)
  )
}

Page({
  data: {
    isModuleOnePreview: false,
    isModuleTwoPreview: false,
    isModuleThreePreview: false,
    isFinalPreview: false,
    pageTitle: '照片预览',
    pageSubtitle: '请确认照片清晰，并按车辆补充证件信息',
    moduleOneSummary: {
      sceneSlots: [],
      vehicles: [],
      hasScene45: false,
      supplementCount: 0,
      remainingSupplementCount: 0,
      canAddSceneSupplement: true,
      scenePhotoCount: 0
    },
    vehicles: [],
    documents: [],
    totalPhotoCount: 0,
    maxTotalPhotos: constants.LIMITS.MAX_TOTAL_PHOTOS,
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
    drivingLicenseMode: 'electronic',
    activeDrivingLicenseDocType: vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE,
    activeDrivingLicenseTitle: '行驶证',
    activeDrivingLicenseVehicleIndex: null,
    activeDrivingLicenseSlots: [],
    appEnvBadgeText: '',
    showUploadOverlay: false,
    showModuleOneHandoff: false,
    moduleOneHandoffTitle: '现场环境及车辆信息已保存',
    moduleOneHandoffProgress: buildHandoffProgress([
      '已完成：现场环境及车辆信息',
      '下一步：车损照片拍摄',
      '未完成：证件信息'
    ]),
    moduleHandoffConfirmText: '进入车损拍摄',
    moduleHandoffTarget: 'damage',
    uploadOverlayTitle: '',
    uploadOverlayDesc: '',
    uploadOverlayProgressText: '',
    uploadOverlayProgressPercent: '',
    uploadOverlayProgressStyle: '',
    uploadOverlayCurrentText: '',
    uploadOverlayPrimaryText: '',
    uploadOverlayPrimaryVisible: false,
    uploadOverlayPrimaryMode: 'primary',
    workflowState: workflow.STATES.IDLE,
    previewLayout: computeResponsivePreviewLayout()
  },

  isLeaving: false,
  isRedirectingToComplete: false,
  isReturningFromPreviewFlow: false,
  uploadRunnerSessionId: '',
  uploadFlowPromise: null,
  completeFlowPromise: null,
  completeAutoTimerId: null,
  completeAutoTimerSessionId: '',

  getBlockedTicketStatus(cache) {
    const ticketStatus = normalizeTicketStatusFromCache(cache)
    return isTicketBlocked(ticketStatus) ? ticketStatus : ''
  },

  showTicketBlockedToast(status) {
    const message = getTicketBlockedMessage(status)
    if (message && typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
      wx.showToast({ title: message, icon: 'none' })
    }
  },

  blockIfTicketBlocked(cache = storage.loadCache()) {
    const ticketStatus = this.getBlockedTicketStatus(cache)
    if (!ticketStatus) {
      return false
    }

    this.showTicketBlockedToast(ticketStatus)
    return true
  },

  onLoad(options = {}) {
    this.isRedirectingToComplete = false
    this.isLeaving = false
    this.isReturningFromPreviewFlow = false
    this.applyPreviewMode(options)
    this.updateAppEnvBadge()
    this.updatePreviewLayout('on_load')
    const cache = storage.loadCacheForResume()
    if (cache && !cache.uploadSession) {
      workflowPage.syncPageWorkflowState(this, workflow.STATES.PREVIEWING, {
        page: 'preview'
      })
    }
    this.loadData()
  },

  applyPreviewMode(options = {}) {
    const cache = storage.loadCache()
    const effectiveMode = normalizePreviewMode(options.mode) || inferPreviewModeFromCache(cache)

    this.setData({
      isModuleOnePreview: effectiveMode === 'moduleOne',
      isModuleTwoPreview: effectiveMode === 'moduleTwo',
      isModuleThreePreview: effectiveMode === 'moduleThree',
      isFinalPreview: effectiveMode === 'final',
      pageTitle: PREVIEW_MODE_TITLES[effectiveMode] || '最终总预览',
      pageSubtitle: PREVIEW_MODE_SUBTITLES[effectiveMode] || '提交前统一确认全部采集内容'
    })
  },

  onShow() {
    if (this.isRedirectingToComplete) {
      return
    }

    this.isLeaving = false
    this.updateAppEnvBadge()
    this.updatePreviewLayout('on_show')

    const cache = storage.loadCacheForResume()
    const flowContext = cacheSelectors.getCurrentFlowContext(cache)
    this.isReturningFromPreviewFlow = !!(cache && flowContext.fromPreview)

    if (cache && flowContext.fromPreview) {
      storage.saveCache(storage.clearPreviewFlags(cache))
    }

    if (cache && !cache.uploadSession) {
      workflowPage.syncPageWorkflowState(this, workflow.STATES.PREVIEWING, {
        page: 'preview'
      })
    }
    this.loadData()
  },

  onHide() {
  },

  onUnload() {
    this.clearUploadMockTimer()
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
    const flowContext = cacheSelectors.getCurrentFlowContext(cache)
    const promptFlowContext = this.isReturningFromPreviewFlow
      ? { ...flowContext, fromPreview: true }
      : flowContext

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    const vehicles = summary.vehicles.map(buildDrivingLicensePreview)
    const activeVehicle = vehicles[this.data.activeDrivingLicenseVehicleIndex]
    const activeDocType = this.data.activeDrivingLicenseDocType || vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE
    const drivingLicenseMode = activeVehicle
      ? vehicleDocuments.getVehicleDocumentSelection(activeVehicle, activeDocType)
      : this.data.drivingLicenseMode

    const allPhotos = this.data.isModuleTwoPreview
      ? summary.allPhotos.filter((photo) => photo.type === constants.PHOTO_TYPE.DAMAGE)
      : this.data.isModuleThreePreview
        ? summary.allPhotos.filter((photo) => photo.type === 'vehicleDocument')
      : summary.allPhotos

    this.setData({
      vehicles,
      documents: summary.documents,
      moduleOneSummary: summary.moduleOneSummary,
      allPhotos,
      totalPhotoCount: summary.totalPhotos,
      progress: summary.progress,
      canAddThirdVehicle: summary.canAddThirdVehicle,
      drivingLicenseMode,
      activeDrivingLicenseTitle: getVehicleDocumentBaseLabel(activeDocType),
      activeDrivingLicenseSlots: activeVehicle
        ? vehicleDocuments.buildVehicleDocumentSlots(activeVehicle, activeDocType, drivingLicenseMode)
        : []
    })

    this.restoreUploadOverlay(cache)
    this.showSceneSupplementPromptIfNeeded(cache, summary.moduleOneSummary, promptFlowContext)
    this.isReturningFromPreviewFlow = false
  },

  shouldShowSceneSupplementPrompt(cache, moduleOneSummary, flowContext) {
    return !!(
      this.data.isModuleOnePreview
      && cache
      && cache.sceneSupplementPromptShown !== true
      && !(flowContext && flowContext.fromPreview)
      && !(cache.retakeMode && cache.retakeMode.enabled)
      && isModuleOneMainComplete(moduleOneSummary)
    )
  },

  showSceneSupplementPromptIfNeeded(cache, moduleOneSummary, flowContext) {
    if (!this.shouldShowSceneSupplementPrompt(cache, moduleOneSummary, flowContext)) {
      return false
    }

    this.setData({
      showModal: true,
      modalContent: SCENE_SUPPLEMENT_PROMPT_CONTENT,
      modalConfirmText: '去拍摄',
      modalCancelText: '没有了',
      modalType: 'sceneSupplementPrompt'
    })
    return true
  },

  markSceneSupplementPromptShown(cache = storage.loadCache()) {
    if (!cache) {
      return null
    }

    cache.sceneSupplementPromptShown = true
    storage.saveCache(cache)
    return cache
  },

  enterSceneSupplementCapture(cache = storage.loadCache()) {
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return false
    }

    const supplements = cache.scenePhotos && Array.isArray(cache.scenePhotos.supplements)
      ? cache.scenePhotos.supplements
      : []
    const targetIndex = supplements.length

    if (targetIndex >= constants.LIMITS.MAX_SCENE_SUPPLEMENTS) {
      wx.showToast({ title: `现场补充照片最多${constants.LIMITS.MAX_SCENE_SUPPLEMENTS}张`, icon: 'none' })
      return false
    }

    cache.currentStep = constants.SHOOT_STEP.SCENE_SUPPLEMENT
    cache.sceneSupplementIndex = targetIndex
    cache.fromPreview = true
    this.goToCameraWithCache(cache)
    return true
  },

  getUploadCurrentItem(session) {
    const items = Array.isArray(session && session.items) ? session.items : []

    if (session && session.phase === uploadState.UPLOAD_PHASE.FAILED) {
      return items.find((item) => item.status === uploadState.UPLOAD_ITEM_STATUS.FAILED) || null
    }

    const activeItem = items.find((item) => item.status === uploadState.UPLOAD_ITEM_STATUS.UPLOADING)
    if (activeItem) {
      return activeItem
    }

    return items.find((item) => item.status === uploadState.UPLOAD_ITEM_STATUS.PENDING)
      || items[items.length - 1]
      || null
  },

  buildUploadOverlayData(session) {
    const total = session && Number.isFinite(session.total) ? session.total : 0
    const uploaded = session && Number.isFinite(session.uploaded) ? session.uploaded : 0
    const percent = total > 0 ? Math.round((uploaded / total) * 100) : 0
    const currentItem = this.getUploadCurrentItem(session)
    const phase = session && session.phase
    const complete = session && session.complete

    if (phase === uploadState.UPLOAD_PHASE.READY) {
      return {
        showUploadOverlay: true,
        uploadOverlayTitle: '照片上传完成',
        uploadOverlayDesc: '照片已上传成功，正在准备完成提交。',
        uploadOverlayProgressText: `已上传 ${uploaded}/${total}`,
        uploadOverlayProgressPercent: `${percent}%`,
        uploadOverlayProgressStyle: `width: ${percent}%`,
        uploadOverlayCurrentText: '即将确认采集完成',
        uploadOverlayPrimaryText: '',
        uploadOverlayPrimaryVisible: false,
        uploadOverlayPrimaryMode: 'primary'
      }
    }

    if (phase === uploadState.UPLOAD_PHASE.COMPLETING) {
      return {
        showUploadOverlay: true,
        uploadOverlayTitle: '正在完成提交',
        uploadOverlayDesc: '照片已上传，请保持小程序打开。',
        uploadOverlayProgressText: `已上传 ${uploaded}/${total}`,
        uploadOverlayProgressPercent: `${percent}%`,
        uploadOverlayProgressStyle: `width: ${percent}%`,
        uploadOverlayCurrentText: '正在确认采集完成',
        uploadOverlayPrimaryText: '',
        uploadOverlayPrimaryVisible: false,
        uploadOverlayPrimaryMode: 'primary'
      }
    }

    if (phase === uploadState.UPLOAD_PHASE.COMPLETE_FAILED) {
      return {
        showUploadOverlay: true,
        uploadOverlayTitle: '完成提交失败',
        uploadOverlayDesc: '照片已上传成功，请重试完成提交。',
        uploadOverlayProgressText: `已上传 ${uploaded}/${total}`,
        uploadOverlayProgressPercent: `${percent}%`,
        uploadOverlayProgressStyle: `width: ${percent}%`,
        uploadOverlayCurrentText: complete && complete.lastErrorMessage
          ? `完成失败：${complete.lastErrorMessage}`
          : '完成提交失败',
        uploadOverlayPrimaryText: '重试完成',
        uploadOverlayPrimaryVisible: true,
        uploadOverlayPrimaryMode: 'danger'
      }
    }

    if (phase === uploadState.UPLOAD_PHASE.COMPLETED) {
      return {
        showUploadOverlay: true,
        uploadOverlayTitle: '采集提交完成',
        uploadOverlayDesc: '采集已完成，请点击完成查看汇总。',
        uploadOverlayProgressText: `已上传 ${uploaded}/${total}`,
        uploadOverlayProgressPercent: `${percent}%`,
        uploadOverlayProgressStyle: `width: ${percent}%`,
        uploadOverlayCurrentText: '采集已完成',
        uploadOverlayPrimaryText: '完成',
        uploadOverlayPrimaryVisible: true,
        uploadOverlayPrimaryMode: 'primary'
      }
    }

    if (phase === uploadState.UPLOAD_PHASE.FAILED) {
      return {
        showUploadOverlay: true,
        uploadOverlayTitle: '有照片上传失败',
        uploadOverlayDesc: '请重试上传，已上传成功的照片不会重复处理。',
        uploadOverlayProgressText: `已上传 ${uploaded}/${total}`,
        uploadOverlayProgressPercent: `${percent}%`,
        uploadOverlayProgressStyle: `width: ${percent}%`,
        uploadOverlayCurrentText: currentItem
          ? `失败：${currentItem.label}${currentItem.lastErrorMessage ? `，${currentItem.lastErrorMessage}` : ''}`
          : '上传失败',
        uploadOverlayPrimaryText: '重试上传',
        uploadOverlayPrimaryVisible: true,
        uploadOverlayPrimaryMode: 'danger'
      }
    }

    return {
      showUploadOverlay: true,
      uploadOverlayTitle: '正在上传照片',
      uploadOverlayDesc: '请保持小程序打开，上传完成后继续下一步。',
      uploadOverlayProgressText: `已上传 ${uploaded}/${total}`,
      uploadOverlayProgressPercent: `${percent}%`,
      uploadOverlayProgressStyle: `width: ${percent}%`,
      uploadOverlayCurrentText: currentItem ? `当前：${currentItem.label}` : '正在整理待上传照片',
      uploadOverlayPrimaryText: '',
      uploadOverlayPrimaryVisible: false,
      uploadOverlayPrimaryMode: 'primary'
    }
  },

  isCompletedUploadSession(session) {
    return !!(
      session
      && session.phase === uploadState.UPLOAD_PHASE.COMPLETED
      && session.complete
      && session.complete.status === uploadState.COMPLETE_STATUS.SUCCESS
    )
  },

  redirectToCompletePage() {
    if (this.isLeaving || this.isRedirectingToComplete) {
      return
    }

    this.isRedirectingToComplete = true
    this.isLeaving = true
    this.clearUploadMockTimer()
    this.setData({ showUploadOverlay: false })
    wx.redirectTo({ url: '/packageD/pages/complete/complete' })
  },

  restoreUploadOverlay(cache = storage.loadCache()) {
    if (!cache || !cache.uploadSession) {
      if (this.data.showUploadOverlay) {
        this.clearUploadMockTimer()
        this.setData({ showUploadOverlay: false })
      }
      return
    }

    if (cache.uploadSession.phase === uploadState.UPLOAD_PHASE.UPLOADING && this.blockIfTicketBlocked(cache)) {
      this.clearUploadMockTimer()
      if (this.data.showUploadOverlay) {
        this.setData({ showUploadOverlay: false })
      }
      return
    }

    const hasActiveRunner = cache.uploadSession.phase === uploadState.UPLOAD_PHASE.UPLOADING
      && this.uploadRunnerSessionId === cache.uploadSession.sessionId
      && this.uploadFlowPromise
    const restored = hasActiveRunner
      ? { changed: false, session: cache.uploadSession }
      : uploadState.restoreInterruptedSession(cache.uploadSession)
    const uploadSession = restored.session
    if (restored.changed) {
      cache.uploadSession = uploadSession
      storage.saveCache(cache)
    }

    if (this.isCompletedUploadSession(uploadSession)) {
      this.redirectToCompletePage()
      return
    }

    this.setData(this.buildUploadOverlayData(uploadSession))

    if (uploadSession.phase === uploadState.UPLOAD_PHASE.UPLOADING) {
      this.startUploadRunner(uploadSession.sessionId)
    } else if (uploadSession.phase === uploadState.UPLOAD_PHASE.READY) {
      this.scheduleAutoCompleteIfReady(uploadSession)
    }
  },

  clearUploadMockTimer() {
    this.uploadRunnerSessionId = ''
    this.uploadFlowPromise = null
    this.clearAutoCompleteTimer()
  },

  clearAutoCompleteTimer() {
    if (this.completeAutoTimerId) {
      clearTimeout(this.completeAutoTimerId)
    }
    this.completeAutoTimerId = null
    this.completeAutoTimerSessionId = ''
  },

  scheduleAutoCompleteIfReady(session) {
    if (!session || session.phase !== uploadState.UPLOAD_PHASE.READY || !session.sessionId) {
      return
    }

    if (this.completeAutoTimerId && this.completeAutoTimerSessionId === session.sessionId) {
      return
    }

    this.clearAutoCompleteTimer()
    const sessionId = session.sessionId
    this.completeAutoTimerSessionId = sessionId
    this.completeAutoTimerId = setTimeout(() => {
      this.completeAutoTimerId = null
      this.completeAutoTimerSessionId = ''

      const cache = storage.loadCache()
      const latestSession = cache && cache.uploadSession
      if (!latestSession || latestSession.sessionId !== sessionId) {
        return
      }

      if (latestSession.phase !== uploadState.UPLOAD_PHASE.READY) {
        return
      }

      if (this.blockIfTicketBlocked(cache)) {
        return
      }

      this.completeFlowPromise = this.submitCompleteToBackend(sessionId)
    }, AUTO_COMPLETE_DELAY_MS)
  },

  startUploadRunner(sessionId) {
    if (!sessionId) {
      return null
    }

    if (this.uploadRunnerSessionId === sessionId && this.uploadFlowPromise) {
      return this.uploadFlowPromise
    }

    const runner = this.runUploadSession(sessionId)
    this.uploadFlowPromise = runner

    runner.finally(() => {
      if (this.uploadFlowPromise === runner && this.uploadRunnerSessionId === sessionId) {
        this.uploadRunnerSessionId = ''
        this.uploadFlowPromise = null
      }
    })

    return runner
  },

  onOpenDrivingLicensePanel(e) {
    const { vehicle, docType, docSide, documentMode } = e.currentTarget.dataset
    const activeDocType = docType || vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE
    const activeVehicle = this.data.vehicles[vehicle]
    const requestedMode = isVehicleDocumentMode(documentMode)
      ? documentMode
      : getVehicleDocumentPanelModeBySide(docSide)
    const drivingLicenseMode = isVehicleDocumentMode(requestedMode)
      ? requestedMode
      : activeVehicle
        ? getVehicleDocumentPanelMode(activeVehicle, activeDocType)
        : vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC

    this.openVehicleDocumentPanel(vehicle, activeDocType, drivingLicenseMode)
  },

  openVehicleDocumentPanel(vehicle, activeDocType, drivingLicenseMode) {
    const activeVehicle = this.data.vehicles[vehicle]
    const panelMode = isVehicleDocumentMode(drivingLicenseMode)
      ? drivingLicenseMode
      : getVehicleDocumentPanelMode(activeVehicle, activeDocType)
    this.setData({
      showDrivingLicensePanel: true,
      drivingLicenseMode: panelMode,
      activeDrivingLicenseDocType: activeDocType,
      activeDrivingLicenseTitle: getVehicleDocumentBaseLabel(activeDocType),
      activeDrivingLicenseVehicleIndex: vehicle,
      activeDrivingLicenseSlots: activeVehicle
        ? vehicleDocuments.buildVehicleDocumentSlots(activeVehicle, activeDocType, panelMode)
        : []
    })
  },

  onCloseDrivingLicensePanel() {
    this.setData({
      showDrivingLicensePanel: false,
      activeDrivingLicenseDocType: vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE,
      activeDrivingLicenseTitle: '行驶证',
      activeDrivingLicenseVehicleIndex: null,
      activeDrivingLicenseSlots: []
    })
  },

  onSwitchDrivingLicenseMode(e = {}) {
    const requestedMode = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.mode
    const nextMode = isVehicleDocumentMode(requestedMode)
      ? requestedMode
      : this.data.drivingLicenseMode === vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC
      ? vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL
      : vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC

    if (nextMode === this.data.drivingLicenseMode) {
      return
    }

    const activeVehicle = this.data.vehicles[this.data.activeDrivingLicenseVehicleIndex]
    this.setData({
      drivingLicenseMode: nextMode,
      activeDrivingLicenseSlots: activeVehicle
        ? vehicleDocuments.buildVehicleDocumentSlots(
          activeVehicle,
          this.data.activeDrivingLicenseDocType,
          nextMode
        )
        : []
    })
  },

  onTapDrivingLicenseSlot(e) {
    const { docType, side, uploaded, uploadable } = e.currentTarget.dataset
    const activeDocType = docType || this.data.activeDrivingLicenseDocType
    const isUploaded = uploaded === true || uploaded === 'true'
    const isUploadable = uploadable !== false && uploadable !== 'false'

    if (!isUploadable || !this.canUploadDrivingLicenseSide(side, activeDocType)) {
      return Promise.resolve(null)
    }

    if (isUploaded) {
      return this.openDrivingLicenseDocumentActions(this.data.activeDrivingLicenseVehicleIndex, side, activeDocType)
    }

    return this.openDrivingLicenseSourceSheet(side, activeDocType)
  },

  canUploadDrivingLicenseSide(docSide, docType = this.data.activeDrivingLicenseDocType) {
    const activeVehicle = this.data.vehicles[this.data.activeDrivingLicenseVehicleIndex]
    const uploadMeta = vehicleDocuments.buildVehicleDocumentUploadMeta(activeVehicle, docType, docSide)

    if (!uploadMeta.uploadable) {
      wx.showToast({
        title: AUX_UPLOAD_ITEM_MISSING_TIP,
        icon: 'none'
      })
      return false
    }

    return true
  },

  onTapDrivingLicenseUpload(e) {
    const { vehicle, docType } = e.currentTarget.dataset
    const activeDocType = docType || vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE
    const activeVehicle = this.data.vehicles[vehicle]
    const mode = activeVehicle
      ? vehicleDocuments.getVehicleDocumentSelection(activeVehicle, activeDocType)
      : vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL
    const targetSide = mode === vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC
      ? vehicleDocuments.DOCUMENT_SIDES.ELECTRONIC
      : vehicleDocuments.DOCUMENT_SIDES.FRONT_PAGE

    this.setData({
      showDrivingLicensePanel: true,
      drivingLicenseMode: mode,
      activeDrivingLicenseDocType: activeDocType,
      activeDrivingLicenseTitle: getVehicleDocumentBaseLabel(activeDocType),
      activeDrivingLicenseVehicleIndex: vehicle,
      activeDrivingLicenseSlots: activeVehicle
        ? vehicleDocuments.buildVehicleDocumentSlots(activeVehicle, activeDocType, mode)
        : []
    })

    return this.openDrivingLicenseSourceSheet(targetSide, activeDocType)
  },

  onOpenDrivingLicenseDocumentActions(e) {
    const { vehicle, docType, side } = e.currentTarget.dataset
    return this.openDrivingLicenseDocumentActions(vehicle, side, docType)
  },

  openDrivingLicenseDocumentActions(vehicleIndex, docSide, docType = this.data.activeDrivingLicenseDocType) {
    return new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['查看', '重新上传', '删除'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            this.previewDrivingLicenseDocument(vehicleIndex, docSide, docType)
          } else if (res.tapIndex === 1) {
            this.setData({
              activeDrivingLicenseVehicleIndex: vehicleIndex,
              activeDrivingLicenseDocType: docType,
              activeDrivingLicenseTitle: getVehicleDocumentBaseLabel(docType)
            })
            await this.openDrivingLicenseSourceSheet(docSide, docType)
          } else if (res.tapIndex === 2) {
            this.confirmDeleteDrivingLicenseDocument(vehicleIndex, docSide, docType)
          }
          resolve()
        },
        fail: () => resolve()
      })
    })
  },

  previewDrivingLicenseDocument(vehicleIndex, docSide, docType = this.data.activeDrivingLicenseDocType) {
    const vehicle = this.data.vehicles[vehicleIndex]
    const current = vehicleDocuments.getVehicleDocumentBySide(vehicle, docType, docSide)

    if (!current) return

    const urls = vehicleDocuments.getVehicleDocuments(vehicle)
      .filter((document) => document.docType === docType)
      .map((document) => document.compressedPath)

    wx.previewImage({
      urls,
      current: current.compressedPath
    })
  },

  confirmDeleteDrivingLicenseDocument(vehicleIndex, docSide, docType = this.data.activeDrivingLicenseDocType) {
    wx.showModal({
      title: '',
      content: `确定删除${getVehicleDocumentLabel(docType, docSide)}吗？`,
      confirmText: '删除',
      confirmColor: '#D32F2F',
      success: (res) => {
        if (res.confirm) {
          storage.deleteVehicleDocument(
            vehicleIndex,
            docType,
            docSide
          )
          this.loadData()
        }
      }
    })
  },

  openDrivingLicenseSourceSheet(docSide, docType = this.data.activeDrivingLicenseDocType) {
    if (!this.canUploadDrivingLicenseSide(docSide, docType)) {
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['拍照', '从手机相册选择'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            await this.chooseDrivingLicenseImage(docSide, 'camera', docType)
          } else if (res.tapIndex === 1) {
            await this.chooseDrivingLicenseImage(docSide, 'album', docType)
          }
          resolve()
        },
        fail: () => resolve()
      })
    })
  },

  chooseDrivingLicenseImage(docSide, sourceType, docType = this.data.activeDrivingLicenseDocType) {
    return new Promise((resolve) => {
      const cacheBeforeChoose = storage.loadCache()

      if (!cacheBeforeChoose) {
        this.isLeaving = true
        wx.redirectTo({ url: '/packageD/pages/index/index' })
        resolve(null)
        return
      }

      const activeVehicle = cacheBeforeChoose.vehicles[this.data.activeDrivingLicenseVehicleIndex]
      const existingDocument = vehicleDocuments.getVehicleDocumentBySide(activeVehicle, docType, docSide)
      const uploadMeta = vehicleDocuments.buildVehicleDocumentUploadMeta(activeVehicle, docType, docSide)

      if (!uploadMeta.uploadable) {
        wx.showToast({
          title: AUX_UPLOAD_ITEM_MISSING_TIP,
          icon: 'none'
        })
        resolve(null)
        return
      }

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
              docType,
              docSide,
              label: getVehicleDocumentLabel(docType, docSide),
              vehicleId: uploadMeta.vehicleId,
              uploadItemId: uploadMeta.uploadItemId,
              photoType: uploadMeta.photoType,
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

            const savedDocumentMode = getVehicleDocumentPanelModeBySide(docSide)
            if (isVehicleDocumentMode(savedDocumentMode)) {
              storage.setVehicleDocumentSelection(
                this.data.activeDrivingLicenseVehicleIndex,
                docType,
                savedDocumentMode
              )
            }

            workflowPage.syncPageWorkflowState(this, workflow.STATES.PREVIEWING, {
              page: 'preview',
              pageAction: 'vehicle_document_saved'
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
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    const sourceStep = cache.currentStep
    cache.currentVehicleIndex = vehicle
    cache.currentStep = type === 'licensePlate'
      ? constants.SHOOT_STEP.LICENSE_PLATE
      : constants.SHOOT_STEP.VIN_CODE
    cache.fromPreview = true
    cache.previewReturnMode = getCurrentPreviewReturnMode(this.data)
    cache.captureReturnStrategy = getModuleOneCaptureReturnStrategy(cache, this.data, cache.currentStep, sourceStep)
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/packageD/pages/camera/camera' })
  },

  onAddDamage(e) {
    const { vehicle } = e.currentTarget.dataset
    const cache = storage.loadCache()

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    const targetVehicle = cache.vehicles && cache.vehicles[vehicle]
    if (targetVehicle && getVehicleDamageCount(targetVehicle) >= MAX_DAMAGES) {
      showDamagePhotoLimitToast()
      return
    }

    if (!canAddNewPhoto(cache)) {
      showTotalPhotoLimitToast()
      return
    }

    cache.currentVehicleIndex = vehicle
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.fromPreview = true
    cache.previewReturnMode = getCurrentPreviewReturnMode(this.data)
    cache.captureReturnStrategy = getDamageCaptureReturnStrategy(this.data)
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/packageD/pages/camera/camera' })
  },

  goToCameraWithCache(cache) {
    cache.previewReturnMode = getCurrentPreviewReturnMode(this.data)
    if (!cache.captureReturnStrategy) {
      cache.captureReturnStrategy = CAPTURE_RETURN_STRATEGY.RETURN_PREVIEW
    }
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/packageD/pages/camera/camera' })
  },

  onTapModuleOneSceneSlot(e) {
    const { sceneType, supplementIndex, completed } = e.currentTarget.dataset
    const isCompleted = completed === true || completed === 'true'

    if (isCompleted) {
      const targetId = sceneType === constants.SCENE_PHOTO_TYPE.SCENE_45
        ? 'scene-45'
        : `scene-supplement-${Number(supplementIndex)}`
      const index = this.data.allPhotos.findIndex((photo) => photo.id === targetId)

      if (index >= 0) {
        this.setData({
          showPreview: true,
          previewIndex: index,
          currentPhoto: this.data.allPhotos[index],
          actionsVisible: true
        })
        return
      }
    }

    const cache = storage.loadCache()

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    const sourceStep = cache.currentStep
    if (sceneType === constants.SCENE_PHOTO_TYPE.SCENE_45) {
      cache.currentStep = constants.SHOOT_STEP.SCENE_45
      delete cache.sceneSupplementIndex
      cache.captureReturnStrategy = getModuleOneCaptureReturnStrategy(
        cache,
        this.data,
        constants.SHOOT_STEP.SCENE_45,
        sourceStep
      )
    } else {
      const supplements = cache.scenePhotos && Array.isArray(cache.scenePhotos.supplements)
        ? cache.scenePhotos.supplements
        : []
      const targetIndex = Number(supplementIndex)

      if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= constants.LIMITS.MAX_SCENE_SUPPLEMENTS) {
        wx.showToast({ title: `现场补充照片最多${constants.LIMITS.MAX_SCENE_SUPPLEMENTS}张`, icon: 'none' })
        return
      }

      if (targetIndex >= supplements.length && supplements.length >= constants.LIMITS.MAX_SCENE_SUPPLEMENTS) {
        wx.showToast({ title: `现场补充照片最多${constants.LIMITS.MAX_SCENE_SUPPLEMENTS}张`, icon: 'none' })
        return
      }

      cache.currentStep = constants.SHOOT_STEP.SCENE_SUPPLEMENT
      cache.sceneSupplementIndex = targetIndex
      cache.captureReturnStrategy = CAPTURE_RETURN_STRATEGY.RETURN_PREVIEW
    }

    cache.fromPreview = true
    this.goToCameraWithCache(cache)
  },

  onTapModuleOneVehicleSlot(e) {
    const { vehicle, type, completed } = e.currentTarget.dataset
    const isCompleted = completed === true || completed === 'true'

    if (isCompleted) {
      this.onPreview({
        currentTarget: {
          dataset: {
            vehicle,
            type
          }
        }
      })
      return
    }

    this.onSupplement({
      currentTarget: {
        dataset: {
          vehicle,
          type
        }
      }
    })
  },

  onEnterDamageFromModuleOne() {
    const cache = storage.loadCache()
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    const sceneSummary = cacheSelectors.getSceneSummary(cache)
    if (!sceneSummary.hasScene45) {
      this.setData({
        showModal: true,
        modalContent: MODULE_ONE_MISSING_SCENE_TIP,
        modalConfirmText: '仍然进入车损拍摄',
        modalCancelText: '返回补拍',
        modalType: 'missingScene45'
      })
      return
    }

    this.showModuleOneHandoff()
  },

  showModuleOneHandoff() {
    this.setData({
      showModuleOneHandoff: true,
      moduleOneHandoffTitle: '现场环境及车辆信息已保存',
      moduleOneHandoffProgress: buildHandoffProgress([
        '已完成：现场环境及车辆信息',
        '下一步：车损照片拍摄',
        '未完成：证件信息'
      ]),
      moduleHandoffConfirmText: '进入车损拍摄',
      moduleHandoffTarget: 'damage'
    })
  },

  onCloseModuleOneHandoff() {
    this.setData({ showModuleOneHandoff: false })
  },

  onConfirmModuleOneHandoff() {
    if (this.data.moduleHandoffTarget === 'moduleThree') {
      return this.confirmEnterModuleThree()
    }

    if (this.data.moduleHandoffTarget === 'final') {
      return this.confirmEnterFinalPreview()
    }

    const cache = storage.loadCache()
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.currentDamageCount = Array.isArray(cache.vehicles && cache.vehicles[0] && cache.vehicles[0].damages)
      ? cache.vehicles[0].damages.length
      : 0
    clearModuleTwoDamageEntryContext(cache)
    cache.workflowState = {
      current: workflow.STATES.CAPTURING,
      updatedAt: new Date().toISOString()
    }
    storage.saveCache(cache)
    this.setData({ showModuleOneHandoff: false })
    this.isLeaving = true
    wx.reLaunch({ url: '/packageD/pages/camera/camera' })
  },

  onEnterDocumentsFromModuleTwo() {
    this.setData({
      showModuleOneHandoff: true,
      moduleOneHandoffTitle: '车损照片已保存',
      moduleOneHandoffProgress: buildHandoffProgress([
        '已完成：现场环境及车辆信息',
        '已完成：车损照片拍摄',
        '下一步：证件信息'
      ]),
      moduleHandoffConfirmText: '进入证件信息',
      moduleHandoffTarget: 'moduleThree'
    })
  },

  confirmEnterModuleThree() {
    const cache = storage.loadCache()
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    cache.currentStep = constants.SHOOT_STEP.MODULE_THREE
    cache.fromPreview = false
    cache.workflowState = {
      current: workflow.STATES.PREVIEWING,
      updatedAt: new Date().toISOString()
    }
    storage.saveCache(cache)
    this.setData({ showModuleOneHandoff: false })
    this.isLeaving = true
    wx.redirectTo({ url: '/packageD/pages/preview/preview?mode=moduleThree' })
  },

  onEnterFinalFromModuleThree() {
    const cache = storage.loadCache()
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    const documentProgressText = vehicleDocuments.hasIncompleteVehicleDocumentVehicles(cache.vehicles)
      ? '待补充：证件信息'
      : '已完成：证件信息'

    this.setData({
      showModuleOneHandoff: true,
      moduleOneHandoffTitle: '证件信息已保存',
      moduleOneHandoffProgress: buildHandoffProgress([
        '已完成：现场环境及车辆信息',
        '已完成：车损照片拍摄',
        documentProgressText
      ]),
      moduleHandoffConfirmText: '进入最终总预览',
      moduleHandoffTarget: 'final'
    })
  },

  confirmEnterFinalPreview() {
    const cache = storage.loadCache()
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
    cache.fromPreview = false
    cache.workflowState = {
      current: workflow.STATES.PREVIEWING,
      updatedAt: new Date().toISOString()
    }
    storage.saveCache(cache)
    this.setData({ showModuleOneHandoff: false })
    this.isLeaving = true
    wx.redirectTo({ url: '/packageD/pages/preview/preview?mode=final' })
  },

  onRetake() {
    const photo = this.data.currentPhoto
    if (!photo) return

    if (photo.type === 'vehicleDocument') {
      this.setData({
        showPreview: false,
        activeDrivingLicenseVehicleIndex: photo.vehicle,
        activeDrivingLicenseDocType: photo.docType,
        activeDrivingLicenseTitle: getVehicleDocumentBaseLabel(photo.docType)
      })
      this.openDrivingLicenseSourceSheet(photo.docSide, photo.docType)
      return
    }

    const cache = storage.loadCache()
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    const previewReturnMode = getCurrentPreviewReturnMode(this.data)

    if (photo.sceneType) {
      if (photo.sceneType === constants.SCENE_PHOTO_TYPE.SCENE_45) {
        cache.currentStep = constants.SHOOT_STEP.SCENE_45
        delete cache.sceneSupplementIndex
      } else {
        cache.currentStep = constants.SHOOT_STEP.SCENE_SUPPLEMENT
        cache.sceneSupplementIndex = Number.isInteger(photo.sceneIndex) ? photo.sceneIndex : 0
      }
      delete cache.retakeMode
      cache.fromPreview = true
      cache.captureReturnStrategy = CAPTURE_RETURN_STRATEGY.RETURN_PREVIEW
      if (previewReturnMode) {
        cache.previewReturnMode = previewReturnMode
      }
      storage.saveCache(cache)
      this.isLeaving = true
      wx.navigateTo({ url: '/packageD/pages/camera/camera' })
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
    cache.captureReturnStrategy = CAPTURE_RETURN_STRATEGY.RETURN_PREVIEW
    if (previewReturnMode) {
      cache.previewReturnMode = previewReturnMode
    }
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/packageD/pages/camera/camera' })
  },

  onDelete() {
    const photo = this.data.currentPhoto
    if (!photo) return

    if (photo.type === 'vehicleDocument') {
      wx.showModal({
        title: '',
        content: `确定删除${getVehicleDocumentLabel(photo.docType, photo.docSide)}吗？`,
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
          if (photo.sceneType) {
            storage.deleteScenePhoto(photo.sceneType, photo.sceneIndex)
          } else {
            storage.deletePhoto(photo.vehicle, photo.type, photo.damage)
          }
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
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    this.startSubmitFlow(cache)
  },

  startSubmitFlow(cache = storage.loadCache()) {
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    if (this.blockIfTicketBlocked(cache)) {
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
      wx.redirectTo({ url: '/packageD/pages/index/index' })
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
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    const candidates = cacheSelectors.getAlbumSaveCandidates(cache)
    if (candidates.length === 0) {
      this.startUploadFlow(cache)
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
    this.startUploadFlow()
  },

  async saveAlbumCandidatesAndComplete() {
    const cache = storage.loadCache()
    const candidates = cacheSelectors.getAlbumSaveCandidates(cache)

    if (candidates.length === 0) {
      this.startUploadFlow(cache)
      return
    }

    const granted = await permission.ensureAlbumSavePermission()
    if (!granted) {
      this.persistAlbumSaveResult(this.buildFailedAlbumSaveResult(candidates, 'permission_denied'))
      this.startUploadFlow()
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
    this.startUploadFlow()
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
    } else if (modalType === 'missingScene45') {
      this.showModuleOneHandoff()
    } else if (modalType === 'sceneSupplementPrompt') {
      const cache = this.markSceneSupplementPromptShown()
      this.enterSceneSupplementCapture(cache)
    }
  },

  onModalCancel() {
    const modalType = this.data.modalType
    this.setData({ showModal: false })
    if (modalType === 'thirdVehicle') {
      this.addThirdVehicle()
    } else if (modalType === 'albumSaveConfirm') {
      this.skipAlbumSaveAndComplete()
    } else if (modalType === 'missingScene45') {
      const cache = storage.loadCache()
      if (!cache) return
      cache.currentStep = constants.SHOOT_STEP.SCENE_45
      cache.fromPreview = true
      this.goToCameraWithCache(cache)
    } else if (modalType === 'sceneSupplementPrompt') {
      this.markSceneSupplementPromptShown()
    }
  },

  onModalMaskTap() {
    if (this.data.modalType === 'sceneSupplementPrompt') {
      this.markSceneSupplementPromptShown()
    }
    this.setData({ showModal: false })
  },

  startUploadFlow(cache = storage.loadCache()) {
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    if (this.blockIfTicketBlocked(cache)) {
      return
    }

    this.clearUploadMockTimer()
    const uploadSession = uploadState.createUploadSession(cache)
    cache.uploadSession = uploadSession
    cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
    storage.saveCache(cache)

    workflowPage.syncPageWorkflowState(this, workflow.STATES.UPLOADING, {
      page: 'preview',
      pageAction: 'upload_start'
    })

    this.setData(this.buildUploadOverlayData(uploadSession))

    if (uploadSession.phase === uploadState.UPLOAD_PHASE.UPLOADING) {
      this.startUploadRunner(uploadSession.sessionId)
    } else if (uploadSession.phase === uploadState.UPLOAD_PHASE.READY) {
      this.scheduleAutoCompleteIfReady(uploadSession)
    }
  },

  getWorkflowStateForUploadPhase(phase) {
    if (phase === uploadState.UPLOAD_PHASE.FAILED) {
      return workflow.STATES.UPLOAD_FAILED
    }
    if (phase === uploadState.UPLOAD_PHASE.READY) {
      return workflow.STATES.UPLOAD_READY
    }
    if (phase === uploadState.UPLOAD_PHASE.COMPLETING) {
      return workflow.STATES.COMPLETING
    }
    if (phase === uploadState.UPLOAD_PHASE.COMPLETE_FAILED) {
      return workflow.STATES.COMPLETE_FAILED
    }
    if (phase === uploadState.UPLOAD_PHASE.COMPLETED) {
      return workflow.STATES.LOCAL_COMPLETED
    }
    return workflow.STATES.UPLOADING
  },

  syncUploadWorkflowState(session, pageAction) {
    if (!session) {
      return
    }

    workflowPage.syncPageWorkflowState(this, this.getWorkflowStateForUploadPhase(session.phase), {
      page: 'preview',
      pageAction
    })
  },

  saveUploadSession(cache, session, pageAction) {
    cache.uploadSession = session
    cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
    storage.saveCache(cache)
    this.syncUploadWorkflowState(session, pageAction)
    this.setData(this.buildUploadOverlayData(session))
    if (session.phase === uploadState.UPLOAD_PHASE.READY) {
      this.scheduleAutoCompleteIfReady(session)
    } else {
      this.clearAutoCompleteTimer()
    }
  },

  async runUploadSession(sessionId) {
    this.uploadRunnerSessionId = sessionId

    while (this.uploadRunnerSessionId === sessionId) {
      const cache = storage.loadCache()
      const session = cache && cache.uploadSession

      if (!session || session.sessionId !== sessionId) {
        return null
      }

      if (session.phase !== uploadState.UPLOAD_PHASE.UPLOADING) {
        return session
      }

      if (this.blockIfTicketBlocked(cache)) {
        return session
      }

      const nextItem = uploadState.getNextUploadItem(session)
      if (!nextItem) {
        const readySession = uploadState.recalculateSession(session)
        this.saveUploadSession(cache, readySession, 'upload_ready')
        return readySession
      }

      const uploadingSession = uploadState.markUploadItemUploading(session, nextItem.id)
      const uploadingItem = uploadingSession.items.find((item) => item.id === nextItem.id)
      this.saveUploadSession(cache, uploadingSession, 'upload_item_start')

      try {
        const result = await auxPhotoApi.uploadPhoto(uploadingItem, {
          ticket: uploadingSession.ticket
        })
        const latestCache = storage.loadCache()
        const latestSession = latestCache && latestCache.uploadSession
        if (!latestSession || latestSession.sessionId !== sessionId || this.uploadRunnerSessionId !== sessionId) {
          return latestSession
        }

        const successSession = uploadState.markUploadItemSuccess(latestSession, nextItem.id, result)
        this.saveUploadSession(latestCache, successSession, 'upload_item_success')
      } catch (error) {
        const latestCache = storage.loadCache()
        const latestSession = latestCache && latestCache.uploadSession
        if (!latestSession || latestSession.sessionId !== sessionId) {
          return latestSession
        }

        const failedSession = uploadState.markUploadItemFailed(latestSession, nextItem.id, error)
        this.saveUploadSession(latestCache, failedSession, 'upload_item_failed')
        return failedSession
      }
    }

    return null
  },

  retryUploadFlow() {
    const cache = storage.loadCache()
    const session = cache && cache.uploadSession

    if (!session) {
      return
    }

    if (this.blockIfTicketBlocked(cache)) {
      return
    }

    const nextSession = uploadState.retryFailedItems(session)
    cache.uploadSession = nextSession
    storage.saveCache(cache)

    workflowPage.syncPageWorkflowState(this, workflow.STATES.UPLOADING, {
      page: 'preview',
      pageAction: 'upload_retry'
    })
    this.setData(this.buildUploadOverlayData(nextSession))
    this.startUploadRunner(nextSession.sessionId)
  },

  onUploadOverlayPrimaryTap() {
    const cache = storage.loadCache()
    const session = cache && cache.uploadSession

    if (!session) {
      return
    }

    if (this.blockIfTicketBlocked(cache)) {
      return
    }

    if (session.phase === uploadState.UPLOAD_PHASE.READY) {
      this.scheduleAutoCompleteIfReady(session)
      return null
    }

    if (session.phase === uploadState.UPLOAD_PHASE.FAILED) {
      return this.retryUploadFlow()
    }

    if (session.phase === uploadState.UPLOAD_PHASE.COMPLETE_FAILED) {
      this.completeFlowPromise = this.submitCompleteToBackend(session.sessionId)
      return this.completeFlowPromise
    }

    if (session.phase === uploadState.UPLOAD_PHASE.COMPLETED) {
      this.redirectToCompletePage()
      return null
    }
  },

  async submitCompleteToBackend(sessionId) {
    const cache = storage.loadCache()
    const session = cache && cache.uploadSession

    if (!session || session.sessionId !== sessionId) {
      return null
    }

    if (this.blockIfTicketBlocked(cache)) {
      return session
    }

    const submittingSession = uploadState.markCompleteSubmitting(session)
    this.saveUploadSession(cache, submittingSession, 'complete_start')

    try {
      const result = await auxPhotoApi.complete({
        ticket: submittingSession.ticket,
        clientUploadCount: submittingSession.uploaded,
        completeAttempt: submittingSession.complete.attempts,
        remark: ''
      })
      const latestCache = storage.loadCache()
      const latestSession = latestCache && latestCache.uploadSession
      if (!latestSession || latestSession.sessionId !== sessionId) {
        return latestSession
      }

      const completedSession = uploadState.markCompleteSuccess(latestSession, result)
      this.saveUploadSession(latestCache, completedSession, 'complete_success')
      workflowPage.syncPageWorkflowState(this, workflow.STATES.LOCAL_COMPLETED, {
        page: 'preview',
        pageAction: 'submit_complete'
      })
      return completedSession
    } catch (error) {
      const latestCache = storage.loadCache()
      const latestSession = latestCache && latestCache.uploadSession
      if (!latestSession || latestSession.sessionId !== sessionId) {
        return latestSession
      }

      const failedSession = uploadState.markCompleteFailed(latestSession, error)
      this.saveUploadSession(latestCache, failedSession, 'complete_failed')
      return failedSession
    }
  },

  addThirdVehicle() {
    const cache = storage.loadCache()

    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/packageD/pages/index/index' })
      return
    }

    if (isAuxPhotoEnabled(cache)) {
      wx.showToast({
        title: AUX_VEHICLE_LOCKED_TIP,
        icon: 'none'
      })
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
        url: '/packageD/pages/camera/camera',
        fail: () => {
          wx.redirectTo({
            url: '/packageD/pages/camera/camera',
            fail: () => {
              wx.reLaunch({ url: '/packageD/pages/camera/camera' })
            }
          })
        }
      })
    }
  },

  onDeleteVehicle(e) {
    const { vehicleIndex } = e.currentTarget.dataset
    const cache = storage.loadCache()

    if (isAuxPhotoEnabled(cache)) {
      wx.showToast({
        title: AUX_VEHICLE_LOCKED_TIP,
        icon: 'none'
      })
      return
    }

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
      wx.redirectTo({ url: '/packageD/pages/index/index' })
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
            wx.redirectTo({ url: '/packageD/pages/index/index' })
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
      wx.redirectTo({ url: '/packageD/pages/index/index' })
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
