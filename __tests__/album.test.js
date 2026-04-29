describe('album utility', () => {
  let consoleLogSpy
  let consoleWarnSpy

  function loadAlbum() {
    jest.resetModules()
    return require('../utils/album')
  }

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    delete global.wx
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    jest.clearAllMocks()
  })

  test('uses the confirmed compressed path first', () => {
    const album = loadAlbum()

    expect(album.getConfirmedPhotoPath({
      compressedPath: '/tmp/compressed.jpg',
      tempFilePath: '/tmp/original.jpg'
    })).toBe('/tmp/compressed.jpg')
  })

  test('saves confirmed photo to system album without success toast', async () => {
    const album = loadAlbum()

    global.wx = {
      saveImageToPhotosAlbum: jest.fn(({ success }) => {
        success()
      }),
      showToast: jest.fn()
    }

    const result = await album.saveConfirmedPhotoToAlbum({
      compressedPath: '/tmp/confirmed.jpg'
    })

    expect(result).toEqual({
      saved: true,
      filePath: '/tmp/confirmed.jpg'
    })
    expect(global.wx.saveImageToPhotosAlbum).toHaveBeenCalledWith(expect.objectContaining({
      filePath: '/tmp/confirmed.jpg'
    }))
    expect(global.wx.showToast).not.toHaveBeenCalled()
  })

  test('keeps flow safe and only shows a light tip when album save fails', async () => {
    const album = loadAlbum()
    const err = { errMsg: 'saveImageToPhotosAlbum:fail system error' }

    global.wx = {
      saveImageToPhotosAlbum: jest.fn(({ fail }) => {
        fail(err)
      }),
      showToast: jest.fn()
    }

    const result = await album.saveConfirmedPhotoToAlbum({
      compressedPath: '/tmp/failed.jpg'
    })

    expect(result).toEqual({
      saved: false,
      reason: 'save_failed',
      err
    })
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: album.SAVE_FAIL_TEXT,
      icon: 'none'
    })
  })

  test('does not toast when save fails because album permission is denied', async () => {
    const album = loadAlbum()
    const err = { errMsg: 'saveImageToPhotosAlbum:fail auth deny' }

    global.wx = {
      saveImageToPhotosAlbum: jest.fn(({ fail }) => {
        fail(err)
      }),
      showToast: jest.fn()
    }

    const result = await album.saveConfirmedPhotoToAlbum({
      compressedPath: '/tmp/denied.jpg'
    })

    expect(result).toEqual({
      saved: false,
      reason: 'permission_denied',
      err
    })
    expect(global.wx.showToast).not.toHaveBeenCalled()
  })
})
