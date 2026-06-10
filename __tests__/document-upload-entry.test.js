describe('document page upload entry', () => {
  let storage
  let constants
  let pageConfig
  let memoryStorage

  function createPageInstance(config) {
    return {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
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
    return vehicle
  }

  function loadDocumentPage() {
    pageConfig = null
    jest.isolateModules(() => {
      require('../packageD/pages/document/document')
    })
    const page = createPageInstance(pageConfig)
    page.loadData()
    return page
  }

  beforeEach(() => {
    jest.resetModules()
    memoryStorage = {}

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
      navigateBack: jest.fn(),
      chooseMedia: jest.fn(),
      previewImage: jest.fn()
    }

    global.Page = jest.fn((config) => {
      pageConfig = config
    })

    storage = require('../packageD/utils/storage')
    constants = require('../packageD/utils/constants')
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
  })

  test('starts cached upload session and returns to preview instead of complete page', () => {
    const cache = storage.initCache()
    cache.vehicles.push(completeVehicle(0))
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    storage.saveCache(cache)
    const page = loadDocumentPage()

    page.onSubmit()

    const savedCache = storage.loadCache()
    expect(savedCache.uploadSession).toEqual(expect.objectContaining({
      phase: 'uploading',
      total: 3
    }))
    expect(savedCache.currentStep).toBe(constants.SHOOT_STEP.PREVIEW)
    expect(global.wx.redirectTo).toHaveBeenCalledWith({
      url: '/packageD/pages/preview/preview'
    })
    expect(global.wx.redirectTo).not.toHaveBeenCalledWith({
      url: '/packageD/pages/complete/complete'
    })
  })
})
