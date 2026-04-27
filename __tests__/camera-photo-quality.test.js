describe('camera photo quality integration', () => {
  let pageConfig
  let constants
  let storage
  let compress
  let photoQuality

  function loadCameraPage() {
    jest.resetModules()
    pageConfig = null

    constants = {
      SHOOT_STEP: {
        LICENSE_PLATE: 'licensePlate',
        VIN_CODE: 'vinCode',
        DAMAGE: 'damage'
      },
      GUIDE_TIPS: {
        licensePlate: '请拍摄车牌'
      },
      VEHICLE_TYPE: {
        TARGET: 'target'
      }
    }

    storage = {
      normalizePhotoMeta: jest.fn((photo, meta) => ({
        ...photo,
        ...meta,
        normalized: true
      })),
      isRetakeMode: jest.fn(() => true)
    }

    compress = {
      compressImage: jest.fn(async (tempFilePath) => ({
        compressedPath: `${tempFilePath}.compressed`,
        originalPath: tempFilePath
      }))
    }

    photoQuality = {
      attachPhotoQualityMeta: jest.fn((photo, result) => ({
        ...photo,
        quality: {
          level: result.level,
          suggestRetake: result.suggestRetake,
          reasons: result.reasons,
          metrics: result.metrics,
          analyzedAt: result.analyzedAt,
          configVersion: result.configVersion
        }
      })),
      buildQualityHintText: jest.fn(() => '照片可能偏模糊，建议重拍'),
      analyzePhotoQuality: jest.fn()
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
    jest.doMock('../utils/cache-selectors', () => ({
      getCurrentFlowContext: jest.fn(() => ({
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE
      }))
    }))
    jest.doMock('../utils/constants', () => constants)
    jest.doMock('../utils/compress', () => compress)
    jest.doMock('../utils/photo-quality', () => photoQuality)
    jest.doMock('../utils/runtime-logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      startSession: jest.fn(),
      endSession: jest.fn()
    }))
    jest.doMock('../utils/plate-detector', () => jest.fn())
    jest.doMock('../utils/damage-detector', () => jest.fn())
    jest.doMock('../utils/frame-utils', () => ({
      PlateFrameUtils: {}
    }))
    jest.doMock('../utils/damage-auto-capture-engine', () => jest.fn())
    jest.doMock('../utils/ai-config', () => ({
      PLATE_MODEL_PATH: '',
      DAMAGE_MODEL_PATH: '',
      PLATE_MODEL_URL: '',
      DAMAGE_MODEL_URL: '',
      AUTO_CAPTURE: {
        LOW_QUALITY: 0.3
      }
    }))
    jest.doMock('../utils/workflow-state', () => ({
      STATES: {
        IDLE: 'IDLE'
      }
    }))
    jest.doMock('../utils/workflow-page', () => ({}))

    require('../pages/camera/camera')

    return pageConfig
  }

  function createPageInstance(overrides = {}) {
    return {
      data: {
        currentStep: constants.SHOOT_STEP.LICENSE_PLATE
      },
      analyzePendingPhotoQuality: jest.fn(),
      savePhoto: jest.fn(),
      resumeAIDetection: jest.fn(),
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
    jest.dontMock('../utils/plate-detector')
    jest.dontMock('../utils/damage-detector')
    jest.dontMock('../utils/frame-utils')
    jest.dontMock('../utils/damage-auto-capture-engine')
    jest.dontMock('../utils/ai-config')
    jest.dontMock('../utils/workflow-state')
    jest.dontMock('../utils/workflow-page')
  })

  test('still analyzes retake photos and passes quality metadata forward', async () => {
    const qualityResult = {
      level: 'warn',
      suggestRetake: true,
      reasons: ['blur'],
      metrics: {
        blurScore: 0.18
      },
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'retake-test'
    }
    const instance = createPageInstance({
      analyzePendingPhotoQuality: jest.fn().mockResolvedValue(qualityResult)
    })

    await pageConfig.handlePhoto.call(instance, '/tmp/retake.jpg', {
      captureMode: 'retake',
      captureTrigger: 'manual'
    })

    expect(storage.isRetakeMode).not.toHaveBeenCalled()
    expect(instance.analyzePendingPhotoQuality).toHaveBeenCalledWith(expect.objectContaining({
      compressedPath: '/tmp/retake.jpg.compressed',
      captureMode: 'retake'
    }))
    expect(photoQuality.attachPhotoQualityMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        compressedPath: '/tmp/retake.jpg.compressed'
      }),
      qualityResult
    )
    expect(instance.savePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        compressedPath: '/tmp/retake.jpg.compressed',
        quality: expect.objectContaining({
          level: 'warn',
          suggestRetake: true,
          reasons: ['blur']
        })
      }),
      expect.objectContaining({
        qualityHintText: '照片可能偏模糊，建议重拍'
      })
    )
  })

  test('still builds retake hint text for retake photos with quality risks', async () => {
    const qualityResult = {
      level: 'warn',
      suggestRetake: true,
      reasons: ['dark'],
      metrics: {
        brightness: 0.16
      },
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'retake-hint-test'
    }
    const instance = createPageInstance({
      analyzePendingPhotoQuality: jest.fn().mockResolvedValue(qualityResult)
    })

    photoQuality.buildQualityHintText.mockReturnValueOnce('照片可能偏暗，建议重拍')

    await pageConfig.handlePhoto.call(instance, '/tmp/retake-dark.jpg', {
      captureMode: 'retake',
      captureTrigger: 'manual'
    })

    expect(photoQuality.buildQualityHintText).toHaveBeenCalledWith(qualityResult)
    expect(instance.savePhoto).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        qualityHintText: '照片可能偏暗，建议重拍'
      })
    )
  })

  test('keeps flow unblocked and hides hint when quality is disabled', async () => {
    const disabledResult = {
      level: 'good',
      suggestRetake: false,
      reasons: ['disabled'],
      metrics: {
        brightness: 0,
        darkRatio: 0,
        brightRatio: 0,
        blurScore: 0,
        contrast: 0,
        sampledWidth: 0,
        sampledHeight: 0
      },
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'disabled-test'
    }
    const normalizedPhoto = {
      compressedPath: '/tmp/disabled.jpg.compressed',
      originalPath: '/tmp/disabled.jpg',
      captureMode: 'retake',
      captureTrigger: 'manual'
    }
    const instance = createPageInstance({
      analyzePendingPhotoQuality: jest.fn().mockResolvedValue(disabledResult)
    })

    photoQuality.attachPhotoQualityMeta.mockReturnValueOnce(normalizedPhoto)
    photoQuality.buildQualityHintText.mockReturnValueOnce('')

    await pageConfig.handlePhoto.call(instance, '/tmp/disabled.jpg', {
      captureMode: 'retake',
      captureTrigger: 'manual'
    })

    expect(instance.analyzePendingPhotoQuality).toHaveBeenCalled()
    expect(photoQuality.attachPhotoQualityMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        compressedPath: '/tmp/disabled.jpg.compressed'
      }),
      disabledResult
    )
    expect(instance.savePhoto).toHaveBeenCalledWith(
      normalizedPhoto,
      expect.objectContaining({
        qualityHintText: ''
      })
    )
    expect(global.wx.showToast).not.toHaveBeenCalled()
  })
})
