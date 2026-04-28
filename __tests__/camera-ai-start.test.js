describe('camera AI detection start timing', () => {
  let pageConfig
  let constants
  let cache
  let storage
  let cacheSelectors
  let workflowPage

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
    jest.doMock('../utils/env-config', () => ({
      getDebugConfig: jest.fn(() => ({
        showAIPanel: false
      }))
    }))
    jest.doMock('../utils/plate-detector', () => jest.fn())
    jest.doMock('../utils/damage-detector', () => jest.fn())
    jest.doMock('../utils/frame-utils', () => ({
      PlateFrameUtils: jest.fn()
    }))
    jest.doMock('../utils/damage-auto-capture-engine', () => jest.fn())
    jest.doMock('../utils/ai-config', () => ({
      PLATE_MODEL_PATH: '',
      DAMAGE_MODEL_PATH: '',
      PLATE_MODEL_URL: '',
      DAMAGE_MODEL_URL: '',
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
          maxAreaRatio: 0.8
        },
        DAMAGE: {},
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
  })

  test('retries AI detection after damage step data is applied from cache', () => {
    const instance = createPageInstance()

    pageConfig.loadCacheData.call(instance, 'test_damage_cache')

    expect(instance.data.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('test_damage_cache')
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
    expect(instance.resetAIState).toHaveBeenCalled()
    expect(instance.resumeAIDetectionAfterStepReady).toHaveBeenCalledWith('confirm_vin_to_damage')
  })
})
