describe('index start permission flow', () => {
  let pageConfig
  let storage
  let constants
  let permission
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

    global.wx = {
      navigateTo: jest.fn(({ success }) => {
        success && success()
      }),
      showToast: jest.fn()
    }
    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })

    jest.doMock('../utils/storage', () => storage)
    jest.doMock('../utils/constants', () => constants)
    jest.doMock('../utils/permission', () => permission)

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
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    jest.clearAllMocks()
    jest.dontMock('../utils/storage')
    jest.dontMock('../utils/constants')
    jest.dontMock('../utils/permission')
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
})
