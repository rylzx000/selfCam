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

  test('batch saves unique valid photo paths and summarizes failures without per-photo toast', async () => {
    const album = loadAlbum()
    const err = { errMsg: 'saveImageToPhotosAlbum:fail system error' }

    global.wx = {
      saveImageToPhotosAlbum: jest.fn(({ filePath, success, fail }) => {
        if (filePath === '/tmp/failed.jpg') {
          fail(err)
          return
        }

        success()
      }),
      showToast: jest.fn()
    }

    const result = await album.savePhotosToAlbumBatch([
      { localPhotoId: 'photo-a', compressedPath: '/tmp/saved.jpg' },
      { localPhotoId: 'photo-a-duplicate', compressedPath: '/tmp/saved.jpg' },
      { localPhotoId: 'photo-b', compressedPath: '/tmp/failed.jpg' },
      { localPhotoId: 'missing-path' }
    ])

    expect(result).toEqual(expect.objectContaining({
      total: 2,
      saved: 1,
      failed: 1,
      permissionDenied: 0
    }))
    expect(result.results).toEqual([
      expect.objectContaining({
        localPhotoId: 'photo-a',
        filePath: '/tmp/saved.jpg',
        saved: true
      }),
      expect.objectContaining({
        localPhotoId: 'photo-b',
        filePath: '/tmp/failed.jpg',
        saved: false,
        reason: 'save_failed'
      })
    ])
    expect(global.wx.saveImageToPhotosAlbum).toHaveBeenCalledTimes(2)
    expect(global.wx.showToast).not.toHaveBeenCalled()
  })

  test('batch records permission denied without blocking the remaining save attempts', async () => {
    const album = loadAlbum()
    const deniedErr = { errMsg: 'saveImageToPhotosAlbum:fail auth deny' }

    global.wx = {
      saveImageToPhotosAlbum: jest.fn(({ filePath, success, fail }) => {
        if (filePath === '/tmp/denied.jpg') {
          fail(deniedErr)
          return
        }

        success()
      }),
      showToast: jest.fn()
    }

    const result = await album.savePhotosToAlbumBatch([
      { localPhotoId: 'denied', compressedPath: '/tmp/denied.jpg' },
      { localPhotoId: 'saved', compressedPath: '/tmp/saved-after-denied.jpg' }
    ])

    expect(result).toEqual(expect.objectContaining({
      total: 2,
      saved: 1,
      failed: 1,
      permissionDenied: 1
    }))
    expect(result.results.map((item) => item.reason)).toEqual(['permission_denied', undefined])
    expect(global.wx.saveImageToPhotosAlbum).toHaveBeenCalledTimes(2)
    expect(global.wx.showToast).not.toHaveBeenCalled()
  })
})
