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

  test('requests only camera permission when start capture scopes are unset', async () => {
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
      albumGranted: false
    })
    expect(authorizeScopes).toEqual([
      permission.CAMERA_SCOPE
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

  test('allows start without checking album permission when album permission is disabled', async () => {
    const permission = loadPermission()

    global.wx = {
      getSetting: jest.fn(({ success }) => {
        success({
          authSetting: {
            [permission.CAMERA_SCOPE]: true,
            [permission.ALBUM_SCOPE]: false
          }
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
    expect(global.wx.getSetting).toHaveBeenCalledTimes(1)
  })

  test('requests album permission only when final album save is confirmed', async () => {
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

    const granted = await permission.ensureAlbumSavePermission()

    expect(granted).toBe(true)
    expect(authorizeScopes).toEqual([permission.ALBUM_SCOPE])
  })

  test('opens settings when final album save permission was previously denied', async () => {
    const permission = loadPermission()

    global.wx = {
      getSetting: jest.fn(({ success }) => {
        success({
          authSetting: {
            [permission.ALBUM_SCOPE]: false
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
            [permission.ALBUM_SCOPE]: true
          }
        })
      })
    }

    const granted = await permission.ensureAlbumSavePermission()

    expect(granted).toBe(true)
    expect(global.wx.authorize).not.toHaveBeenCalled()
    expect(global.wx.showModal).toHaveBeenCalledWith(expect.objectContaining({
      title: '相册权限',
      confirmText: '去设置'
    }))
    expect(global.wx.openSetting).toHaveBeenCalled()
  })

  test('returns false for final album save when user cancels album setting', async () => {
    const permission = loadPermission()

    global.wx = {
      getSetting: jest.fn(({ success }) => {
        success({
          authSetting: {
            [permission.ALBUM_SCOPE]: false
          }
        })
      }),
      authorize: jest.fn(),
      showModal: jest.fn(({ success }) => {
        success({ confirm: false })
      }),
      openSetting: jest.fn()
    }

    const granted = await permission.ensureAlbumSavePermission()

    expect(granted).toBe(false)
    expect(global.wx.openSetting).not.toHaveBeenCalled()
  })
})
