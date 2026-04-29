describe('permission utility', () => {
  let consoleWarnSpy

  function loadPermission() {
    jest.resetModules()
    return require('../utils/permission')
  }

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    delete global.wx
    consoleWarnSpy.mockRestore()
    jest.clearAllMocks()
  })

  test('requests camera and album permission when both scopes are unset', async () => {
    const permission = loadPermission()
    const authorizeScopes = []

    global.wx = {
      getSetting: jest.fn(({ success }) => {
        success({ authSetting: {} })
      }),
      authorize: jest.fn(({ scope, success }) => {
        authorizeScopes.push(scope)
        success()
      })
    }

    const result = await permission.ensureStartCapturePermissions()

    expect(result).toEqual({
      cameraGranted: true,
      albumGranted: true
    })
    expect(authorizeScopes).toEqual([
      permission.CAMERA_SCOPE,
      permission.ALBUM_SCOPE
    ])
  })

  test('blocks start when camera remains disabled after openSetting', async () => {
    const permission = loadPermission()

    global.wx = {
      getSetting: jest.fn(({ success }) => {
        success({
          authSetting: {
            [permission.CAMERA_SCOPE]: false
          }
        })
      }),
      authorize: jest.fn(),
      showModal: jest.fn(({ success }) => {
        success({ confirm: true })
      }),
      openSetting: jest.fn(({ success }) => {
        success({
          authSetting: {
            [permission.CAMERA_SCOPE]: false
          }
        })
      })
    }

    const result = await permission.ensureStartCapturePermissions()

    expect(result).toEqual({
      cameraGranted: false,
      albumGranted: false
    })
    expect(global.wx.showModal).toHaveBeenCalledWith(expect.objectContaining({
      content: permission.CAMERA_DENIED_MESSAGE,
      confirmText: '去设置'
    }))
    expect(global.wx.openSetting).toHaveBeenCalled()
    expect(global.wx.authorize).not.toHaveBeenCalled()
  })

  test('allows start when album permission is disabled', async () => {
    const permission = loadPermission()
    let getSettingCount = 0

    global.wx = {
      getSetting: jest.fn(({ success }) => {
        getSettingCount += 1
        success({
          authSetting: getSettingCount === 1
            ? { [permission.CAMERA_SCOPE]: true }
            : { [permission.ALBUM_SCOPE]: false }
        })
      }),
      authorize: jest.fn(),
      showModal: jest.fn(),
      openSetting: jest.fn()
    }

    const result = await permission.ensureStartCapturePermissions()

    expect(result).toEqual({
      cameraGranted: true,
      albumGranted: false
    })
    expect(global.wx.showModal).not.toHaveBeenCalled()
    expect(global.wx.openSetting).not.toHaveBeenCalled()
    expect(global.wx.authorize).not.toHaveBeenCalled()
  })
})
