describe('camera AI detection start timing', () => {
  let pageConfig
  let constants
  let cache
  let storage
  let cacheSelectors
  let workflowPage
  let album
  let envConfig
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
      showToast: jest.fn()
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
    jest.doMock('../utils/runtime-logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      startSession: jest.fn(),
      endSession: jest.fn()
    }))
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
      logAiModelConfig: pageConfig.logAiModelConfig,
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
    expect(album.saveConfirmedPhotoToAlbum).toHaveBeenCalledWith(
      expect.objectContaining({ compressedPath: '/tmp/vin.jpg' })
    )
    expect(instance.resetAIState).toHaveBeenCalled()
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('confirm_vin_to_damage')
  })

  test('continues confirmation when album save fails', async () => {
    cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
    album.saveConfirmedPhotoToAlbum.mockResolvedValueOnce({
      saved: false,
      reason: 'save_failed'
    })
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

    await Promise.resolve()
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
