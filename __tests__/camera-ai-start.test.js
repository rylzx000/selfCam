describe('camera AI detection start timing', () => {
  let pageConfig
  let constants
  let cache
  let storage
  let cacheSelectors
  let workflowPage
  let album
  let envConfig
  let runtimeLogger
  let PlateDetector
  let DamageDetector
  let PlateFrameUtils
  let DamageAutoCaptureEngine
  let aiFeatureConfig

  function loadCameraPage(options = {}) {
    jest.resetModules()
    pageConfig = null
    aiFeatureConfig = {
      enabled: false,
      plateEnabled: true,
      damageEnabled: true,
      ...(options.aiFeatureConfig || {})
    }

    constants = {
      SHOOT_STEP: {
        SCENE_45: 'scene45',
        SCENE_SUPPLEMENT: 'sceneSupplement',
        LICENSE_PLATE: 'licensePlate',
        VIN_CODE: 'vinCode',
        DAMAGE: 'damage',
        MODULE_ONE_PREVIEW: 'moduleOnePreview',
        MODULE_THREE: 'moduleThree',
        FINAL_PREVIEW: 'finalPreview',
        PREVIEW: 'preview'
      },
      PHOTO_TYPE: {
        SCENE_45: 'scene45',
        SCENE_SUPPLEMENT: 'sceneSupplement',
        LICENSE_PLATE: 'licensePlate',
        VIN_CODE: 'vinCode',
        DAMAGE: 'damage'
      },
      SCENE_PHOTO_TYPE: {
        SCENE_45: 'scene45',
        SUPPLEMENT: 'sceneSupplement'
      },
      GUIDE_TIPS: {
        scene45: 'scene tip',
        sceneSupplement: 'scene supplement tip',
        licensePlate: 'plate tip',
        vinCode: 'vin tip',
        damage: 'damage tip'
      },
      VEHICLE_TYPE: {
        TARGET: 'target'
      },
      LIMITS: {
        MAX_SCENE_SUPPLEMENTS: 3,
        MAX_DAMAGES: 10
      }
    }

    cache = {
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      vehicles: [
        {
          type: 'target',
          damages: []
        }
      ]
    }

    storage = {
      loadCache: jest.fn(() => cache),
      loadCacheForResume: jest.fn(() => cache),
      saveCache: jest.fn(),
      clearPreviewFlags: jest.fn((targetCache) => ({
        ...targetCache,
        fromPreview: false
      })),
      isRetakeMode: jest.fn(() => false),
      saveRetakenPhoto: jest.fn(() => true),
      normalizePhotoMeta: jest.fn((photo, meta) => ({
        ...photo,
        ...meta
      }))
    }

    cacheSelectors = {
      getCurrentFlowContext: jest.fn((targetCache) => ({
        hasVehicles: true,
        hasRetakeContext: false,
        auxPhotoEnabled: !!(targetCache.auxPhoto && targetCache.auxPhoto.enabled),
        currentStep: targetCache.currentStep,
        currentVehicleIndex: targetCache.currentVehicleIndex,
        currentVehicle: targetCache.vehicles[targetCache.currentVehicleIndex],
        currentVehicleType: targetCache.vehicles[targetCache.currentVehicleIndex].type,
        currentVehicleRoleName: targetCache.vehicles[targetCache.currentVehicleIndex].vehicleRoleName || targetCache.vehicles[targetCache.currentVehicleIndex].type,
        currentVehiclePlateNo: targetCache.vehicles[targetCache.currentVehicleIndex].licenseNo || '',
        currentVehiclePlateTheme: targetCache.vehicles[targetCache.currentVehicleIndex].vehiclePlateTheme || 'oil',
        currentVehicleProgressText: targetCache.vehicles.length > 1
          ? `${targetCache.currentVehicleIndex + 1}/${targetCache.vehicles.length} 辆`
          : '',
        fromPreview: !!targetCache.fromPreview,
        hasNextVehicle: targetCache.currentVehicleIndex < targetCache.vehicles.length - 1,
        nextVehicleIndex: targetCache.currentVehicleIndex < targetCache.vehicles.length - 1 ? targetCache.currentVehicleIndex + 1 : null,
        finishDamageText: targetCache.currentVehicleIndex < targetCache.vehicles.length - 1
          ? '下一辆车'
          : '去预览',
        guideTip: constants.GUIDE_TIPS[targetCache.currentStep],
        damageCount: targetCache.vehicles[targetCache.currentVehicleIndex].damages.length,
        workflowState: 'CAPTURING'
      }))
    }

    workflowPage = {
      syncPageWorkflowState: jest.fn()
    }
    album = {
      saveConfirmedPhotoToAlbum: jest.fn(() => Promise.resolve({ saved: true }))
    }
    envConfig = {
      getDebugConfig: jest.fn(() => ({
        showAIPanel: false
      })),
      getAiConfig: jest.fn(() => ({
        wxEnvVersion: 'trial',
        appEnv: 'sit',
        plateModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx',
        damageModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/damage.onnx',
        plateModelPath: '/user-data/plate-sit-test.onnx',
        damageModelPath: '/user-data/damage-sit-test.onnx'
      }))
    }
    runtimeLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      forceWarn: jest.fn(),
      forceError: jest.fn(),
      startSession: jest.fn(() => 'test-session'),
      endSession: jest.fn(),
      getSessionId: jest.fn(() => 'test-session')
    }
    PlateDetector = jest.fn(function PlateDetectorMock(options) {
      this.options = options
      this.isModelLoaded = jest.fn(() => true)
      this.load = jest.fn(() => Promise.resolve(true))
    })
    DamageDetector = jest.fn(function DamageDetectorMock(options) {
      this.options = options
      this.isModelLoaded = jest.fn(() => true)
      this.load = jest.fn(() => Promise.resolve(true))
    })
    PlateFrameUtils = jest.fn(function PlateFrameUtilsMock() {
      this.reset = jest.fn()
      this.check = jest.fn()
    })
    DamageAutoCaptureEngine = jest.fn(function DamageAutoCaptureEngineMock() {
      this.reset = jest.fn()
      this.shouldRunDetector = jest.fn(() => true)
    })

    global.wx = {
      hideLoading: jest.fn(),
      showLoading: jest.fn(),
      showToast: jest.fn(),
      showModal: jest.fn(),
      navigateTo: jest.fn(({ success } = {}) => {
        if (success) success()
      }),
      navigateBack: jest.fn(({ success } = {}) => {
        if (success) success()
      }),
      redirectTo: jest.fn(({ success } = {}) => {
        if (success) success()
      }),
      reLaunch: jest.fn(({ success } = {}) => {
        if (success) success()
      }),
      getSystemInfoSync: jest.fn(() => ({
        model: 'iPhone 15',
        system: 'iOS 17.0',
        platform: 'ios',
        SDKVersion: '3.15.1',
        version: '8.0.50',
        brand: 'Apple'
      }))
    }
    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })
    global.getCurrentPages = jest.fn(() => [])

    jest.doMock('../packageD/utils/storage', () => storage)
    jest.doMock('../packageD/utils/cache-selectors', () => cacheSelectors)
    jest.doMock('../packageD/utils/constants', () => constants)
    jest.doMock('../packageD/utils/compress', () => ({
      compressImage: jest.fn()
    }))
    jest.doMock('../packageD/utils/photo-quality', () => ({
      attachPhotoQualityMeta: jest.fn((photo) => photo),
      buildQualityHintText: jest.fn(() => ''),
      analyzePhotoQuality: jest.fn()
    }))
    jest.doMock('../packageD/utils/runtime-logger', () => runtimeLogger)
    jest.doMock('../packageD/utils/env-config', () => envConfig)
    jest.doMock('../packageD/utils/plate-detector', () => PlateDetector)
    jest.doMock('../packageD/utils/damage-detector', () => DamageDetector)
    jest.doMock('../packageD/utils/frame-utils', () => ({
      PlateFrameUtils,
      createVirtualCameraMapping: jest.fn(() => ({
        sourceWidth: 400,
        sourceHeight: 300,
        targetWidth: 400,
        targetHeight: 300,
        frameAspect: 1.3333,
        targetAspect: 1.3333,
        mappingMode: 'legacy',
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0
      }))
    }))
    jest.doMock('../packageD/utils/damage-auto-capture-engine', () => DamageAutoCaptureEngine)
    jest.doMock('../packageD/utils/ai-config', () => ({
      AI_FEATURES: aiFeatureConfig,
      AUTO_CAPTURE: {
        LOW_QUALITY: 0.3,
        DETECT_INTERVAL: 100,
        COOLDOWN_MS: 1000,
        STATUS_TEXT: {
          unavailable: 'unavailable',
          scanningPlate: 'scanning plate',
          scanningDamage: 'scanning damage',
          loading: 'loading',
          cooldown: 'cooldown',
          locked: 'locked',
          fallback: 'fallback',
          detected: 'detected'
        },
        PLATE: {
          detectInterval: 100,
          minConsecutiveFrames: 1,
          minAreaRatio: 0.1,
          maxAreaRatio: 0.8,
          scoreThreshold: 0.7,
          iouThreshold: 0.5,
          targetSize: 640,
          inputName: 'input',
          outputName: 'output'
        },
        DAMAGE: {
          scoreThreshold: 0.3,
          iouThreshold: 0.2,
          targetSize: 640,
          inputName: 'images',
          outputName: 'output0'
        },
        DAMAGE_FLOW: {
          previewInterval: 100,
          phase: {
            minAreaRatio: 0.1,
            maxAreaRatio: 0.8
          }
        }
      }
    }))
    jest.doMock('../packageD/utils/workflow-state', () => ({
      STATES: {
        IDLE: 'IDLE',
        RETAKING: 'RETAKING',
        CAPTURING: 'CAPTURING',
        CONFIRMING: 'CONFIRMING'
      }
    }))
    jest.doMock('../packageD/utils/workflow-page', () => workflowPage)
    jest.doMock('../packageD/utils/album', () => album)

    require('../packageD/pages/camera/camera')
  }

  function createPageInstance(overrides = {}) {
    return {
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
        cameraMounted: true,
        showConfirmModal: false,
        pendingPhoto: null,
        aiFeatureEnabled: aiFeatureConfig.enabled,
        plateAIFeatureEnabled: aiFeatureConfig.plateEnabled,
        damageAIFeatureEnabled: aiFeatureConfig.damageEnabled,
        aiEnabled: true,
        aiAvailable: true
      },
      isLeaving: false,
      cameraInitialized: true,
      cameraContext: {},
      detectTimer: null,
      aiBusy: false,
      pendingCameraInitResumeReason: '',
      pendingCameraRemountReason: '',
      cameraStopObserved: true,
      cameraRestartTimer: null,
      setData(updates, callback) {
        this.data = {
          ...this.data,
          ...updates
        }
        if (callback) {
          callback()
        }
      },
      getDamagePhaseLabel: pageConfig.getDamagePhaseLabel,
      isAIFeatureEnabledForStep: pageConfig.isAIFeatureEnabledForStep,
      isAIEnabledForStep: pageConfig.isAIEnabledForStep,
      getAIStatusByStep: pageConfig.getAIStatusByStep,
      getAIFrameBytes: pageConfig.getAIFrameBytes,
      convertAIFrameToImagePath: pageConfig.convertAIFrameToImagePath,
      getFeedbackId: pageConfig.getFeedbackId,
      roundLogNumber: pageConfig.roundLogNumber,
      toLogBox: pageConfig.toLogBox,
      buildFrameMappingLog: pageConfig.buildFrameMappingLog,
      logAIGeometrySnapshot: pageConfig.logAIGeometrySnapshot,
      logAutoCaptureGateSample: pageConfig.logAutoCaptureGateSample,
      logAutoCaptureReady: pageConfig.logAutoCaptureReady,
      logAiModelConfig: pageConfig.logAiModelConfig,
      reportAiUnavailable: pageConfig.reportAiUnavailable,
      navigateToPreviewPage: pageConfig.navigateToPreviewPage,
      navigateToModuleOnePreviewPage: pageConfig.navigateToModuleOnePreviewPage,
      navigateBackToPreviewPage: pageConfig.navigateBackToPreviewPage,
      goToPreviewPage: pageConfig.goToPreviewPage,
      prepareModuleTwoDamageCache: pageConfig.prepareModuleTwoDamageCache,
      startModuleTwoDamageCapture: pageConfig.startModuleTwoDamageCapture,
      maybeShowCaptureGuide: pageConfig.maybeShowCaptureGuide,
      showCaptureGuide: pageConfig.showCaptureGuide,
      onCaptureGuideConfirm: pageConfig.onCaptureGuideConfirm,
      onCloseCaptureGuide: pageConfig.onCloseCaptureGuide,
      onOpenCaptureGuide: pageConfig.onOpenCaptureGuide,
      advanceToNextAuxVehicle: pageConfig.advanceToNextAuxVehicle,
      closeDamageCompleteModal: pageConfig.closeDamageCompleteModal,
      pauseCaptureForDamageCompleteModal: pageConfig.pauseCaptureForDamageCompleteModal,
      showAuxDamageCompleteModal: pageConfig.showAuxDamageCompleteModal,
      handleDamageCompletedFlow: pageConfig.handleDamageCompletedFlow,
      onDamageCompleteModalConfirm: pageConfig.onDamageCompleteModalConfirm,
      onDamageCompleteModalCancel: pageConfig.onDamageCompleteModalCancel,
      onDamageCompleteModalMaskTap: pageConfig.onDamageCompleteModalMaskTap,
      clearCameraRestartTimer: pageConfig.clearCameraRestartTimer,
      mountPendingCamera: pageConfig.mountPendingCamera,
      requestCameraRemountAfterStop: pageConfig.requestCameraRemountAfterStop,
      resetDamageAutoCaptureStage: pageConfig.resetDamageAutoCaptureStage,
      cancelPlateHintClear: pageConfig.cancelPlateHintClear,
      getActiveDistanceHint: pageConfig.getActiveDistanceHint,
      syncPlateBlink: jest.fn(),
      stopAIDetectionLoop: jest.fn(),
      stopAIFrameListener: jest.fn(),
      stopPlateBlink: jest.fn(),
      resumeAIDetectionAfterStepReady: jest.fn(),
      resetAIState: jest.fn(),
      ...overrides
    }
  }

  beforeEach(() => {
    loadCameraPage()
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    delete global.getCurrentPages
    jest.clearAllMocks()
    jest.dontMock('../packageD/utils/storage')
    jest.dontMock('../packageD/utils/cache-selectors')
    jest.dontMock('../packageD/utils/constants')
    jest.dontMock('../packageD/utils/compress')
    jest.dontMock('../packageD/utils/photo-quality')
    jest.dontMock('../packageD/utils/runtime-logger')
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/plate-detector')
    jest.dontMock('../packageD/utils/damage-detector')
    jest.dontMock('../packageD/utils/frame-utils')
    jest.dontMock('../packageD/utils/damage-auto-capture-engine')
    jest.dontMock('../packageD/utils/ai-config')
    jest.dontMock('../packageD/utils/workflow-state')
    jest.dontMock('../packageD/utils/workflow-page')
    jest.dontMock('../packageD/utils/album')
  })

  test('retries AI detection after damage step data is applied from cache', () => {
    const instance = createPageInstance()

    pageConfig.loadCacheData.call(instance, 'test_damage_cache')

    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('test_damage_cache')
  })

  test('camera page does not reference frozen AI model URL constants', () => {
    const fs = require('fs')
    const cameraSource = fs.readFileSync(require.resolve('../packageD/pages/camera/camera'), 'utf8')

    expect(cameraSource).not.toContain('PLATE_MODEL_URL')
    expect(cameraSource).not.toContain('DAMAGE_MODEL_URL')
  })

  test('camera component requests medium realtime frames for AI preview', () => {
    const fs = require('fs')
    const path = require('path')
    const cameraWxml = fs.readFileSync(path.resolve(__dirname, '../packageD/pages/camera/camera.wxml'), 'utf8')

    expect(cameraWxml).toContain('frame-size="medium"')
  })

  test('camera component renders split vehicle role, plate and dynamic finish action fields', () => {
    const fs = require('fs')
    const path = require('path')
    const cameraWxml = fs.readFileSync(path.resolve(__dirname, '../packageD/pages/camera/camera.wxml'), 'utf8')

    expect(cameraWxml).toContain('{{vehicleRoleName}}')
    expect(cameraWxml).toContain('{{vehiclePlateNo}}')
    expect(cameraWxml).toContain('vehicle-plate-{{vehiclePlateTheme}}')
    expect(cameraWxml).toContain('{{vehicleProgressText}}')
    expect(cameraWxml).toContain('{{finishDamageText}}')
  })

  test('camera component keeps vehicle progress out of the plate card', () => {
    const fs = require('fs')
    const path = require('path')
    const cameraWxml = fs.readFileSync(path.resolve(__dirname, '../packageD/pages/camera/camera.wxml'), 'utf8')

    expect(cameraWxml).not.toContain('<text wx:if="{{vehicleProgressText}}" class="vehicle-progress">{{vehicleProgressText}}</text>')
    expect(cameraWxml).toContain('class="damage-count-header"')
    expect(cameraWxml).toContain('<text wx:if="{{vehicleProgressText}}" class="vehicle-progress damage-progress">{{vehicleProgressText}}</text>')
  })

  test('camera component renders capture guide modal and side review entry', () => {
    const fs = require('fs')
    const path = require('path')
    const cameraWxml = fs.readFileSync(path.resolve(__dirname, '../packageD/pages/camera/camera.wxml'), 'utf8')

    expect(cameraWxml).toContain('wx:if="{{showCaptureGuideModal}}"')
    expect(cameraWxml).toContain('class="guide-modal-card"')
    expect(cameraWxml).toContain('wx:if="{{captureGuideDescription}}"')
    expect(cameraWxml).toContain('bindtap="onCaptureGuideConfirm"')
    expect(cameraWxml).toContain('bindtap="onOpenCaptureGuide"')
    expect(cameraWxml).toContain("currentStep === 'scene45' || currentStep === 'damage'")
    expect(cameraWxml).toContain('/packageD/assets/images/capture-guides/scene-45deg.png')
    expect(cameraWxml).toContain('/packageD/assets/images/capture-guides/damage-far.png')
    expect(cameraWxml).toContain('/packageD/assets/images/capture-guides/damage-mid.png')
    expect(cameraWxml).toContain('/packageD/assets/images/capture-guides/damage-close.png')
  })

  test('scene45 first entry shows intro capture guide and confirm marks it seen', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_45
    cache.captureGuideSeen = {}
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_45,
        showConfirmModal: false,
        pendingPhoto: null,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.loadCacheData.call(instance, 'scene45_entry')

    expect(instance.data.showCaptureGuideModal).toBe(true)
    expect(instance.data.captureGuideType).toBe('scene45')
    expect(instance.data.captureGuideIntro).toBe(true)
    expect(instance.data.captureGuideTitle).toBe('拍摄指引：整车照，45度角拍一张，包含现场环境')
    expect(instance.data.captureGuideDescription).toBe('')
    expect(instance.data.captureGuideButtonText).toBe('知道了，开始拍摄')

    pageConfig.onCaptureGuideConfirm.call(instance)

    expect(instance.data.showCaptureGuideModal).toBe(false)
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.SCENE_45)
    expect(cache.captureGuideSeen.scene45).toBe(true)
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      captureGuideSeen: expect.objectContaining({
        scene45: true
      })
    }))
  })

  test('scene45 seen state prevents automatic guide on later entry', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_45
    cache.captureGuideSeen = {
      scene45: true
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_45,
        showConfirmModal: false,
        pendingPhoto: null,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.loadCacheData.call(instance, 'scene45_reentry')

    expect(instance.data.showCaptureGuideModal).toBe(false)
    expect(instance.data.captureGuideType).toBe('')
  })

  test('damage first entry shows intro capture guide and confirm marks it seen', () => {
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.captureGuideSeen = {
      scene45: true
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        pendingPhoto: null,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.loadCacheData.call(instance, 'damage_entry')

    expect(instance.data.showCaptureGuideModal).toBe(true)
    expect(instance.data.captureGuideType).toBe('damage')
    expect(instance.data.captureGuideIntro).toBe(true)
    expect(instance.data.captureGuideTitle).toBe('拍摄指引：车损处远、中、近拍摄')
    expect(instance.data.captureGuideDescription).toBe('')
    expect(instance.data.captureGuideButtonText).toBe('知道了，开始拍摄')

    pageConfig.onCaptureGuideConfirm.call(instance)

    expect(instance.data.showCaptureGuideModal).toBe(false)
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.captureGuideSeen.damage).toBe(true)
  })

  test('camera step display names stay short for scene plate and vin pages', () => {
    const instance = createPageInstance()

    cache.currentStep = constants.SHOOT_STEP.SCENE_45
    pageConfig.loadCacheData.call(instance, 'scene45_step_name')
    expect(instance.data.stepDisplayName).toBe('整车45度')

    cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
    pageConfig.loadCacheData.call(instance, 'plate_step_name')
    expect(instance.data.stepDisplayName).toBe('拍摄车牌号')

    cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    pageConfig.loadCacheData.call(instance, 'vin_step_name')
    expect(instance.data.stepDisplayName).toBe('拍摄vin码')
  })

  test('step display name updates during scene plate vin confirmation flow', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_45
    cache.scenePhotos = {
      scene45: { status: 'pending' },
      supplements: []
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_45,
        stepDisplayName: '整车45度',
        showConfirmModal: true,
        pendingPhoto: { compressedPath: '/tmp/scene-45.jpg' },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(instance.data.stepDisplayName).toBe('拍摄车牌号')

    instance.setData({
      currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
      showConfirmModal: true,
      pendingPhoto: { compressedPath: '/tmp/plate.jpg' }
    })
    pageConfig.onConfirmPhoto.call(instance)

    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.VIN_CODE)
    expect(instance.data.stepDisplayName).toBe('拍摄vin码')
  })

  test('capture guide keeps camera mounted but hides capture action', () => {
    const fs = require('fs')
    const path = require('path')
    const cameraWxml = fs.readFileSync(path.resolve(__dirname, '../packageD/pages/camera/camera.wxml'), 'utf8')
    const cameraJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../packageD/pages/camera/camera.json'), 'utf8'))
    const cameraTag = cameraWxml.match(/<camera[\s\S]*?>/)[0]
    const captureSectionTag = cameraWxml.match(/<view wx:if="\{\{cameraMounted[\s\S]*?class="capture-section"/)[0]

    expect(cameraWxml).not.toContain('vehicleSwitching')
    expect(cameraWxml).not.toContain('vehicle-switch-mask')
    expect(cameraWxml).toContain('<confirm-modal')
    expect(cameraWxml).toContain('visible="{{showDamageCompleteModal}}"')
    expect(cameraWxml).toContain('show-cancel="{{damageCompleteShowCancel}}"')
    expect(cameraWxml).toContain('bind:masktap="onDamageCompleteModalMaskTap"')
    expect(cameraTag).toContain('wx:if="{{cameraMounted && !showConfirmModal && !showDamageCompleteModal}}"')
    expect(cameraTag).not.toContain('showCaptureGuideModal')
    expect(cameraWxml).toContain('wx:if="{{cameraMounted && !showConfirmModal && !showDamageCompleteModal && !showCaptureGuideModal}}"')
    expect(captureSectionTag).toContain('showCaptureGuideModal')
    expect(cameraJson.usingComponents['confirm-modal']).toBe('/packageD/components/confirm-modal/confirm-modal')
  })

  test('capture guide open and close does not request camera remount', () => {
    const requestCameraRemountAfterStop = jest.fn()
    const resumeAIDetectionAfterStepReady = jest.fn()
    const instance = createPageInstance({
      requestCameraRemountAfterStop,
      resumeAIDetectionAfterStepReady,
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_45,
        cameraMounted: true,
        showConfirmModal: false,
        showDamageCompleteModal: false,
        showCaptureGuideModal: false,
        pendingPhoto: null,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.showCaptureGuide.call(instance, 'scene45', true)

    expect(instance.data.showCaptureGuideModal).toBe(true)
    expect(instance.data.cameraMounted).toBe(true)
    expect(instance.pendingCameraInitResumeReason).toBe('')
    expect(instance.pendingCameraRemountReason).toBe('')
    expect(requestCameraRemountAfterStop).not.toHaveBeenCalled()

    pageConfig.onCloseCaptureGuide.call(instance)

    expect(instance.data.showCaptureGuideModal).toBe(false)
    expect(instance.data.cameraMounted).toBe(true)
    expect(instance.pendingCameraInitResumeReason).toBe('')
    expect(instance.pendingCameraRemountReason).toBe('')
    expect(requestCameraRemountAfterStop).not.toHaveBeenCalled()
    expect(resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('capture_guide_closed')
  })

  test('manual capture is ignored while damage completion modal is open', () => {
    const takePhoto = jest.fn()
    const instance = createPageInstance({
      cameraContext: { takePhoto },
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showDamageCompleteModal: true,
        showConfirmModal: false,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onCapture.call(instance)

    expect(takePhoto).not.toHaveBeenCalled()
    expect(global.wx.showLoading).not.toHaveBeenCalled()
    expect(instance.stopAIDetectionLoop).not.toHaveBeenCalled()
    expect(instance.stopAIFrameListener).not.toHaveBeenCalled()
  })

  test('AI feature switch disabled keeps plate and damage detection fully manual', async () => {
    wx.createInferenceSession = jest.fn()
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    const onCameraFrame = jest.fn()
    const startAIFrameListener = jest.fn()
    const instance = createPageInstance({
      cameraContext: { onCameraFrame },
      startAIFrameListener,
      stopAIDetectionLoop: pageConfig.stopAIDetectionLoop,
      stopAIFrameListener: jest.fn(),
      stopPlateBlink: jest.fn(),
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
        aiStatusText: 'loading',
        aiReady: true,
        aiLoading: true,
        aiLocked: true,
        aiFeatureEnabled: true,
        plateAIFeatureEnabled: true,
        damageAIFeatureEnabled: true,
        aiAvailable: true,
        aiEnabled: true
      }
    })

    try {
      pageConfig.initAICapability.call(instance)

      expect(instance.data.aiFeatureEnabled).toBe(false)
      expect(instance.data.aiAvailable).toBe(true)
      expect(instance.data.aiEnabled).toBe(false)
      expect(instance.data.aiStatusText).toBe('')
      expect(PlateFrameUtils).not.toHaveBeenCalled()
      expect(DamageAutoCaptureEngine).not.toHaveBeenCalled()
      expect(runtimeLogger.info).not.toHaveBeenCalledWith('ai', 'capability_ready', expect.any(Object))
      expect(runtimeLogger.forceError).not.toHaveBeenCalledWith('ai', 'ai_unavailable', expect.any(Object))

      await expect(pageConfig.ensureDetector.call(instance, constants.SHOOT_STEP.LICENSE_PLATE)).resolves.toBeNull()
      await expect(pageConfig.ensureDetector.call(instance, constants.SHOOT_STEP.DAMAGE)).resolves.toBeNull()
      expect(PlateDetector).not.toHaveBeenCalled()
      expect(DamageDetector).not.toHaveBeenCalled()
      expect(envConfig.getAiConfig).not.toHaveBeenCalled()

      pageConfig.resumeAIDetection.call(instance, 'feature_switch_test')
      expect(instance.stopAIFrameListener).toHaveBeenCalledWith('feature_disabled_feature_switch_test')
      expect(instance.data.aiStatusText).toBe('')

      expect(pageConfig.startAIFrameListener.call(instance, 'disabled_listener')).toBe(false)
      pageConfig.startAIDetectionLoop.call(instance, constants.SHOOT_STEP.LICENSE_PLATE)
      expect(startAIFrameListener).not.toHaveBeenCalled()
      expect(onCameraFrame).not.toHaveBeenCalled()
      expect(instance.detectTimer).toBeNull()
      expect(setTimeoutSpy).not.toHaveBeenCalled()
    } finally {
      setTimeoutSpy.mockRestore()
    }
  })

  test('AI feature switch disabled keeps page copy in manual capture mode', () => {
    const fs = require('fs')
    const path = require('path')
    const aiConfigSource = fs.readFileSync(path.resolve(__dirname, '../packageD/utils/ai-config.js'), 'utf8')
    const cameraWxml = fs.readFileSync(path.resolve(__dirname, '../packageD/pages/camera/camera.wxml'), 'utf8')

    expect(aiConfigSource).toContain('const AI_FEATURES = Object.freeze({')
    expect(aiConfigSource).toContain('enabled: false')
    expect(aiConfigSource).toContain('plateEnabled: true')
    expect(aiConfigSource).toContain('damageEnabled: true')
    expect(cameraWxml).toContain("请对准车损处，点击下方按钮拍照")
    expect(cameraWxml).toContain("{{aiEnabled && ((currentStep === 'licensePlate' && plateAIFeatureEnabled) || (currentStep === 'damage' && damageAIFeatureEnabled)) ? '手动拍照' : '点击拍照'}}")
    expect(cameraWxml).toContain('wx:if="{{aiStatusText}}"')
  })

  test('starts and stops camera frame listener for AI preview frames', () => {
    loadCameraPage({
      aiFeatureConfig: {
        enabled: true
      }
    })
    let frameHandler = null
    const start = jest.fn(({ success } = {}) => {
      if (success) success()
    })
    const stop = jest.fn(({ success } = {}) => {
      if (success) success()
    })
    const onCameraFrame = jest.fn((handler) => {
      frameHandler = handler
      return { start, stop }
    })
    const frame = {
      data: new ArrayBuffer(4),
      width: 1,
      height: 1
    }
    const instance = createPageInstance({
      cameraContext: { onCameraFrame },
      cameraFrameListener: null,
      latestAIFrame: null
    })

    pageConfig.startAIFrameListener.call(instance, 'test_start')
    frameHandler(frame)
    expect(instance.latestAIFrame).toEqual(expect.objectContaining({
      data: frame.data,
      width: 1,
      height: 1
    }))

    pageConfig.stopAIFrameListener.call(instance, 'test_stop')

    expect(onCameraFrame).toHaveBeenCalledWith(expect.any(Function))
    expect(start).toHaveBeenCalled()
    expect(stop).toHaveBeenCalled()
    expect(instance.latestAIFrame).toBeNull()
    expect(runtimeLogger.info).toHaveBeenCalledWith('ai', 'ai_frame_listener_start', expect.objectContaining({
      reason: 'test_start'
    }))
    expect(runtimeLogger.info).toHaveBeenCalledWith('ai', 'ai_frame_listener_stop', expect.objectContaining({
      reason: 'test_stop'
    }))
  })

  test('AI preview uses latest camera frame instead of cameraContext.takePhoto', async () => {
    const takePhoto = jest.fn()
    const imageData = { data: new Uint8ClampedArray(4) }
    const putImageData = jest.fn()
    const createImageData = jest.fn(() => imageData)
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ({
        createImageData,
        putImageData
      })),
      toTempFilePath: jest.fn(({ success } = {}) => {
        success({ tempFilePath: '/tmp/ai-frame.jpg' })
      })
    }
    wx.createOffscreenCanvas = jest.fn(() => canvas)
    const instance = createPageInstance({
      cameraContext: { takePhoto },
      latestAIFrame: {
        data: new Uint8Array([255, 0, 0, 255]).buffer,
        width: 1,
        height: 1
      },
      aiPreviewTakePhotoRemovedLogged: false
    })

    const result = await pageConfig.takeAIPreviewPhoto.call(instance)

    expect(result).toBe('/tmp/ai-frame.jpg')
    expect(takePhoto).not.toHaveBeenCalled()
    expect(createImageData).toHaveBeenCalledWith(1, 1)
    expect(putImageData).toHaveBeenCalledWith(imageData, 0, 0)
    expect(runtimeLogger.info).toHaveBeenCalledWith('ai', 'ai_preview_take_photo_removed', expect.objectContaining({
      source: 'onCameraFrame'
    }))
  })

  test('onShow sends forced realtime probe', () => {
    const instance = createPageInstance({
      updateAppEnvBadge: jest.fn(),
      loadCacheData: jest.fn()
    })

    pageConfig.onShow.call(instance)

    expect(runtimeLogger.forceWarn).toHaveBeenCalledWith('diagnostic', 'realtime_probe', expect.objectContaining({
      probe: 'selfCam_realtime_probe',
      page: 'packageD/pages/camera/camera',
      at: expect.any(Number)
    }))
  })

  test('logs camera layout snapshot to WeChat realtime logs once per layout geometry', () => {
    const instance = createPageInstance({
      cameraLayoutRealtimeLogKey: '',
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
        showConfirmModal: false,
        pendingPhoto: null,
        aiEnabled: true,
        aiAvailable: true
      }
    })
    const layout = {
      windowWidth: 1084,
      windowHeight: 488,
      cameraWidth: 574.12,
      cameraHeight: 430.59,
      layoutScale: 1.435,
      needsResponsiveUiScale: true
    }

    pageConfig.logCameraLayoutSnapshot.call(instance, layout, 'test_layout')
    pageConfig.logCameraLayoutSnapshot.call(instance, layout, 'test_layout')

    expect(runtimeLogger.forceWarn).toHaveBeenCalledTimes(1)
    expect(runtimeLogger.forceWarn).toHaveBeenCalledWith('ai', 'camera_layout_snapshot', expect.objectContaining({
      feedbackId: 'selfCam_test-session',
      reason: 'test_layout',
      windowWidth: 1084,
      windowHeight: 488,
      cameraWidth: 574.12,
      cameraHeight: 430.59,
      layoutScale: 1.435,
      needsResponsiveUiScale: true,
      model: 'iPhone 15',
      platform: 'ios'
    }))
  })

  test('throttles auto capture gate samples for recognized but not ready targets', () => {
    const dateSpy = jest.spyOn(Date, 'now')
    const instance = createPageInstance({
      aiGateLogAt: {},
      aiDetectionRunId: 7
    })

    try {
      dateSpy.mockReturnValueOnce(1000)
      pageConfig.logAutoCaptureGateSample.call(instance, constants.SHOOT_STEP.LICENSE_PLATE, {
        frameMapping: {
          sourceWidth: 800,
          sourceHeight: 450,
          frameAspect: 1.7778,
          mappingMode: 'aspectFillCrop',
          scale: 0.6667,
          offsetX: -66.67,
          offsetY: 0
        },
        captureBox: { x: 100, y: 176, width: 200, height: 68 },
        mappedBox: { centerX: 200, centerY: 210, width: 140, height: 40 },
        inBox: false,
        centerAligned: true,
        areaRatio: 0.41,
        consecutiveCount: 1
      })

      dateSpy.mockReturnValueOnce(2500)
      pageConfig.logAutoCaptureGateSample.call(instance, constants.SHOOT_STEP.LICENSE_PLATE, {
        frameMapping: {
          sourceWidth: 800,
          sourceHeight: 450,
          frameAspect: 1.7778,
          mappingMode: 'aspectFillCrop',
          scale: 0.6667,
          offsetX: -66.67,
          offsetY: 0
        },
        captureBox: { x: 100, y: 176, width: 200, height: 68 },
        mappedBox: { centerX: 200, centerY: 210, width: 140, height: 40 },
        inBox: false,
        centerAligned: true,
        areaRatio: 0.41,
        consecutiveCount: 1
      })

      dateSpy.mockReturnValueOnce(5200)
      pageConfig.logAutoCaptureGateSample.call(instance, constants.SHOOT_STEP.LICENSE_PLATE, {
        frameMapping: {
          sourceWidth: 800,
          sourceHeight: 450,
          frameAspect: 1.7778,
          mappingMode: 'aspectFillCrop',
          scale: 0.6667,
          offsetX: -66.67,
          offsetY: 0
        },
        captureBox: { x: 100, y: 176, width: 200, height: 68 },
        mappedBox: { centerX: 200, centerY: 210, width: 140, height: 40 },
        inBox: false,
        centerAligned: true,
        areaRatio: 0.41,
        consecutiveCount: 1
      })

      expect(runtimeLogger.forceWarn).toHaveBeenCalledTimes(2)
      expect(runtimeLogger.forceWarn).toHaveBeenNthCalledWith(1, 'ai', 'auto_capture_gate_sample', expect.objectContaining({
        feedbackId: 'selfCam_test-session',
        step: constants.SHOOT_STEP.LICENSE_PLATE,
        runId: 7,
        frameWidth: 800,
        frameHeight: 450,
        mappingMode: 'aspectFillCrop',
        captureBox: { x: 100, y: 176, width: 200, height: 68 },
        mappedBox: { centerX: 200, centerY: 210, width: 140, height: 40 },
        centerAligned: true,
        areaRatio: 0.41,
        consecutiveCount: 1
      }))
    } finally {
      dateSpy.mockRestore()
    }
  })

  test('passes fresh aiConfig into detectors instead of frozen model url and path', async () => {
    loadCameraPage({
      aiFeatureConfig: {
        enabled: true
      }
    })
    const instance = createPageInstance()
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    try {
      await pageConfig.ensureDetector.call(instance, constants.SHOOT_STEP.LICENSE_PLATE)

      expect(envConfig.getAiConfig).toHaveBeenCalled()
      expect(PlateDetector).toHaveBeenCalledWith(expect.objectContaining({
        aiConfig: expect.objectContaining({
          appEnv: 'sit',
          plateModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx'
        }),
        scoreThreshold: 0.7,
        iouThreshold: 0.5,
        targetSize: 640,
        inputName: 'input',
        outputName: 'output'
      }))
      expect(PlateDetector.mock.calls[0][0]).not.toHaveProperty('modelUrl')
      expect(PlateDetector.mock.calls[0][0]).not.toHaveProperty('modelPath')
      expect(runtimeLogger.info).toHaveBeenCalledWith('ai', 'model_config', expect.objectContaining({
        appEnv: 'sit',
        wxEnvVersion: 'trial',
        plateModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx',
        damageModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/damage.onnx'
      }))
      expect(runtimeLogger.forceWarn).toHaveBeenCalledWith('ai', 'model_config_probe', expect.objectContaining({
        appEnv: 'sit',
        wxEnvVersion: 'trial',
        plateModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx',
        damageModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/damage.onnx'
      }))

      await pageConfig.ensureDetector.call(instance, constants.SHOOT_STEP.DAMAGE)

      expect(DamageDetector).toHaveBeenCalledWith(expect.objectContaining({
        aiConfig: expect.objectContaining({
          appEnv: 'sit',
          damageModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/damage.onnx'
        }),
        scoreThreshold: 0.3,
        iouThreshold: 0.2,
        targetSize: 640,
        inputName: 'images',
        outputName: 'output0'
      }))
      expect(DamageDetector.mock.calls[0][0]).not.toHaveProperty('modelUrl')
      expect(DamageDetector.mock.calls[0][0]).not.toHaveProperty('modelPath')
    } finally {
      consoleLogSpy.mockRestore()
    }
  })

  test('logs ai config and system info when detector init fails', async () => {
    loadCameraPage({
      aiFeatureConfig: {
        enabled: true
      }
    })
    const detectorError = Object.assign(new Error('Download failed with status: 418'), {
      stage: 'download_status',
      modelName: 'plate',
      statusCode: 418,
      errMsg: 'blocked by WAF'
    })
    PlateDetector.mockImplementationOnce(function PlateDetectorMock(options) {
      this.options = options
      this.isModelLoaded = jest.fn(() => false)
      this.load = jest.fn(() => Promise.reject(detectorError))
    })
    const instance = createPageInstance()
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const detector = await pageConfig.ensureDetector.call(instance, constants.SHOOT_STEP.LICENSE_PLATE)

      expect(detector).toBeNull()
      expect(runtimeLogger.error).toHaveBeenCalledWith('ai', 'detector_init_failed', expect.objectContaining({
        step: constants.SHOOT_STEP.LICENSE_PLATE,
        feedbackId: 'selfCam_test-session',
        appEnv: 'sit',
        wxEnvVersion: 'trial',
        plateModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx',
        damageModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/damage.onnx',
        stage: 'download_status',
        modelName: 'plate',
        statusCode: 418,
        message: 'Download failed with status: 418',
        errMsg: 'blocked by WAF',
        systemInfo: expect.objectContaining({
          model: 'iPhone 15',
          system: 'iOS 17.0',
          platform: 'ios',
          SDKVersion: '3.15.1',
          version: '8.0.50',
          brand: 'Apple'
        })
      }))
      expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai', 'detector_init_failed', expect.objectContaining({
        step: constants.SHOOT_STEP.LICENSE_PLATE,
        feedbackId: 'selfCam_test-session',
        stage: 'download_status',
        modelName: 'plate',
        statusCode: 418,
        errMsg: 'blocked by WAF'
      }))
      expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai', 'ai_unavailable', expect.objectContaining({
        reason: 'detector_init_failed',
        feedbackId: 'selfCam_test-session',
        appEnv: 'sit',
        wxEnvVersion: 'trial',
        plateModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx',
        damageModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/damage.onnx',
        stage: 'download_status',
        modelName: 'plate',
        statusCode: 418,
        message: 'Download failed with status: 418',
        errMsg: 'blocked by WAF',
        systemInfo: expect.objectContaining({
          model: 'iPhone 15',
          system: 'iOS 17.0',
          platform: 'ios',
          SDKVersion: '3.15.1',
          version: '8.0.50',
          brand: 'Apple'
        })
      }))
      expect(instance.data.aiStatusText).toBe('unavailable')
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  test('reports AI unavailable when inference API is missing', () => {
    loadCameraPage({
      aiFeatureConfig: {
        enabled: true
      }
    })
    const instance = createPageInstance()

    pageConfig.initAICapability.call(instance)

    expect(instance.data.aiAvailable).toBe(false)
    expect(instance.data.aiStatusText).toBe('unavailable')
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai', 'ai_unavailable', expect.objectContaining({
      reason: 'inference_api_unavailable',
      feedbackId: 'selfCam_test-session',
      appEnv: 'sit',
      wxEnvVersion: 'trial',
      plateModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx',
      damageModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/damage.onnx',
      stage: 'inference_api',
      message: 'wx.createInferenceSession is not available',
      systemInfo: expect.objectContaining({
        model: 'iPhone 15',
        SDKVersion: '3.15.1',
        brand: 'Apple'
      })
    }))
  })

  test('single vehicle module one natural VIN completion opens module one preview', () => {
    cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    cache.currentVehicleIndex = 0
    cache.fromPreview = false
    cache.vehicles[0].licensePlate = {
      status: 'completed',
      compressedPath: '/tmp/plate.jpg'
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.VIN_CODE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/vin.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.vehicles[0].vinCode).toEqual(expect.objectContaining({
      compressedPath: '/tmp/vin.jpg',
      status: 'completed'
    }))
    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.MODULE_ONE_PREVIEW)
    expect(cache.currentDamageCount).toBe(0)
    expect(album.saveConfirmedPhotoToAlbum).not.toHaveBeenCalled()
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleOne'
    }))
    expect(instance.data.currentStep).not.toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalledWith('module_two_damage_start')
  })

  test('scene 45 confirmation advances into target vehicle license plate capture', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_45
    cache.scenePhotos = {
      scene45: { status: 'pending' },
      supplements: []
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_45,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/scene-45.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.scenePhotos.scene45).toEqual(expect.objectContaining({
      compressedPath: '/tmp/scene-45.jpg',
      status: 'completed'
    }))
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('confirm_scene_45')
  })

  test('module one scene 45 preview recapture returns to module one preview', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_45
    cache.fromPreview = true
    cache.previewReturnMode = 'moduleOne'
    cache.scenePhotos = {
      scene45: { status: 'pending' },
      supplements: []
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_45,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/scene-45-retake.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.scenePhotos.scene45).toEqual(expect.objectContaining({
      compressedPath: '/tmp/scene-45-retake.jpg',
      status: 'completed'
    }))
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.MODULE_ONE_PREVIEW)
    expect(global.wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleOne'
    }))
    expect(instance.data.currentStep).not.toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalledWith('confirm_scene_45')
  })

  test('final preview scene 45 recapture returns to final preview', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_45
    cache.fromPreview = true
    cache.previewReturnMode = 'final'
    cache.scenePhotos = {
      scene45: { status: 'pending' },
      supplements: []
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_45,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/final-scene-45.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.scenePhotos.scene45).toEqual(expect.objectContaining({
      compressedPath: '/tmp/final-scene-45.jpg',
      status: 'completed'
    }))
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.FINAL_PREVIEW)
    expect(global.wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=final'
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleOne'
    }))
  })

  test('final preview scene supplement recapture returns to final preview', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_SUPPLEMENT
    cache.fromPreview = true
    cache.previewReturnMode = 'final'
    cache.sceneSupplementIndex = 0
    cache.scenePhotos = {
      scene45: { status: 'completed', compressedPath: '/tmp/scene-45.jpg' },
      supplements: [{ status: 'completed', compressedPath: '/tmp/old-supplement.jpg' }]
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_SUPPLEMENT,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/final-scene-supplement.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.scenePhotos.supplements[0]).toEqual(expect.objectContaining({
      compressedPath: '/tmp/final-scene-supplement.jpg',
      status: 'completed'
    }))
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.FINAL_PREVIEW)
    expect(global.wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=final'
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleOne'
    }))
  })

  test('final preview license plate recapture returns to final preview', () => {
    cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
    cache.fromPreview = true
    cache.previewReturnMode = 'final'
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/final-plate.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.vehicles[0].licensePlate).toEqual(expect.objectContaining({
      compressedPath: '/tmp/final-plate.jpg',
      status: 'completed'
    }))
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.FINAL_PREVIEW)
    expect(global.wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=final'
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleOne'
    }))
  })

  test('final preview VIN recapture returns to final preview', () => {
    cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    cache.fromPreview = true
    cache.previewReturnMode = 'final'
    cache.vehicles[0].licensePlate = {
      status: 'completed',
      compressedPath: '/tmp/final-plate.jpg'
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.VIN_CODE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/final-vin.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.vehicles[0].vinCode).toEqual(expect.objectContaining({
      compressedPath: '/tmp/final-vin.jpg',
      status: 'completed'
    }))
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.FINAL_PREVIEW)
    expect(global.wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=final'
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleOne'
    }))
  })

  test('module two entry starts damage capture without returning to license plate or VIN', () => {
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.currentVehicleIndex = 0
    cache.scenePhotos = {
      scene45: {
        status: 'completed',
        compressedPath: '/tmp/scene-45.jpg'
      },
      supplements: []
    }
    cache.vehicles[0].licensePlate = {
      status: 'completed',
      compressedPath: '/tmp/plate.jpg'
    }
    cache.vehicles[0].vinCode = {
      status: 'completed',
      compressedPath: '/tmp/vin.jpg'
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        pendingPhoto: null,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.loadCacheData.call(instance, 'module_two_entry')

    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.data.damageCount).toBe(0)
    expect(global.wx.redirectTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/index/index'
    }))
  })

  test('aux photo finish damage asks before advancing to next vehicle', () => {
    cache = {
      auxPhoto: {
        enabled: true,
        ticket: 'mock-2'
      },
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      currentDamageCount: 1,
      vehicles: [
        {
          type: '标的车',
          vehicleRoleName: '标的车',
          licenseNo: '京A12345',
          damages: [{ compressedPath: '/tmp/damage-1.jpg' }]
        },
        {
          type: '三者车',
          vehicleRoleName: '三者车',
          licenseNo: '京B12345',
          damages: []
        }
      ]
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        pendingPhoto: null,
        damageCount: 1,
        isNavigating: false,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onFinishDamage.call(instance)

    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.data.isNavigating).toBe(true)
    expect(storage.saveCache).not.toHaveBeenCalled()
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()
    expect(global.wx.showModal).not.toHaveBeenCalled()
    expect(instance.data.showDamageCompleteModal).toBe(true)
    expect(instance.data.damageCompleteModalContent).toContain('\u5df2\u62cd\u6444 1 \u5f20')
    expect(instance.data.damageCompleteModalContent).not.toContain('\u5df2\u62cd\u6ee1 10 \u5f20')
    expect(instance.data.damageCompleteConfirmText).toBe('\u4e0b\u4e00\u8f86\u8f66')
    expect(instance.data.damageCompleteCancelText).toBe('\u67e5\u770b\u5df2\u62cd')
    expect(instance.data.damageCompleteShowCancel).toBe(true)
    expect(instance.data.cameraMounted).toBe(false)
    expect(instance.stopAIDetectionLoop).toHaveBeenCalled()
    expect(instance.stopAIFrameListener).toHaveBeenCalledWith('damage_complete_modal')

    pageConfig.onDamageCompleteModalConfirm.call(instance)

    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.currentDamageCount).toBe(0)
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      currentVehicleIndex: 1,
      currentStep: constants.SHOOT_STEP.DAMAGE
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.data.vehicleRoleName).toBe('三者车')
    expect(instance.data.vehiclePlateNo).toBe('京B12345')
    expect(instance.data.vehicleProgressText).toBe('2/2 辆')
    expect(instance.data.finishDamageText).toBe('去预览')
    expect(instance.data.isNavigating).toBe(false)
    expect(instance.data.showDamageCompleteModal).toBe(false)
    expect(instance.data.cameraMounted).toBe(false)
    expect(instance.pendingCameraInitResumeReason).toBe('finish_damage_next_vehicle')
    expect(instance.pendingCameraRemountReason).toBe('finish_damage_next_vehicle')
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()

    pageConfig.onCameraStop.call(instance, { detail: {} })
    expect(instance.data.cameraMounted).toBe(true)

    pageConfig.onCameraInitDone.call(instance, { detail: {} })

    expect(instance.pendingCameraInitResumeReason).toBe('')
    expect(instance.pendingCameraRemountReason).toBe('')
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('finish_damage_next_vehicle')
  })

  test('aux photo finish damage opens preview when user reviews captured photos', () => {
    cache = {
      auxPhoto: {
        enabled: true,
        ticket: 'mock-2'
      },
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      currentDamageCount: 1,
      vehicles: [
        {
          type: 'target',
          vehicleRoleName: 'target',
          licenseNo: 'A12345',
          damages: [{ compressedPath: '/tmp/damage-1.jpg' }]
        },
        {
          type: 'third',
          vehicleRoleName: 'third',
          licenseNo: 'B12345',
          damages: []
        }
      ]
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        pendingPhoto: null,
        damageCount: 1,
        isNavigating: false,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onFinishDamage.call(instance)
    expect(global.wx.showModal).not.toHaveBeenCalled()
    expect(instance.data.showDamageCompleteModal).toBe(true)
    expect(instance.data.damageCompleteModalContent).toContain('\u5df2\u62cd\u6444 1 \u5f20')
    expect(instance.data.damageCompleteModalContent).not.toContain('\u5df2\u62cd\u6ee1 10 \u5f20')

    pageConfig.onDamageCompleteModalCancel.call(instance)

    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      fromPreview: false
    }))
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleTwo'
    }))
    expect(instance.data.showDamageCompleteModal).toBe(false)
    expect(instance.data.cameraMounted).toBe(false)
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()
  })

  test('aux photo finish damage on final vehicle uses single preview action', () => {
    cache = {
      auxPhoto: {
        enabled: true,
        ticket: 'mock-1'
      },
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      currentDamageCount: 10,
      vehicles: [
        {
          type: 'target',
          vehicleRoleName: 'target',
          licenseNo: 'A12345',
          damages: Array.from({ length: constants.LIMITS.MAX_DAMAGES }, (_, index) => ({
            compressedPath: `/tmp/damage-${index + 1}.jpg`
          }))
        }
      ]
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        pendingPhoto: null,
        damageCount: 10,
        isNavigating: false,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onFinishDamage.call(instance)

    expect(instance.data.showDamageCompleteModal).toBe(false)
    expect(instance.data.cameraMounted).toBe(false)

    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleTwo'
    }))
    expect(instance.data.cameraMounted).toBe(false)
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()
    expect(instance.pendingCameraInitResumeReason).toBe('')
  })

  test('aux photo finish damage on final vehicle with partial damages uses captured count copy', () => {
    cache = {
      auxPhoto: {
        enabled: true,
        ticket: 'mock-1'
      },
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      currentDamageCount: 2,
      vehicles: [
        {
          type: 'target',
          vehicleRoleName: 'target',
          licenseNo: 'A12345',
          damages: [
            { compressedPath: '/tmp/damage-1.jpg' },
            { compressedPath: '/tmp/damage-2.jpg' }
          ]
        }
      ]
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        pendingPhoto: null,
        damageCount: 2,
        isNavigating: false,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onFinishDamage.call(instance)

    expect(instance.data.showDamageCompleteModal).toBe(false)
    expect(instance.data.cameraMounted).toBe(false)
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleTwo'
    }))
  })

  test('aux photo max damage asks before advancing to next vehicle', () => {
    cache = {
      auxPhoto: {
        enabled: true,
        ticket: 'mock-2'
      },
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      currentDamageCount: 9,
      vehicles: [
        {
          type: '标的车',
          vehicleRoleName: '标的车',
          licenseNo: '京A12345',
          damages: Array.from({ length: constants.LIMITS.MAX_DAMAGES - 1 }, (_, index) => ({
            compressedPath: `/tmp/damage-${index + 1}.jpg`
          }))
        },
        {
          type: '三者车',
          vehicleRoleName: '三者车',
          licenseNo: '京B12345',
          damages: []
        }
      ]
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/damage-10.jpg'
        },
        damageCount: 9,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.vehicles[0].damages).toHaveLength(10)
    expect(instance.data.showConfirmModal).toBe(false)
    expect(instance.data.pendingPhoto).toBeNull()
    expect(instance.data.damageCount).toBe(10)
    expect(instance.data.finishDamageText).toBe('下一辆车')
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()

    expect(global.wx.showModal).not.toHaveBeenCalled()
    expect(instance.data.showDamageCompleteModal).toBe(true)
    expect(instance.data.damageCompleteModalContent).toContain('\u5df2\u62cd\u6ee1 10 \u5f20')
    expect(instance.data.damageCompleteConfirmText).toBe('\u4e0b\u4e00\u8f86\u8f66')
    expect(instance.data.damageCompleteCancelText).toBe('\u67e5\u770b\u5df2\u62cd')
    expect(instance.data.damageCompleteShowCancel).toBe(true)
    expect(instance.data.cameraMounted).toBe(false)

    pageConfig.onDamageCompleteModalConfirm.call(instance)

    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.currentDamageCount).toBe(0)
    expect(storage.saveCache).toHaveBeenLastCalledWith(expect.objectContaining({
      currentVehicleIndex: 1,
      currentStep: constants.SHOOT_STEP.DAMAGE
    }))
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.data.showDamageCompleteModal).toBe(false)
    expect(instance.data.cameraMounted).toBe(false)
    expect(instance.pendingCameraInitResumeReason).toBe('finish_damage_next_vehicle')
    expect(instance.pendingCameraRemountReason).toBe('finish_damage_next_vehicle')
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()

    pageConfig.onCameraStop.call(instance, { detail: {} })
    expect(instance.data.cameraMounted).toBe(true)

    pageConfig.onCameraInitDone.call(instance, { detail: {} })

    expect(instance.pendingCameraInitResumeReason).toBe('')
    expect(instance.pendingCameraRemountReason).toBe('')
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('finish_damage_next_vehicle')
  })

  test('aux photo max damage rejects another confirmed damage photo before advancing', () => {
    cache = {
      auxPhoto: {
        enabled: true,
        ticket: 'mock-2'
      },
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      currentDamageCount: 10,
      vehicles: [
        {
          type: '标的车',
          vehicleRoleName: '标的车',
          licenseNo: '京A12345',
          damages: Array.from({ length: constants.LIMITS.MAX_DAMAGES }, (_, index) => ({
            compressedPath: `/tmp/damage-${index + 1}.jpg`
          }))
        },
        {
          type: '三者车',
          vehicleRoleName: '三者车',
          licenseNo: '京B12345',
          damages: []
        }
      ]
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/damage-11.jpg'
        },
        damageCount: 10,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.vehicles[0].damages).toHaveLength(10)
    expect(cache.vehicles[0].damages.map((photo) => photo.compressedPath)).not.toContain('/tmp/damage-11.jpg')
    expect(cache.currentDamageCount).toBe(10)
    expect(instance.data.showConfirmModal).toBe(false)
    expect(instance.data.pendingPhoto).toBeNull()
    expect(instance.data.damageCount).toBe(10)
    expect(global.wx.showToast).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'none'
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()

    expect(global.wx.showModal).not.toHaveBeenCalled()
    expect(instance.data.showDamageCompleteModal).toBe(true)
    expect(instance.data.damageCompleteModalContent).toContain('\u5df2\u62cd\u6ee1 10 \u5f20')
    expect(instance.data.damageCompleteConfirmText).toBe('\u4e0b\u4e00\u8f86\u8f66')
    expect(instance.data.damageCompleteCancelText).toBe('\u67e5\u770b\u5df2\u62cd')
    expect(instance.data.damageCompleteShowCancel).toBe(true)
    expect(instance.data.cameraMounted).toBe(false)

    pageConfig.onDamageCompleteModalConfirm.call(instance)

    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.currentDamageCount).toBe(0)
    expect(cache.vehicles[0].damages).toHaveLength(10)
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.data.showDamageCompleteModal).toBe(false)
    expect(instance.data.cameraMounted).toBe(false)
    expect(instance.pendingCameraInitResumeReason).toBe('finish_damage_next_vehicle')
    expect(instance.pendingCameraRemountReason).toBe('finish_damage_next_vehicle')
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()

    pageConfig.onCameraStop.call(instance, { detail: {} })
    expect(instance.data.cameraMounted).toBe(true)

    pageConfig.onCameraInitDone.call(instance, { detail: {} })

    expect(instance.pendingCameraInitResumeReason).toBe('')
    expect(instance.pendingCameraRemountReason).toBe('')
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('finish_damage_next_vehicle')
  })

  test('leaving with pending damage does not exceed max damage count', () => {
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.currentDamageCount = 10
    cache.vehicles[0].damages = Array.from({ length: constants.LIMITS.MAX_DAMAGES }, (_, index) => ({
      compressedPath: `/tmp/damage-${index + 1}.jpg`
    }))
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/damage-11.jpg'
        },
        damageCount: 10,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    const saved = pageConfig.savePendingPhotoBeforeLeave.call(instance)

    expect(saved).toBe(false)
    expect(cache.vehicles[0].damages).toHaveLength(10)
    expect(cache.vehicles[0].damages.map((photo) => photo.compressedPath)).not.toContain('/tmp/damage-11.jpg')
    expect(cache.currentDamageCount).toBe(10)
    expect(instance.data.showConfirmModal).toBe(false)
    expect(instance.data.pendingPhoto).toBeNull()
    expect(instance.data.damageCount).toBe(10)
  })

  test('leaving with pending scene supplement saves it before returning to preview', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_SUPPLEMENT
    cache.sceneSupplementIndex = 0
    cache.scenePhotos = {
      scene45: { status: 'pending' },
      supplements: []
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_SUPPLEMENT,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/scene-supplement.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    const saved = pageConfig.savePendingPhotoBeforeLeave.call(instance)

    expect(saved).toBe(true)
    expect(cache.scenePhotos.supplements[0]).toEqual(expect.objectContaining({
      compressedPath: '/tmp/scene-supplement.jpg',
      status: 'completed'
    }))
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      currentStep: constants.SHOOT_STEP.SCENE_SUPPLEMENT
    }))
  })

  test('module one preview fallback keeps module one mode when returning from scene supplement', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_SUPPLEMENT
    cache.fromPreview = true
    global.getCurrentPages = jest.fn(() => [])
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_SUPPLEMENT,
        showConfirmModal: false,
        pendingPhoto: null,
        isNavigating: false,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onGoPreview.call(instance)

    expect(global.wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleOne'
    }))
    expect(global.wx.reLaunch).not.toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview'
    }))
  })

  test('leaving with pending natural module one VIN starts module two damage capture state', () => {
    cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    cache.auxPhoto = { enabled: false }
    cache.fromPreview = false
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.VIN_CODE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/pending-vin.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    const saved = pageConfig.savePendingPhotoBeforeLeave.call(instance)

    expect(saved).toBe(true)
    expect(cache.vehicles[0].vinCode).toEqual(expect.objectContaining({
      compressedPath: '/tmp/pending-vin.jpg',
      status: 'completed'
    }))
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.MODULE_ONE_PREVIEW)
    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentDamageCount).toBe(0)
  })

  test('leaving with pending preview VIN still routes back to module one preview state', () => {
    cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    cache.auxPhoto = { enabled: false }
    cache.fromPreview = true
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.VIN_CODE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/pending-preview-vin.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    const saved = pageConfig.savePendingPhotoBeforeLeave.call(instance)

    expect(saved).toBe(true)
    expect(cache.vehicles[0].vinCode).toEqual(expect.objectContaining({
      compressedPath: '/tmp/pending-preview-vin.jpg',
      status: 'completed'
    }))
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.MODULE_ONE_PREVIEW)
    expect(cache.currentDamageCount).toBe(0)
  })

  test('multi vehicle module one flow captures all VINs before module one preview', () => {
    cache.currentStep = constants.SHOOT_STEP.SCENE_45
    cache.auxPhoto = { enabled: true }
    cache.scenePhotos = {
      scene45: { status: 'pending' },
      supplements: []
    }
    cache.vehicles = [
      { type: 'target', damages: [] },
      { type: 'thirdParty', damages: [] }
    ]
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_45,
        showConfirmModal: true,
        pendingPhoto: { compressedPath: '/tmp/scene-45.jpg' },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)
    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)

    instance.setData({
      currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
      showConfirmModal: true,
      pendingPhoto: { compressedPath: '/tmp/target-plate.jpg' }
    })
    pageConfig.onConfirmPhoto.call(instance)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.VIN_CODE)

    instance.setData({
      currentStep: constants.SHOOT_STEP.VIN_CODE,
      showConfirmModal: true,
      pendingPhoto: { compressedPath: '/tmp/target-vin.jpg' }
    })
    pageConfig.onConfirmPhoto.call(instance)
    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)

    instance.setData({
      currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
      showConfirmModal: true,
      pendingPhoto: { compressedPath: '/tmp/third-plate.jpg' }
    })
    pageConfig.onConfirmPhoto.call(instance)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.VIN_CODE)

    instance.setData({
      currentStep: constants.SHOOT_STEP.VIN_CODE,
      showConfirmModal: true,
      pendingPhoto: { compressedPath: '/tmp/third-vin.jpg' }
    })
    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.vehicles[0].vinCode.compressedPath).toBe('/tmp/target-vin.jpg')
    expect(cache.vehicles[1].vinCode.compressedPath).toBe('/tmp/third-vin.jpg')
    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.MODULE_ONE_PREVIEW)
    expect(cache.currentDamageCount).toBe(0)
    expect(global.wx.navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleOne'
    }))
    expect(instance.data.currentStep).not.toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenLastCalledWith('module_two_damage_start')
  })

  test('preview VIN retake confirmation still returns to module one preview', () => {
    cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    cache.fromPreview = true
    cache.vehicles[0].licensePlate = {
      status: 'completed',
      compressedPath: '/tmp/plate.jpg'
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.VIN_CODE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/preview-vin.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.vehicles[0].vinCode).toEqual(expect.objectContaining({
      compressedPath: '/tmp/preview-vin.jpg',
      status: 'completed'
    }))
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.MODULE_ONE_PREVIEW)
    expect(global.wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=moduleOne'
    }))
    expect(instance.data.currentStep).not.toBe(constants.SHOOT_STEP.DAMAGE)
  })

  test('module two next vehicle stays in damage when module one vehicle info is complete', () => {
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.currentVehicleIndex = 0
    cache.currentDamageCount = 10
    cache.auxPhoto = { enabled: false }
    cache.vehicles = [
      {
        type: 'target',
        licensePlate: { status: 'completed', compressedPath: '/tmp/target-plate.jpg' },
        vinCode: { status: 'completed', compressedPath: '/tmp/target-vin.jpg' },
        damages: Array.from({ length: constants.LIMITS.MAX_DAMAGES }, (_, index) => ({ compressedPath: `/tmp/damage-${index}.jpg` }))
      },
      {
        type: 'thirdParty',
        licensePlate: { status: 'completed', compressedPath: '/tmp/third-plate.jpg' },
        vinCode: { status: 'completed', compressedPath: '/tmp/third-vin.jpg' },
        damages: []
      }
    ]
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        pendingPhoto: null,
        damageCount: 10,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.advanceToNextAuxVehicle.call(instance, cache, cacheSelectors.getCurrentFlowContext(cache))

    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.currentDamageCount).toBe(0)
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalledWith('finish_damage_next_vehicle')
    expect(instance.data.showCaptureGuideModal).toBe(false)
  })

  test('left side review entry opens scene and damage guides without changing step', () => {
    const sceneInstance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.SCENE_45,
        showConfirmModal: false,
        pendingPhoto: null,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onOpenCaptureGuide.call(sceneInstance)

    expect(sceneInstance.data.showCaptureGuideModal).toBe(true)
    expect(sceneInstance.data.captureGuideType).toBe('scene45')
    expect(sceneInstance.data.captureGuideIntro).toBe(false)
    expect(sceneInstance.data.captureGuideButtonText).toBe('关闭')
    expect(sceneInstance.data.currentStep).toBe(constants.SHOOT_STEP.SCENE_45)

    const damageInstance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        pendingPhoto: null,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onOpenCaptureGuide.call(damageInstance)

    expect(damageInstance.data.showCaptureGuideModal).toBe(true)
    expect(damageInstance.data.captureGuideType).toBe('damage')
    expect(damageInstance.data.captureGuideIntro).toBe(false)
    expect(damageInstance.data.captureGuideButtonText).toBe('关闭')
    expect(damageInstance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
  })

  test('plate and vin do not open capture guide from side entry', () => {
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
        showConfirmModal: false,
        pendingPhoto: null,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onOpenCaptureGuide.call(instance)

    expect(instance.data.showCaptureGuideModal).toBeFalsy()

    instance.setData({ currentStep: constants.SHOOT_STEP.VIN_CODE })
    pageConfig.onOpenCaptureGuide.call(instance)

    expect(instance.data.showCaptureGuideModal).toBeFalsy()
  })

  test('preview return mode keeps final preview after damage supplement', () => {
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.fromPreview = true
    cache.previewReturnMode = 'final'
    const instance = createPageInstance()

    pageConfig.navigateToPreviewPage.call(instance, cache)

    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=final'
    }))
  })

  test('retake mode navigateBack fallback keeps final preview return mode', () => {
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.fromPreview = true
    cache.previewReturnMode = 'final'
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: 0,
      photoType: constants.PHOTO_TYPE.DAMAGE,
      damageIndex: 0
    }
    storage.isRetakeMode.mockReturnValue(true)
    global.wx.navigateBack.mockImplementationOnce(({ fail } = {}) => {
      if (fail) fail({ errMsg: 'navigateBack:fail' })
    })
    const instance = createPageInstance()

    pageConfig.savePhoto.call(instance, {
      compressedPath: '/tmp/final-retake-damage.jpg'
    })

    expect(storage.saveRetakenPhoto).toHaveBeenCalledWith(expect.objectContaining({
      compressedPath: '/tmp/final-retake-damage.jpg'
    }))
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      fromPreview: false,
      previewReturnMode: 'final'
    }))
    expect(global.wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=final'
    }))
  })

  test('camera view exposes scene step labels and preview return affordance', () => {
    const wxml = require('fs').readFileSync('packageD/pages/camera/camera.wxml', 'utf8')

    expect(wxml).toContain('<camera')
    expect(wxml).toContain('bindtap="onCapture"')
    expect(wxml).toContain('bindtap="onConfirmPhoto"')
    expect(wxml).toContain('<confirm-modal')
    expect(wxml).toContain('{{damageCount}}/10 张</text>')
    expect(wxml).toContain('当前车辆')
    expect(wxml).toContain('车损照片')
    expect(wxml).not.toContain('?/text>')
    expect(wxml).not.toMatch(/[\u938B\u93B7\u9413\u891D\u8930]/u)
    expect(wxml).toContain('{{stepDisplayName}}')
    expect(wxml).toContain('{{previewButtonText}}')
    expect(wxml).toContain("currentStep === 'scene45'")
    expect(wxml).toContain("currentStep === 'sceneSupplement'")
  })

  test('camera side capture guide entry keeps weak pill structure and scoped visibility', () => {
    const wxml = require('fs').readFileSync('packageD/pages/camera/camera.wxml', 'utf8')

    expect(wxml).toContain('class="side-guide-entry"')
    expect(wxml).toContain('bindtap="onOpenCaptureGuide"')
    expect(wxml).toContain("wx:if=\"{{currentStep === 'scene45' || currentStep === 'damage'}}\"")
    expect(wxml).toContain("data-guide=\"{{currentStep === 'damage' ? 'damage' : 'scene45'}}\"")
    expect(wxml).toContain('class="side-guide-main">拍摄指引</text>')
    expect(wxml).toContain("class=\"side-guide-tag\">{{currentStep === 'damage' ? '远 / 中 / 近' : '45度'}}")
    expect(wxml).toContain('class="mini-scene-car"')
    expect(wxml).toContain('class="mini-damage-steps"')
  })

  test('continues confirmation without saving confirmed photo to album', async () => {
    cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/plate.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.currentStep).toBe(constants.SHOOT_STEP.VIN_CODE)
    expect(cache.vehicles[0].licensePlate).toEqual(expect.objectContaining({
      compressedPath: '/tmp/plate.jpg',
      status: 'completed'
    }))
    expect(storage.saveCache).toHaveBeenCalledWith(cache)
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('confirm_license_plate')
    expect(album.saveConfirmedPhotoToAlbum).not.toHaveBeenCalled()
  })

  test('manual license plate capture still works while AI is disabled', () => {
    cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
    const instance = createPageInstance({
      cameraContext: {
        takePhoto: jest.fn(({ success } = {}) => {
          success({ tempImagePath: '/tmp/manual-plate.jpg' })
        })
      },
      handlePhoto: jest.fn(),
      stopAIDetectionLoop: pageConfig.stopAIDetectionLoop,
      stopAIFrameListener: jest.fn(),
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
        showConfirmModal: false,
        showDamageCompleteModal: false,
        showCaptureGuideModal: false,
        pendingPhoto: null,
        aiFeatureEnabled: false,
        plateAIFeatureEnabled: true,
        damageAIFeatureEnabled: true,
        aiEnabled: false,
        aiAvailable: true,
        aiStatusText: ''
      }
    })

    pageConfig.onCapture.call(instance)

    expect(instance.cameraContext.takePhoto).toHaveBeenCalledWith(expect.objectContaining({
      quality: 'high'
    }))
    expect(instance.handlePhoto).toHaveBeenCalledWith('/tmp/manual-plate.jpg', expect.objectContaining({
      captureMode: 'manual',
      captureTrigger: 'manual_button',
      aiDetection: null
    }))
    expect(instance.stopAIFrameListener).toHaveBeenCalledWith('manual_capture')
    expect(instance.data.aiStatusText).toBe('')
  })

  test('manual damage capture still works through module two and multi vehicle flow while AI is disabled', () => {
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.currentVehicleIndex = 0
    cache.currentDamageCount = 0
    cache.vehicles = [
      { type: 'target', vehicleRoleName: 'target', damages: [] },
      { type: 'thirdParty', vehicleRoleName: 'thirdParty', damages: [] }
    ]
    const instance = createPageInstance({
      cameraContext: {
        takePhoto: jest.fn(({ success } = {}) => {
          success({ tempImagePath: '/tmp/manual-damage.jpg' })
        })
      },
      handlePhoto: jest.fn(),
      resetAIState: pageConfig.resetAIState,
      resumeAIDetectionAfterStepReady: jest.fn(),
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        showDamageCompleteModal: false,
        showCaptureGuideModal: false,
        pendingPhoto: null,
        damageCount: 0,
        aiFeatureEnabled: false,
        plateAIFeatureEnabled: true,
        damageAIFeatureEnabled: true,
        aiEnabled: false,
        aiAvailable: true,
        aiStatusText: ''
      }
    })

    pageConfig.onCapture.call(instance)
    expect(instance.handlePhoto).toHaveBeenCalledWith('/tmp/manual-damage.jpg', expect.objectContaining({
      captureMode: 'manual',
      captureTrigger: 'manual_button',
      aiDetection: null
    }))

    instance.setData({
      showConfirmModal: true,
      pendingPhoto: { compressedPath: '/tmp/manual-damage-confirmed.jpg' }
    })
    pageConfig.onConfirmPhoto.call(instance)
    expect(cache.vehicles[0].damages).toHaveLength(1)
    expect(cache.vehicles[0].damages[0]).toEqual(expect.objectContaining({
      compressedPath: '/tmp/manual-damage-confirmed.jpg'
    }))
    expect(instance.data.damageCount).toBe(1)

    pageConfig.startModuleTwoDamageCapture.call(instance, cache, 'manual_module_two_start')
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.data.aiStatusText).toBe('')

    pageConfig.advanceToNextAuxVehicle.call(instance, cache, cacheSelectors.getCurrentFlowContext(cache))
    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.data.aiStatusText).toBe('')
  })

  test('AI initialization path is still available when feature switch is restored', async () => {
    loadCameraPage({
      aiFeatureConfig: {
        enabled: true
      }
    })
    wx.createInferenceSession = jest.fn()
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        aiFeatureEnabled: true,
        plateAIFeatureEnabled: true,
        damageAIFeatureEnabled: true,
        aiEnabled: false,
        aiAvailable: false,
        aiStatusText: ''
      }
    })

    pageConfig.initAICapability.call(instance)

    expect(instance.data.aiFeatureEnabled).toBe(true)
    expect(instance.data.aiAvailable).toBe(true)
    expect(instance.data.aiEnabled).toBe(true)
    expect(instance.data.aiStatusText).toBe('loading')
    expect(PlateFrameUtils).toHaveBeenCalled()
    expect(DamageAutoCaptureEngine).toHaveBeenCalled()
    expect(runtimeLogger.info).toHaveBeenCalledWith('ai', 'capability_ready', {
      canUseInference: true
    })

    await pageConfig.ensureDetector.call(instance, constants.SHOOT_STEP.LICENSE_PLATE)
    await pageConfig.ensureDetector.call(instance, constants.SHOOT_STEP.DAMAGE)

    expect(PlateDetector).toHaveBeenCalledTimes(1)
    expect(DamageDetector).toHaveBeenCalledTimes(1)
    expect(envConfig.getAiConfig).toHaveBeenCalled()
  })

  test('does not save to album when user retakes pending photo', () => {
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/rejected.jpg'
        },
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onRetakePhoto.call(instance)

    expect(album.saveConfirmedPhotoToAlbum).not.toHaveBeenCalled()
    expect(instance.data.pendingPhoto).toBeNull()
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('retake_photo')
  })
})
