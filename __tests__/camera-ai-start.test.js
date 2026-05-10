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
        currentStep: targetCache.currentStep,
        currentVehicleIndex: targetCache.currentVehicleIndex,
        currentVehicle: targetCache.vehicles[targetCache.currentVehicleIndex],
        currentVehicleType: targetCache.vehicles[targetCache.currentVehicleIndex].type,
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
      showToast: jest.fn(),
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

    jest.doMock('../utils/storage', () => storage)
    jest.doMock('../utils/cache-selectors', () => cacheSelectors)
    jest.doMock('../utils/constants', () => constants)
    jest.doMock('../utils/compress', () => ({
      compressImage: jest.fn()
    }))
    jest.doMock('../utils/photo-quality', () => ({
      attachPhotoQualityMeta: jest.fn((photo) => photo),
      buildQualityHintText: jest.fn(() => ''),
      analyzePhotoQuality: jest.fn()
    }))
    jest.doMock('../utils/runtime-logger', () => runtimeLogger)
    jest.doMock('../utils/env-config', () => envConfig)
    jest.doMock('../utils/plate-detector', () => PlateDetector)
    jest.doMock('../utils/damage-detector', () => DamageDetector)
    jest.doMock('../utils/frame-utils', () => ({
      PlateFrameUtils: jest.fn()
    }))
    jest.doMock('../utils/damage-auto-capture-engine', () => jest.fn())
    jest.doMock('../utils/ai-config', () => ({
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
    jest.doMock('../utils/workflow-state', () => ({
      STATES: {
        IDLE: 'IDLE',
        RETAKING: 'RETAKING',
        CAPTURING: 'CAPTURING',
        CONFIRMING: 'CONFIRMING'
      }
    }))
    jest.doMock('../utils/workflow-page', () => workflowPage)
    jest.doMock('../utils/album', () => album)

    require('../pages/camera/camera')
  }

  function createPageInstance(overrides = {}) {
    return {
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
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
      logAiModelConfig: pageConfig.logAiModelConfig,
      reportAiUnavailable: pageConfig.reportAiUnavailable,
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
    jest.clearAllMocks()
    jest.dontMock('../utils/storage')
    jest.dontMock('../utils/cache-selectors')
    jest.dontMock('../utils/constants')
    jest.dontMock('../utils/compress')
    jest.dontMock('../utils/photo-quality')
    jest.dontMock('../utils/runtime-logger')
    jest.dontMock('../utils/env-config')
    jest.dontMock('../utils/plate-detector')
    jest.dontMock('../utils/damage-detector')
    jest.dontMock('../utils/frame-utils')
    jest.dontMock('../utils/damage-auto-capture-engine')
    jest.dontMock('../utils/ai-config')
    jest.dontMock('../utils/workflow-state')
    jest.dontMock('../utils/workflow-page')
    jest.dontMock('../utils/album')
  })

  test('retries AI detection after damage step data is applied from cache', () => {
    const instance = createPageInstance()

    pageConfig.loadCacheData.call(instance, 'test_damage_cache')

    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('test_damage_cache')
  })

  test('camera page does not reference frozen AI model URL constants', () => {
    const fs = require('fs')
    const cameraSource = fs.readFileSync(require.resolve('../pages/camera/camera'), 'utf8')

    expect(cameraSource).not.toContain('PLATE_MODEL_URL')
    expect(cameraSource).not.toContain('DAMAGE_MODEL_URL')
  })

  test('camera component requests medium realtime frames for AI preview', () => {
    const fs = require('fs')
    const path = require('path')
    const cameraWxml = fs.readFileSync(path.resolve(__dirname, '../pages/camera/camera.wxml'), 'utf8')

    expect(cameraWxml).toContain('frame-size="medium"')
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
      page: 'pages/camera/camera',
      at: expect.any(Number)
    }))
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
