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

  function loadCameraPage() {
    jest.resetModules()
    pageConfig = null

    constants = {
      SHOOT_STEP: {
        LICENSE_PLATE: 'licensePlate',
        VIN_CODE: 'vinCode',
        DAMAGE: 'damage',
        PREVIEW: 'preview'
      },
      GUIDE_TIPS: {
        licensePlate: 'plate tip',
        vinCode: 'vin tip',
        damage: 'damage tip'
      },
      VEHICLE_TYPE: {
        TARGET: 'target'
      },
      LIMITS: {
        MAX_DAMAGES: 5
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
        currentVehicleProgressText: targetCache.auxPhoto && targetCache.auxPhoto.enabled
          ? `${targetCache.currentVehicleIndex + 1}/${targetCache.vehicles.length} 辆`
          : '',
        hasNextVehicle: !!(targetCache.auxPhoto && targetCache.auxPhoto.enabled && targetCache.currentVehicleIndex < targetCache.vehicles.length - 1),
        nextVehicleIndex: targetCache.currentVehicleIndex < targetCache.vehicles.length - 1 ? targetCache.currentVehicleIndex + 1 : null,
        finishDamageText: targetCache.auxPhoto && targetCache.auxPhoto.enabled && targetCache.currentVehicleIndex < targetCache.vehicles.length - 1
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
      PlateFrameUtils: jest.fn(),
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
    jest.doMock('../packageD/utils/damage-auto-capture-engine', () => jest.fn())
    jest.doMock('../packageD/utils/ai-config', () => ({
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
      navigateBackToPreviewPage: pageConfig.navigateBackToPreviewPage,
      goToPreviewPage: pageConfig.goToPreviewPage,
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

  test('camera component closes camera and hides capture during damage completion decision', () => {
    const fs = require('fs')
    const path = require('path')
    const cameraWxml = fs.readFileSync(path.resolve(__dirname, '../packageD/pages/camera/camera.wxml'), 'utf8')
    const cameraJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../packageD/pages/camera/camera.json'), 'utf8'))
    const cameraTag = cameraWxml.match(/<camera[\s\S]*?>/)[0]

    expect(cameraWxml).not.toContain('vehicleSwitching')
    expect(cameraWxml).not.toContain('vehicle-switch-mask')
    expect(cameraWxml).toContain('<confirm-modal')
    expect(cameraWxml).toContain('visible="{{showDamageCompleteModal}}"')
    expect(cameraWxml).toContain('show-cancel="{{damageCompleteShowCancel}}"')
    expect(cameraWxml).toContain('bind:masktap="onDamageCompleteModalMaskTap"')
    expect(cameraTag).toContain('wx:if="{{cameraMounted && !showConfirmModal && !showDamageCompleteModal}}"')
    expect(cameraWxml).toContain('wx:if="{{cameraMounted && !showConfirmModal && !showDamageCompleteModal}}"')
    expect(cameraJson.usingComponents['confirm-modal']).toBe('/packageD/components/confirm-modal/confirm-modal')
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

  test('starts and stops camera frame listener for AI preview frames', () => {
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

  test('retries AI detection after VIN confirmation switches to damage step', () => {
    cache.currentStep = constants.SHOOT_STEP.VIN_CODE
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

    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.vehicles[0].vinCode).toEqual(expect.objectContaining({
      compressedPath: '/tmp/vin.jpg',
      status: 'completed'
    }))
    expect(album.saveConfirmedPhotoToAlbum).not.toHaveBeenCalled()
    expect(instance.resetAIState).toHaveBeenCalled()
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('confirm_vin_to_damage')
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
    expect(instance.data.damageCompleteModalContent).not.toContain('\u5df2\u62cd\u6ee1 5 \u5f20')
    expect(instance.data.damageCompleteConfirmText).toBe('\u4e0b\u4e00\u8f86\u8f66')
    expect(instance.data.damageCompleteCancelText).toBe('\u67e5\u770b\u5df2\u62cd')
    expect(instance.data.damageCompleteShowCancel).toBe(true)
    expect(instance.data.cameraMounted).toBe(false)
    expect(instance.stopAIDetectionLoop).toHaveBeenCalled()
    expect(instance.stopAIFrameListener).toHaveBeenCalledWith('damage_complete_modal')

    pageConfig.onDamageCompleteModalConfirm.call(instance)

    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(cache.currentDamageCount).toBe(0)
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      currentVehicleIndex: 1,
      currentStep: constants.SHOOT_STEP.LICENSE_PLATE
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
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
    expect(instance.data.damageCompleteModalContent).not.toContain('\u5df2\u62cd\u6ee1 5 \u5f20')

    pageConfig.onDamageCompleteModalCancel.call(instance)

    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      fromPreview: false
    }))
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview'
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
      currentDamageCount: 5,
      vehicles: [
        {
          type: 'target',
          vehicleRoleName: 'target',
          licenseNo: 'A12345',
          damages: [
            { compressedPath: '/tmp/damage-1.jpg' },
            { compressedPath: '/tmp/damage-2.jpg' },
            { compressedPath: '/tmp/damage-3.jpg' },
            { compressedPath: '/tmp/damage-4.jpg' },
            { compressedPath: '/tmp/damage-5.jpg' }
          ]
        }
      ]
    }
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: false,
        pendingPhoto: null,
        damageCount: 5,
        isNavigating: false,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onFinishDamage.call(instance)

    expect(instance.data.showDamageCompleteModal).toBe(true)
    expect(instance.data.damageCompleteModalContent).toContain('\u5df2\u62cd\u6ee1 5 \u5f20')
    expect(instance.data.damageCompleteConfirmText).toBe('\u53bb\u9884\u89c8')
    expect(instance.data.damageCompleteShowCancel).toBe(false)
    expect(instance.data.cameraMounted).toBe(false)

    pageConfig.onDamageCompleteModalConfirm.call(instance)

    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview'
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

    expect(instance.data.showDamageCompleteModal).toBe(true)
    expect(instance.data.damageCompleteModalContent).toContain('\u5df2\u62cd\u6444 2 \u5f20')
    expect(instance.data.damageCompleteModalContent).not.toContain('\u5df2\u62cd\u6ee1 5 \u5f20')
    expect(instance.data.damageCompleteConfirmText).toBe('\u53bb\u9884\u89c8')
    expect(instance.data.damageCompleteShowCancel).toBe(false)
  })

  test('aux photo max damage asks before advancing to next vehicle', () => {
    cache = {
      auxPhoto: {
        enabled: true,
        ticket: 'mock-2'
      },
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.DAMAGE,
      currentDamageCount: 4,
      vehicles: [
        {
          type: '标的车',
          vehicleRoleName: '标的车',
          licenseNo: '京A12345',
          damages: [
            { compressedPath: '/tmp/damage-1.jpg' },
            { compressedPath: '/tmp/damage-2.jpg' },
            { compressedPath: '/tmp/damage-3.jpg' },
            { compressedPath: '/tmp/damage-4.jpg' }
          ]
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
          compressedPath: '/tmp/damage-5.jpg'
        },
        damageCount: 4,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.vehicles[0].damages).toHaveLength(5)
    expect(instance.data.showConfirmModal).toBe(false)
    expect(instance.data.pendingPhoto).toBeNull()
    expect(instance.data.damageCount).toBe(5)
    expect(instance.data.finishDamageText).toBe('下一辆车')
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()

    expect(global.wx.showModal).not.toHaveBeenCalled()
    expect(instance.data.showDamageCompleteModal).toBe(true)
    expect(instance.data.damageCompleteModalContent).toContain('\u5df2\u62cd\u6ee1 5 \u5f20')
    expect(instance.data.damageCompleteConfirmText).toBe('\u4e0b\u4e00\u8f86\u8f66')
    expect(instance.data.damageCompleteCancelText).toBe('\u67e5\u770b\u5df2\u62cd')
    expect(instance.data.damageCompleteShowCancel).toBe(true)
    expect(instance.data.cameraMounted).toBe(false)

    pageConfig.onDamageCompleteModalConfirm.call(instance)

    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(cache.currentDamageCount).toBe(0)
    expect(storage.saveCache).toHaveBeenLastCalledWith(expect.objectContaining({
      currentVehicleIndex: 1,
      currentStep: constants.SHOOT_STEP.LICENSE_PLATE
    }))
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
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
      currentDamageCount: 5,
      vehicles: [
        {
          type: '标的车',
          vehicleRoleName: '标的车',
          licenseNo: '京A12345',
          damages: [
            { compressedPath: '/tmp/damage-1.jpg' },
            { compressedPath: '/tmp/damage-2.jpg' },
            { compressedPath: '/tmp/damage-3.jpg' },
            { compressedPath: '/tmp/damage-4.jpg' },
            { compressedPath: '/tmp/damage-5.jpg' }
          ]
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
          compressedPath: '/tmp/damage-6.jpg'
        },
        damageCount: 5,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    pageConfig.onConfirmPhoto.call(instance)

    expect(cache.vehicles[0].damages).toHaveLength(5)
    expect(cache.vehicles[0].damages.map((photo) => photo.compressedPath)).not.toContain('/tmp/damage-6.jpg')
    expect(cache.currentDamageCount).toBe(5)
    expect(instance.data.showConfirmModal).toBe(false)
    expect(instance.data.pendingPhoto).toBeNull()
    expect(instance.data.damageCount).toBe(5)
    expect(global.wx.showToast).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'none'
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(instance.resumeAIDetectionAfterStepReady).not.toHaveBeenCalled()

    expect(global.wx.showModal).not.toHaveBeenCalled()
    expect(instance.data.showDamageCompleteModal).toBe(true)
    expect(instance.data.damageCompleteModalContent).toContain('\u5df2\u62cd\u6ee1 5 \u5f20')
    expect(instance.data.damageCompleteConfirmText).toBe('\u4e0b\u4e00\u8f86\u8f66')
    expect(instance.data.damageCompleteCancelText).toBe('\u67e5\u770b\u5df2\u62cd')
    expect(instance.data.damageCompleteShowCancel).toBe(true)
    expect(instance.data.cameraMounted).toBe(false)

    pageConfig.onDamageCompleteModalConfirm.call(instance)

    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(cache.currentDamageCount).toBe(0)
    expect(cache.vehicles[0].damages).toHaveLength(5)
    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
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
    cache.currentDamageCount = 5
    cache.vehicles[0].damages = [
      { compressedPath: '/tmp/damage-1.jpg' },
      { compressedPath: '/tmp/damage-2.jpg' },
      { compressedPath: '/tmp/damage-3.jpg' },
      { compressedPath: '/tmp/damage-4.jpg' },
      { compressedPath: '/tmp/damage-5.jpg' }
    ]
    const instance = createPageInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        showConfirmModal: true,
        pendingPhoto: {
          compressedPath: '/tmp/damage-6.jpg'
        },
        damageCount: 5,
        aiEnabled: true,
        aiAvailable: true
      }
    })

    const saved = pageConfig.savePendingPhotoBeforeLeave.call(instance)

    expect(saved).toBe(false)
    expect(cache.vehicles[0].damages).toHaveLength(5)
    expect(cache.vehicles[0].damages.map((photo) => photo.compressedPath)).not.toContain('/tmp/damage-6.jpg')
    expect(cache.currentDamageCount).toBe(5)
    expect(instance.data.showConfirmModal).toBe(false)
    expect(instance.data.pendingPhoto).toBeNull()
    expect(instance.data.damageCount).toBe(5)
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
