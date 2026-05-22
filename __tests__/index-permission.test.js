describe('index start permission flow', () => {
  let pageConfig
  let storage
  let constants
  let permission
  let envConfig
  let modelCache
  let auxPhotoApi
  let auxPhotoMapper
  let consoleLogSpy
  let consoleWarnSpy

  function loadIndexPage() {
    jest.resetModules()
    pageConfig = null

    constants = {
      SHOOT_STEP: {
        LICENSE_PLATE: 'licensePlate'
      }
    }
    storage = {
      initCache: jest.fn(() => ({
        vehicles: []
      })),
      createVehicle: jest.fn(() => ({
        type: 'target'
      })),
      saveCache: jest.fn(),
      loadCache: jest.fn(() => ({
        saved: true
      })),
      clearCache: jest.fn()
    }
    permission = {
      ensureStartCapturePermissions: jest.fn()
    }
    envConfig = {
      getAppEnvBadgeText: jest.fn(() => ''),
      canSwitchAppEnv: jest.fn(() => true),
      getAvailableAppEnvs: jest.fn(() => ['dev', 'sit']),
      saveAppEnvOverride: jest.fn(() => true),
      clearAppEnvOverride: jest.fn(),
      isRelease: jest.fn(() => false)
    }
    modelCache = {
      clearAiModelCache: jest.fn(() => Promise.resolve({
        ok: true,
        appEnv: 'sit',
        wxEnvVersion: 'trial',
        results: [
          { modelName: 'plate', path: '/user-data/plate.onnx', deleted: true, reason: 'deleted', errMsg: '' },
          { modelName: 'damage', path: '/user-data/damage.onnx', deleted: true, reason: 'deleted', errMsg: '' }
        ]
      }))
    }
    auxPhotoApi = {
      init: jest.fn()
    }
    auxPhotoMapper = {
      buildCacheFromInit: jest.fn(() => ({
        auxPhoto: {
          enabled: true,
          ticket: 'mock-2'
        },
        vehicles: [
          {
            id: 'LOSS_VEHICLE_100001',
            displayName: '标的车 京A12345'
          },
          {
            id: 'LOSS_VEHICLE_100002',
            displayName: '三者车 京B12345'
          }
        ],
        currentVehicleIndex: 0,
        currentStep: 'licensePlate'
      }))
    }

    global.wx = {
      navigateTo: jest.fn(({ success }) => {
        success && success()
      }),
      showToast: jest.fn(),
      showModal: jest.fn(),
      showActionSheet: jest.fn()
    }
    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })

    jest.doMock('../utils/storage', () => storage)
    jest.doMock('../utils/constants', () => constants)
    jest.doMock('../utils/permission', () => permission)
    jest.doMock('../utils/env-config', () => envConfig)
    jest.doMock('../utils/model-cache', () => modelCache)
    jest.doMock('../utils/aux-photo-api', () => auxPhotoApi)
    jest.doMock('../utils/aux-photo-mapper', () => auxPhotoMapper)

    require('../pages/index/index')
  }

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    loadIndexPage()
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    delete global.getApp
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    jest.clearAllMocks()
    jest.dontMock('../utils/storage')
    jest.dontMock('../utils/constants')
    jest.dontMock('../utils/permission')
    jest.dontMock('../utils/env-config')
    jest.dontMock('../utils/model-cache')
    jest.dontMock('../utils/aux-photo-api')
    jest.dontMock('../utils/aux-photo-mapper')
  })

  test('does not initialize capture flow when camera permission is denied', async () => {
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: false,
      albumGranted: false
    })

    await pageConfig.onStart.call(pageConfig)

    expect(storage.initCache).not.toHaveBeenCalled()
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
  })

  test('continues original capture flow when album permission is denied but camera is granted', async () => {
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: false
    })

    await pageConfig.onStart.call(pageConfig)

    expect(storage.initCache).toHaveBeenCalled()
    expect(storage.createVehicle).toHaveBeenCalledWith(0)
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
      vehicles: [expect.objectContaining({ type: 'target' })]
    }))
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/camera/camera'
    }))
  })

  test('uses aux photo init and backend vehicles when ticket is present', async () => {
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        vehicles: [
          { vehicleId: 'LOSS_VEHICLE_100001', licenseNo: '京A12345' },
          { vehicleId: 'LOSS_VEHICLE_100002', licenseNo: '京B12345' }
        ]
      }
    })
    global.getApp = jest.fn(() => ({
      globalData: {
        ticket: 'mock-2'
      }
    }))

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoApi.init).toHaveBeenCalledWith('mock-2')
    expect(auxPhotoMapper.buildCacheFromInit).toHaveBeenCalledWith(expect.objectContaining({
      ticket: 'mock-2'
    }))
    expect(storage.createVehicle).not.toHaveBeenCalled()
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      auxPhoto: expect.objectContaining({
        enabled: true,
        ticket: 'mock-2'
      }),
      vehicles: [
        expect.objectContaining({ displayName: '标的车 京A12345' }),
        expect.objectContaining({ displayName: '三者车 京B12345' })
      ]
    }))
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/camera/camera'
    }))
  })

  test('blocks release start when ticket is missing', async () => {
    envConfig.isRelease.mockReturnValue(true)
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })

    await pageConfig.onStart.call(pageConfig)

    expect(permission.ensureStartCapturePermissions).not.toHaveBeenCalled()
    expect(storage.initCache).not.toHaveBeenCalled()
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '链接无效，请联系工作人员重新发送',
      icon: 'none'
    })
  })

  test('ignores duplicate start taps while capture flow is starting', async () => {
    let resolvePermission
    permission.ensureStartCapturePermissions.mockReturnValue(new Promise((resolve) => {
      resolvePermission = resolve
    }))

    const firstStart = pageConfig.onStart.call(pageConfig)
    const secondStart = pageConfig.onStart.call(pageConfig)

    expect(permission.ensureStartCapturePermissions).toHaveBeenCalledTimes(1)
    expect(storage.initCache).not.toHaveBeenCalled()

    resolvePermission({
      cameraGranted: true,
      albumGranted: true
    })

    await firstStart
    await secondStart

    expect(storage.initCache).toHaveBeenCalledTimes(1)
    expect(global.wx.navigateTo).toHaveBeenCalledTimes(1)
  })

  test('shows retry tip and releases start lock when start flow fails', async () => {
    const err = new Error('navigate failed')
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    global.wx.navigateTo.mockImplementationOnce(({ fail }) => {
      fail(err)
    })

    await pageConfig.onStart.call(pageConfig)

    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '开始采集失败，请重试',
      icon: 'none'
    })
    expect(pageConfig.isStartingCapture).toBe(false)

    global.wx.navigateTo.mockImplementationOnce(({ success }) => {
      success && success()
    })

    await pageConfig.onStart.call(pageConfig)

    expect(global.wx.navigateTo).toHaveBeenCalledTimes(2)
  })

  test('hidden debug action clears AI model cache and shows success tip', async () => {
    const clearResult = await modelCache.clearAiModelCache()
    modelCache.clearAiModelCache.mockClear()
    global.wx.showActionSheet.mockImplementationOnce(({ itemList, success }) => {
      expect(itemList).toEqual(['dev', 'sit', '清除环境选择', '清除 AI 模型缓存'])
      success({ tapIndex: 3 })
    })

    pageConfig.showAppEnvSelector.call(pageConfig)
    await Promise.resolve()
    await Promise.resolve()

    expect(modelCache.clearAiModelCache).toHaveBeenCalledTimes(1)
    expect(consoleLogSpy).toHaveBeenCalledWith('[AI:model:cache:clear]', clearResult)
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '模型缓存已清理',
      icon: 'none'
    })
  })
})
