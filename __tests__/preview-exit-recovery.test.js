const fs = require('fs')

const PREVIEW_BASE_URL = '/packageD/pages/preview/preview'
const COMPLETE_URL = '/packageD/pages/complete/complete'
const CAMERA_URL = '/packageD/pages/camera/camera'
const INDEX_URL = '/packageD/pages/index/index'
const TEST_TICKET = 'mock-2'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createPhoto(path) {
  return {
    status: 'completed',
    compressedPath: path,
    tempFilePath: path,
    fileSize: 1024,
    createdAt: 1000,
    updatedAt: 1000
  }
}

function getLastNavigationUrl(wxMock = global.wx) {
  const calls = [
    ...(wxMock.navigateTo && wxMock.navigateTo.mock ? wxMock.navigateTo.mock.calls : []),
    ...(wxMock.redirectTo && wxMock.redirectTo.mock ? wxMock.redirectTo.mock.calls : []),
    ...(wxMock.reLaunch && wxMock.reLaunch.mock ? wxMock.reLaunch.mock.calls : [])
  ]
  const lastCall = calls[calls.length - 1]
  return lastCall && lastCall[0] && lastCall[0].url
}

function createIndexResumeCache(overrides = {}) {
  return {
    auxPhoto: {
      enabled: true,
      ticket: TEST_TICKET
    },
    vehicles: [
      {
        licensePlate: createPhoto('/tmp/plate.jpg'),
        vinCode: createPhoto('/tmp/vin.jpg'),
        damages: [createPhoto('/tmp/damage.jpg')]
      }
    ],
    currentVehicleIndex: 0,
    currentStep: 'preview',
    workflowState: {
      current: 'PREVIEWING',
      updatedAt: '2026-07-27T00:00:00.000Z'
    },
    ...overrides
  }
}

function loadIndexPageWithMocks({ resumeCache, ticketStatus = 'OPENED' } = {}) {
  jest.resetModules()
  let pageConfig = null
  const storage = {
    initCache: jest.fn(() => ({ vehicles: [] })),
    createVehicle: jest.fn(() => ({ type: 'target' })),
    saveCache: jest.fn(),
    loadCache: jest.fn(() => resumeCache || null),
    loadCacheForResume: jest.fn(() => resumeCache || null),
    clearCache: jest.fn()
  }
  const constants = {
    SHOOT_STEP: {
      SCENE_45: 'scene45',
      LICENSE_PLATE: 'licensePlate',
      VIN_CODE: 'vinCode',
      DAMAGE: 'damage',
      MODULE_ONE_PREVIEW: 'moduleOnePreview',
      MODULE_THREE: 'moduleThree',
      FINAL_PREVIEW: 'finalPreview',
      PREVIEW: 'preview'
    }
  }
  const permission = {
    ensureStartCapturePermissions: jest.fn(() => Promise.resolve({
      cameraGranted: true,
      albumGranted: true
    }))
  }
  const auxPhotoApi = {
    init: jest.fn(() => Promise.resolve({
      success: true,
      data: {
        ticket: TEST_TICKET,
        ticketStatus
      }
    }))
  }
  const bootstrap = {
    bootstrap: jest.fn(),
    getTicket: jest.fn(() => TEST_TICKET)
  }

  global.wx = {
    navigateTo: jest.fn(({ success } = {}) => success && success()),
    redirectTo: jest.fn(({ success } = {}) => success && success()),
    reLaunch: jest.fn(({ success } = {}) => success && success()),
    showToast: jest.fn(),
    showModal: jest.fn(),
    showActionSheet: jest.fn()
  }
  global.Page = jest.fn((config) => {
    pageConfig = config
    return config
  })

  jest.doMock('../packageD/utils/storage', () => storage)
  jest.doMock('../packageD/utils/constants', () => constants)
  jest.doMock('../packageD/utils/permission', () => permission)
  jest.doMock('../packageD/utils/env-config', () => ({
    getAppEnvBadgeText: jest.fn(() => ''),
    canSwitchAppEnv: jest.fn(() => false),
    getAvailableAppEnvs: jest.fn(() => []),
    saveAppEnvOverride: jest.fn(),
    clearAppEnvOverride: jest.fn(),
    isRelease: jest.fn(() => false)
  }))
  jest.doMock('../packageD/utils/model-cache', () => ({
    clearAiModelCache: jest.fn()
  }))
  jest.doMock('../packageD/utils/bootstrap', () => bootstrap)
  jest.doMock('../packageD/utils/aux-photo-api', () => auxPhotoApi)
  jest.doMock('../packageD/utils/aux-photo-mapper', () => ({
    buildCacheFromInit: jest.fn(() => createIndexResumeCache())
  }))
  jest.doMock('../packageD/utils/workflow-state', () => ({
    STATES: {
      PREVIEWING: 'PREVIEWING'
    },
    inferStateFromCache: jest.fn((cache) => cache && cache.workflowState && cache.workflowState.current)
  }))

  require('../packageD/pages/index/index')

  return {
    pageConfig,
    storage,
    permission,
    auxPhotoApi,
    bootstrap
  }
}

describe('首页同 ticket 恢复闭环可退出性', () => {
  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../packageD/utils/storage')
    jest.dontMock('../packageD/utils/constants')
    jest.dontMock('../packageD/utils/permission')
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/model-cache')
    jest.dontMock('../packageD/utils/bootstrap')
    jest.dontMock('../packageD/utils/aux-photo-api')
    jest.dontMock('../packageD/utils/aux-photo-mapper')
    jest.dontMock('../packageD/utils/workflow-state')
  })

  test('RESTORE-EXIT-INDEX-001 同 ticket 的普通 preview 缓存不应静默恢复到无 mode 老预览', async () => {
    const { pageConfig, storage } = loadIndexPageWithMocks({
      resumeCache: createIndexResumeCache({
        currentStep: 'preview',
        workflowState: { current: 'PREVIEWING' }
      })
    })

    await pageConfig.onStart.call(pageConfig)

    expect(storage.loadCacheForResume).toHaveBeenCalledTimes(1)
    expect(getLastNavigationUrl()).not.toBe(PREVIEW_BASE_URL)
  })

  test('RESTORE-EXIT-INDEX-002 后端 blocked ticket 优先于本地旧预览缓存', async () => {
    const { pageConfig, storage, permission } = loadIndexPageWithMocks({
      resumeCache: createIndexResumeCache(),
      ticketStatus: 'COMPLETED'
    })

    await pageConfig.onStart.call(pageConfig)

    expect(storage.loadCacheForResume).not.toHaveBeenCalled()
    expect(permission.ensureStartCapturePermissions).not.toHaveBeenCalled()
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '照片已完成采集，请勿重复操作。',
      icon: 'none'
    })
  })

  test('RESTORE-EXIT-INDEX-003 completed 上传会话恢复到完成页出口', async () => {
    const { pageConfig } = loadIndexPageWithMocks({
      resumeCache: createIndexResumeCache({
        uploadSession: {
          phase: 'completed',
          complete: {
            status: 'success'
          }
        },
        workflowState: { current: 'LOCAL_COMPLETED' }
      })
    })

    await pageConfig.onStart.call(pageConfig)

    expect(getLastNavigationUrl()).toBe(COMPLETE_URL)
  })
})

describe('预览页恢复后可退出性', () => {
  let storage
  let constants
  let pageConfig
  let memoryStorage

  function createCompletedVehicle(index = 0, damageCount = 1) {
    const vehicle = storage.createVehicle(index)
    vehicle.vehicleRoleName = index === 0 ? '标的车' : `三者车${index}`
    vehicle.licenseNo = index === 0 ? '京A12345' : `京B0000${index}`
    vehicle.licensePlate = createPhoto(`/tmp/plate-${index}.jpg`)
    vehicle.vinCode = createPhoto(`/tmp/vin-${index}.jpg`)
    vehicle.damages = Array.from({ length: damageCount }, (_, damageIndex) => createPhoto(`/tmp/damage-${index}-${damageIndex}.jpg`))
    return vehicle
  }

  function createPreviewCache(mode = 'moduleOne', overrides = {}) {
    const cache = storage.initCache()
    cache.auxPhoto = {
      enabled: true,
      ticket: TEST_TICKET
    }
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.scenePhotos.scene45 = createPhoto('/tmp/scene-45.jpg')
    cache.sceneSupplementPromptShown = true
    cache.workflowState = {
      current: 'PREVIEWING',
      updatedAt: cache.updatedAt
    }

    if (mode === 'moduleOne') {
      cache.currentStep = constants.SHOOT_STEP.MODULE_ONE_PREVIEW
    } else if (mode === 'moduleTwo') {
      cache.currentStep = constants.SHOOT_STEP.DAMAGE
    } else if (mode === 'moduleThree') {
      cache.currentStep = constants.SHOOT_STEP.MODULE_THREE
    } else if (mode === 'final') {
      cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
    } else {
      cache.currentStep = constants.SHOOT_STEP.PREVIEW
    }

    return {
      ...cache,
      ...overrides
    }
  }

  function createUploadSession(phase, overrides = {}) {
    const completeStatus = phase === 'completed'
      ? 'success'
      : phase === 'complete_failed'
        ? 'failed'
        : 'pending'
    const itemStatus = phase === 'failed'
      ? 'failed'
      : phase === 'ready' || phase === 'completed' || phase === 'complete_failed'
        ? 'success'
        : 'pending'

    return {
      version: 1,
      sessionId: `session-${phase}`,
      phase,
      ticket: TEST_TICKET,
      total: 1,
      uploaded: itemStatus === 'success' ? 1 : 0,
      failed: itemStatus === 'failed' ? 1 : 0,
      complete: {
        status: completeStatus,
        attempts: 0,
        lastErrorCode: phase === 'complete_failed' ? 'E_COMPLETE' : '',
        lastErrorMessage: phase === 'complete_failed' ? '完成提交失败' : '',
        submittedAt: '',
        completedAt: '',
        ticketStatus: '',
        uploadedCount: itemStatus === 'success' ? 1 : 0,
        completeTime: '',
        response: null
      },
      items: [
        {
          id: 'photo-1',
          clientPhotoId: 'photo-1',
          filePath: '/tmp/photo-1.jpg',
          label: '标的车 - 车损1',
          status: itemStatus,
          attempts: 1,
          startedAt: '',
          uploadedAt: itemStatus === 'success' ? '2026-07-27T00:00:00.000Z' : '',
          failedAt: itemStatus === 'failed' ? '2026-07-27T00:00:00.000Z' : '',
          lastErrorCode: itemStatus === 'failed' ? 'E_UPLOAD' : '',
          lastErrorMessage: itemStatus === 'failed' ? '上传失败' : ''
        }
      ],
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
      ...overrides
    }
  }

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

  function resolvePrimaryAction(page) {
    if (page.data.isModuleOnePreview) {
      return { available: true, label: '进入车损拍摄', action: 'onEnterDamageFromModuleOne' }
    }
    if (page.data.isModuleTwoPreview) {
      return { available: true, label: '进入证件信息', action: 'onEnterDocumentsFromModuleTwo' }
    }
    if (page.data.isModuleThreePreview) {
      return { available: true, label: '进入最终总预览', action: 'onEnterFinalFromModuleThree' }
    }
    if (page.data.isFinalPreview) {
      return { available: true, label: '提交', action: 'onSubmit' }
    }
    return { available: false, label: '', action: '' }
  }

  function assertSinglePreviewMode(page, expectedMode) {
    const modeFlags = {
      moduleOne: page.data.isModuleOnePreview,
      moduleTwo: page.data.isModuleTwoPreview,
      moduleThree: page.data.isModuleThreePreview,
      final: page.data.isFinalPreview
    }
    const activeModes = Object.keys(modeFlags).filter((mode) => modeFlags[mode])

    expect(activeModes).toEqual([expectedMode])
    Object.keys(modeFlags).forEach((mode) => {
      expect(modeFlags[mode]).toBe(mode === expectedMode)
    })
  }

  beforeEach(() => {
    jest.resetModules()
    jest.useRealTimers()
    memoryStorage = {}

    jest.doMock('../packageD/utils/env-config', () => ({
      getAppEnvBadgeText: jest.fn(() => ''),
      getDebugConfig: jest.fn(() => ({ showAIPanel: false })),
      getAiConfig: jest.fn(() => ({}))
    }))
    jest.doMock('../packageD/utils/runtime-logger', () => ({
      forceWarn: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getSessionId: jest.fn(() => 'test-session'),
      endSession: jest.fn()
    }))
    jest.doMock('../packageD/utils/workflow-page', () => ({
      syncPageWorkflowState: jest.fn()
    }))
    jest.doMock('../packageD/utils/aux-photo-api', () => ({
      uploadPhoto: jest.fn(() => new Promise(() => {})),
      complete: jest.fn(() => Promise.resolve({
        success: true,
        data: {
          ticketStatus: 'COMPLETED',
          uploadedCount: 1
        }
      }))
    }))
    jest.doMock('../packageD/utils/album', () => ({
      savePhotosToAlbumBatch: jest.fn()
    }))
    jest.doMock('../packageD/utils/permission', () => ({
      ensureAlbumSavePermission: jest.fn(() => Promise.resolve(true))
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
      showActionSheet: jest.fn(),
      chooseMedia: jest.fn(),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showToast: jest.fn(),
      showModal: jest.fn(({ success } = {}) => success && success({ confirm: true })),
      previewImage: jest.fn(),
      navigateTo: jest.fn(({ success } = {}) => success && success()),
      navigateBack: jest.fn(({ success } = {}) => success && success()),
      redirectTo: jest.fn(({ success } = {}) => success && success()),
      reLaunch: jest.fn(({ success } = {}) => success && success())
    }
    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })

    storage = require('../packageD/utils/storage')
    constants = require('../packageD/utils/constants')
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/runtime-logger')
    jest.dontMock('../packageD/utils/workflow-page')
    jest.dontMock('../packageD/utils/aux-photo-api')
    jest.dontMock('../packageD/utils/album')
    jest.dontMock('../packageD/utils/permission')
  })

  test.each([
    ['moduleOne', '进入车损拍摄', 'onEnterDamageFromModuleOne'],
    ['moduleTwo', '进入证件信息', 'onEnterDocumentsFromModuleTwo'],
    ['moduleThree', '进入最终总预览', 'onEnterFinalFromModuleThree'],
    ['final', '提交', 'onSubmit']
  ])('PREVIEW-EXIT-MODE-001 %s 模式存在明确主操作：%s', (mode, label, action) => {
    const page = loadPreviewPage(createPreviewCache(mode), { mode })
    const primaryAction = resolvePrimaryAction(page)

    assertSinglePreviewMode(page, mode)
    expect(primaryAction).toEqual({
      available: true,
      label,
      action
    })
    expect(typeof page[action]).toBe('function')
  })

  test.each([
    ['moduleOne', () => ({ currentStep: constants.SHOOT_STEP.PREVIEW }), '现场环境及车辆信息'],
    ['moduleTwo', () => ({ currentStep: constants.SHOOT_STEP.PREVIEW, uploadSession: createUploadSession('failed') }), '车损照片预览'],
    ['moduleThree', () => ({ currentStep: constants.SHOOT_STEP.FINAL_PREVIEW, uploadSession: createUploadSession('failed') }), '证件信息'],
    ['final', () => ({ currentStep: constants.SHOOT_STEP.MODULE_ONE_PREVIEW }), '最终总预览']
  ])('PREVIEW-EXIT-MODE-006 URL mode=%s 优先于缓存残留且预览模式互斥', (mode, createOverrides, pageTitle) => {
    const overrides = createOverrides()
    const page = loadPreviewPage(createPreviewCache('plain', overrides), { mode })

    assertSinglePreviewMode(page, mode)
    expect(page.data.pageTitle).toBe(pageTitle)
  })

  test.each([
    ['currentStep=preview', () => ({ currentStep: constants.SHOOT_STEP.PREVIEW })],
    ['uploadSession残留', () => ({ uploadSession: createUploadSession('failed') })]
  ])('PREVIEW-EXIT-MODE-007 无 mode + %s 迁移为唯一 final 模式', (name, createOverrides) => {
    const overrides = createOverrides()
    const page = loadPreviewPage(createPreviewCache('plain', overrides), {})

    assertSinglePreviewMode(page, 'final')
    expect(page.data.pageTitle).toBe('最终总预览')
  })

  test('PREVIEW-EXIT-MODE-002 moduleOne 主操作进入车损交接弹层', () => {
    const page = loadPreviewPage(createPreviewCache('moduleOne'), { mode: 'moduleOne' })

    page.onEnterDamageFromModuleOne()

    expect(page.data.showModuleOneHandoff).toBe(true)
    expect(page.data.moduleHandoffConfirmText).toBe('进入车损拍摄')
  })

  test('PREVIEW-EXIT-MODE-003 moduleTwo 主操作进入证件信息交接弹层', () => {
    const page = loadPreviewPage(createPreviewCache('moduleTwo'), { mode: 'moduleTwo' })

    page.onEnterDocumentsFromModuleTwo()

    expect(page.data.showModuleOneHandoff).toBe(true)
    expect(page.data.moduleHandoffConfirmText).toBe('进入证件信息')
  })

  test('PREVIEW-EXIT-MODE-004 moduleThree 主操作进入最终总预览交接弹层', () => {
    const page = loadPreviewPage(createPreviewCache('moduleThree'), { mode: 'moduleThree' })

    page.onEnterFinalFromModuleThree()

    expect(page.data.showModuleOneHandoff).toBe(true)
    expect(page.data.moduleHandoffConfirmText).toBe('进入最终总预览')
  })

  test('PREVIEW-EXIT-MODE-005 final 主操作触发提交确认链路', () => {
    const page = loadPreviewPage(createPreviewCache('final'), { mode: 'final' })

    page.onSubmit()

    expect(page.data.showModal || page.data.showUploadOverlay).toBe(true)
  })

  test('PREVIEW-EXIT-NOMODE-001 无 mode 普通 preview 恢复页必须暴露明确主操作', () => {
    const page = loadPreviewPage(createPreviewCache('plain'), {})

    expect(page.data.isModuleOnePreview).toBe(false)
    expect(page.data.isModuleTwoPreview).toBe(false)
    expect(page.data.isModuleThreePreview).toBe(false)
    expect(page.data.isFinalPreview).toBe(true)
    expect(resolvePrimaryAction(page)).toEqual(expect.objectContaining({
      available: true,
      action: 'onSubmit'
    }))
  })

  test('PREVIEW-EXIT-LAYER-001 大图预览层关闭后回到列表预览并保留底部主操作', () => {
    const page = loadPreviewPage(createPreviewCache('moduleTwo'), { mode: 'moduleTwo' })

    page.onPreview({
      currentTarget: {
        dataset: {
          vehicle: 0,
          type: 'damage',
          damage: 0
        }
      }
    })
    expect(page.data.showPreview).toBe(true)

    page.onClosePreview()

    expect(page.data.showPreview).toBe(false)
    expect(page.data.isModuleTwoPreview).toBe(true)
    expect(resolvePrimaryAction(page)).toEqual(expect.objectContaining({
      available: true,
      action: 'onEnterDocumentsFromModuleTwo'
    }))
  })

  test.each([
    ['failed', '有照片上传失败', '重试上传', true],
    ['ready', '照片上传完成', '', false],
    ['complete_failed', '完成提交失败', '重试完成', true]
  ])('PREVIEW-EXIT-UPLOAD-001 uploadSession=%s 恢复上传遮罩出口', (phase, title, primaryText, primaryVisible) => {
    if (phase === 'ready') {
      jest.useFakeTimers()
    }
    const page = loadPreviewPage(createPreviewCache('plain', {
      uploadSession: createUploadSession(phase)
    }), {})

    expect(page.data.showUploadOverlay).toBe(true)
    expect(page.data.uploadOverlayTitle).toBe(title)
    expect(page.data.uploadOverlayPrimaryText).toBe(primaryText)
    expect(page.data.uploadOverlayPrimaryVisible).toBe(primaryVisible)

    if (phase === 'ready') {
      expect(page.completeAutoTimerId).toBeTruthy()
      jest.useRealTimers()
    }
  })

  test('PREVIEW-EXIT-UPLOAD-002 uploadSession=completed 恢复后进入完成页', () => {
    loadPreviewPage(createPreviewCache('plain', {
      uploadSession: createUploadSession('completed')
    }), {})

    expect(getLastNavigationUrl()).toBe(COMPLETE_URL)
  })

  test('PREVIEW-EXIT-WXML-001 显式模式底部主操作绑定保持存在', () => {
    const wxml = fs.readFileSync('packageD/pages/preview/preview.wxml', 'utf8')

    expect(wxml).toContain('bindtap="onEnterDamageFromModuleOne"')
    expect(wxml).toContain('bindtap="onEnterDocumentsFromModuleTwo"')
    expect(wxml).toContain('bindtap="onEnterFinalFromModuleThree"')
    expect(wxml).toContain('bindtap="onSubmit"')
  })
})
