describe('preview final album save flow', () => {
  let storage
  let constants
  let documents
  let album
  let permission
  let pageConfig
  let memoryStorage

  function createPageInstance(config) {
    return {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      isLeaving: false,
      setData(updates, callback) {
        this.data = {
          ...this.data,
          ...updates
        }
        if (typeof callback === 'function') {
          callback()
        }
      }
    }
  }

  function completeVehicle(index, options = {}) {
    const vehicle = storage.createVehicle(index)
    vehicle.licensePlate = {
      status: 'completed',
      compressedPath: `/plate-${index}.jpg`,
      localPhotoId: `plate-${index}`
    }
    vehicle.vinCode = {
      status: 'completed',
      compressedPath: `/vin-${index}.jpg`,
      localPhotoId: `vin-${index}`
    }
    vehicle.damages = [
      {
        compressedPath: `/damage-${index}.jpg`,
        localPhotoId: `damage-${index}`
      }
    ]

    if (options.drivingLicenseComplete) {
      vehicle.documentSelections[documents.DOCUMENT_TYPES.DRIVING_LICENSE] = documents.DOCUMENT_SELECTIONS.ELECTRONIC
      vehicle.documents = [
        {
          docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
          docSide: documents.DRIVING_LICENSE_SIDES.ELECTRONIC,
          label: '电子行驶证',
          sourceType: options.drivingLicenseSourceType || 'album',
          compressedPath: `/license-${index}.jpg`,
          localPhotoId: `license-${index}`
        }
      ]
    }

    return vehicle
  }

  function saveCacheWithVehicles(vehicleCount, options = {}) {
    const cache = storage.initCache()
    for (let index = 0; index < vehicleCount; index += 1) {
      cache.vehicles.push(completeVehicle(index, options))
    }
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    storage.saveCache(cache)
    return storage.loadCache()
  }

  function loadPreviewPage() {
    pageConfig = null
    jest.isolateModules(() => {
      require('../pages/preview/preview')
    })

    const page = createPageInstance(pageConfig)
    page.loadData()
    return page
  }

  function expectUploadOverlayStarted(page, expectedTotal) {
    try {
      const cache = storage.loadCache()

      expect(page.data.showUploadOverlay).toBe(true)
      expect(page.data.uploadOverlayTitle).toBe('正在上传照片')
      expect(cache.uploadSession).toEqual(expect.objectContaining({
        phase: 'uploading',
        total: expectedTotal
      }))
      expect(global.wx.redirectTo).not.toHaveBeenCalledWith({
        url: '/pages/complete/complete'
      })
    } finally {
      page.onUnload()
    }
  }

  beforeEach(() => {
    jest.resetModules()
    memoryStorage = {}

    jest.doMock('../utils/album', () => ({
      savePhotosToAlbumBatch: jest.fn(async (candidates) => ({
        total: candidates.length,
        saved: candidates.length,
        failed: 0,
        permissionDenied: 0,
        results: candidates.map((candidate) => ({
          localPhotoId: candidate.localPhotoId,
          filePath: candidate.filePath,
          saved: true
        }))
      }))
    }))

    jest.doMock('../utils/permission', () => ({
      ensureAlbumSavePermission: jest.fn(async () => true)
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
      showToast: jest.fn(),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showModal: jest.fn(),
      redirectTo: jest.fn(),
      navigateTo: jest.fn(),
      previewImage: jest.fn()
    }

    global.Page = jest.fn((config) => {
      pageConfig = config
    })

    storage = require('../utils/storage')
    constants = require('../utils/constants')
    documents = require('../utils/documents')
    album = require('../utils/album')
    permission = require('../utils/permission')
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../utils/album')
    jest.dontMock('../utils/permission')
  })

  test('shows final album save prompt after third vehicle and driving license confirmations', () => {
    saveCacheWithVehicles(1, { drivingLicenseComplete: false })
    const page = loadPreviewPage()

    page.onSubmit()
    expect(page.data.modalType).toBe('thirdVehicle')

    page.onModalConfirm()
    expect(page.data.modalType).toBe('drivingLicenseRisk')

    page.onModalConfirm()
    expect(page.data.modalType).toBe('albumSaveConfirm')
    expect(page.data.modalContent).toBe('是否保存全部图片至手机相册？建议保存，便于后续案件处理。')
    expect(permission.ensureAlbumSavePermission).not.toHaveBeenCalled()
  })

  test('blocks damage supplement from preview when vehicle already has max damages', () => {
    const cache = saveCacheWithVehicles(1, { drivingLicenseComplete: true })
    cache.vehicles[0].damages = Array.from({ length: constants.LIMITS.MAX_DAMAGES }, (_, index) => ({
      compressedPath: `/damage-full-${index}.jpg`,
      localPhotoId: `damage-full-${index}`
    }))
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    storage.saveCache(cache)
    const page = loadPreviewPage()

    page.onAddDamage({
      currentTarget: {
        dataset: { vehicle: 0 }
      }
    })

    const latestCache = storage.loadCache()
    expect(latestCache.currentStep).toBe(constants.SHOOT_STEP.PREVIEW)
    expect(latestCache.vehicles[0].damages).toHaveLength(constants.LIMITS.MAX_DAMAGES)
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(global.wx.showToast).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'none'
    }))
  })

  test('skips album save and completes when user cancels final save prompt', () => {
    saveCacheWithVehicles(3, { drivingLicenseComplete: true })
    const page = loadPreviewPage()

    page.onSubmit()
    expect(page.data.modalType).toBe('albumSaveConfirm')

    page.onModalCancel()

    const cache = storage.loadCache()
    expect(permission.ensureAlbumSavePermission).not.toHaveBeenCalled()
    expect(album.savePhotosToAlbumBatch).not.toHaveBeenCalled()
    expect(cache.albumSaveSummary).toEqual(expect.objectContaining({
      decision: 'skipped',
      total: 9,
      saved: 0,
      failed: 0
    }))
    expectUploadOverlayStarted(page, 12)
  })

  test('saves current candidates after permission is granted and records saved photos', async () => {
    saveCacheWithVehicles(3, {
      drivingLicenseComplete: true,
      drivingLicenseSourceType: 'camera'
    })
    const page = loadPreviewPage()

    page.onSubmit()
    await page.onModalConfirm()

    const cache = storage.loadCache()
    expect(permission.ensureAlbumSavePermission).toHaveBeenCalledTimes(1)
    expect(album.savePhotosToAlbumBatch).toHaveBeenCalledTimes(1)
    expect(album.savePhotosToAlbumBatch.mock.calls[0][0]).toHaveLength(12)
    expect(Object.keys(cache.albumSaveRecords)).toHaveLength(12)
    expect(cache.albumSaveRecords['plate-0']).toEqual(expect.objectContaining({
      status: 'saved',
      filePath: '/plate-0.jpg'
    }))
    expect(cache.albumSaveSummary).toEqual(expect.objectContaining({
      decision: 'saved',
      total: 12,
      saved: 12,
      failed: 0
    }))
    expectUploadOverlayStarted(page, 12)
  })

  test('completes without saving when final album permission is denied', async () => {
    permission.ensureAlbumSavePermission.mockResolvedValueOnce(false)
    saveCacheWithVehicles(3, { drivingLicenseComplete: true })
    const page = loadPreviewPage()

    page.onSubmit()
    await page.onModalConfirm()

    const cache = storage.loadCache()
    expect(album.savePhotosToAlbumBatch).not.toHaveBeenCalled()
    expect(cache.albumSaveSummary).toEqual(expect.objectContaining({
      decision: 'permission_denied',
      total: 9,
      saved: 0,
      failed: 9,
      permissionDenied: 9
    }))
    expectUploadOverlayStarted(page, 12)
  })

  test('does not prompt when all current photos were already saved', () => {
    const cache = saveCacheWithVehicles(3, { drivingLicenseComplete: true })
    cache.vehicles.forEach((vehicle) => {
      ;[vehicle.licensePlate, vehicle.vinCode].forEach((photo) => {
        cache.albumSaveRecords[photo.localPhotoId] = {
          status: 'saved',
          filePath: photo.compressedPath
        }
      })
      vehicle.damages.forEach((photo) => {
        cache.albumSaveRecords[photo.localPhotoId] = {
          status: 'saved',
          filePath: photo.compressedPath
        }
      })
    })
    storage.saveCache(cache)
    const page = loadPreviewPage()

    page.onSubmit()

    expect(page.data.showModal).toBe(false)
    expect(album.savePhotosToAlbumBatch).not.toHaveBeenCalled()
    expectUploadOverlayStarted(page, 12)
  })

  test('after returning to edit, saves only replaced photos with new identity', async () => {
    const cache = saveCacheWithVehicles(3, { drivingLicenseComplete: true })
    cache.vehicles.forEach((vehicle) => {
      ;[vehicle.licensePlate, vehicle.vinCode].forEach((photo) => {
        cache.albumSaveRecords[photo.localPhotoId] = {
          status: 'saved',
          filePath: photo.compressedPath
        }
      })
      vehicle.damages.forEach((photo) => {
        cache.albumSaveRecords[photo.localPhotoId] = {
          status: 'saved',
          filePath: photo.compressedPath
        }
      })
    })
    cache.vehicles[0].licensePlate = {
      status: 'completed',
      compressedPath: '/plate-0-new.jpg',
      localPhotoId: 'plate-0-new'
    }
    storage.saveCache(cache)
    const page = loadPreviewPage()

    page.onSubmit()
    await page.onModalConfirm()

    expect(album.savePhotosToAlbumBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        localPhotoId: 'plate-0-new',
        filePath: '/plate-0-new.jpg'
      })
    ])
    page.onUnload()
  })
})
