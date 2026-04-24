describe('storage cache governance', () => {
  let storage
  let constants
  let memoryStorage

  function createCompletedVehicle(index, damageCount = 1) {
    const vehicle = storage.createVehicle(index)
    vehicle.licensePlate = {
      compressedPath: `/plate-${index}.jpg`,
      status: 'completed'
    }
    vehicle.vinCode = {
      compressedPath: `/vin-${index}.jpg`,
      status: 'completed'
    }
    vehicle.damages = Array.from({ length: damageCount }, (_, damageIndex) => ({
      compressedPath: `/damage-${index}-${damageIndex}.jpg`
    }))
    return vehicle
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
      }
    }

    storage = require('../utils/storage')
    constants = require('../utils/constants')
  })

  afterEach(() => {
    delete global.wx
  })

  test('keeps null for missing cache to preserve existing page compatibility', () => {
    expect(storage.loadCache()).toBeNull()
  })

  test('writes schemaVersion for new cache', () => {
    const cache = storage.initCache()
    storage.saveCache(cache)

    const savedCache = storage.loadCache()

    expect(savedCache.schemaVersion).toBe(storage.CACHE_SCHEMA_VERSION)
    expect(savedCache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(savedCache.workflowState.current).toBe('IDLE')
  })

  test('migrates and sanitizes legacy cache before returning it', () => {
    const checkpointAt = '2026-04-23T00:00:00.000Z'
    const legacyCache = {
      vehicles: [
        {
          id: '',
          type: '',
          licensePlate: {
            compressedPath: '/plate.jpg'
          },
          vinCode: {
            status: 'completed'
          },
          damages: [
            { compressedPath: '/damage.jpg' },
            { bad: true }
          ]
        }
      ],
      documents: [
        { compressedPath: '/doc.jpg' },
        { foo: 'bar' }
      ],
      currentStep: 'unknown_step',
      currentVehicleIndex: 99,
      currentDamageCount: -1,
      retakeMode: {
        enabled: true,
        vehicleIndex: 0,
        photoType: constants.PHOTO_TYPE.DAMAGE,
        damageIndex: 9
      },
      workflowState: 'PREVIEWING',
      fromPreview: 'yes',
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: checkpointAt
    }

    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(legacyCache)

    const cache = storage.loadCache()
    const persistedCache = JSON.parse(memoryStorage[storage.STORAGE_KEY])

    expect(cache.schemaVersion).toBe(storage.CACHE_SCHEMA_VERSION)
    expect(cache.vehicles).toHaveLength(1)
    expect(cache.documents).toHaveLength(1)
    expect(cache.vehicles[0].id).toBeTruthy()
    expect(cache.vehicles[0].type).toBeTruthy()
    expect(cache.vehicles[0].licensePlate.status).toBe('completed')
    expect(cache.vehicles[0].vinCode.status).toBe('pending')
    expect(cache.vehicles[0].damages).toHaveLength(1)
    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.VIN_CODE)
    expect(cache.currentDamageCount).toBe(1)
    expect(cache.retakeMode.enabled).toBe(false)
    expect(cache.workflowState).toEqual({
      current: 'PREVIEWING',
      updatedAt: checkpointAt
    })
    expect(cache.fromPreview).toBe(false)
    expect(storage.validateCache(cache).valid).toBe(true)
    expect(persistedCache.updatedAt).toBe(checkpointAt)
    expect(persistedCache.workflowState.updatedAt).toBe(checkpointAt)
  })

  test('keeps valid retake mode and aligns current step and vehicle index', () => {
    const cache = storage.initCache()
    cache.vehicles.push(storage.createVehicle(0))
    cache.vehicles.push(storage.createVehicle(1))
    cache.vehicles[1].licensePlate = {
      compressedPath: '/plate-2.jpg',
      status: 'completed'
    }
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: 1,
      photoType: constants.PHOTO_TYPE.LICENSE_PLATE,
      damageIndex: null
    }

    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(cache)

    const repairedCache = storage.loadCache()

    expect(repairedCache.currentVehicleIndex).toBe(1)
    expect(repairedCache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(repairedCache.retakeMode.enabled).toBe(true)
    expect(repairedCache.retakeMode.vehicleIndex).toBe(1)
  })

  test('falls back to a safe empty cache when stored json is malformed', () => {
    memoryStorage[storage.STORAGE_KEY] = '{bad json'

    const cache = storage.loadCache()

    expect(cache.schemaVersion).toBe(storage.CACHE_SCHEMA_VERSION)
    expect(cache.vehicles).toEqual([])
    expect(cache.documents).toEqual([])
    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
  })

  test('clears stale retake context during safe resume and falls back to preview', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 2))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: 0,
      photoType: constants.PHOTO_TYPE.DAMAGE,
      damageIndex: 1
    }
    cache.workflowState = {
      current: 'RETAKING',
      updatedAt: '2000-01-01T00:00:00.000Z'
    }
    cache.updatedAt = '2000-01-01T00:00:00.000Z'

    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(cache)

    const safeCache = storage.loadCacheForResume()

    expect(safeCache.retakeMode.enabled).toBe(false)
    expect(safeCache.fromPreview).toBe(false)
    expect(safeCache.currentStep).toBe(constants.SHOOT_STEP.PREVIEW)
    expect(safeCache.workflowState.current).toBe('PREVIEWING')
  })

  test('clears stale preview flag during safe resume but keeps capture step', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.fromPreview = true
    cache.workflowState = {
      current: 'CAPTURING',
      updatedAt: '2000-01-01T00:00:00.000Z'
    }
    cache.updatedAt = '2000-01-01T00:00:00.000Z'

    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(cache)

    const safeCache = storage.loadCacheForResume()

    expect(safeCache.fromPreview).toBe(false)
    expect(safeCache.retakeMode.enabled).toBe(false)
    expect(safeCache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(safeCache.workflowState.current).toBe('CAPTURING')
  })

  test('downgrades stale completion context to preview during safe resume', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    cache.workflowState = {
      current: 'LOCAL_COMPLETED',
      updatedAt: '2000-01-01T00:00:00.000Z'
    }
    cache.updatedAt = '2000-01-01T00:00:00.000Z'

    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(cache)

    const safeCache = storage.loadCacheForResume()

    expect(safeCache.currentStep).toBe(constants.SHOOT_STEP.PREVIEW)
    expect(safeCache.workflowState.current).toBe('PREVIEWING')
    expect(safeCache.fromPreview).toBe(false)
  })

  test('keeps fresh retake context during safe resume', () => {
    const freshTimestamp = new Date().toISOString()
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: 0,
      photoType: constants.PHOTO_TYPE.DAMAGE,
      damageIndex: 0
    }
    cache.workflowState = {
      current: 'RETAKING',
      updatedAt: freshTimestamp
    }
    cache.updatedAt = freshTimestamp

    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(cache)

    const safeCache = storage.loadCacheForResume()

    expect(safeCache.retakeMode.enabled).toBe(true)
    expect(safeCache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
  })
})
