const storage = require('../../utils/storage')
const cacheSelectors = require('../../utils/cache-selectors')
const constants = require('../../utils/constants')
const compress = require('../../utils/compress')
const photoQuality = require('../../utils/photo-quality')
const runtimeLogger = require('../../utils/runtime-logger')
const envConfig = require('../../utils/env-config')
const PlateDetector = require('../../utils/plate-detector')
const DamageDetector = require('../../utils/damage-detector')
const { PlateFrameUtils } = require('../../utils/frame-utils')
const DamageAutoCaptureEngine = require('../../utils/damage-auto-capture-engine')
const { AUTO_CAPTURE } = require('../../utils/ai-config')
const workflow = require('../../utils/workflow-state')
const workflowPage = require('../../utils/workflow-page')
const album = require('../../utils/album')

const PLATE_DISTANCE_HINT_TEXT = {
  forward: '\u8bf7\u9760\u8fd1\u4e00\u70b9',
  backward: '\u8bf7\u7a0d\u5fae\u540e\u9000'
}

const DAMAGE_DISTANCE_HINT_TEXT = {
  forward: '\u8bf7\u9760\u8fd1\u4e00\u70b9',
  backward: '\u8bf7\u7a0d\u5fae\u8fdc\u79bb'
}

const VIN_GUIDE_TIP = '\u8bf7\u5bf9\u51c6\u524d\u6321\u98ce\u73bb\u7483\u5de6\u4e0b\u89d2VIN\u7801\uff0c\u62cd\u6e05\u5b8c\u6574\u5b57\u7b26'
const CONFIRM_USE_TEXT = '\u786e\u8ba4\u4f7f\u7528'
const RETAKE_TEXT = '\u91cd\u65b0\u62cd\u6444'
const MAX_TOTAL_PHOTOS = (constants.LIMITS && constants.LIMITS.MAX_TOTAL_PHOTOS) || 50
const TOTAL_PHOTO_LIMIT_TIP = `最多${MAX_TOTAL_PHOTOS}张，请先删除`
const CAMERA_VIRTUAL_WIDTH = 400
const CAMERA_VIRTUAL_HEIGHT = 300
const CAMERA_ASPECT_RATIO = CAMERA_VIRTUAL_WIDTH / CAMERA_VIRTUAL_HEIGHT
const CAMERA_BASE_RPX_WIDTH = 750
const CAMERA_BASE_TOTAL_RPX_WIDTH = 32 * 2 + 120 * 2 + 24 * 2 + CAMERA_VIRTUAL_WIDTH
const CAMERA_BASE_TOTAL_RPX_HEIGHT = 20 * 2 + CAMERA_VIRTUAL_HEIGHT

function getFiniteNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function computeResponsiveCameraLayout(info = {}) {
  const rawWindowWidth = getFiniteNumber(info.windowWidth, 844)
  const rawWindowHeight = getFiniteNumber(info.windowHeight, 390)
  const windowWidth = Math.max(rawWindowWidth, rawWindowHeight)
  const windowHeight = Math.min(rawWindowWidth, rawWindowHeight)
  const safeArea = info.safeArea || {}
  const safeAreaWidth = getFiniteNumber(safeArea.right - safeArea.left, windowWidth)
  const safeAreaHeight = getFiniteNumber(safeArea.bottom - safeArea.top, windowHeight)
  const baseScale = windowWidth / CAMERA_BASE_RPX_WIDTH
  const widthFitScale = windowWidth / CAMERA_BASE_TOTAL_RPX_WIDTH
  const heightFitScale = windowHeight / CAMERA_BASE_TOTAL_RPX_HEIGHT
  const layoutScale = Math.max(Math.min(baseScale, widthFitScale, heightFitScale), 0.1)
  const paddingX = Number((32 * layoutScale).toFixed(2))
  const paddingY = Number((20 * layoutScale).toFixed(2))
  const gap = Number((24 * layoutScale).toFixed(2))
  const sideWidth = Number((120 * layoutScale).toFixed(2))
  const cameraWidth = Number((CAMERA_VIRTUAL_WIDTH * layoutScale).toFixed(2))
  const cameraHeight = Number((CAMERA_VIRTUAL_HEIGHT * layoutScale).toFixed(2))

  return {
    rawWindowWidth,
    rawWindowHeight,
    windowWidth,
    windowHeight,
    safeWidth: windowWidth,
    safeHeight: windowHeight,
    safeAreaWidth,
    safeAreaHeight,
    layoutScale,
    paddingX,
    paddingY,
    gap,
    sideWidth,
    cameraWidth,
    cameraHeight,
    containerStyle: `padding: ${paddingY}px ${paddingX}px; gap: ${gap}px;`,
    infoAreaStyle: `width: ${sideWidth}px;`,
    actionAreaStyle: `width: ${sideWidth}px;`,
    cameraWrapperStyle: `width: ${cameraWidth}px; height: ${cameraHeight}px;`
  }
}

function getWindowInfoSnapshot() {
  try {
    if (typeof wx !== 'undefined' && typeof wx.getWindowInfo === 'function') {
      return wx.getWindowInfo() || {}
    }
  } catch (error) {
    // 窗口信息读取失败时继续尝试旧接口
  }

  try {
    if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
      return wx.getSystemInfoSync() || {}
    }
  } catch (error) {
    // 布局读取失败不影响拍照主流程，使用默认横屏尺寸兜底
  }

  return {}
}

function countStoredPhotos(cache) {
  let total = 0
  const vehicles = Array.isArray(cache && cache.vehicles) ? cache.vehicles : []
  const documents = Array.isArray(cache && cache.documents) ? cache.documents : []

  vehicles.forEach((vehicle) => {
    if (vehicle.licensePlate && vehicle.licensePlate.compressedPath) total += 1
    if (vehicle.vinCode && vehicle.vinCode.compressedPath) total += 1
    if (Array.isArray(vehicle.damages)) total += vehicle.damages.filter((photo) => photo && photo.compressedPath).length
    if (Array.isArray(vehicle.documents)) total += vehicle.documents.filter((photo) => photo && photo.compressedPath).length
  })

  total += documents.filter((photo) => photo && photo.compressedPath).length
  return total
}

function isTotalPhotoLimitReached(cache) {
  if (typeof cacheSelectors.getCacheSummary === 'function') {
    return cacheSelectors.getCacheSummary(cache).totalPhotos >= MAX_TOTAL_PHOTOS
  }

  return countStoredPhotos(cache) >= MAX_TOTAL_PHOTOS
}

function showTotalPhotoLimitToast() {
  wx.showToast({
    title: TOTAL_PHOTO_LIMIT_TIP,
    icon: 'none'
  })
}

function getSystemInfoSnapshot() {
  try {
    if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function') {
      const info = wx.getSystemInfoSync() || {}
      return {
        model: info.model || '',
        system: info.system || '',
        platform: info.platform || '',
        SDKVersion: info.SDKVersion || '',
        version: info.version || '',
        brand: info.brand || ''
      }
    }
  } catch (error) {
    // 系统信息读取失败不影响拍摄主流程
  }

  return {
    model: '',
    system: '',
    platform: '',
    SDKVersion: '',
    version: '',
    brand: ''
  }
}

Page({
  data: {
    currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
    guideTip: constants.GUIDE_TIPS[constants.SHOOT_STEP.LICENSE_PLATE],
    vinGuideTip: VIN_GUIDE_TIP,
    confirmUseText: CONFIRM_USE_TEXT,
    retakeText: RETAKE_TEXT,
    vehicleType: constants.VEHICLE_TYPE.TARGET,
    damageCount: 0,
    showConfirmModal: false,
    qualityHintText: '',
    pendingPhoto: null,
    isNavigating: false,  // 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮闁汇値鍠楅妵鍕箛閳轰胶鍔撮梺鎼炲€栧ú鐔煎蓟濞戙埄鏁冮柨婵嗘椤︹晠姊烘潪鎵槮婵☆偅鐟ч幑銏犫槈閵忕姷顓哄┑鐐叉缁绘帗绂掓ィ鍐┾拺缂備焦蓱鐏忣參鏌涙繝鍌ょ吋闁糕斁鍋撳銈嗗坊閸嬫挾绱掗悩鑼х€规洘娲熼弻鍡楊吋閸涱垼鍞甸梺璇插嚱缂嶅棝鍩€椤掑寮跨紒鎻掑⒔閹广垹鈹戦崱鈺傚兊濡炪倖鎸炬慨鎾嵁濡ゅ懏鈷掑ù锝呮憸缁夋椽鏌涚€ｎ亷韬€规洘婢樿灃闁告侗鍘奸幆鐐烘⒑闁偛鑻晶瀛樻叏?
    aiStatusText: '',
    aiReady: false,
    aiAvailable: true,
    aiEnabled: true,
    aiLoading: false,
    aiLocked: false,
    plateFrameState: 'normal',
    plateDistanceHint: '',
    damageDistanceHint: '',
    plateBlinkFrame: 'a',
    damageFrameState: 'normal',
    damageAreaRatioText: '',
    damagePhaseLabel: '',
    appEnvBadgeText: '',
    showDamageDebug: false,
    workflowState: workflow.STATES.IDLE,
    cameraLayout: computeResponsiveCameraLayout()
  },

  cameraContext: null,
  isLeaving: false,  // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈠Χ閸屾矮澹曞┑顔矫畷顒勫储鐎电硶鍋撶憴鍕妞ゎ偄顦遍埀顒勬涧閵堢顕ｉ崼鏇炵闁绘ê鐏氬В搴㈢節閻㈤潧浠╅柟娲讳簽瀵板﹪鎳為妷褏褰炬繝鐢靛Т閸嬪棝鎮為挊澹濆綊鎮℃惔锝嗘喖闂佺粯鎸堕崕鑼崲濠靛顥堟繛鎴炵懐濡繝姊洪棃鈺冪ɑ婵＄偠妫勮灋闁告稒鎯岄弫鍡楊熆鐠虹尨宸ユい顐亞缁辨挻鎷呮禒瀣懙闁汇埄鍨埀顒€纾弳锕傛煙閻戞ê鐏嶉柡鈧禒瀣厵闂侇叏绠戞晶顖涖亜閺傚灝顏紒杈ㄦ崌瀹曟帒鈻庨幇顔哄仒濠碉紕鍋涢悺銊╁箖閸屾氨鏆︾憸鐗堝笒闁卞洭鏌￠崶鈺佲偓锝夋晝閸屾稓鍘遍梺鍝勬储閸斿矂鎮橀敓鐘崇厱閻庯絻鍔屾慨鍌炴煛鐏炲墽鈽夐柍钘夘槸椤粓宕奸悢鍛婃瘞闂?
  detectTimer: null,
  plateBlinkTimer: null,
  plateHintClearTimer: null,
  aiBusy: false,
  aiCooldownUntil: 0,
  plateDetector: null,
  damageDetector: null,
  plateFrameChecker: null,
  damageAutoCaptureEngine: null,
  cameraInitialized: false,
  cameraFrameListener: null,
  latestAIFrame: null,
  aiPreviewTakePhotoRemovedLogged: false,
  aiDetectionRunId: 0,
  cameraLayoutLogKey: '',

  onLoad() {
    this.isLeaving = false
    if (typeof this.updateCameraLayout === 'function') {
      this.updateCameraLayout('page_load')
    }
    this.updateAppEnvBadge()
    const sessionId = runtimeLogger.startSession('camera', {
      page: 'camera',
      initialStep: this.data.currentStep
    })
    console.log('[selfCam:feedback]', `selfCam_${sessionId}`)
    this.setData({ showDamageDebug: this.shouldShowAIDebug() })
    runtimeLogger.info('camera', 'page_load', {
      feedbackId: `selfCam_${sessionId}`,
      showDamageDebug: this.data.showDamageDebug
    })
    this.initAICapability()
    this.loadCacheData('page_load')
  },

  onReady() {
    this.cameraContext = wx.createCameraContext()
  },

  onShow() {
    if (typeof this.updateCameraLayout === 'function') {
      this.updateCameraLayout('page_show')
    }
    this.updateAppEnvBadge()
    runtimeLogger.forceWarn('diagnostic', 'realtime_probe', {
      probe: 'selfCam_realtime_probe',
      page: 'pages/camera/camera',
      at: Date.now()
    })
    runtimeLogger.info('camera', 'page_show', {
      isLeaving: this.isLeaving,
      currentStep: this.data.currentStep,
      showConfirmModal: this.data.showConfirmModal,
      cameraInitialized: this.cameraInitialized
    })
    this.isLeaving = false
    this.setData({ isNavigating: false })
    this.loadCacheData('page_show')
  },

  onResize(res) {
    const sizeInfo = res && res.size ? res.size : res
    this.updateCameraLayout('page_resize', sizeInfo)
  },

  onHide() {
    this.cancelPlateHintClear()
    this.stopPlateBlink()
    this.stopAIFrameListener('page_hide')
  },

  onUnload() {
    runtimeLogger.info('camera', 'page_unload', {
      currentStep: this.data.currentStep,
      hasPendingPhoto: !!this.data.pendingPhoto,
      showConfirmModal: this.data.showConfirmModal
    })
    this.cancelPlateHintClear()
    this.stopPlateBlink()
    this.stopAIDetectionLoop()
    this.stopAIFrameListener('page_unload')
    this.destroyDetectors()
    // 椤甸潰鍗歌浇鏃讹紝濡傛湁寰呯‘璁ょ収鐗囧垯鍏堜繚瀛?
    if (this.data.showConfirmModal && this.data.pendingPhoto) {
      this.savePendingPhotoBeforeLeave()
    }
    runtimeLogger.endSession('camera', { reason: 'page_unload' })
  },

  shouldShowAIDebug() {
    return envConfig.getDebugConfig().showAIPanel
  },

  updateAppEnvBadge() {
    const appEnvBadgeText = envConfig.getAppEnvBadgeText()

    if (this.data.appEnvBadgeText !== appEnvBadgeText) {
      this.setData({ appEnvBadgeText })
    }
  },

  computeCameraLayout(info = {}) {
    return computeResponsiveCameraLayout(info)
  },

  updateCameraLayout(reason = 'manual', info = null) {
    const windowInfo = info || getWindowInfoSnapshot()
    const cameraLayout = this.computeCameraLayout(windowInfo)
    const layoutLogKey = `${cameraLayout.windowWidth}x${cameraLayout.windowHeight}:${cameraLayout.cameraWidth}x${cameraLayout.cameraHeight}`

    this.setData({ cameraLayout })

    if (this.cameraLayoutLogKey !== layoutLogKey) {
      this.cameraLayoutLogKey = layoutLogKey
      console.log('[camera:layout]', {
        reason,
        rawWindowWidth: cameraLayout.rawWindowWidth,
        rawWindowHeight: cameraLayout.rawWindowHeight,
        windowWidth: cameraLayout.windowWidth,
        windowHeight: cameraLayout.windowHeight,
        cameraWidth: cameraLayout.cameraWidth,
        cameraHeight: cameraLayout.cameraHeight,
        sideWidth: cameraLayout.sideWidth,
        gap: cameraLayout.gap
      })
    }
  },

  logAiModelConfig(aiConfig) {
    const payload = {
      appEnv: aiConfig.appEnv,
      wxEnvVersion: aiConfig.wxEnvVersion,
      plateModelUrl: aiConfig.plateModelUrl,
      damageModelUrl: aiConfig.damageModelUrl
    }
    console.log('[AI:model:config]', payload)
    runtimeLogger.info('ai', 'model_config', payload)
    runtimeLogger.forceWarn('ai', 'model_config_probe', payload)
  },

  reportAiUnavailable(reason, extra = {}) {
    const aiConfig = envConfig.getAiConfig()
    const systemInfo = getSystemInfoSnapshot()
    const sessionId = runtimeLogger.getSessionId ? runtimeLogger.getSessionId() : ''

    runtimeLogger.forceError('ai', 'ai_unavailable', {
      reason,
      feedbackId: sessionId ? `selfCam_${sessionId}` : '',
      appEnv: aiConfig.appEnv || '',
      wxEnvVersion: aiConfig.wxEnvVersion || '',
      plateModelUrl: aiConfig.plateModelUrl || '',
      damageModelUrl: aiConfig.damageModelUrl || '',
      stage: extra.stage || '',
      modelName: extra.modelName || '',
      statusCode: extra.statusCode || '',
      message: extra.message || '',
      errMsg: extra.errMsg || '',
      systemInfo
    })
  },

  getAIStatusByStep(step) {
    if (!this.data.aiAvailable || !this.data.aiEnabled) {
      return AUTO_CAPTURE.STATUS_TEXT.unavailable
    }
    if (step === constants.SHOOT_STEP.LICENSE_PLATE) {
      return AUTO_CAPTURE.STATUS_TEXT.scanningPlate
    }
    if (step === constants.SHOOT_STEP.DAMAGE) {
      return AUTO_CAPTURE.STATUS_TEXT.scanningDamage
    }
    return ''
  },

  async ensureDetector(step) {
    if (!this.data.aiAvailable || !this.data.aiEnabled) {
      return null
    }

    try {
      if (step === constants.SHOOT_STEP.LICENSE_PLATE) {
        if (!this.plateDetector) {
          const aiConfig = envConfig.getAiConfig()
          this.logAiModelConfig(aiConfig)
          this.plateDetector = new PlateDetector({
            aiConfig,
            scoreThreshold: AUTO_CAPTURE.PLATE.scoreThreshold,
            iouThreshold: AUTO_CAPTURE.PLATE.iouThreshold,
            targetSize: AUTO_CAPTURE.PLATE.targetSize,
            inputName: AUTO_CAPTURE.PLATE.inputName,
            outputName: AUTO_CAPTURE.PLATE.outputName
          })
        }

        if (this.plateDetector.isModelLoaded()) {
          return this.plateDetector
        }

        this.setData({ aiLoading: true, aiStatusText: AUTO_CAPTURE.STATUS_TEXT.loading })
        if (!this.plateDetector.isModelLoaded()) {
          await this.plateDetector.load()
        }
      } else if (step === constants.SHOOT_STEP.DAMAGE) {
        if (!this.damageDetector) {
          const aiConfig = envConfig.getAiConfig()
          this.logAiModelConfig(aiConfig)
          this.damageDetector = new DamageDetector({
            aiConfig,
            scoreThreshold: AUTO_CAPTURE.DAMAGE.scoreThreshold,
            iouThreshold: AUTO_CAPTURE.DAMAGE.iouThreshold,
            targetSize: AUTO_CAPTURE.DAMAGE.targetSize,
            inputName: AUTO_CAPTURE.DAMAGE.inputName,
            outputName: AUTO_CAPTURE.DAMAGE.outputName
          })
        }

        if (this.damageDetector.isModelLoaded()) {
          return this.damageDetector
        }

        this.setData({ aiLoading: true, aiStatusText: AUTO_CAPTURE.STATUS_TEXT.loading })
        if (!this.damageDetector.isModelLoaded()) {
          await this.damageDetector.load()
        }
      }

      this.setData({ aiReady: true, aiLoading: false, aiStatusText: this.getAIStatusByStep(step) })
      return step === constants.SHOOT_STEP.LICENSE_PLATE ? this.plateDetector : this.damageDetector
    } catch (error) {
      console.error('[AI] detector init failed:', error)
      const aiConfig = envConfig.getAiConfig()
      const systemInfo = getSystemInfoSnapshot()
      const sessionId = runtimeLogger.getSessionId ? runtimeLogger.getSessionId() : ''
      const failurePayload = {
        step,
        feedbackId: sessionId ? `selfCam_${sessionId}` : '',
        appEnv: aiConfig.appEnv,
        wxEnvVersion: aiConfig.wxEnvVersion,
        plateModelUrl: aiConfig.plateModelUrl,
        damageModelUrl: aiConfig.damageModelUrl,
        stage: error?.stage || '',
        modelName: error?.modelName || '',
        statusCode: error?.statusCode || '',
        message: error?.message || '',
        errMsg: error?.errMsg || '',
        systemInfo
      }
      runtimeLogger.error('ai', 'detector_init_failed', failurePayload)
      runtimeLogger.forceError('ai', 'detector_init_failed', failurePayload)
      this.reportAiUnavailable('detector_init_failed', {
        stage: error?.stage || '',
        modelName: error?.modelName || '',
        statusCode: error?.statusCode || '',
        message: error?.message || '',
        errMsg: error?.errMsg || ''
      })
      this.setData({
        aiReady: false,
        aiLoading: false,
        aiAvailable: false,
        aiEnabled: false,
        aiStatusText: AUTO_CAPTURE.STATUS_TEXT.unavailable
      })
      return null
    }
  },

  resumeAIDetection(reason = 'manual') {
    const { currentStep, showConfirmModal } = this.data
    const aiSupportedStep = [constants.SHOOT_STEP.LICENSE_PLATE, constants.SHOOT_STEP.DAMAGE].includes(currentStep)
    const detectionRunning = !!this.detectTimer || this.aiBusy

    runtimeLogger.info('ai', 'resume_detection_request', {
      reason,
      currentStep,
      showConfirmModal,
      isLeaving: this.isLeaving,
      cameraInitialized: this.cameraInitialized,
      hasCameraContext: !!this.cameraContext,
      aiAvailable: this.data.aiAvailable,
      aiEnabled: this.data.aiEnabled,
      detectionRunning,
      plateModelLoaded: !!this.plateDetector?.isModelLoaded?.(),
      damageModelLoaded: !!this.damageDetector?.isModelLoaded?.()
    })

    this.stopAIDetectionLoop()

    if (!aiSupportedStep || showConfirmModal || this.isLeaving || !this.cameraInitialized) {
      this.stopAIFrameListener(`resume_skipped_${reason}`)
      this.setData({ aiStatusText: this.getAIStatusByStep(currentStep), aiLocked: false })
      runtimeLogger.info('ai', 'resume_detection_skipped', {
        reason,
        currentStep,
        aiSupportedStep,
        showConfirmModal,
        isLeaving: this.isLeaving,
        cameraInitialized: this.cameraInitialized
      })
      return
    }

    this.startAIDetectionLoop(currentStep)
  },

  resumeAIDetectionAfterStepReady(reason) {
    this.syncPlateBlink(this.getActiveDistanceHint())
    this.resumeAIDetection(reason)
  },

  getDamageCaptureBox() {
    return {
      x: 134,
      y: 84,
      width: 132,
      height: 132
    }
  },

  getPlateCaptureBox() {
    return {
      x: 100,
      y: 176,
      width: 200,
      height: 68
    }
  },

  async triggerAutoCapture(step, aiDetection) {
    const canUseSelectedDamageFrame = step === constants.SHOOT_STEP.DAMAGE && !!aiDetection?.selectedFramePath

    if ((!canUseSelectedDamageFrame && (!this.cameraContext || !this.cameraInitialized)) || this.isLeaving) {
      runtimeLogger.warn('capture', 'auto_capture_blocked', {
        step,
        hasCameraContext: !!this.cameraContext,
        isLeaving: this.isLeaving,
        cameraInitialized: this.cameraInitialized,
        canUseSelectedDamageFrame
      })
      return
    }

    runtimeLogger.info('capture', 'auto_capture_start', {
      step,
      finalReason: aiDetection?.finalReason || '',
      useSelectedDamageFrame: canUseSelectedDamageFrame
    })
    this.stopAIDetectionLoop()
    this.stopAIFrameListener('auto_capture')
    wx.showLoading({
      title: step === constants.SHOOT_STEP.DAMAGE && aiDetection?.selectedFramePath
        ? '\u5904\u7406\u4e2d...'
        : '\u62cd\u6444\u4e2d...'
    })

    try {
      await new Promise((resolve) => setTimeout(resolve, 300))

      let tempImagePath = ''

      if (step === constants.SHOOT_STEP.DAMAGE && aiDetection?.selectedFramePath) {
        tempImagePath = aiDetection.selectedFramePath
        runtimeLogger.info('capture', 'use_selected_damage_frame', {
          finalReason: aiDetection.finalReason,
          selectedFrameScore: aiDetection.selectedFrameScore
        })
      } else {
        tempImagePath = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            console.error('[AI] auto capture takePhoto timeout')
            reject(new Error('AUTO_CAPTURE_TAKE_PHOTO_TIMEOUT'))
          }, 5000)

          this.cameraContext.takePhoto({
            quality: 'high',
            success: (res) => {
              clearTimeout(timeoutId)
              resolve(res.tempImagePath)
            },
            fail: (err) => {
              clearTimeout(timeoutId)
              console.error('[AI] auto capture takePhoto fail:', err)
              reject(err)
            }
          })
        })
      }

      await this.handlePhoto(tempImagePath, {
        captureMode: 'auto',
        captureTrigger: step === constants.SHOOT_STEP.LICENSE_PLATE
          ? 'ai_plate_detection'
          : `ai_damage_${aiDetection?.finalReason || 'selected_frame'}`,
        aiDetection
      })
    } catch (error) {
      wx.hideLoading()
      console.error('[AI] auto capture failed:', error)
      runtimeLogger.error('capture', 'auto_capture_failed', {
        step,
        finalReason: aiDetection?.finalReason || '',
        message: error?.message || ''
      })
      this.reportAiUnavailable('manual_fallback', {
        stage: 'auto_capture',
        message: error?.message || '',
        errMsg: error?.errMsg || ''
      })
      this.setData({ aiStatusText: AUTO_CAPTURE.STATUS_TEXT.fallback, aiLocked: false })
      wx.showToast({ title: '\u81ea\u52a8\u62cd\u7167\u5931\u8d25\uff0c\u8bf7\u624b\u52a8\u62cd\u7167', icon: 'none' })
      this.resumeAIDetection()
    }
  },

  stopAIDetectionLoop() {
    this.aiDetectionRunId += 1
    if (this.detectTimer) {
      clearTimeout(this.detectTimer)
      this.detectTimer = null
    }
    this.aiBusy = false
  },

  initAICapability() {
    this.plateFrameChecker = new PlateFrameUtils({
      minConsecutiveFrames: AUTO_CAPTURE.PLATE.minConsecutiveFrames,
      minAreaRatio: AUTO_CAPTURE.PLATE.minAreaRatio,
      maxAreaRatio: AUTO_CAPTURE.PLATE.maxAreaRatio,
      centerOffsetThreshold: 0.16
    })
    this.damageAutoCaptureEngine = new DamageAutoCaptureEngine({
      config: AUTO_CAPTURE.DAMAGE_FLOW
    })

    const canUseInference = typeof wx.createInferenceSession === 'function'
    this.setData({
      aiAvailable: canUseInference,
      aiEnabled: canUseInference,
      aiStatusText: canUseInference ? AUTO_CAPTURE.STATUS_TEXT.loading : AUTO_CAPTURE.STATUS_TEXT.unavailable
    })
    runtimeLogger.info('ai', 'capability_ready', { canUseInference })
    if (!canUseInference) {
      this.reportAiUnavailable('inference_api_unavailable', {
        stage: 'inference_api',
        message: 'wx.createInferenceSession is not available'
      })
    }
  },

  destroyDetectors() {
    if (this.plateDetector) {
      this.plateDetector.destroy()
      this.plateDetector = null
    }
    if (this.damageDetector) {
      this.damageDetector.destroy()
      this.damageDetector = null
    }
    if (this.damageAutoCaptureEngine) {
      this.damageAutoCaptureEngine.reset()
    }
  },

  resetDamageAutoCaptureStage() {
    if (this.damageAutoCaptureEngine) {
      this.damageAutoCaptureEngine.reset()
    }
  },

  getDamagePhaseLabel(searchState = {}) {
    if (searchState.captureReady || searchState.phase === 'SHOOT') {
      return '\u81ea\u52a8\u62cd\u7167'
    }
    if (searchState.phase === 'HOLD') {
      return '\u4fdd\u6301\u7a33\u5b9a'
    }
    return '\u7b49\u5f85\u8bc6\u522b'
  },

  formatDamageDebugText(debug = {}, searchState = {}) {
    if (!debug || typeof debug.trackQuality !== 'number') {
      return ''
    }

    const imageAreaRatio = Number.isFinite(debug.imageAreaRatio) ? debug.imageAreaRatio : (debug.areaRatio || 0)
    const minAreaRatio = Number.isFinite(debug.effectiveMinAreaRatio) ? debug.effectiveMinAreaRatio : 0
    const maxAreaRatio = Number.isFinite(debug.effectiveMaxAreaRatio) ? debug.effectiveMaxAreaRatio : 0

    return `phase ${searchState.phase || 'SEEK'} | area ${(imageAreaRatio * 100).toFixed(1)}%/${(minAreaRatio * 100).toFixed(1)}-${(maxAreaRatio * 100).toFixed(1)}% | center ${(debug.centerOffset || 0).toFixed(2)} | stable ${(debug.stability || 0).toFixed(2)} | hold ${searchState.holdStableCount || 0}`
  },

  setDataIfChanged(updates = {}) {
    const changed = {}

    Object.keys(updates).forEach((key) => {
      if (this.data[key] !== updates[key]) {
        changed[key] = updates[key]
      }
    })

    if (!Object.keys(changed).length) {
      return false
    }

    this.setData(changed)
    return true
  },

  getDetectInterval(step) {
    if (step === constants.SHOOT_STEP.LICENSE_PLATE) {
      return AUTO_CAPTURE.PLATE.detectInterval || AUTO_CAPTURE.DETECT_INTERVAL
    }
    if (step === constants.SHOOT_STEP.DAMAGE) {
      return AUTO_CAPTURE.DAMAGE_FLOW.previewInterval || AUTO_CAPTURE.DETECT_INTERVAL
    }
    return AUTO_CAPTURE.DETECT_INTERVAL
  },

  shouldRunDamageDetector() {
    if (!this.damageAutoCaptureEngine) {
      return true
    }
    return this.damageAutoCaptureEngine.shouldRunDetector()
  },

  getActiveDistanceHint() {
    if (this.data.currentStep === constants.SHOOT_STEP.DAMAGE) {
      return this.data.damageDistanceHint
    }
    if (this.data.currentStep === constants.SHOOT_STEP.LICENSE_PLATE) {
      return this.data.plateDistanceHint
    }
    return ''
  },

  startPlateBlink() {
    if (this.plateBlinkTimer) {
      return
    }

    if (this.data.plateBlinkFrame !== 'a') {
      this.setDataIfChanged({ plateBlinkFrame: 'a' })
    }

    this.plateBlinkTimer = setInterval(() => {
      const currentStep = this.data.currentStep
      const activeHint = this.getActiveDistanceHint()
      const supportDistanceHint = currentStep === constants.SHOOT_STEP.LICENSE_PLATE || currentStep === constants.SHOOT_STEP.DAMAGE

      if (this.isLeaving || this.data.showConfirmModal || !supportDistanceHint || !activeHint) {
        this.stopPlateBlink()
        return
      }

      this.setDataIfChanged({
        plateBlinkFrame: this.data.plateBlinkFrame === 'a' ? 'b' : 'a'
      })
    }, 400)
  },

  cancelPlateHintClear() {
    if (this.plateHintClearTimer) {
      clearTimeout(this.plateHintClearTimer)
      this.plateHintClearTimer = null
    }
  },

  schedulePlateHintClear(delay = 900) {
    this.cancelPlateHintClear()
    this.plateHintClearTimer = setTimeout(() => {
      this.plateHintClearTimer = null
      this.stopPlateBlink()
      this.setDataIfChanged({
        plateDistanceHint: '',
        damageDistanceHint: '',
        plateBlinkFrame: 'a'
      })
    }, delay)
  },

  stopPlateBlink() {
    if (this.plateBlinkTimer) {
      clearInterval(this.plateBlinkTimer)
      this.plateBlinkTimer = null
    }

    if (this.data.plateBlinkFrame !== 'a') {
      this.setDataIfChanged({ plateBlinkFrame: 'a' })
    }
  },

  syncPlateBlink(direction) {
    const shouldBlink = !!direction
      && !this.isLeaving
      && !this.data.showConfirmModal
      && (this.data.currentStep === constants.SHOOT_STEP.LICENSE_PLATE || this.data.currentStep === constants.SHOOT_STEP.DAMAGE)

    if (shouldBlink) {
      this.startPlateBlink()
      return
    }

    this.stopPlateBlink()
  },

  getPlateDistanceHint(status) {
    if (!status || status.consecutiveMet || status.inBox || !status.centerAligned) {
      return {
        direction: '',
        text: ''
      }
    }

    if (status.areaRatio < AUTO_CAPTURE.PLATE.minAreaRatio) {
      return {
        direction: 'forward',
        text: PLATE_DISTANCE_HINT_TEXT.forward
      }
    }

    if (status.areaRatio > AUTO_CAPTURE.PLATE.maxAreaRatio) {
      return {
        direction: 'backward',
        text: PLATE_DISTANCE_HINT_TEXT.backward
      }
    }

    return {
      direction: '',
      text: ''
    }
  },

  getDamageDistanceHint(damageState) {
    if (!damageState || damageState.captureReady || !damageState.hasTrack) {
      return {
        direction: '',
        text: ''
      }
    }

    const debug = damageState.debug || {}
    const minAreaRatio = Number.isFinite(debug.effectiveMinAreaRatio)
      ? debug.effectiveMinAreaRatio
      : AUTO_CAPTURE.DAMAGE_FLOW.phase.minAreaRatio
    const maxAreaRatio = Number.isFinite(debug.effectiveMaxAreaRatio)
      ? debug.effectiveMaxAreaRatio
      : AUTO_CAPTURE.DAMAGE_FLOW.phase.maxAreaRatio
    const areaRatio = Number.isFinite(debug.imageAreaRatio)
      ? debug.imageAreaRatio
      : (debug.areaRatio || 0)

    if (areaRatio < minAreaRatio) {
      return {
        direction: 'forward',
        text: DAMAGE_DISTANCE_HINT_TEXT.forward
      }
    }

    if (areaRatio > maxAreaRatio) {
      return {
        direction: 'backward',
        text: DAMAGE_DISTANCE_HINT_TEXT.backward
      }
    }

    return {
      direction: '',
      text: ''
    }
  },

  resetAIState() {
    if (this.plateFrameChecker) {
      this.plateFrameChecker.reset()
    }
    this.resetDamageAutoCaptureStage()
    this.cancelPlateHintClear()
    this.stopPlateBlink()
    this.aiCooldownUntil = 0
    this.aiBusy = false
      this.setData({
        aiLocked: false,
        aiStatusText: this.data.aiEnabled && this.data.aiAvailable ? '' : AUTO_CAPTURE.STATUS_TEXT.unavailable,
        plateFrameState: 'normal',
        plateDistanceHint: '',
        damageDistanceHint: '',
        plateBlinkFrame: 'a',
        damageFrameState: 'normal',
        damageAreaRatioText: '',
        damagePhaseLabel: this.data.currentStep === constants.SHOOT_STEP.DAMAGE
        ? this.getDamagePhaseLabel({ phase: 'SEEK' })
        : ''
      })
  },

  startAIFrameListener(reason = 'manual') {
    if (!this.cameraContext || typeof this.cameraContext.onCameraFrame !== 'function') {
      return false
    }
    if (this.cameraFrameListener) {
      return true
    }

    this.latestAIFrame = null
    const listener = this.cameraContext.onCameraFrame((frame) => {
      if (!frame || !frame.data || !frame.width || !frame.height) {
        return
      }
      this.latestAIFrame = {
        data: frame.data,
        width: frame.width,
        height: frame.height,
        capturedAt: Date.now()
      }
    })

    this.cameraFrameListener = listener

    try {
      if (listener && typeof listener.start === 'function') {
        listener.start({
          success: () => {
            runtimeLogger.info('ai', 'ai_frame_listener_start', { reason })
          },
          fail: (err) => {
            if (this.cameraFrameListener === listener) {
              this.cameraFrameListener = null
              this.latestAIFrame = null
            }
            runtimeLogger.warn('ai', 'ai_frame_listener_start_failed', {
              reason,
              message: err?.errMsg || err?.message || ''
            })
          }
        })
      } else {
        runtimeLogger.info('ai', 'ai_frame_listener_start', {
          reason,
          startMethod: 'unavailable'
        })
      }
      return true
    } catch (error) {
      if (this.cameraFrameListener === listener) {
        this.cameraFrameListener = null
        this.latestAIFrame = null
      }
      runtimeLogger.warn('ai', 'ai_frame_listener_start_failed', {
        reason,
        message: error?.errMsg || error?.message || ''
      })
      return false
    }
  },

  stopAIFrameListener(reason = 'manual') {
    const listener = this.cameraFrameListener
    if (!listener) {
      this.latestAIFrame = null
      return false
    }

    this.cameraFrameListener = null
    this.latestAIFrame = null

    try {
      if (typeof listener.stop === 'function') {
        listener.stop({
          success: () => {
            runtimeLogger.info('ai', 'ai_frame_listener_stop', { reason })
          },
          fail: (err) => {
            runtimeLogger.warn('ai', 'ai_frame_listener_stop_failed', {
              reason,
              message: err?.errMsg || err?.message || ''
            })
          }
        })
      } else {
        runtimeLogger.info('ai', 'ai_frame_listener_stop', {
          reason,
          stopMethod: 'unavailable'
        })
      }
    } catch (error) {
      runtimeLogger.warn('ai', 'ai_frame_listener_stop_failed', {
        reason,
        message: error?.errMsg || error?.message || ''
      })
    }

    return true
  },

  getAIFrameBytes(frameData) {
    if (!frameData) {
      return null
    }
    if (frameData instanceof Uint8ClampedArray) {
      return frameData
    }
    if (frameData instanceof ArrayBuffer) {
      return new Uint8ClampedArray(frameData)
    }
    if (ArrayBuffer.isView(frameData)) {
      return new Uint8ClampedArray(frameData.buffer, frameData.byteOffset, frameData.byteLength)
    }
    return null
  },

  convertAIFrameToImagePath(frame) {
    return new Promise((resolve, reject) => {
      const width = Math.floor(Number(frame?.width) || 0)
      const height = Math.floor(Number(frame?.height) || 0)
      const frameBytes = this.getAIFrameBytes(frame?.data)

      if (!width || !height || !frameBytes) {
        reject(new Error('AI_FRAME_INVALID'))
        return
      }
      if (typeof wx.createOffscreenCanvas !== 'function') {
        reject(new Error('AI_FRAME_CANVAS_UNAVAILABLE'))
        return
      }

      const canvas = wx.createOffscreenCanvas({
        type: '2d',
        width,
        height
      })
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx || typeof ctx.putImageData !== 'function') {
        reject(new Error('AI_FRAME_CANVAS_CONTEXT_UNAVAILABLE'))
        return
      }

      const imageData = typeof ctx.createImageData === 'function'
        ? ctx.createImageData(width, height)
        : (typeof ctx.getImageData === 'function' ? ctx.getImageData(0, 0, width, height) : null)
      if (!imageData || !imageData.data) {
        reject(new Error('AI_FRAME_IMAGE_DATA_UNAVAILABLE'))
        return
      }

      imageData.data.set(frameBytes.subarray(0, imageData.data.length))
      ctx.putImageData(imageData, 0, 0)

      const success = (res) => {
        const imagePath = res?.tempFilePath || res?.tempImagePath || ''
        if (!imagePath) {
          reject(new Error('AI_FRAME_TEMP_PATH_EMPTY'))
          return
        }
        resolve(imagePath)
      }
      const fail = (err) => {
        reject(err || new Error('AI_FRAME_TO_PATH_FAILED'))
      }

      if (typeof canvas.toTempFilePath === 'function') {
        canvas.toTempFilePath({
          x: 0,
          y: 0,
          width,
          height,
          destWidth: width,
          destHeight: height,
          fileType: 'jpg',
          quality: 0.8,
          success,
          fail
        })
        return
      }

      if (typeof wx.canvasToTempFilePath === 'function') {
        wx.canvasToTempFilePath({
          canvas,
          x: 0,
          y: 0,
          width,
          height,
          destWidth: width,
          destHeight: height,
          fileType: 'jpg',
          quality: 0.8,
          success,
          fail
        })
        return
      }

      reject(new Error('AI_FRAME_TO_PATH_UNAVAILABLE'))
    })
  },

  async takeAIPreviewPhoto() {
    if (!this.cameraContext || !this.cameraInitialized || this.isLeaving) {
      return ''
    }

    const frame = this.latestAIFrame
    if (!frame) {
      return ''
    }

    if (!this.aiPreviewTakePhotoRemovedLogged) {
      runtimeLogger.info('ai', 'ai_preview_take_photo_removed', {
        source: 'onCameraFrame'
      })
      this.aiPreviewTakePhotoRemovedLogged = true
    }

    try {
      return await this.convertAIFrameToImagePath(frame)
    } catch (error) {
      runtimeLogger.warn('ai', 'ai_preview_frame_to_path_failed', {
        message: error?.errMsg || error?.message || ''
      })
      return ''
    }
  },

  startAIDetectionLoop(step) {
    this.stopAIDetectionLoop()

    if (!this.data.aiAvailable || !this.data.aiEnabled || !this.cameraContext || !this.cameraInitialized) {
      this.setData({ aiStatusText: this.getAIStatusByStep(step) || AUTO_CAPTURE.STATUS_TEXT.unavailable })
      runtimeLogger.info('ai', 'detection_loop_blocked', {
        step,
        aiAvailable: this.data.aiAvailable,
        aiEnabled: this.data.aiEnabled,
        hasCameraContext: !!this.cameraContext,
        cameraInitialized: this.cameraInitialized
      })
      return
    }

    this.startAIFrameListener(`detection_loop_${step}`)

    const runId = this.aiDetectionRunId
    runtimeLogger.info('ai', 'detection_loop_start', {
      step,
      runId,
      detectInterval: this.getDetectInterval(step),
      plateModelLoaded: !!this.plateDetector?.isModelLoaded?.(),
      damageModelLoaded: !!this.damageDetector?.isModelLoaded?.()
    })

    const scheduleNext = () => {
      if (runId === this.aiDetectionRunId && !this.isLeaving && !this.data.showConfirmModal) {
        this.detectTimer = setTimeout(loop, this.getDetectInterval(step))
      }
    }

    const loop = async () => {
      let shouldSchedule = true
      const isActiveRun = () => runId === this.aiDetectionRunId
      if (runId !== this.aiDetectionRunId) {
        return
      }
      if (this.isLeaving) {
        return
      }
      if (this.aiBusy || this.data.showConfirmModal) {
        scheduleNext()
        return
      }

      if (Date.now() < this.aiCooldownUntil) {
        this.setDataIfChanged({ aiStatusText: AUTO_CAPTURE.STATUS_TEXT.cooldown, aiLocked: false })
        scheduleNext()
        return
      }

      try {
        this.aiBusy = true
        const detector = await this.ensureDetector(step)
        if (!detector || !isActiveRun()) {
          return
        }

        const previewPhoto = await this.takeAIPreviewPhoto()
        if (!previewPhoto || !isActiveRun()) {
          return
        }

        const shouldDetect = step !== constants.SHOOT_STEP.DAMAGE || this.shouldRunDamageDetector()
        let result = null
        if (shouldDetect) {
          result = await detector.detect(previewPhoto)
          if (!isActiveRun()) {
            return
          }
          if (result) {
            result.previewPath = previewPhoto
          }
        }

        if (!isActiveRun()) {
          return
        }

        const ready = this.checkAutoCaptureReady(step, {
          result,
          previewPath: previewPhoto,
          timestamp: Date.now()
        })

        if (ready.captureReady) {
          runtimeLogger.info('capture', 'auto_capture_ready', {
            step,
            finalReason: ready.aiDetection?.finalReason || '',
            selectedFramePath: !!ready.aiDetection?.selectedFramePath
          })
          this.setDataIfChanged({
            aiLocked: true,
            aiStatusText: AUTO_CAPTURE.STATUS_TEXT.locked,
            damagePhaseLabel: step === constants.SHOOT_STEP.DAMAGE
              ? this.getDamagePhaseLabel({ phase: 'SHOOT', captureReady: true })
              : this.data.damagePhaseLabel
          })
          shouldSchedule = false
          await this.triggerAutoCapture(step, ready.aiDetection)
          this.aiCooldownUntil = Date.now() + AUTO_CAPTURE.COOLDOWN_MS
        } else {
          this.setDataIfChanged({
            aiLocked: false,
            aiStatusText: ready.statusText || this.getAIStatusByStep(step)
          })
        }
      } catch (error) {
        console.error('[AI] detect loop error:', error)
        runtimeLogger.error('ai', 'detect_loop_error', {
          step,
          message: error?.message || ''
        })
        this.reportAiUnavailable('manual_fallback', {
          stage: 'detect_loop',
          message: error?.message || '',
          errMsg: error?.errMsg || ''
        })
        if (isActiveRun()) {
          this.setDataIfChanged({ aiLocked: false, aiStatusText: AUTO_CAPTURE.STATUS_TEXT.fallback })
        }
      } finally {
        if (!isActiveRun()) {
          return
        }
        this.aiBusy = false
        if (shouldSchedule) {
          scheduleNext()
        }
      }
    }

    this.detectTimer = setTimeout(loop, this.getDetectInterval(step))
  },

  checkAutoCaptureReady(step, framePayload) {
    const frame = framePayload && typeof framePayload === 'object' && Object.prototype.hasOwnProperty.call(framePayload, 'result')
      ? framePayload
      : {
        result: framePayload || null,
        previewPath: framePayload?.previewPath || '',
        timestamp: Date.now()
      }
    const result = frame.result

    if (!result && step === constants.SHOOT_STEP.LICENSE_PLATE && this.plateFrameChecker) {
      this.plateFrameChecker.reset()
      this.setDataIfChanged({
        plateFrameState: 'normal'
      })
      this.schedulePlateHintClear()
    }

    if (step === constants.SHOOT_STEP.LICENSE_PLATE) {
      if (!result) {
        return {
          captureReady: false,
          statusText: this.getAIStatusByStep(step)
        }
      }

      const status = this.plateFrameChecker.checkFrameStatus(result, this.getPlateCaptureBox(), 400, 300)
      const distanceHint = this.getPlateDistanceHint(status)
      let plateFrameState = 'detected'
      if (status.consecutiveMet) {
        plateFrameState = 'locked'
      } else if (status.inBox) {
        plateFrameState = 'stable'
      }

      let statusText = AUTO_CAPTURE.STATUS_TEXT.detected
      if (status.consecutiveMet) {
        statusText = AUTO_CAPTURE.STATUS_TEXT.locked
      } else if (status.inBox) {
        statusText = AUTO_CAPTURE.STATUS_TEXT.stabilizing
      } else if (distanceHint.text) {
        statusText = distanceHint.text
      } else {
        statusText = AUTO_CAPTURE.STATUS_TEXT.adjustTarget
      }

      this.setDataIfChanged({
        plateFrameState,
        plateDistanceHint: distanceHint.direction
      })
      if (distanceHint.direction) {
        this.cancelPlateHintClear()
        this.syncPlateBlink(distanceHint.direction)
      } else {
        this.schedulePlateHintClear(500)
      }
      return {
        captureReady: status.consecutiveMet,
        statusText,
        aiDetection: {
          detected: true,
          score: result.confidence,
          stableFrames: status.consecutiveCount,
          box: result
        }
      }
    }

    if (!this.damageAutoCaptureEngine) {
      return {
        captureReady: false,
        statusText: AUTO_CAPTURE.STATUS_TEXT.moveToBox
      }
    }

    const damageState = this.damageAutoCaptureEngine.update({
      detection: result,
      previewPath: frame.previewPath || result?.previewPath || '',
      timestamp: frame.timestamp || Date.now(),
      captureBox: this.getDamageCaptureBox(),
      canvasWidth: 400,
      canvasHeight: 300
    })
    const damageFrameState = damageState.captureReady
      ? 'locked'
      : ((damageState.phase === 'HOLD' || damageState.detected || damageState.hasTrack) ? 'active' : 'normal')
    const damageDistanceHint = this.getDamageDistanceHint(damageState)

    this.setDataIfChanged({
      damageFrameState,
      damageDistanceHint: damageDistanceHint.direction,
      damageAreaRatioText: this.data.showDamageDebug
        ? this.formatDamageDebugText(damageState.debug, damageState)
        : '',
      damagePhaseLabel: this.getDamagePhaseLabel(damageState)
    })

    if (damageDistanceHint.direction) {
      this.cancelPlateHintClear()
      this.syncPlateBlink(damageDistanceHint.direction)
    } else {
      this.schedulePlateHintClear(500)
    }

    return {
      captureReady: !!damageState.captureReady,
      statusText: damageDistanceHint.text || damageState.statusText || AUTO_CAPTURE.STATUS_TEXT.detected,
      aiDetection: damageState.aiDetection
    }
  },
  loadCacheData(resumeReason = 'load_cache_data') {
    const cache = storage.loadCacheForResume()
    const flowContext = cacheSelectors.getCurrentFlowContext(cache)
    
    if (!cache) {
      // 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾剧粯绻涢幋鐐垫噧缂佸墎鍋ら弻娑㈠Ψ椤旂厧顫╃紓浣插亾闁割偆鍠撶弧鈧梻鍌氱墛缁嬫帡鏁嶉弮鍫熺厾闁哄娉曟禒銏ゆ婢舵劖鐓ユ繝闈涙婢ф稒銇勮箛鏇炐ラ柣銉邯瀹曪綁濡疯閻撴捇姊洪崫鍕伇闁哥姵鐗犻悰顕€宕卞鍏夹梻浣瑰缁嬫垹绮旇ぐ鎺戣摕闁绘柨鍚嬮崑鈺呮倶閻愮紟鎺楀几閸涘瓨鈷戦柛婵嗗椤箓鏌涢弬璺ㄧ劯闁糕斂鍎插鍕箾閵忋垹鏋涢柟铏墵閸┾剝鎷呴幇鐔哄仧缁辨捇宕掑顑藉亾閻戣姤鍤勯柛鎾茬閸ㄦ繃銇勯弽顐粶闁搞劌鍊块弻娑⑩€﹂幋婵囩亾闂佸搫妫寸粻鎾诲蓟濞戙埄鏁冮柨婵嗘椤︺劑姊虹粙鍖″姛闁稿繑锕㈠濠氬Χ閸パ勭€抽梺鍛婎殘閸嬫盯锝為锔解拺闁圭娴烽埊鏇犵磼鐎ｎ偄绗ч柟骞垮灩閳规垿宕辫箛鏃備簴闂備礁澹婇悡鍫ュ窗濡ゅ懏鍊堕柛顐ｇ箥濞撳鏌曢崼婵囶棞闁诲繈鍎查妵鍕晝閳ь剟鎮樺顓犫攳?
      runtimeLogger.warn('camera', 'cache_missing_redirect_index')
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    if (!flowContext.hasVehicles) {
      runtimeLogger.warn('camera', 'vehicles_missing_redirect_index')
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    if (!flowContext.hasRetakeContext && flowContext.currentStep === constants.SHOOT_STEP.PREVIEW) {
      runtimeLogger.info('camera', 'safe_resume_redirect_preview', {
        workflowState: flowContext.workflowState
      })
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/preview/preview' })
      return
    }

    // 婵犵數濮烽弫鍛婃叏閻戝鈧倿鎸婃竟鈺嬬秮瀹曘劑寮堕幋鐙呯幢闂備線鈧偛鑻晶鎾煛鐏炲墽銆掗柍褜鍓ㄧ紞鍡涘磻閸涱厾鏆︾€光偓閸曨剛鍘?currentVehicleIndex 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈠Χ閸屾矮澹曞┑顔矫畷顒勫储鐎电硶鍋撶憴鍕妞ゎ偄顦遍埀顒勬涧閵堢顕ｉ崼鏇炵闁绘ê鐏氬В搴㈢節閻㈤潧浠﹂柟绋款煼瀹曟椽宕橀鑲╋紱闂佽鍎抽悘鍫ュ磻閹炬枼鏋旈柛顭戝枟閻忓牓姊虹拠鑼闁煎綊绠栭、姘跺Ψ閳轰胶顦板銈嗘尰缁嬫垶绂嶆ィ鍐╃叆婵犻潧妫濋妤€霉濠婂嫮绠為柡?
    if (flowContext.currentVehicleIndex === undefined || flowContext.currentVehicleIndex === null) {
      runtimeLogger.warn('camera', 'vehicle_index_invalid_redirect_index')
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    const currentVehicle = flowContext.currentVehicle
    
    if (!currentVehicle) {
      runtimeLogger.warn('camera', 'current_vehicle_missing_redirect_index', {
        currentVehicleIndex: flowContext.currentVehicleIndex
      })
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }
    
    const damageCount = flowContext.damageCount

    // 婵犵數濮烽弫鍛婃叏閻戝鈧倿鎸婃竟鈺嬬秮瀹曘劑寮堕幋鐙呯幢闂備線鈧偛鑻晶鎾煛鐏炲墽銆掗柍褜鍓ㄧ紞鍡涘磻閸涱厾鏆︾€光偓閸曨剛鍘搁悗鍏夊亾閻庯綆鍓涢敍鐔哥箾鐎电顎撳┑鈥虫喘楠炲繘鎮╃拠鑼唽闂佸湱鍎ら崺鍫濐焽閵夈儮鏀介柣妯活問閺嗩垶鏌嶈閸撴瑩宕捄銊ф／鐟滄棃寮婚悢纰辨晩闁绘挸绨堕崑鎾诲箹娴ｇ懓浠奸梺缁樺灱濡嫬鏁梻浣稿暱閹碱偊宕愰悷鎵虫瀺闁糕剝绋掗埛鎴︽煕韫囨稒锛熼柤鍓蹭邯閺屾稒鎯旈姀銏″垱闂佽桨绀侀崯鏉戠暦閹烘垟妲堥柟鐑樻尭椤忓綊姊婚崒娆戭槮婵犫偓鏉堚晛鍨濇い鏍ㄧ矋閺嗘粓鏌ｉ幇顒夊殶濠⒀€鍓濈换婵嬫偨闂堟刀锝嗐亜閺冣偓閻楃姴鐣风憴鍕嚤閻庢稒锚閳ь剝鍩栫换婵嬫濞戝啿濮涙繛瀛樼矆缁瑥顫忕紒妯诲闁告繂瀚紓鎾绘⒑缁嬫寧鍞夊ù婊庡墯缁旂喖寮撮姀鈺傛櫍闂佺粯锚閸熷潡宕㈣ぐ鎺撯拺?
    if (flowContext.hasRetakeContext) {
      const { currentStep, vehicleType } = flowContext.retakeContext
      this.setData({
        currentStep,
        guideTip: flowContext.guideTip,
        vehicleType: vehicleType || constants.VEHICLE_TYPE.TARGET,
        damageCount,
        damagePhaseLabel: currentStep === constants.SHOOT_STEP.DAMAGE
          ? this.getDamagePhaseLabel({ phase: 'SEEK' })
          : '',
        damageAreaRatioText: ''
      }, () => {
        runtimeLogger.info('camera', 'cache_data_applied', {
          resumeReason,
          currentStep: this.data.currentStep,
          cameraInitialized: this.cameraInitialized,
          hasCameraContext: !!this.cameraContext,
          aiEnabled: this.data.aiEnabled,
          detectionRunning: !!this.detectTimer || this.aiBusy
        })
        this.resumeAIDetectionAfterStepReady(resumeReason)
      })
      workflowPage.syncPageWorkflowState(this, workflow.STATES.RETAKING, {
        page: 'camera',
        step: currentStep
      })
    } else {
      this.setData({
        currentStep: flowContext.currentStep,
        guideTip: flowContext.guideTip,
        vehicleType: flowContext.currentVehicleType || constants.VEHICLE_TYPE.TARGET,
        damageCount,
        damagePhaseLabel: flowContext.currentStep === constants.SHOOT_STEP.DAMAGE
          ? this.getDamagePhaseLabel({ phase: 'SEEK' })
          : '',
        damageAreaRatioText: ''
      }, () => {
        runtimeLogger.info('camera', 'cache_data_applied', {
          resumeReason,
          currentStep: this.data.currentStep,
          cameraInitialized: this.cameraInitialized,
          hasCameraContext: !!this.cameraContext,
          aiEnabled: this.data.aiEnabled,
          detectionRunning: !!this.detectTimer || this.aiBusy
        })
        this.resumeAIDetectionAfterStepReady(resumeReason)
      })
      workflowPage.syncPageWorkflowState(
        this,
        this.data.showConfirmModal && this.data.pendingPhoto
          ? workflow.STATES.CONFIRMING
          : workflow.STATES.CAPTURING,
        {
          page: 'camera',
          step: flowContext.currentStep
        }
      )
    }
  },

  onCapture() {
    runtimeLogger.info('capture', 'manual_capture_pressed', {
      currentStep: this.data.currentStep,
      cameraInitialized: this.cameraInitialized,
      hasCameraContext: !!this.cameraContext
    })

    if (!this.cameraInitialized || !this.cameraContext) {
      wx.showToast({ title: '\u76f8\u673a\u521d\u59cb\u5316\u4e2d', icon: 'none' })
      console.warn('[camera] capture blocked: camera not initialized')
      return
    }

    this.stopAIDetectionLoop()
    this.stopAIFrameListener('manual_capture')
    this.setData({ aiLocked: false, aiStatusText: this.getAIStatusByStep(this.data.currentStep) })
    wx.showLoading({ title: '\u5904\u7406\u4e2d...' })

    this.cameraContext.takePhoto({
      quality: 'high',
      success: (res) => {
        this.handlePhoto(res.tempImagePath, {
          captureMode: 'manual',
          captureTrigger: 'manual_button',
          aiDetection: null
        })
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({ title: '\u62cd\u7167\u5931\u8d25', icon: 'none' })
        console.error('闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀缁犵娀鏌熼幑鎰靛殭閹兼潙锕弻銈囧枈閸楃偛顫梺娲诲幗閹瑰洭寮诲☉銏╂晝闁挎繂妫涢ˇ銉╂⒑濞茶骞楁い銊ワ躬閻涱噣寮介‖銉ラ叄椤㈡鍩€椤掑嫭鍊堕柍鍝勫暟绾惧ジ鏌涢幘鑼槮濞寸姾浜埀顒侇問閸犳牠鎮ラ悡搴ｆ殾濠靛倸澹婇弫鍐┿亜椤愵偄骞栭柛銈変憾閺?', err)
      }
    })
  },

  async handlePhoto(tempFilePath, meta = {}) {
    runtimeLogger.info('capture', 'handle_photo_start', {
      currentStep: this.data.currentStep,
      captureMode: meta.captureMode || 'manual',
      captureTrigger: meta.captureTrigger || '',
      hasAiDetection: !!meta.aiDetection
    })
    try {
      // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閾忣偅鐝ㄦ繝纰夌磿閸嬫垿宕愰弽顓炲瀭闂傚牊鑰藉ú顏勎╃憸搴綖閺囥垺鐓欓柣鎰靛墯缂嶆垹绱掗崜浣镐槐闁哄瞼鍠栭弻鍥晝閳ь剚鏅舵导瀛樼厱濠电姴瀚禒杈ㄦ叏婵犲啯銇濈€规洏鍔嶇换婵嬪礃閵娧勨枈闂傚倷绀侀幉锟犲礉濡ゅ懎纾婚柟鐐?
      const compressedPhoto = await compress.compressImage(tempFilePath)
      const normalizedPhoto = storage.normalizePhotoMeta(compressedPhoto, meta)

      const qualityResult = await this.analyzePendingPhotoQuality(normalizedPhoto)
      const photoWithQuality = photoQuality.attachPhotoQualityMeta(normalizedPhoto, qualityResult)
      const qualityHintText = photoQuality.buildQualityHintText(qualityResult)

      // 濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧浠ч柛瀣尭閳诲秹宕卞☉娆戝幈闁诲函缍嗘禍婊堝焵椤掆偓椤兘鐛径濠庢桨鐎光偓閳ь剟鎮块埀顒勬⒑閸濆嫬鏆婇柛瀣尰缁?
      this.savePhoto(photoWithQuality, {
        qualityHintText
      })
      
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '\u56fe\u7247\u5904\u7406\u5931\u8d25', icon: 'none' })
      console.error('闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇炲€哥粻鏍煕椤愶絾绀€缁炬儳娼″鍫曞醇濞戞ê顬夊┑鐐叉噽婵炩偓闁哄被鍊濋獮渚€骞掗幋婵嗩潥婵犵數鍋涢幊鎰箾閳ь剟鏌＄仦绯曞亾閹颁礁鎮戦梺鍛婂姂閸斿矂鈥栭崼銏㈢＝濞达絿顭堥。鎶芥煕鐎ｃ劌鈧繂顕ｇ拠娴嬫闁靛繒濮村畵鍡涙⒑闂堟侗鐒鹃柛搴や含缁煤椤忓應鎷虹紓浣割儏鐏忓懘宕濋悢鍏肩厱閻庯綆鍋嗗ú鎾煃閵夘垳鐣电€规洜顭堣灃闁逞屽墰缁顫濋懜鐢靛幍濠电偛鐗嗛悘婵嬪几閵堝洨纾介柛顐犲劙閹查箖鏌?', err)
      this.resumeAIDetection()
    }
  },

  async analyzePendingPhotoQuality(photo) {
    if (!photo || !photo.compressedPath) {
      return null
    }

    try {
      const result = await photoQuality.analyzePhotoQuality({
        filePath: photo.compressedPath
      })

      runtimeLogger.info('capture', 'photo_quality_analyzed', {
        level: result?.level || '',
        suggestRetake: !!result?.suggestRetake,
        reasons: Array.isArray(result?.reasons) ? result.reasons : []
      })

      return result
    } catch (error) {
      runtimeLogger.warn('capture', 'photo_quality_analyze_failed', {
        message: error?.message || String(error)
      })
      return null
    }
  },

  savePhoto(photo, options = {}) {
    const cachedFlowContext = cacheSelectors.getCurrentFlowContext(storage.loadCache())
    runtimeLogger.info('capture', 'photo_pending_confirm', {
      currentStep: cachedFlowContext.currentStep,
      captureMode: photo.captureMode,
      captureTrigger: photo.captureTrigger
    })
    const cache = storage.loadCache()
    if (!cache) return
    const flowContext = cacheSelectors.getCurrentFlowContext(cache)

    if (storage.isRetakeMode()) {
      storage.saveRetakenPhoto(photo)
      const latestCache = storage.loadCache()
      if (latestCache) {
        storage.saveCache(storage.clearPreviewFlags(latestCache))
      }
      wx.navigateBack({
        fail: () => {
          wx.redirectTo({ url: '/pages/preview/preview' })
        }
      })
      return
    }

    this.setData({
      showConfirmModal: true,
      qualityHintText: options.qualityHintText || '',
      pendingPhoto: photo
    })
    workflowPage.syncPageWorkflowState(this, workflow.STATES.CONFIRMING, {
      page: 'camera',
      step: flowContext.currentStep
    })
  },

  onConfirmPhoto() {
    const cachedFlowContext = cacheSelectors.getCurrentFlowContext(storage.loadCache())
    runtimeLogger.info('capture', 'confirm_photo', {
      currentStep: cachedFlowContext.currentStep,
      hasPendingPhoto: !!this.data.pendingPhoto
    })
    const cache = storage.loadCache()
    const pendingPhoto = this.data.pendingPhoto
    if (!cache || !pendingPhoto) return

    const flowContext = cacheSelectors.getCurrentFlowContext(cache)

    if (isTotalPhotoLimitReached(cache)) {
      showTotalPhotoLimitToast()
      return
    }

    const currentVehicle = cache.vehicles[flowContext.currentVehicleIndex]
    if (!currentVehicle) return

    Promise.resolve(album.saveConfirmedPhotoToAlbum(pendingPhoto))
      .catch((err) => {
        console.warn('[album] saveConfirmedPhotoToAlbum unexpected failure:', err)
      })

    if (flowContext.currentStep === constants.SHOOT_STEP.LICENSE_PLATE) {
      currentVehicle.licensePlate = {
        ...pendingPhoto,
        status: 'completed',
        recognizedText: '',
        isManualInput: true,
        isNewEnergy: false
      }
      cache.currentStep = constants.SHOOT_STEP.VIN_CODE
      storage.saveCache(cache)

      this.setData({
        showConfirmModal: false,
        pendingPhoto: null,
        qualityHintText: '',
        currentStep: cache.currentStep,
        guideTip: constants.GUIDE_TIPS[cache.currentStep],
        damagePhaseLabel: ''
      }, () => {
        workflowPage.syncPageWorkflowState(this, workflow.STATES.CAPTURING, {
          page: 'camera',
          step: cache.currentStep
        })
        this.resetAIState()
        this.resumeAIDetectionAfterStepReady('confirm_license_plate')
      })
      return
    }

    if (flowContext.currentStep === constants.SHOOT_STEP.VIN_CODE) {
      currentVehicle.vinCode = {
        ...pendingPhoto,
        status: 'completed',
        recognizedText: '',
        isManualInput: true
      }
      cache.currentStep = constants.SHOOT_STEP.DAMAGE
      cache.currentDamageCount = 0
      const damageCount = currentVehicle.damages?.length || 0
      storage.saveCache(cache)

      this.setData({
        showConfirmModal: false,
        pendingPhoto: null,
        qualityHintText: '',
        currentStep: cache.currentStep,
        guideTip: constants.GUIDE_TIPS[cache.currentStep],
        damageCount,
        damagePhaseLabel: this.getDamagePhaseLabel({ phase: 'SEEK' })
      }, () => {
        workflowPage.syncPageWorkflowState(this, workflow.STATES.CAPTURING, {
          page: 'camera',
          step: cache.currentStep
        })
        this.resetAIState()
        this.resumeAIDetectionAfterStepReady('confirm_vin_to_damage')
      })
      return
    }

    if (!currentVehicle.damages) {
      currentVehicle.damages = []
    }
    currentVehicle.damages.push(pendingPhoto)
    cache.currentDamageCount = currentVehicle.damages.length
    storage.saveCache(cache)
    runtimeLogger.info('damage_flow', 'damage_photo_saved', {
      damageCount: currentVehicle.damages.length,
      captureMode: pendingPhoto.captureMode,
      captureTrigger: pendingPhoto.captureTrigger
    })

    if (currentVehicle.damages.length >= constants.LIMITS.MAX_DAMAGES) {
      this.isLeaving = true
      this.setData({
        showConfirmModal: false,
        pendingPhoto: null,
        qualityHintText: '',
        damageCount: currentVehicle.damages.length,
        damagePhaseLabel: this.getDamagePhaseLabel({ phase: 'SEEK' }),
        damageAreaRatioText: ''
      })

      if (cache.fromPreview) {
        storage.saveCache(storage.clearPreviewFlags(cache))
        const pages = getCurrentPages()
        const hasPreviewInStack = pages.some((page) => page.route === 'pages/preview/preview')

        if (hasPreviewInStack) {
          wx.navigateBack({
            fail: () => {
              wx.redirectTo({
                url: '/pages/preview/preview',
                fail: () => {
                  wx.reLaunch({ url: '/pages/preview/preview' })
                }
              })
            }
          })
        } else {
          wx.redirectTo({
            url: '/pages/preview/preview',
            fail: () => {
              wx.reLaunch({ url: '/pages/preview/preview' })
            }
          })
        }
      } else {
        storage.saveCache(storage.clearPreviewFlags(cache))
        wx.navigateTo({
          url: '/pages/preview/preview',
          fail: () => {
            wx.redirectTo({
              url: '/pages/preview/preview',
              fail: () => {
                wx.reLaunch({ url: '/pages/preview/preview' })
              }
            })
          }
        })
      }
      return
    }

    this.setData({
      showConfirmModal: false,
      pendingPhoto: null,
      qualityHintText: '',
      damageCount: currentVehicle.damages.length,
      damageFrameState: 'normal',
      damagePhaseLabel: this.getDamagePhaseLabel({ phase: 'SEEK' }),
      damageAreaRatioText: ''
    }, () => {
      workflowPage.syncPageWorkflowState(this, workflow.STATES.CAPTURING, {
        page: 'camera',
        step: cache.currentStep
      })
      this.resetAIState()
      this.resumeAIDetectionAfterStepReady('confirm_damage_continue')
    })
  },

  onFinishDamage() {
    if (this.data.isNavigating) {
      return
    }

    runtimeLogger.info('damage_flow', 'finish_damage_pressed', {
      damageCount: this.data.damageCount
    })

    if (this.data.showConfirmModal && this.data.pendingPhoto) {
      this.savePendingPhotoBeforeLeave()
    }

    this.setData({ isNavigating: true })
    this.isLeaving = true

    const cache = storage.loadCache()
    if (!cache) {
      runtimeLogger.warn('camera', 'finish_damage_without_cache')
      this.setData({ isNavigating: false })
      this.isLeaving = false
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }
    const flowContext = cacheSelectors.getCurrentFlowContext(cache)

    if (flowContext.fromPreview) {
      storage.saveCache(storage.clearPreviewFlags(cache))
      const pages = getCurrentPages()
      const hasPreviewInStack = pages.some((page) => page.route === 'pages/preview/preview')
      if (hasPreviewInStack) {
        wx.navigateBack({
          fail: () => {
            runtimeLogger.warn('camera', 'navigate_back_preview_failed')
            wx.redirectTo({
              url: '/pages/preview/preview',
              fail: () => {
                wx.reLaunch({ url: '/pages/preview/preview' })
              }
            })
          }
        })
      } else {
        wx.redirectTo({
          url: '/pages/preview/preview',
          fail: () => {
            wx.reLaunch({ url: '/pages/preview/preview' })
          }
        })
      }
      return
    }

    storage.saveCache(storage.clearPreviewFlags(cache))
    wx.navigateTo({
      url: '/pages/preview/preview',
      fail: (err) => {
        runtimeLogger.warn('camera', 'navigate_preview_failed', {
          message: err?.errMsg || ''
        })
        wx.redirectTo({
          url: '/pages/preview/preview',
          fail: () => {
            wx.reLaunch({ url: '/pages/preview/preview' })
          }
        })
      }
    })
  },

  onRetakePhoto() {
    runtimeLogger.info('camera', 'retake_photo', {
      currentStep: this.data.currentStep
    })
    this.resetAIState()
    this.setData({
      showConfirmModal: false,
      pendingPhoto: null,
      qualityHintText: '',
      damagePhaseLabel: this.data.currentStep === constants.SHOOT_STEP.DAMAGE ? this.getDamagePhaseLabel({ phase: 'SEEK' }) : ''
    }, () => {
      workflowPage.syncPageWorkflowState(this, workflow.STATES.CAPTURING, {
        page: 'camera',
        step: this.data.currentStep
      })
      this.resumeAIDetectionAfterStepReady('retake_photo')
    })
  },

  savePendingPhotoBeforeLeave() {
    const cachedFlowContext = cacheSelectors.getCurrentFlowContext(storage.loadCache())
    runtimeLogger.info('capture', 'save_pending_photo_before_leave', {
      currentStep: cachedFlowContext.currentStep,
      hasPendingPhoto: !!this.data.pendingPhoto
    })
    if (!this.data.pendingPhoto) return false

    const cache = storage.loadCache()
    if (!cache) return false

    const flowContext = cacheSelectors.getCurrentFlowContext(cache)

    const currentVehicle = cache.vehicles[flowContext.currentVehicleIndex]
    if (!currentVehicle) return false

    if (flowContext.currentStep === constants.SHOOT_STEP.LICENSE_PLATE) {
      currentVehicle.licensePlate = {
        ...this.data.pendingPhoto,
        status: 'completed',
        recognizedText: '',
        isManualInput: true,
        isNewEnergy: false
      }
      cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    } else if (flowContext.currentStep === constants.SHOOT_STEP.VIN_CODE) {
      currentVehicle.vinCode = {
        ...this.data.pendingPhoto,
        status: 'completed',
        recognizedText: '',
        isManualInput: true
      }
      cache.currentStep = constants.SHOOT_STEP.DAMAGE
      cache.currentDamageCount = 0
    } else if (flowContext.currentStep === constants.SHOOT_STEP.DAMAGE) {
      if (!currentVehicle.damages) {
        currentVehicle.damages = []
      }
      currentVehicle.damages.push(this.data.pendingPhoto)
      cache.currentDamageCount = currentVehicle.damages.length
    }

    storage.saveCache(cache)
    this.setData({
      showConfirmModal: false,
      pendingPhoto: null,
      qualityHintText: ''
    })
    return true
  },

  onCameraError(err) {
    console.error('闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀绾惧潡鏌ｉ姀銏╃劸闁汇倗鍋撶换娑㈠箣濞嗗繒浠肩紓浣哄Х閸犳牠寮诲澶娢ㄩ柨鏃傛櫕娴煎洭姊虹悰鈥充壕闂佹寧娲栭崐褰掓偂閸愵亝鍠愭繝濠傜墕缁€鍫ユ煟閺傛娈犳繛鍏肩墬缁绘稑顔忛鑽ょ泿缂備胶濮抽崡鎶界嵁閺嶃劍缍囬柛鎾楀惙鎴︽⒑闂堚晝绉甸柛銊ゅ嵆閳?', err)
    runtimeLogger.error('camera', 'camera_error', {
      message: err?.detail?.errMsg || err?.errMsg || ''
    })
    wx.showModal({
      title: '\u76f8\u673a\u6743\u9650',
      content: '\u8bf7\u6388\u6743\u4f7f\u7528\u6444\u50cf\u5934',
      showCancel: false,
      success: () => {
        wx.navigateBack({
          fail: () => {
            wx.redirectTo({ url: '/pages/index/index' })
          }
        })
      }
    })
  },

  onCameraInitDone(e) {
    runtimeLogger.info('camera', 'camera_init_done', {
      hasDetail: !!e?.detail,
      currentStep: this.data.currentStep,
      aiEnabled: this.data.aiEnabled,
      aiAvailable: this.data.aiAvailable,
      detectionRunning: !!this.detectTimer || this.aiBusy
    })
    this.cameraInitialized = true
    this.resumeAIDetection('camera_init_done')
  },

  onCameraStop(e) {
    runtimeLogger.warn('camera', 'camera_stop', {
      hasDetail: !!e?.detail
    })
    this.cameraInitialized = false
    this.stopAIFrameListener('camera_stop')
  },

  onGoPreview() {
    if (this.data.isNavigating) {
      return
    }

    if (this.data.showConfirmModal && this.data.pendingPhoto) {
      this.savePendingPhotoBeforeLeave()
    }

    this.setData({ isNavigating: true })
    this.isLeaving = true

    const cache = storage.loadCache()
    const flowContext = cacheSelectors.getCurrentFlowContext(cache)
    if (cache && flowContext.fromPreview) {
      storage.saveCache(storage.clearPreviewFlags(cache))
      const pages = getCurrentPages()
      const hasPreviewInStack = pages.some((page) => page.route === 'pages/preview/preview')

      if (hasPreviewInStack) {
        wx.navigateBack({
          fail: () => {
            wx.redirectTo({
              url: '/pages/preview/preview',
              fail: () => {
                wx.reLaunch({ url: '/pages/preview/preview' })
              }
            })
          }
        })
      } else {
        wx.redirectTo({
          url: '/pages/preview/preview',
          fail: () => {
            wx.reLaunch({ url: '/pages/preview/preview' })
          }
        })
      }
      return
    }

    wx.navigateTo({
      url: '/pages/preview/preview',
      fail: () => {
        wx.redirectTo({
          url: '/pages/preview/preview',
          fail: () => {
            wx.reLaunch({ url: '/pages/preview/preview' })
          }
        })
      }
    })
  }
})
