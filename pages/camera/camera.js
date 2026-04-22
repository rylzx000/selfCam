const storage = require('../../utils/storage')
const constants = require('../../utils/constants')
const compress = require('../../utils/compress')
const runtimeLogger = require('../../utils/runtime-logger')
const PlateDetector = require('../../utils/plate-detector')
const DamageDetector = require('../../utils/damage-detector')
const { PlateFrameUtils } = require('../../utils/frame-utils')
const DamageAutoCaptureEngine = require('../../utils/damage-auto-capture-engine')
const { PLATE_MODEL_PATH, DAMAGE_MODEL_PATH, PLATE_MODEL_URL, DAMAGE_MODEL_URL, AUTO_CAPTURE } = require('../../utils/ai-config')

const PLATE_DISTANCE_HINT_TEXT = {
  forward: '\u8bf7\u9760\u8fd1\u4e00\u70b9',
  backward: '\u8bf7\u7a0d\u5fae\u540e\u9000'
}

Page({
  data: {
    currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
    guideTip: constants.GUIDE_TIPS[constants.SHOOT_STEP.LICENSE_PLATE],
    vehicleType: constants.VEHICLE_TYPE.TARGET,
    damageCount: 0,
    showConfirmModal: false,
    confirmContent: '',
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
    plateBlinkFrame: 'a',
    damageFrameState: 'normal',
    damageAreaRatioText: '',
    damagePhaseLabel: '',
    showDamageDebug: false
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

  onLoad() {
    this.isLeaving = false
    runtimeLogger.startSession('camera', {
      page: 'camera',
      initialStep: this.data.currentStep
    })
    this.setData({ showDamageDebug: this.shouldShowAIDebug() })
    runtimeLogger.info('camera', 'page_load', {
      showDamageDebug: this.data.showDamageDebug
    })
    this.initAICapability()
    this.loadCacheData()
  },

  onReady() {
    this.cameraContext = wx.createCameraContext()
  },

  onShow() {
    runtimeLogger.info('camera', 'page_show', {
      isLeaving: this.isLeaving,
      currentStep: this.data.currentStep,
      showConfirmModal: this.data.showConfirmModal,
      cameraInitialized: this.cameraInitialized
    })
    this.isLeaving = false
    this.setData({ isNavigating: false })
    this.loadCacheData()
    this.syncPlateBlink(this.data.plateDistanceHint)
    this.resumeAIDetection()
  },

  onHide() {
    this.cancelPlateHintClear()
    this.stopPlateBlink()
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
    this.destroyDetectors()
    // 椤甸潰鍗歌浇鏃讹紝濡傛湁寰呯‘璁ょ収鐗囧垯鍏堜繚瀛?
    if (this.data.showConfirmModal && this.data.pendingPhoto) {
      this.savePendingPhotoBeforeLeave()
    }
    runtimeLogger.endSession('camera', { reason: 'page_unload' })
  },

  shouldShowAIDebug() {
    if (typeof wx.getAccountInfoSync !== 'function') {
      return false
    }

    try {
      const accountInfo = wx.getAccountInfoSync()
      return accountInfo?.miniProgram?.envVersion !== 'release'
    } catch (error) {
      console.warn('[AI] shouldShowAIDebug failed:', error)
      return false
    }
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
          this.plateDetector = new PlateDetector({
            modelUrl: PLATE_MODEL_URL,
            modelPath: PLATE_MODEL_PATH,
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
          this.damageDetector = new DamageDetector({
            modelUrl: DAMAGE_MODEL_URL,
            modelPath: DAMAGE_MODEL_PATH,
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
      runtimeLogger.error('ai', 'detector_init_failed', {
        step,
        message: error?.message || ''
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

  resumeAIDetection() {
    const { currentStep, showConfirmModal } = this.data
    const aiSupportedStep = [constants.SHOOT_STEP.LICENSE_PLATE, constants.SHOOT_STEP.DAMAGE].includes(currentStep)

    this.stopAIDetectionLoop()

    if (!aiSupportedStep || showConfirmModal || this.isLeaving || !this.cameraInitialized) {
      this.setData({ aiStatusText: this.getAIStatusByStep(currentStep), aiLocked: false })
      return
    }

    this.startAIDetectionLoop(currentStep)
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
      this.setData({ aiStatusText: AUTO_CAPTURE.STATUS_TEXT.fallback, aiLocked: false })
      wx.showToast({ title: '\u81ea\u52a8\u62cd\u7167\u5931\u8d25\uff0c\u8bf7\u624b\u52a8\u62cd\u7167', icon: 'none' })
      this.resumeAIDetection()
    }
  },

  stopAIDetectionLoop() {
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

    return `phase ${searchState.phase || 'SEEK'} | seen ${searchState.detectedFrames || 0} | hold ${searchState.holdStableCount || 0} | q ${(debug.trackQuality || 0).toFixed(2)} | s ${(debug.stability || 0).toFixed(2)} | c ${(debug.centerOffset || 0).toFixed(2)} | area ${((debug.areaRatio || 0) * 100).toFixed(1)}%`
  },
  getDetectInterval(step) {
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

  startPlateBlink() {
    if (this.plateBlinkTimer) {
      return
    }

    if (this.data.plateBlinkFrame !== 'a') {
      this.setData({ plateBlinkFrame: 'a' })
    }

    this.plateBlinkTimer = setInterval(() => {
      if (this.isLeaving || this.data.showConfirmModal || this.data.currentStep !== constants.SHOOT_STEP.LICENSE_PLATE || !this.data.plateDistanceHint) {
        this.stopPlateBlink()
        return
      }

      this.setData({
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
      this.setData({
        plateDistanceHint: '',
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
      this.setData({ plateBlinkFrame: 'a' })
    }
  },

  syncPlateBlink(direction) {
    const shouldBlink = !!direction
      && !this.isLeaving
      && !this.data.showConfirmModal
      && this.data.currentStep === constants.SHOOT_STEP.LICENSE_PLATE

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
        plateBlinkFrame: 'a',
        damageFrameState: 'normal',
        damageAreaRatioText: '',
        damagePhaseLabel: this.data.currentStep === constants.SHOOT_STEP.DAMAGE
        ? this.getDamagePhaseLabel({ phase: 'SEEK' })
        : ''
    })
  },

  takeAIPreviewPhoto() {
    if (!this.cameraContext || !this.cameraInitialized || this.isLeaving) {
      return Promise.resolve('')
    }

    return new Promise((resolve) => {
      this.cameraContext.takePhoto({
        quality: AUTO_CAPTURE.LOW_QUALITY,
        success: (res) => {
          resolve(res?.tempImagePath || '')
        },
        fail: (err) => {
          runtimeLogger.warn('ai', 'preview_photo_failed', {
            message: err?.errMsg || ''
          })
          resolve('')
        }
      })
    })
  },

  startAIDetectionLoop(step) {
    this.stopAIDetectionLoop()

    if (!this.data.aiAvailable || !this.data.aiEnabled || !this.cameraContext || !this.cameraInitialized) {
      this.setData({ aiStatusText: this.getAIStatusByStep(step) || AUTO_CAPTURE.STATUS_TEXT.unavailable })
      return
    }

    const scheduleNext = () => {
      if (!this.isLeaving && !this.data.showConfirmModal) {
        this.detectTimer = setTimeout(loop, this.getDetectInterval(step))
      }
    }

    const loop = async () => {
      let shouldSchedule = true
      if (this.isLeaving) {
        return
      }
      if (this.aiBusy || this.data.showConfirmModal) {
        scheduleNext()
        return
      }

      if (Date.now() < this.aiCooldownUntil) {
        this.setData({ aiStatusText: AUTO_CAPTURE.STATUS_TEXT.cooldown, aiLocked: false })
        scheduleNext()
        return
      }

      try {
        this.aiBusy = true
        const detector = await this.ensureDetector(step)
        if (!detector) {
          return
        }

        const previewPhoto = await this.takeAIPreviewPhoto()
        if (!previewPhoto) {
          return
        }

        const shouldDetect = step !== constants.SHOOT_STEP.DAMAGE || this.shouldRunDamageDetector()
        let result = null
        if (shouldDetect) {
          result = await detector.detect(previewPhoto)
          if (result) {
            result.previewPath = previewPhoto
          }
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
          this.setData({
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
          this.setData({
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
        this.setData({ aiLocked: false, aiStatusText: AUTO_CAPTURE.STATUS_TEXT.fallback })
      } finally {
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
      this.setData({
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

      this.setData({
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

    this.setData({
      damageFrameState,
      damageAreaRatioText: this.data.showDamageDebug
        ? this.formatDamageDebugText(damageState.debug, damageState)
        : '',
      damagePhaseLabel: this.getDamagePhaseLabel(damageState)
    })

    return {
      captureReady: !!damageState.captureReady,
      statusText: damageState.statusText || AUTO_CAPTURE.STATUS_TEXT.detected,
      aiDetection: damageState.aiDetection
    }
  },
  loadCacheData() {
    const cache = storage.loadCache()
    
    if (!cache) {
      // 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾剧粯绻涢幋鐐垫噧缂佸墎鍋ら弻娑㈠Ψ椤旂厧顫╃紓浣插亾闁割偆鍠撶弧鈧梻鍌氱墛缁嬫帡鏁嶉弮鍫熺厾闁哄娉曟禒銏ゆ婢舵劖鐓ユ繝闈涙婢ф稒銇勮箛鏇炐ラ柣銉邯瀹曪綁濡疯閻撴捇姊洪崫鍕伇闁哥姵鐗犻悰顕€宕卞鍏夹梻浣瑰缁嬫垹绮旇ぐ鎺戣摕闁绘柨鍚嬮崑鈺呮倶閻愮紟鎺楀几閸涘瓨鈷戦柛婵嗗椤箓鏌涢弬璺ㄧ劯闁糕斂鍎插鍕箾閵忋垹鏋涢柟铏墵閸┾剝鎷呴幇鐔哄仧缁辨捇宕掑顑藉亾閻戣姤鍤勯柛鎾茬閸ㄦ繃銇勯弽顐粶闁搞劌鍊块弻娑⑩€﹂幋婵囩亾闂佸搫妫寸粻鎾诲蓟濞戙埄鏁冮柨婵嗘椤︺劑姊虹粙鍖″姛闁稿繑锕㈠濠氬Χ閸パ勭€抽梺鍛婎殘閸嬫盯锝為锔解拺闁圭娴烽埊鏇犵磼鐎ｎ偄绗ч柟骞垮灩閳规垿宕辫箛鏃備簴闂備礁澹婇悡鍫ュ窗濡ゅ懏鍊堕柛顐ｇ箥濞撳鏌曢崼婵囶棞闁诲繈鍎查妵鍕晝閳ь剟鎮樺顓犫攳?
      runtimeLogger.warn('camera', 'cache_missing_redirect_index')
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    if (!cache.vehicles || cache.vehicles.length === 0) {
      runtimeLogger.warn('camera', 'vehicles_missing_redirect_index')
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    // 婵犵數濮烽弫鍛婃叏閻戝鈧倿鎸婃竟鈺嬬秮瀹曘劑寮堕幋鐙呯幢闂備線鈧偛鑻晶鎾煛鐏炲墽銆掗柍褜鍓ㄧ紞鍡涘磻閸涱厾鏆︾€光偓閸曨剛鍘?currentVehicleIndex 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈠Χ閸屾矮澹曞┑顔矫畷顒勫储鐎电硶鍋撶憴鍕妞ゎ偄顦遍埀顒勬涧閵堢顕ｉ崼鏇炵闁绘ê鐏氬В搴㈢節閻㈤潧浠﹂柟绋款煼瀹曟椽宕橀鑲╋紱闂佽鍎抽悘鍫ュ磻閹炬枼鏋旈柛顭戝枟閻忓牓姊虹拠鑼闁煎綊绠栭、姘跺Ψ閳轰胶顦板銈嗘尰缁嬫垶绂嶆ィ鍐╃叆婵犻潧妫濋妤€霉濠婂嫮绠為柡?
    if (cache.currentVehicleIndex === undefined || cache.currentVehicleIndex === null) {
      runtimeLogger.warn('camera', 'vehicle_index_invalid_redirect_index')
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    const currentVehicle = cache.vehicles[cache.currentVehicleIndex]
    
    if (!currentVehicle) {
      runtimeLogger.warn('camera', 'current_vehicle_missing_redirect_index', {
        currentVehicleIndex: cache.currentVehicleIndex
      })
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }
    
    const damageCount = currentVehicle.damages?.length || 0

    // 婵犵數濮烽弫鍛婃叏閻戝鈧倿鎸婃竟鈺嬬秮瀹曘劑寮堕幋鐙呯幢闂備線鈧偛鑻晶鎾煛鐏炲墽銆掗柍褜鍓ㄧ紞鍡涘磻閸涱厾鏆︾€光偓閸曨剛鍘搁悗鍏夊亾閻庯綆鍓涢敍鐔哥箾鐎电顎撳┑鈥虫喘楠炲繘鎮╃拠鑼唽闂佸湱鍎ら崺鍫濐焽閵夈儮鏀介柣妯活問閺嗩垶鏌嶈閸撴瑩宕捄銊ф／鐟滄棃寮婚悢纰辨晩闁绘挸绨堕崑鎾诲箹娴ｇ懓浠奸梺缁樺灱濡嫬鏁梻浣稿暱閹碱偊宕愰悷鎵虫瀺闁糕剝绋掗埛鎴︽煕韫囨稒锛熼柤鍓蹭邯閺屾稒鎯旈姀銏″垱闂佽桨绀侀崯鏉戠暦閹烘垟妲堥柟鐑樻尭椤忓綊姊婚崒娆戭槮婵犫偓鏉堚晛鍨濇い鏍ㄧ矋閺嗘粓鏌ｉ幇顒夊殶濠⒀€鍓濈换婵嬫偨闂堟刀锝嗐亜閺冣偓閻楃姴鐣风憴鍕嚤閻庢稒锚閳ь剝鍩栫换婵嬫濞戝啿濮涙繛瀛樼矆缁瑥顫忕紒妯诲闁告繂瀚紓鎾绘⒑缁嬫寧鍞夊ù婊庡墯缁旂喖寮撮姀鈺傛櫍闂佺粯锚閸熷潡宕㈣ぐ鎺撯拺?
    if (storage.isRetakeMode()) {
    if (storage.isRetakeMode()) {
      const { photoType } = cache.retakeMode
      this.setData({
        currentStep: photoType,
        guideTip: constants.GUIDE_TIPS[photoType],
        vehicleType: cache.vehicles[cache.retakeMode.vehicleIndex]?.type || constants.VEHICLE_TYPE.TARGET,
        damageCount,
        damagePhaseLabel: photoType === constants.SHOOT_STEP.DAMAGE
          ? this.getDamagePhaseLabel({ phase: 'SEEK' })
          : '',
        damageAreaRatioText: ''
      })
    } else {
      this.setData({
        currentStep: cache.currentStep,
        guideTip: constants.GUIDE_TIPS[cache.currentStep],
        vehicleType: currentVehicle?.type || constants.VEHICLE_TYPE.TARGET,
        damageCount,
        damagePhaseLabel: cache.currentStep === constants.SHOOT_STEP.DAMAGE
          ? this.getDamagePhaseLabel({ phase: 'SEEK' })
          : '',
        damageAreaRatioText: ''
      })
    }
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
      
      // 濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧浠ч柛瀣尭閳诲秹宕卞☉娆戝幈闁诲函缍嗘禍婊堝焵椤掆偓椤兘鐛径濠庢桨鐎光偓閳ь剟鎮块埀顒勬⒑閸濆嫬鏆婇柛瀣尰缁?
      this.savePhoto(normalizedPhoto)
      
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '\u56fe\u7247\u5904\u7406\u5931\u8d25', icon: 'none' })
      console.error('闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇炲€哥粻鏍煕椤愶絾绀€缁炬儳娼″鍫曞醇濞戞ê顬夊┑鐐叉噽婵炩偓闁哄被鍊濋獮渚€骞掗幋婵嗩潥婵犵數鍋涢幊鎰箾閳ь剟鏌＄仦绯曞亾閹颁礁鎮戦梺鍛婂姂閸斿矂鈥栭崼銏㈢＝濞达絿顭堥。鎶芥煕鐎ｃ劌鈧繂顕ｇ拠娴嬫闁靛繒濮村畵鍡涙⒑闂堟侗鐒鹃柛搴や含缁煤椤忓應鎷虹紓浣割儏鐏忓懘宕濋悢鍏肩厱閻庯綆鍋嗗ú鎾煃閵夘垳鐣电€规洜顭堣灃闁逞屽墰缁顫濋懜鐢靛幍濠电偛鐗嗛悘婵嬪几閵堝洨纾介柛顐犲劙閹查箖鏌?', err)
      this.resumeAIDetection()
    }
  },

  savePhoto(photo) {
    runtimeLogger.info('capture', 'photo_pending_confirm', {
      currentStep: storage.loadCache()?.currentStep,
      captureMode: photo.captureMode,
      captureTrigger: photo.captureTrigger
    })
    const cache = storage.loadCache()
    if (!cache) return

    if (storage.isRetakeMode()) {
      storage.saveRetakenPhoto(photo)
      cache.fromPreview = false
      storage.saveCache(cache)
      wx.navigateBack({
        fail: () => {
          wx.redirectTo({ url: '/pages/preview/preview' })
        }
      })
      return
    }

    let confirmContent = ''
    if (cache.currentStep === constants.SHOOT_STEP.LICENSE_PLATE) {
      confirmContent = '\u8f66\u724c\u7167\u7247\u6e05\u6670\u5417\uff1f'
    } else if (cache.currentStep === constants.SHOOT_STEP.VIN_CODE) {
      confirmContent = 'VIN\u7801\u7167\u7247\u6e05\u6670\u5417\uff1f'
    } else if (cache.currentStep === constants.SHOOT_STEP.DAMAGE) {
      confirmContent = '\u8f66\u635f\u7167\u7247\u6e05\u6670\u5417\uff1f'
    }

    this.setData({
      showConfirmModal: true,
      confirmContent,
      pendingPhoto: photo
    })
  },

  onConfirmPhoto() {
    runtimeLogger.info('capture', 'confirm_photo', {
      currentStep: storage.loadCache()?.currentStep,
      hasPendingPhoto: !!this.data.pendingPhoto
    })
    const cache = storage.loadCache()
    if (!cache || !this.data.pendingPhoto) return

    const currentVehicle = cache.vehicles[cache.currentVehicleIndex]
    if (!currentVehicle) return

    if (cache.currentStep === constants.SHOOT_STEP.LICENSE_PLATE) {
      currentVehicle.licensePlate = {
        ...this.data.pendingPhoto,
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
        currentStep: cache.currentStep,
        guideTip: constants.GUIDE_TIPS[cache.currentStep],
        damagePhaseLabel: ''
      })
      this.resetAIState()
      this.resumeAIDetection()
      return
    }

    if (cache.currentStep === constants.SHOOT_STEP.VIN_CODE) {
      currentVehicle.vinCode = {
        ...this.data.pendingPhoto,
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
        currentStep: cache.currentStep,
        guideTip: constants.GUIDE_TIPS[cache.currentStep],
        damageCount,
        damagePhaseLabel: this.getDamagePhaseLabel({ phase: 'SEEK' })
      })
      this.resetAIState()
      this.resumeAIDetection()
      return
    }

    if (!currentVehicle.damages) {
      currentVehicle.damages = []
    }
    currentVehicle.damages.push(this.data.pendingPhoto)
    cache.currentDamageCount = currentVehicle.damages.length
    storage.saveCache(cache)
    runtimeLogger.info('damage_flow', 'damage_photo_saved', {
      damageCount: currentVehicle.damages.length,
      captureMode: this.data.pendingPhoto.captureMode,
      captureTrigger: this.data.pendingPhoto.captureTrigger
    })

    if (currentVehicle.damages.length >= constants.LIMITS.MAX_DAMAGES) {
      this.isLeaving = true
      this.setData({
        showConfirmModal: false,
        pendingPhoto: null,
        damageCount: currentVehicle.damages.length,
        damagePhaseLabel: this.getDamagePhaseLabel({ phase: 'SEEK' }),
        damageAreaRatioText: ''
      })

      if (cache.fromPreview) {
        cache.fromPreview = false
        storage.saveCache(cache)
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
        cache.fromPreview = false
        storage.saveCache(cache)
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

    this.resetAIState()
    this.setData({
      showConfirmModal: false,
      pendingPhoto: null,
      damageCount: currentVehicle.damages.length,
      damageFrameState: 'normal',
      damagePhaseLabel: this.getDamagePhaseLabel({ phase: 'SEEK' }),
      damageAreaRatioText: ''
    })
    this.resumeAIDetection()
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

    if (cache.fromPreview) {
      cache.fromPreview = false
      storage.saveCache(cache)

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

    cache.fromPreview = false
    storage.saveCache(cache)
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
      damagePhaseLabel: this.data.currentStep === constants.SHOOT_STEP.DAMAGE ? this.getDamagePhaseLabel({ phase: 'SEEK' }) : ''
    })
    this.resumeAIDetection()
  },

  savePendingPhotoBeforeLeave() {
    runtimeLogger.info('capture', 'save_pending_photo_before_leave', {
      currentStep: storage.loadCache()?.currentStep,
      hasPendingPhoto: !!this.data.pendingPhoto
    })
    if (!this.data.pendingPhoto) return false

    const cache = storage.loadCache()
    if (!cache) return false

    const currentVehicle = cache.vehicles[cache.currentVehicleIndex]
    if (!currentVehicle) return false

    if (cache.currentStep === constants.SHOOT_STEP.LICENSE_PLATE) {
      currentVehicle.licensePlate = {
        ...this.data.pendingPhoto,
        status: 'completed',
        recognizedText: '',
        isManualInput: true,
        isNewEnergy: false
      }
      cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    } else if (cache.currentStep === constants.SHOOT_STEP.VIN_CODE) {
      currentVehicle.vinCode = {
        ...this.data.pendingPhoto,
        status: 'completed',
        recognizedText: '',
        isManualInput: true
      }
      cache.currentStep = constants.SHOOT_STEP.DAMAGE
      cache.currentDamageCount = 0
    } else if (cache.currentStep === constants.SHOOT_STEP.DAMAGE) {
      if (!currentVehicle.damages) {
        currentVehicle.damages = []
      }
      currentVehicle.damages.push(this.data.pendingPhoto)
      cache.currentDamageCount = currentVehicle.damages.length
    }

    storage.saveCache(cache)
    this.setData({
      showConfirmModal: false,
      pendingPhoto: null
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
      hasDetail: !!e?.detail
    })
    this.cameraInitialized = true
    this.resumeAIDetection()
  },

  onCameraStop(e) {
    runtimeLogger.warn('camera', 'camera_stop', {
      hasDetail: !!e?.detail
    })
    this.cameraInitialized = false
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
    if (cache && cache.fromPreview) {
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
