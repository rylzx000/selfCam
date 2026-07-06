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
      vehicle.documentSelections[documents.DOCUMENT_TYPES.DRIVER_LICENSE] = documents.DOCUMENT_SELECTIONS.ELECTRONIC
      vehicle.documentSelections[documents.DOCUMENT_TYPES.DRIVING_LICENSE] = documents.DOCUMENT_SELECTIONS.ELECTRONIC
      vehicle.documents = [
        {
          docType: documents.DOCUMENT_TYPES.DRIVER_LICENSE,
          docSide: documents.DRIVER_LICENSE_SIDES.ELECTRONIC,
          label: '?????',
          sourceType: options.drivingLicenseSourceType || 'album',
          compressedPath: `/driver-license-${index}.jpg`,
          localPhotoId: `driver-license-${index}`
        },
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
      require('../packageD/pages/preview/preview')
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
        url: '/packageD/pages/complete/complete'
      })
    } finally {
      page.onUnload()
    }
  }

  beforeEach(() => {
    jest.resetModules()
    memoryStorage = {}

    jest.doMock('../packageD/utils/album', () => ({
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

    jest.doMock('../packageD/utils/permission', () => ({
      ensureAlbumSavePermission: jest.fn(async () => true)
    }))

    jest.doMock('../packageD/utils/aux-photo-api', () => ({
      uploadPhoto: jest.fn(async (item) => ({
        success: true,
        code: '0000',
        message: 'ok',
        data: {
          uploadRecordId: `${item.id}-record`,
          photoId: `${item.id}-photo`,
          vehicleId: item.vehicleId,
          uploadItemId: item.uploadItemId,
          photoType: item.photoType,
          duplicate: false,
          itemUploadedCount: item.sortNo || 1,
          ticketStatus: 'UPLOADING'
        }
      })),
      complete: jest.fn(async ({ ticket, clientUploadCount }) => ({
        success: true,
        code: '0000',
        message: 'ok',
        data: {
          ticket,
          ticketStatus: 'COMPLETED',
          uploadedCount: clientUploadCount,
          requiredPassed: true,
          missingItems: [],
          completeTime: '2026-05-26 10:30:00',
          phase2TriggerStatus: 'NOT_ENABLED'
        }
      }))
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

    storage = require('../packageD/utils/storage')
    constants = require('../packageD/utils/constants')
    documents = require('../packageD/utils/documents')
    album = require('../packageD/utils/album')
    permission = require('../packageD/utils/permission')
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../packageD/utils/album')
    jest.dontMock('../packageD/utils/permission')
    jest.dontMock('../packageD/utils/aux-photo-api')
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
    expectUploadOverlayStarted(page, 15)
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
    expect(album.savePhotosToAlbumBatch.mock.calls[0][0]).toHaveLength(15)
    expect(Object.keys(cache.albumSaveRecords)).toHaveLength(15)
    expect(cache.albumSaveRecords['plate-0']).toEqual(expect.objectContaining({
      status: 'saved',
      filePath: '/plate-0.jpg'
    }))
    expect(cache.albumSaveSummary).toEqual(expect.objectContaining({
      decision: 'saved',
      total: 15,
      saved: 15,
      failed: 0
    }))
    expectUploadOverlayStarted(page, 15)
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
    expectUploadOverlayStarted(page, 15)
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
    expectUploadOverlayStarted(page, 15)
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
