const constants = require('../packageD/utils/constants')

const PREVIEW_BASE_URL = '/packageD/pages/preview/preview'
const CAMERA_URL = '/packageD/pages/camera/camera'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createPhoto(path) {
  return {
    status: 'completed',
    compressedPath: path
  }
}

function createVehicle(index, overrides = {}) {
  return {
    type: index === 0 ? '标的车' : `三者车${index}`,
    vehicleRoleName: index === 0 ? '标的车' : `三者车${index}`,
    licenseNo: index === 0 ? '京A12345' : `京B0000${index}`,
    licensePlate: createPhoto(`/plate-${index}.jpg`),
    vinCode: createPhoto(`/vin-${index}.jpg`),
    damages: [],
    documents: [],
    ...overrides
  }
}

function createVehicleDocument(docType, docSide, path) {
  return {
    id: `${docType}-${docSide}`,
    docType,
    docSide,
    label: docType === 'driver_license' ? '驾驶证' : '行驶证',
    sourceType: 'camera',
    tempFilePath: path,
    compressedPath: path,
    createdAt: 1000,
    updatedAt: 1000
  }
}

function readFinalSceneMarkup() {
  const wxml = require('fs').readFileSync('packageD/pages/preview/preview.wxml', 'utf8')
  const start = wxml.indexOf('一、现场环境及车辆信息')
  const end = wxml.indexOf('<text class="vehicle-title" style="{{previewLayout.vehicleTitleStyle}}">车辆信息</text>', start)
  return wxml.slice(start, end)
}

function baseCache(vehicles = [createVehicle(0)]) {
  return {
    currentVehicleIndex: 0,
    currentStep: constants.SHOOT_STEP.MODULE_ONE_PREVIEW,
    currentDamageCount: 0,
    vehicles,
    scenePhotos: {
      scene45: createPhoto('/scene-45.jpg'),
      supplements: []
    },
    documents: [],
    retakeMode: {
      enabled: false,
      vehicleIndex: null,
      photoType: null,
      damageIndex: null
    },
    fromPreview: false,
    sceneSupplementPromptShown: true
  }
}

function singleVehicleModuleOneCache() {
  return baseCache([createVehicle(0)])
}

function doubleVehicleModuleOneCache() {
  return baseCache([createVehicle(0), createVehicle(1)])
}

function moduleTwoDamageCache() {
  const cache = singleVehicleModuleOneCache()
  cache.currentStep = constants.SHOOT_STEP.DAMAGE
  cache.currentVehicleIndex = 0
  cache.currentDamageCount = 1
  cache.vehicles[0].damages = [createPhoto('/damage-0.jpg')]
  return cache
}

function moduleThreeDocumentCache() {
  const cache = singleVehicleModuleOneCache()
  cache.currentStep = constants.SHOOT_STEP.MODULE_THREE
  return cache
}

function finalPreviewCache() {
  const cache = singleVehicleModuleOneCache()
  cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
  cache.vehicles[0].damages = [createPhoto('/damage-final.jpg')]
  return cache
}

function withPreviewReturn(cache, mode) {
  const nextCache = clone(cache)
  nextCache.fromPreview = true
  nextCache.previewReturnMode = mode
  return nextCache
}

function withRetakeMode(cache, photoType, vehicleIndex = 0, damageIndex = null) {
  const nextCache = clone(cache)
  nextCache.fromPreview = true
  nextCache.currentVehicleIndex = vehicleIndex
  nextCache.currentStep = photoType
  nextCache.retakeMode = {
    enabled: true,
    vehicleIndex,
    photoType,
    damageIndex
  }
  return nextCache
}

function getNavigationUrls() {
  return [
    ...global.wx.navigateTo.mock.calls,
    ...global.wx.redirectTo.mock.calls,
    ...global.wx.reLaunch.mock.calls
  ].map(([options]) => options && options.url).filter(Boolean)
}

function expectNavigation(expectedUrl) {
  expect(getNavigationUrls()).toContain(expectedUrl)
}

function expectNoLegacyPreviewWithoutMode() {
  expect(getNavigationUrls()).not.toContain(PREVIEW_BASE_URL)
}

function expectNoNaturalNextStep(cache, forbiddenStep) {
  if (forbiddenStep) {
    expect(cache.currentStep).not.toBe(forbiddenStep)
  }
}

describe('流程路由矩阵 - 相机页出口', () => {
  let pageConfig
  let cameraCache
  let storage
  let cacheSelectors
  let workflowPage

  function getFlowContext(targetCache) {
    const vehicles = Array.isArray(targetCache && targetCache.vehicles) ? targetCache.vehicles : []
    const retakeMode = targetCache && targetCache.retakeMode && targetCache.retakeMode.enabled === true
      ? targetCache.retakeMode
      : null
    const retakeVehicleIndex = retakeMode && Number.isInteger(retakeMode.vehicleIndex)
      ? retakeMode.vehicleIndex
      : null
    const currentVehicleIndex = retakeMode ? retakeVehicleIndex : (targetCache.currentVehicleIndex || 0)
    const currentVehicle = vehicles[currentVehicleIndex]
    const currentStep = retakeMode ? retakeMode.photoType : targetCache.currentStep
    const hasNextVehicle = currentVehicleIndex < vehicles.length - 1

    return {
      hasCache: !!targetCache,
      hasVehicles: vehicles.length > 0,
      hasRetakeContext: !!retakeMode,
      retakeContext: retakeMode ? {
        ...retakeMode,
        currentStep,
        vehicle: currentVehicle,
        vehicleType: currentVehicle && currentVehicle.type
      } : null,
      currentStep,
      currentVehicleIndex,
      currentVehicle,
      currentVehicleType: currentVehicle && currentVehicle.type,
      currentVehicleRoleName: currentVehicle && currentVehicle.vehicleRoleName,
      currentVehiclePlateNo: currentVehicle && currentVehicle.licenseNo,
      currentVehiclePlateTheme: 'oil',
      currentVehicleProgressText: vehicles.length > 1 ? `${currentVehicleIndex + 1}/${vehicles.length} 辆` : '',
      hasNextVehicle,
      nextVehicleIndex: hasNextVehicle ? currentVehicleIndex + 1 : null,
      finishDamageText: hasNextVehicle ? '下一辆车' : '去预览',
      damageCount: currentVehicle && Array.isArray(currentVehicle.damages) ? currentVehicle.damages.length : 0,
      fromPreview: !!(targetCache && targetCache.fromPreview),
      workflowState: 'CAPTURING',
      guideTip: constants.GUIDE_TIPS[currentStep] || ''
    }
  }

  function saveRetakenPhoto(photo) {
    const retakeMode = cameraCache.retakeMode
    const vehicle = cameraCache.vehicles[retakeMode.vehicleIndex]

    if (retakeMode.photoType === constants.PHOTO_TYPE.DAMAGE) {
      vehicle.damages[retakeMode.damageIndex] = photo
    } else if (retakeMode.photoType === constants.PHOTO_TYPE.LICENSE_PLATE) {
      vehicle.licensePlate = photo
    } else if (retakeMode.photoType === constants.PHOTO_TYPE.VIN_CODE) {
      vehicle.vinCode = photo
    }

    cameraCache.retakeMode = {
      enabled: false,
      vehicleIndex: null,
      photoType: null,
      damageIndex: null
    }
    return true
  }

  function loadCameraPage(initialCache, pages = []) {
    jest.resetModules()
    pageConfig = null
    cameraCache = clone(initialCache)

    storage = {
      loadCache: jest.fn(() => cameraCache),
      loadCacheForResume: jest.fn(() => cameraCache),
      saveCache: jest.fn((nextCache) => {
        cameraCache = nextCache
        return nextCache
      }),
      clearPreviewFlags: jest.fn((targetCache) => ({
        ...targetCache,
        fromPreview: false
      })),
      isRetakeMode: jest.fn(() => !!(cameraCache.retakeMode && cameraCache.retakeMode.enabled)),
      saveRetakenPhoto: jest.fn(saveRetakenPhoto),
      normalizePhotoMeta: jest.fn((photo, meta) => ({
        ...photo,
        ...meta
      }))
    }
    cacheSelectors = {
      getCurrentFlowContext: jest.fn((targetCache) => getFlowContext(targetCache || cameraCache))
    }
    workflowPage = {
      syncPageWorkflowState: jest.fn()
    }

    global.wx = {
      hideLoading: jest.fn(),
      showLoading: jest.fn(),
      showToast: jest.fn(),
      showModal: jest.fn(),
      navigateTo: jest.fn(({ success } = {}) => success && success()),
      navigateBack: jest.fn(({ success } = {}) => success && success()),
      redirectTo: jest.fn(({ success } = {}) => success && success()),
      reLaunch: jest.fn(({ success } = {}) => success && success()),
      getSystemInfoSync: jest.fn(() => ({
        model: 'iPhone 15',
        system: 'iOS 17.0',
        platform: 'ios',
        SDKVersion: '3.15.1',
        version: '8.0.50',
        brand: 'Apple',
        windowWidth: 844,
        windowHeight: 390,
        safeArea: { width: 844, height: 390 },
        pixelRatio: 2
      }))
    }
    global.getCurrentPages = jest.fn(() => pages)
    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })

    jest.doMock('../packageD/utils/storage', () => storage)
    jest.doMock('../packageD/utils/cache-selectors', () => cacheSelectors)
    jest.doMock('../packageD/utils/compress', () => ({
      compressImage: jest.fn()
    }))
    jest.doMock('../packageD/utils/photo-quality', () => ({
      attachPhotoQualityMeta: jest.fn((photo) => photo),
      buildQualityHintText: jest.fn(() => ''),
      analyzePhotoQuality: jest.fn()
    }))
    jest.doMock('../packageD/utils/runtime-logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      forceWarn: jest.fn(),
      forceError: jest.fn(),
      startSession: jest.fn(() => 'test-session'),
      endSession: jest.fn(),
      getSessionId: jest.fn(() => 'test-session')
    }))
    jest.doMock('../packageD/utils/env-config', () => ({
      getDebugConfig: jest.fn(() => ({ showAIPanel: false })),
      getAiConfig: jest.fn(() => ({}))
    }))
    jest.doMock('../packageD/utils/plate-detector', () => jest.fn())
    jest.doMock('../packageD/utils/damage-detector', () => jest.fn())
    jest.doMock('../packageD/utils/frame-utils', () => ({
      PlateFrameUtils: jest.fn(),
      createVirtualCameraMapping: jest.fn(() => ({
        sourceWidth: 400,
        sourceHeight: 300,
        targetWidth: 400,
        targetHeight: 300,
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
      AI_FEATURES: {
        enabled: false,
        plateEnabled: true,
        damageEnabled: true
      },
      AUTO_CAPTURE: {
        LOW_QUALITY: 0.3,
        DETECT_INTERVAL: 100,
        COOLDOWN_MS: 1000,
        STATUS_TEXT: {},
        PLATE: {},
        DAMAGE: {},
        DAMAGE_FLOW: {
          previewInterval: 100,
          phase: {}
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

    require('../packageD/pages/camera/camera')
  }

  function createCameraInstance(overrides = {}) {
    return {
      data: {
        currentStep: cameraCache.currentStep,
        isNavigating: false,
        showConfirmModal: true,
        showDamageCompleteModal: false,
        showCaptureGuideModal: false,
        pendingPhoto: createPhoto('/pending.jpg'),
        cameraMounted: true,
        aiEnabled: true,
        aiAvailable: true,
        damageCount: 0
      },
      isLeaving: false,
      cameraInitialized: true,
      detectTimer: null,
      aiBusy: false,
      pendingCameraInitResumeReason: '',
      pendingCameraRemountReason: '',
      cameraRestartTimer: null,
      setData(updates, callback) {
        this.data = {
          ...this.data,
          ...updates
        }
        if (callback) callback()
      },
      clearCameraRestartTimer: jest.fn(),
      resetAIState: jest.fn(),
      stopAIDetectionLoop: jest.fn(),
      stopAIFrameListener: jest.fn(),
      stopPlateBlink: jest.fn(),
      resumeAIDetectionAfterStepReady: jest.fn(),
      requestCameraRemountAfterStop: jest.fn(),
      getDamagePhaseLabel: pageConfig.getDamagePhaseLabel,
      navigateToPreviewPage: pageConfig.navigateToPreviewPage,
      navigateToModuleOnePreviewPage: pageConfig.navigateToModuleOnePreviewPage,
      navigateBackToPreviewPage: pageConfig.navigateBackToPreviewPage,
      goToPreviewPage: pageConfig.goToPreviewPage,
      advanceToNextAuxVehicle: pageConfig.advanceToNextAuxVehicle,
      closeDamageCompleteModal: pageConfig.closeDamageCompleteModal,
      handleDamageCompletedFlow: pageConfig.handleDamageCompletedFlow,
      maybeShowCaptureGuide: jest.fn(),
      ...overrides
    }
  }

  afterEach(() => {
    delete global.wx
    delete global.Page
    delete global.getCurrentPages
    jest.dontMock('../packageD/utils/storage')
    jest.dontMock('../packageD/utils/cache-selectors')
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
  })

  const confirmCases = [
    {
      id: 'ROUTE-M1-001',
      title: '首次自然拍完45度后进入车牌号拍摄',
      cacheFactory: () => {
        const cache = singleVehicleModuleOneCache()
        cache.currentStep = constants.SHOOT_STEP.SCENE_45
        cache.scenePhotos.scene45 = { status: 'pending' }
        return cache
      },
      expectedStep: constants.SHOOT_STEP.LICENSE_PLATE,
      expectedUrl: null
    },
    {
      id: 'ROUTE-M1-002',
      title: '模块一预览补拍45度后返回模块一预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(singleVehicleModuleOneCache(), 'moduleOne')
        cache.currentStep = constants.SHOOT_STEP.SCENE_45
        return cache
      },
      expectedStep: constants.SHOOT_STEP.MODULE_ONE_PREVIEW,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleOne`,
      forbiddenStep: constants.SHOOT_STEP.LICENSE_PLATE
    },
    {
      id: 'ROUTE-M1-003',
      title: '模块一预览删除45度后补拍仍返回模块一预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(singleVehicleModuleOneCache(), 'moduleOne')
        cache.currentStep = constants.SHOOT_STEP.SCENE_45
        cache.scenePhotos.scene45 = { status: 'pending' }
        return cache
      },
      expectedStep: constants.SHOOT_STEP.MODULE_ONE_PREVIEW,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleOne`,
      forbiddenStep: constants.SHOOT_STEP.LICENSE_PLATE
    },
    {
      id: 'ROUTE-M1-004',
      title: '首次自然拍完车牌号后进入VIN拍摄',
      cacheFactory: () => {
        const cache = singleVehicleModuleOneCache()
        cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
        return cache
      },
      expectedStep: constants.SHOOT_STEP.VIN_CODE,
      expectedUrl: null
    },
    {
      id: 'ROUTE-M1-005',
      title: '模块一预览补拍车牌号后返回模块一预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(singleVehicleModuleOneCache(), 'moduleOne')
        cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
        return cache
      },
      expectedStep: constants.SHOOT_STEP.MODULE_ONE_PREVIEW,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleOne`,
      forbiddenStep: constants.SHOOT_STEP.VIN_CODE
    },
    {
      id: 'ROUTE-M1-007',
      title: '模块一预览补拍VIN后返回模块一预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(singleVehicleModuleOneCache(), 'moduleOne')
        cache.currentStep = constants.SHOOT_STEP.VIN_CODE
        return cache
      },
      expectedStep: constants.SHOOT_STEP.MODULE_ONE_PREVIEW,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleOne`,
      forbiddenStep: constants.SHOOT_STEP.DAMAGE
    },
    {
      id: 'ROUTE-M1-009',
      title: '现场补充照片补拍完成后返回模块一预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(singleVehicleModuleOneCache(), 'moduleOne')
        cache.currentStep = constants.SHOOT_STEP.SCENE_SUPPLEMENT
        cache.sceneSupplementIndex = 0
        return cache
      },
      expectedStep: constants.SHOOT_STEP.MODULE_ONE_PREVIEW,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleOne`
    },
    {
      id: 'ROUTE-FINAL-001',
      title: '最终预览重拍45度后返回最终总预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(finalPreviewCache(), 'final')
        cache.currentStep = constants.SHOOT_STEP.SCENE_45
        return cache
      },
      expectedStep: constants.SHOOT_STEP.FINAL_PREVIEW,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=final`,
      forbiddenStep: constants.SHOOT_STEP.LICENSE_PLATE
    },
    {
      id: 'ROUTE-FINAL-002',
      title: '最终预览重拍现场补充照片后返回最终总预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(finalPreviewCache(), 'final')
        cache.currentStep = constants.SHOOT_STEP.SCENE_SUPPLEMENT
        cache.sceneSupplementIndex = 0
        return cache
      },
      expectedStep: constants.SHOOT_STEP.FINAL_PREVIEW,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=final`
    },
    {
      id: 'ROUTE-FINAL-003',
      title: '最终预览重拍车牌号后返回最终总预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(finalPreviewCache(), 'final')
        cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
        return cache
      },
      expectedStep: constants.SHOOT_STEP.FINAL_PREVIEW,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=final`,
      forbiddenStep: constants.SHOOT_STEP.VIN_CODE
    },
    {
      id: 'ROUTE-FINAL-004',
      title: '最终预览重拍VIN后返回最终总预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(finalPreviewCache(), 'final')
        cache.currentStep = constants.SHOOT_STEP.VIN_CODE
        return cache
      },
      expectedStep: constants.SHOOT_STEP.FINAL_PREVIEW,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=final`,
      forbiddenStep: constants.SHOOT_STEP.DAMAGE
    },
    {
      id: 'ROUTE-M2-003',
      title: '模块二预览补拍车损后返回模块二预览',
      cacheFactory: () => withPreviewReturn(moduleTwoDamageCache(), 'moduleTwo'),
      expectedStep: constants.SHOOT_STEP.DAMAGE,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleTwo`
    },
    {
      id: 'ROUTE-M2-004',
      title: '最终预览补拍车损后返回最终总预览',
      cacheFactory: () => {
        const cache = withPreviewReturn(finalPreviewCache(), 'final')
        cache.currentStep = constants.SHOOT_STEP.DAMAGE
        return cache
      },
      expectedStep: constants.SHOOT_STEP.DAMAGE,
      expectedUrl: `${PREVIEW_BASE_URL}?mode=final`
    }
  ]

  test.each(confirmCases)('$id $title', ({ cacheFactory, expectedStep, expectedUrl, forbiddenStep }) => {
    loadCameraPage(cacheFactory())
    const instance = createCameraInstance()

    pageConfig.onConfirmPhoto.call(instance)

    expect(cameraCache.currentStep).toBe(expectedStep)
    expectNoNaturalNextStep(cameraCache, forbiddenStep)
    if (expectedUrl) {
      expectNavigation(expectedUrl)
    }
    expectNoLegacyPreviewWithoutMode()
  })

  const viewCapturedCases = [
    {
      id: 'ROUTE-M1-006',
      title: '车牌号拍摄页查看已拍进入模块一预览',
      cacheFactory: () => {
        const cache = singleVehicleModuleOneCache()
        cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
        return cache
      },
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleOne`
    },
    {
      id: 'ROUTE-M1-008',
      title: 'VIN拍摄页查看已拍进入模块一预览',
      cacheFactory: () => {
        const cache = singleVehicleModuleOneCache()
        cache.currentStep = constants.SHOOT_STEP.VIN_CODE
        return cache
      },
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleOne`
    },
    {
      id: 'ROUTE-M2-002',
      title: '模块二车损拍摄页查看已拍忽略陈旧final返回模式',
      cacheFactory: () => {
        const cache = moduleTwoDamageCache()
        cache.previewReturnMode = 'final'
        return cache
      },
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleTwo`
    },
    {
      id: 'ROUTE-FB-004',
      title: '新三模块流程查看已拍不得进入无mode老预览',
      cacheFactory: () => {
        const cache = singleVehicleModuleOneCache()
        cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
        return cache
      },
      expectedUrl: `${PREVIEW_BASE_URL}?mode=moduleOne`
    }
  ]

  test.each(viewCapturedCases)('$id $title', ({ cacheFactory, expectedUrl }) => {
    loadCameraPage(cacheFactory())
    const instance = createCameraInstance({
      data: {
        currentStep: cameraCache.currentStep,
        isNavigating: false,
        showConfirmModal: false,
        pendingPhoto: null
      }
    })

    pageConfig.onGoPreview.call(instance)

    expectNavigation(expectedUrl)
    expectNoLegacyPreviewWithoutMode()
  })

  test('ROUTE-M1-010 双车模块一自然流程按车辆推进并最终进入模块一预览', () => {
    const firstVehicleCache = doubleVehicleModuleOneCache()
    firstVehicleCache.currentVehicleIndex = 0
    firstVehicleCache.currentStep = constants.SHOOT_STEP.VIN_CODE
    loadCameraPage(firstVehicleCache)
    let instance = createCameraInstance()

    pageConfig.onConfirmPhoto.call(instance)

    expect(cameraCache.currentVehicleIndex).toBe(1)
    expect(cameraCache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(getNavigationUrls()).toHaveLength(0)

    const secondVehicleCache = doubleVehicleModuleOneCache()
    secondVehicleCache.currentVehicleIndex = 1
    secondVehicleCache.currentStep = constants.SHOOT_STEP.VIN_CODE
    loadCameraPage(secondVehicleCache)
    instance = createCameraInstance()

    pageConfig.onConfirmPhoto.call(instance)

    expect(cameraCache.currentVehicleIndex).toBe(1)
    expect(cameraCache.currentStep).toBe(constants.SHOOT_STEP.MODULE_ONE_PREVIEW)
    expectNavigation(`${PREVIEW_BASE_URL}?mode=moduleOne`)
    expectNoLegacyPreviewWithoutMode()
  })

  test('ROUTE-FINAL-005 最终预览重拍车损的navigateBack失败兜底回最终总预览', () => {
    const cache = withRetakeMode(finalPreviewCache(), constants.PHOTO_TYPE.DAMAGE, 0, 0)
    cache.previewReturnMode = 'final'
    loadCameraPage(cache, [{ route: 'packageD/pages/preview/preview' }])
    global.wx.navigateBack.mockImplementationOnce(({ fail } = {}) => fail && fail({ errMsg: 'navigateBack:fail' }))
    const instance = createCameraInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        isNavigating: false,
        showConfirmModal: false,
        pendingPhoto: null
      }
    })

    pageConfig.savePhoto.call(instance, createPhoto('/retake-damage.jpg'))

    expectNavigation(`${PREVIEW_BASE_URL}?mode=final`)
    expectNoLegacyPreviewWithoutMode()
  })

  test('ROUTE-FINAL-006 最终预览重拍证件停留最终预览证件面板处理', () => {
    const cache = moduleThreeDocumentCache()
    cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW

    expect(cache.currentStep).toBe(constants.SHOOT_STEP.FINAL_PREVIEW)
  })

  test('ROUTE-M2-005 多车车损确认下一辆时留在相机页并切到下一车车损', () => {
    const cache = baseCache([
      createVehicle(0, { damages: [createPhoto('/damage-0.jpg')] }),
      createVehicle(1, { damages: [] })
    ])
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.currentVehicleIndex = 0
    loadCameraPage(cache)
    const instance = createCameraInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        isNavigating: true,
        showDamageCompleteModal: true,
        showConfirmModal: false,
        pendingPhoto: null
      }
    })

    pageConfig.onDamageCompleteModalConfirm.call(instance)

    expect(cameraCache.currentVehicleIndex).toBe(1)
    expect(cameraCache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(getNavigationUrls()).toHaveLength(0)
  })

  test('ROUTE-M2-006 多车车损查看已拍进入模块二预览', () => {
    const cache = baseCache([
      createVehicle(0, { damages: [createPhoto('/damage-0.jpg')] }),
      createVehicle(1, { damages: [] })
    ])
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.currentVehicleIndex = 0
    loadCameraPage(cache)
    const instance = createCameraInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        isNavigating: true,
        showDamageCompleteModal: true,
        showConfirmModal: false,
        pendingPhoto: null
      }
    })

    pageConfig.onDamageCompleteModalCancel.call(instance)

    expectNavigation(`${PREVIEW_BASE_URL}?mode=moduleTwo`)
    expectNoLegacyPreviewWithoutMode()
  })

  test('COMPLEX-CAM-001 最终预览重拍第二车中间车损且navigateBack失败仍回最终预览', () => {
    const cache = baseCache([
      createVehicle(0, { damages: [createPhoto('/damage-0-0.jpg')] }),
      createVehicle(1, {
        damages: [
          createPhoto('/damage-1-0.jpg'),
          createPhoto('/damage-1-1.jpg'),
          createPhoto('/damage-1-2.jpg')
        ]
      })
    ])
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.currentVehicleIndex = 1
    cache.fromPreview = true
    cache.previewReturnMode = 'final'
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: 1,
      photoType: constants.PHOTO_TYPE.DAMAGE,
      damageIndex: 1
    }
    loadCameraPage(cache, [{ route: 'packageD/pages/preview/preview' }])
    global.wx.navigateBack.mockImplementationOnce(({ fail } = {}) => fail && fail({ errMsg: 'navigateBack:fail' }))
    const instance = createCameraInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        isNavigating: false,
        showConfirmModal: false,
        pendingPhoto: null
      }
    })

    pageConfig.savePhoto.call(instance, createPhoto('/damage-1-1-retake.jpg'))

    expect(cameraCache.vehicles[1].damages[1].compressedPath).toBe('/damage-1-1-retake.jpg')
    expect(cameraCache.retakeMode.enabled).toBe(false)
    expectNavigation(`${PREVIEW_BASE_URL}?mode=final`)
    expectNoLegacyPreviewWithoutMode()
  })

  test('COMPLEX-CAM-002 模块一查看已拍忽略陈旧final返回模式', () => {
    const cache = singleVehicleModuleOneCache()
    cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    cache.previewReturnMode = 'final'
    loadCameraPage(cache)
    const instance = createCameraInstance({
      data: {
        currentStep: constants.SHOOT_STEP.VIN_CODE,
        isNavigating: false,
        showConfirmModal: false,
        pendingPhoto: null
      }
    })

    pageConfig.onGoPreview.call(instance)

    expectNavigation(`${PREVIEW_BASE_URL}?mode=moduleOne`)
    expectNoLegacyPreviewWithoutMode()
  })

  test('COMPLEX-CAM-003 多车车损下一辆忽略陈旧final返回模式并留在相机页', () => {
    const cache = baseCache([
      createVehicle(0, { damages: [createPhoto('/damage-0.jpg')] }),
      createVehicle(1, { damages: [] })
    ])
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.currentVehicleIndex = 0
    cache.previewReturnMode = 'final'
    loadCameraPage(cache)
    const instance = createCameraInstance({
      data: {
        currentStep: constants.SHOOT_STEP.DAMAGE,
        isNavigating: true,
        showDamageCompleteModal: true,
        showConfirmModal: false,
        pendingPhoto: null
      }
    })

    pageConfig.onDamageCompleteModalConfirm.call(instance)

    expect(cameraCache.currentVehicleIndex).toBe(1)
    expect(cameraCache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(getNavigationUrls()).toHaveLength(0)
  })

  const fallbackCases = [
    ['ROUTE-FB-001', 'moduleOne', `${PREVIEW_BASE_URL}?mode=moduleOne`],
    ['ROUTE-FB-002', 'moduleTwo', `${PREVIEW_BASE_URL}?mode=moduleTwo`],
    ['ROUTE-FB-003', 'final', `${PREVIEW_BASE_URL}?mode=final`]
  ]

  test.each(fallbackCases)('%s navigateBack失败兜底保留%s模式', (id, mode, expectedUrl) => {
    const cache = withPreviewReturn(moduleTwoDamageCache(), mode)
    cache.currentStep = mode === 'moduleOne' ? constants.SHOOT_STEP.LICENSE_PLATE : constants.SHOOT_STEP.DAMAGE
    loadCameraPage(cache, [{ route: 'packageD/pages/preview/preview' }])
    global.wx.navigateBack.mockImplementationOnce(({ fail } = {}) => fail && fail({ errMsg: `${id}:fail` }))
    const instance = createCameraInstance()

    pageConfig.navigateBackToPreviewPage.call(instance, cameraCache)

    expectNavigation(expectedUrl)
    expectNoLegacyPreviewWithoutMode()
  })
})

describe('流程路由矩阵 - 预览页入口与证件页', () => {
  let storage
  let documents
  let compress
  let pageConfig
  let memoryStorage
  let actionSheetTapIndexes

  function createPreviewPageInstance(config) {
    return {
      ...config,
      data: clone(config.data),
      isLeaving: false,
      setData(updates, callback) {
        this.data = {
          ...this.data,
          ...updates
        }
        if (callback) callback()
      }
    }
  }

  function buildPreviewCache(mode = 'moduleOne') {
    const cache = storage.initCache()
    cache.vehicles.push(storage.createVehicle(0))
    cache.vehicles[0].vehicleRoleName = '标的车'
    cache.vehicles[0].licenseNo = '京A12345'
    cache.vehicles[0].licensePlate = createPhoto('/plate.jpg')
    cache.vehicles[0].vinCode = createPhoto('/vin.jpg')
    cache.scenePhotos.scene45 = createPhoto('/scene-45.jpg')
    cache.sceneSupplementPromptShown = true

    if (mode === 'moduleTwo') {
      cache.currentStep = constants.SHOOT_STEP.DAMAGE
      cache.vehicles[0].damages = [createPhoto('/damage.jpg')]
    } else if (mode === 'moduleThree') {
      cache.currentStep = constants.SHOOT_STEP.MODULE_THREE
    } else if (mode === 'final') {
      cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
      cache.vehicles[0].damages = [createPhoto('/damage.jpg')]
    } else {
      cache.currentStep = constants.SHOOT_STEP.MODULE_ONE_PREVIEW
    }

    return cache
  }

  function appendPreviewVehicle(cache, index, overrides = {}) {
    const vehicle = storage.createVehicle(index)
    vehicle.vehicleRoleName = index === 0 ? '标的车' : `三者车${index}`
    vehicle.licenseNo = index === 0 ? '京A12345' : `京B0000${index}`
    vehicle.licensePlate = createPhoto(`/plate-${index}.jpg`)
    vehicle.vinCode = createPhoto(`/vin-${index}.jpg`)
    vehicle.damages = []
    vehicle.documents = []
    Object.assign(vehicle, overrides)
    cache.vehicles[index] = vehicle
    return vehicle
  }

  function loadPreviewPage(cache, options = {}) {
    storage.saveCache(cache)
    pageConfig = null
    jest.isolateModules(() => {
      require('../packageD/pages/preview/preview')
    })
    const page = createPreviewPageInstance(pageConfig)
    page.onLoad(options)
    return page
  }

  beforeEach(() => {
    jest.resetModules()
    memoryStorage = {}
    actionSheetTapIndexes = []

    jest.doMock('../packageD/utils/compress', () => ({
      compressImage: jest.fn(async (filePath) => ({
        tempFilePath: filePath,
        compressedPath: `${filePath}.compressed`,
        fileSize: 123456
      }))
    }))
    jest.doMock('../packageD/utils/env-config', () => ({
      getAppEnvBadgeText: jest.fn(() => '')
    }))
    jest.doMock('../packageD/utils/runtime-logger', () => ({
      forceWarn: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getSessionId: jest.fn(() => 'test-session')
    }))
    jest.doMock('../packageD/utils/workflow-page', () => ({
      syncPageWorkflowState: jest.fn()
    }))
    jest.doMock('../packageD/utils/upload-state', () => ({
      buildUploadOverlay: jest.fn(() => null)
    }))
    jest.doMock('../packageD/utils/aux-photo-api', () => ({
      uploadPhoto: jest.fn()
    }))
    jest.doMock('../packageD/utils/album', () => ({
      savePhotosToAlbumBatch: jest.fn()
    }))
    jest.doMock('../packageD/utils/permission', () => ({
      ensureAlbumSavePermission: jest.fn()
    }))

    global.wx = {
      env: {
        USER_DATA_PATH: '/tmp'
      },
      getStorageSync(key) {
        return memoryStorage[key]
      },
      setStorageSync(key, value) {
        memoryStorage[key] = value
      },
      removeStorageSync(key) {
        delete memoryStorage[key]
      },
      getSystemInfoSync: jest.fn(() => ({
        windowWidth: 844,
        windowHeight: 390,
        safeArea: { width: 844, height: 390 },
        pixelRatio: 2,
        platform: 'ios',
        system: 'iOS 17.0',
        model: 'iPhone 15'
      })),
      showActionSheet: jest.fn(({ success }) => success && success({ tapIndex: actionSheetTapIndexes.shift() || 0 })),
      chooseMedia: jest.fn(({ success }) => success && success({ tempFiles: [{ tempFilePath: '/tmp/document.jpg', size: 456789 }] })),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showToast: jest.fn(),
      showModal: jest.fn(({ success }) => success && success({ confirm: true })),
      previewImage: jest.fn(),
      navigateTo: jest.fn(({ success } = {}) => success && success()),
      redirectTo: jest.fn(({ success } = {}) => success && success()),
      reLaunch: jest.fn(({ success } = {}) => success && success())
    }
    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })

    storage = require('../packageD/utils/storage')
    documents = require('../packageD/utils/documents')
    compress = require('../packageD/utils/compress')
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../packageD/utils/compress')
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/runtime-logger')
    jest.dontMock('../packageD/utils/workflow-page')
    jest.dontMock('../packageD/utils/upload-state')
    jest.dontMock('../packageD/utils/aux-photo-api')
    jest.dontMock('../packageD/utils/album')
    jest.dontMock('../packageD/utils/permission')
  })

  test('ROUTE-M2-001 模块一预览确认进入车损拍摄直接打开相机车损步骤', () => {
    const page = loadPreviewPage(buildPreviewCache('moduleOne'), { mode: 'moduleOne' })

    page.onConfirmModuleOneHandoff()

    const cache = storage.loadCache()
    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.fromPreview).toBe(false)
    expect(global.wx.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: CAMERA_URL
    }))
    expectNoLegacyPreviewWithoutMode()
  })

  const documentCases = [
    ['ROUTE-M3-001', 'moduleThree', 'driver_license', 'electronic'],
    ['ROUTE-M3-002', 'moduleThree', 'driver_license', 'front_page'],
    ['ROUTE-M3-003', 'moduleThree', 'driving_license', 'electronic'],
    ['ROUTE-M3-004', 'moduleThree', 'driving_license', 'back_page'],
    ['ROUTE-M3-005', 'final', 'driver_license', 'electronic']
  ]

  test.each(documentCases)('%s %s证件补拍后停留当前预览上下文', async (id, mode, docType, side) => {
    const page = loadPreviewPage(buildPreviewCache(mode), { mode })
    page.setData({
      activeDrivingLicenseVehicleIndex: 0,
      activeDrivingLicenseDocType: docType
    })

    await page.chooseDrivingLicenseImage(side, 'camera', docType)

    const cache = storage.loadCache()
    expect(mode === 'final' ? page.data.isFinalPreview : page.data.isModuleThreePreview).toBe(true)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.PREVIEW)
    expect(compress.compressImage).toHaveBeenCalledWith('/tmp/document.jpg', expect.any(Object))
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(global.wx.redirectTo).not.toHaveBeenCalledWith(expect.objectContaining({
      url: PREVIEW_BASE_URL
    }))
    expectNoLegacyPreviewWithoutMode()
  })

  test('ACCESS-M1-001 模块一删除45度后仍可从空槽位补拍并回模块一', () => {
    const page = loadPreviewPage(buildPreviewCache('moduleOne'), { mode: 'moduleOne' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === 'scene-45')
    })

    page.onDelete()
    page.onTapModuleOneSceneSlot({
      currentTarget: {
        dataset: {
          sceneType: constants.SCENE_PHOTO_TYPE.SCENE_45,
          completed: false
        }
      }
    })

    const cache = storage.loadCache()
    const sceneSlot = page.data.moduleOneSummary.sceneSlots.find((slot) => slot.sceneType === constants.SCENE_PHOTO_TYPE.SCENE_45)
    expect(sceneSlot.completed).toBe(false)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.SCENE_45)
    expect(cache.fromPreview).toBe(true)
    expect(cache.previewReturnMode).toBe('moduleOne')
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: CAMERA_URL
    }))
  })

  test('ACCESS-M1-002 模块一删除车牌后仍可从车辆空槽位补拍并回模块一', () => {
    const page = loadPreviewPage(buildPreviewCache('moduleOne'), { mode: 'moduleOne' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === '0-licensePlate')
    })

    page.onDelete()
    page.onTapModuleOneVehicleSlot({
      currentTarget: {
        dataset: {
          vehicle: 0,
          type: constants.PHOTO_TYPE.LICENSE_PLATE,
          completed: false
        }
      }
    })

    const cache = storage.loadCache()
    expect(page.data.moduleOneSummary.vehicles[0].hasLicensePlate).toBe(false)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(cache.fromPreview).toBe(true)
    expect(cache.previewReturnMode).toBe('moduleOne')
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: CAMERA_URL
    }))
  })

  test('ACCESS-M2-001 模块二删除最后一张车损后仍可从车损空入口补拍并回模块二', () => {
    const page = loadPreviewPage(buildPreviewCache('moduleTwo'), { mode: 'moduleTwo' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === '0-damage-0')
    })

    page.onDelete()
    page.onAddDamage({
      currentTarget: {
        dataset: {
          vehicle: 0
        }
      }
    })

    const cache = storage.loadCache()
    expect(page.data.vehicles[0].damages).toHaveLength(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.fromPreview).toBe(true)
    expect(cache.previewReturnMode).toBe('moduleTwo')
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: CAMERA_URL
    }))
  })

  test('ACCESS-M3-001 模块三删除驾驶证后仍展示证件上传入口', () => {
    const cache = buildPreviewCache('moduleThree')
    cache.vehicles[0].documents = [
      createVehicleDocument('driver_license', 'front_page', '/driver-front.jpg')
    ]
    const page = loadPreviewPage(cache, { mode: 'moduleThree' })

    page.confirmDeleteDrivingLicenseDocument(0, 'front_page', 'driver_license')

    const displayItems = page.data.vehicles[0].vehicleDocumentPreview.displayItems
    expect(displayItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'upload',
        docType: 'driver_license',
        uploaded: false
      })
    ]))
  })

  test('ACCESS-FINAL-001 最终预览删除唯一45度后现场环境区和45度空槽位仍应可见', () => {
    const cache = buildPreviewCache('final')
    cache.scenePhotos.supplements = []
    const page = loadPreviewPage(cache, { mode: 'final' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === 'scene-45')
    })

    page.onDelete()

    const sceneSlot = page.data.moduleOneSummary.sceneSlots.find((slot) => slot.sceneType === constants.SCENE_PHOTO_TYPE.SCENE_45)
    const finalSceneMarkup = readFinalSceneMarkup()

    expect(page.data.moduleOneSummary.scenePhotoCount).toBe(0)
    expect(sceneSlot.completed).toBe(false)
    expect(finalSceneMarkup).toContain("{{item.completed ? '' : 'empty-thumb'}}")
    expect(finalSceneMarkup).toContain('<text wx:else class="plus"')
    expect(finalSceneMarkup).not.toContain('isFinalPreview && moduleOneSummary.scenePhotoCount > 0')
  })

  test('ACCESS-FINAL-002 最终预览删除45度但仍有补充照片时45度空槽位仍应可见', () => {
    const cache = buildPreviewCache('final')
    cache.scenePhotos.supplements = [createPhoto('/supplement.jpg')]
    const page = loadPreviewPage(cache, { mode: 'final' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === 'scene-45')
    })

    page.onDelete()

    const sceneSlot = page.data.moduleOneSummary.sceneSlots.find((slot) => slot.sceneType === constants.SCENE_PHOTO_TYPE.SCENE_45)
    const finalSceneMarkup = readFinalSceneMarkup()

    expect(page.data.moduleOneSummary.scenePhotoCount).toBe(1)
    expect(sceneSlot.completed).toBe(false)
    expect(finalSceneMarkup).toContain("{{item.completed ? '' : 'empty-thumb'}}")
    expect(finalSceneMarkup).toContain('data-scene-type="{{item.sceneType}}"')
  })

  test('ACCESS-FINAL-003 最终预览删除现场补充后仍应展示补充现场照片空入口', () => {
    const cache = buildPreviewCache('final')
    cache.scenePhotos.supplements = [createPhoto('/supplement.jpg')]
    const page = loadPreviewPage(cache, { mode: 'final' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === 'scene-supplement-0')
    })

    page.onDelete()

    const supplementSlot = page.data.moduleOneSummary.sceneSlots.find((slot) => (
      slot.sceneType === constants.SCENE_PHOTO_TYPE.SUPPLEMENT && slot.completed === false
    ))
    const finalSceneMarkup = readFinalSceneMarkup()

    expect(page.data.moduleOneSummary.canAddSceneSupplement).toBe(true)
    expect(supplementSlot).toEqual(expect.objectContaining({
      completed: false
    }))
    expect(finalSceneMarkup).toContain('<text wx:else class="plus"')
  })

  test('ACCESS-FINAL-004 最终预览删除车牌后仍可从车辆空槽位补拍并回最终预览', () => {
    const page = loadPreviewPage(buildPreviewCache('final'), { mode: 'final' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === '0-licensePlate')
    })

    page.onDelete()
    page.onTapModuleOneVehicleSlot({
      currentTarget: {
        dataset: {
          vehicle: 0,
          type: constants.PHOTO_TYPE.LICENSE_PLATE,
          completed: false
        }
      }
    })

    const cache = storage.loadCache()
    expect(page.data.moduleOneSummary.vehicles[0].hasLicensePlate).toBe(false)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(cache.fromPreview).toBe(true)
    expect(cache.previewReturnMode).toBe('final')
  })

  test('ACCESS-FINAL-005 最终预览删除最后一张车损后仍可从车损入口补拍并回最终预览', () => {
    const page = loadPreviewPage(buildPreviewCache('final'), { mode: 'final' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === '0-damage-0')
    })

    page.onDelete()
    page.onAddDamage({
      currentTarget: {
        dataset: {
          vehicle: 0
        }
      }
    })

    const cache = storage.loadCache()
    expect(page.data.vehicles[0].damages).toHaveLength(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.fromPreview).toBe(true)
    expect(cache.previewReturnMode).toBe('final')
  })

  test('ACCESS-FINAL-006 最终预览删除证件后仍展示证件上传入口', () => {
    const cache = buildPreviewCache('final')
    cache.vehicles[0].documents = [
      createVehicleDocument('driver_license', 'front_page', '/driver-front.jpg')
    ]
    const page = loadPreviewPage(cache, { mode: 'final' })

    page.confirmDeleteDrivingLicenseDocument(0, 'front_page', 'driver_license')

    const displayItems = page.data.vehicles[0].vehicleDocumentPreview.displayItems
    expect(page.data.isFinalPreview).toBe(true)
    expect(displayItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'upload',
        docType: 'driver_license',
        uploaded: false
      })
    ]))
  })

  test('COMPLEX-PV-M1-001 多车模块一删除第二车VIN后补拍仍锁定第二车并回模块一', () => {
    const cache = buildPreviewCache('moduleOne')
    appendPreviewVehicle(cache, 1)
    const page = loadPreviewPage(cache, { mode: 'moduleOne' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === '1-vinCode')
    })

    page.onDelete()
    page.onTapModuleOneVehicleSlot({
      currentTarget: {
        dataset: {
          vehicle: 1,
          type: constants.PHOTO_TYPE.VIN_CODE,
          completed: false
        }
      }
    })

    const nextCache = storage.loadCache()
    expect(page.data.moduleOneSummary.vehicles[1].hasVinCode).toBe(false)
    expect(nextCache.currentVehicleIndex).toBe(1)
    expect(nextCache.currentStep).toBe(constants.SHOOT_STEP.VIN_CODE)
    expect(nextCache.fromPreview).toBe(true)
    expect(nextCache.previewReturnMode).toBe('moduleOne')
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: CAMERA_URL
    }))
  })

  test('COMPLEX-PV-FINAL-001 最终预览陈旧moduleTwo模式下删除第二车车牌后补拍仍回final', () => {
    const cache = buildPreviewCache('final')
    appendPreviewVehicle(cache, 1, { damages: [createPhoto('/damage-1.jpg')] })
    cache.previewReturnMode = 'moduleTwo'
    const page = loadPreviewPage(cache, { mode: 'final' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === '1-licensePlate')
    })

    page.onDelete()
    page.onTapModuleOneVehicleSlot({
      currentTarget: {
        dataset: {
          vehicle: 1,
          type: constants.PHOTO_TYPE.LICENSE_PLATE,
          completed: false
        }
      }
    })

    const nextCache = storage.loadCache()
    expect(page.data.moduleOneSummary.vehicles[1].hasLicensePlate).toBe(false)
    expect(nextCache.currentVehicleIndex).toBe(1)
    expect(nextCache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(nextCache.previewReturnMode).toBe('final')
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: CAMERA_URL
    }))
  })

  test('COMPLEX-PV-FINAL-002 最终预览现场补充满额删除中间项后释放空入口并回final', () => {
    const cache = buildPreviewCache('final')
    cache.scenePhotos.supplements = [
      createPhoto('/supplement-0.jpg'),
      createPhoto('/supplement-1.jpg'),
      createPhoto('/supplement-2.jpg')
    ]
    const page = loadPreviewPage(cache, { mode: 'final' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === 'scene-supplement-1')
    })

    page.onDelete()
    const emptySupplementSlot = page.data.moduleOneSummary.sceneSlots.find((slot) => (
      slot.sceneType === constants.SCENE_PHOTO_TYPE.SUPPLEMENT && slot.completed === false
    ))
    page.onTapModuleOneSceneSlot({
      currentTarget: {
        dataset: {
          sceneType: emptySupplementSlot.sceneType,
          supplementIndex: emptySupplementSlot.supplementIndex,
          completed: false
        }
      }
    })

    const nextCache = storage.loadCache()
    expect(page.data.moduleOneSummary.supplementCount).toBe(2)
    expect(page.data.moduleOneSummary.canAddSceneSupplement).toBe(true)
    expect(emptySupplementSlot.supplementIndex).toBe(2)
    expect(nextCache.currentStep).toBe(constants.SHOOT_STEP.SCENE_SUPPLEMENT)
    expect(nextCache.sceneSupplementIndex).toBe(2)
    expect(nextCache.previewReturnMode).toBe('final')
  })

  test('COMPLEX-PV-M2-001 模块二多车删除第二车中间车损后补拍仍锁定第二车并回模块二', () => {
    const cache = buildPreviewCache('moduleTwo')
    appendPreviewVehicle(cache, 1, {
      damages: [
        createPhoto('/damage-1-0.jpg'),
        createPhoto('/damage-1-1.jpg'),
        createPhoto('/damage-1-2.jpg')
      ]
    })
    const page = loadPreviewPage(cache, { mode: 'moduleTwo' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === '1-damage-1')
    })

    page.onDelete()
    page.onAddDamage({
      currentTarget: {
        dataset: {
          vehicle: 1
        }
      }
    })

    const nextCache = storage.loadCache()
    expect(page.data.vehicles[1].damages).toHaveLength(2)
    expect(nextCache.currentVehicleIndex).toBe(1)
    expect(nextCache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(nextCache.previewReturnMode).toBe('moduleTwo')
  })

  test('COMPLEX-PV-FINAL-003 最终预览连续删除现场车牌车损后三个补拍入口都保持final', () => {
    const page = loadPreviewPage(buildPreviewCache('final'), { mode: 'final' })
    ;['scene-45', '0-licensePlate', '0-damage-0'].forEach((photoId) => {
      page.setData({
        showPreview: true,
        currentPhoto: page.data.allPhotos.find((photo) => photo.id === photoId)
      })
      page.onDelete()
    })

    const sceneSlot = page.data.moduleOneSummary.sceneSlots.find((slot) => slot.sceneType === constants.SCENE_PHOTO_TYPE.SCENE_45)
    page.onTapModuleOneSceneSlot({
      currentTarget: {
        dataset: {
          sceneType: sceneSlot.sceneType,
          completed: false
        }
      }
    })
    expect(storage.loadCache().previewReturnMode).toBe('final')
    expect(storage.loadCache().currentStep).toBe(constants.SHOOT_STEP.SCENE_45)

    page.onTapModuleOneVehicleSlot({
      currentTarget: {
        dataset: {
          vehicle: 0,
          type: constants.PHOTO_TYPE.LICENSE_PLATE,
          completed: false
        }
      }
    })
    expect(storage.loadCache().previewReturnMode).toBe('final')
    expect(storage.loadCache().currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)

    page.onAddDamage({
      currentTarget: {
        dataset: {
          vehicle: 0
        }
      }
    })
    expect(storage.loadCache().previewReturnMode).toBe('final')
    expect(storage.loadCache().currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
  })

  test('COMPLEX-PV-FINAL-004 最终预览连续删除两类证件后对应上传入口均恢复且不跳页', () => {
    const cache = buildPreviewCache('final')
    cache.vehicles[0].documents = [
      createVehicleDocument('driver_license', 'front_page', '/driver-front.jpg'),
      createVehicleDocument('driving_license', 'back_page', '/driving-back.jpg')
    ]
    const page = loadPreviewPage(cache, { mode: 'final' })

    page.confirmDeleteDrivingLicenseDocument(0, 'front_page', 'driver_license')
    page.confirmDeleteDrivingLicenseDocument(0, 'back_page', 'driving_license')

    const displayItems = page.data.vehicles[0].vehicleDocumentPreview.displayItems
    expect(page.data.isFinalPreview).toBe(true)
    expect(displayItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'upload',
        docType: 'driver_license',
        uploaded: false
      }),
      expect.objectContaining({
        type: 'upload',
        docType: 'driving_license',
        uploaded: false
      })
    ]))
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(global.wx.redirectTo).not.toHaveBeenCalled()
  })
})
