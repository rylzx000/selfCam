describe('preview upload overlay flow', () => {
  let storage
  let constants
  let documents
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

  function completeVehicle(index) {
    const vehicle = storage.createVehicle(index)
    vehicle.displayName = index === 0 ? '标的车 京A12345' : `三者车 京B1234${index}`
    vehicle.vehicleId = `LOSS_VEHICLE_${index}`
    vehicle.uploadItems = [
      { uploadItemId: `V${index}_PLATE`, photoType: 'LICENSE_PLATE', photoName: '车牌', maxCount: 1 },
      { uploadItemId: `V${index}_VIN`, photoType: 'VIN', photoName: 'VIN', maxCount: 1 },
      { uploadItemId: `V${index}_DAMAGE`, photoType: 'DAMAGE', photoName: '车损', maxCount: 5 },
      { uploadItemId: `V${index}_LICENSE_ELECTRONIC`, photoType: 'DRIVING_LICENSE_ELECTRONIC', photoName: '电子行驶证', maxCount: 1 }
    ]
    vehicle.uploadItemsByPhotoType = vehicle.uploadItems.reduce((result, item) => {
      result[item.photoType] = item
      return result
    }, {})
    vehicle.licensePlate = {
      status: 'completed',
      source: 'album',
      compressedPath: `/plate-${index}.jpg`,
      localPhotoId: `plate-${index}`
    }
    vehicle.vinCode = {
      status: 'completed',
      source: 'album',
      compressedPath: `/vin-${index}.jpg`,
      localPhotoId: `vin-${index}`
    }
    vehicle.damages = [
      {
        source: 'album',
        compressedPath: `/damage-${index}.jpg`,
        localPhotoId: `damage-${index}`
      }
    ]
    vehicle.documentSelections[documents.DOCUMENT_TYPES.DRIVING_LICENSE] = documents.DOCUMENT_SELECTIONS.ELECTRONIC
    vehicle.documents = [
      {
        docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        docSide: documents.DRIVING_LICENSE_SIDES.ELECTRONIC,
        label: '电子行驶证',
        sourceType: 'album',
        compressedPath: `/license-${index}.jpg`,
        localPhotoId: `license-${index}`,
        vehicleId: vehicle.vehicleId,
        uploadItemId: `V${index}_LICENSE_ELECTRONIC`,
        photoType: 'DRIVING_LICENSE_ELECTRONIC'
      }
    ]
    return vehicle
  }

  function saveReadyPreviewCache(ticket = 'mock-2') {
    const cache = storage.initCache()
    cache.auxPhoto = {
      enabled: true,
      ticket
    }
    cache.vehicles.push(completeVehicle(0), completeVehicle(1), completeVehicle(2))
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    cache.workflowState = {
      current: 'PREVIEWING',
      updatedAt: cache.updatedAt
    }
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

  beforeEach(() => {
    jest.resetModules()
    memoryStorage = {}

    jest.doMock('../utils/album', () => ({
      savePhotosToAlbumBatch: jest.fn()
    }))

    jest.doMock('../utils/permission', () => ({
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
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../utils/album')
    jest.dontMock('../utils/permission')
  })

  test('starts local upload overlay instead of redirecting directly to complete page', () => {
    saveReadyPreviewCache('mock-2')
    const page = loadPreviewPage()

    try {
      page.onSubmit()

      const cache = storage.loadCache()
      expect(page.data.showUploadOverlay).toBe(true)
      expect(page.data.uploadOverlayTitle).toBe('正在上传照片')
      expect(page.data.uploadOverlayPrimaryVisible).toBe(false)
      expect(cache.uploadSession).toEqual(expect.objectContaining({
        phase: 'uploading',
        total: 12
      }))
      expect(global.wx.redirectTo).not.toHaveBeenCalledWith({
        url: '/pages/complete/complete'
      })
    } finally {
      page.onUnload()
    }
  })

  test('shows retry action for fail-once mock and retries failed item only', () => {
    saveReadyPreviewCache('mock-fail-once')
    const page = loadPreviewPage()

    try {
      page.onSubmit()
      let cache = storage.loadCache()
      const sessionId = cache.uploadSession.sessionId

      page.clearUploadMockTimer()
      page.processUploadMockStep(sessionId)

      cache = storage.loadCache()
      expect(cache.uploadSession).toEqual(expect.objectContaining({
        phase: 'failed',
        uploaded: 0,
        failed: 1
      }))
      expect(page.data.uploadOverlayTitle).toBe('有照片上传失败')
      expect(page.data.uploadOverlayPrimaryVisible).toBe(true)
      expect(page.data.uploadOverlayPrimaryText).toBe('重试上传')

      page.onUploadOverlayPrimaryTap()
      cache = storage.loadCache()
      expect(cache.uploadSession.items[0].status).toBe('pending')
      expect(cache.uploadSession.items[0].attempts).toBe(1)

      page.clearUploadMockTimer()
      page.processUploadMockStep(cache.uploadSession.sessionId)

      cache = storage.loadCache()
      expect(cache.uploadSession.items[0].status).toBe('success')
      expect(cache.uploadSession.items[0].attempts).toBe(2)
      expect(cache.uploadSession.uploaded).toBe(1)
      expect(cache.uploadSession.failed).toBe(0)
    } finally {
      page.onUnload()
    }
  })
})
