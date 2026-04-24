describe('storage safe resume and fault injection', () => {
  let storage
  let schema
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
    jest.useRealTimers()
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
    schema = require('../utils/storage-schema')
    constants = require('../utils/constants')
  })

  afterEach(() => {
    jest.useRealTimers()
    delete global.wx
  })

  test('returns null for missing cache even when using safe resume entry', () => {
    expect(storage.loadCacheForResume()).toBeNull()
  })

  test('drops stale retake residue after long suspend and falls back to preview', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T12:00:00.000Z'))

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
    cache.updatedAt = '2026-04-24T11:57:00.000Z'
    cache.workflowState = {
      current: 'RETAKING',
      updatedAt: '2026-04-24T11:57:00.000Z'
    }

    const resolved = schema.resolveSafeResumeCache(cache)

    expect(resolved.reasons).toContain('stale_retake_context')
    expect(resolved.cache.retakeMode.enabled).toBe(false)
    expect(resolved.cache.currentStep).toBe(constants.SHOOT_STEP.PREVIEW)
    expect(resolved.cache.workflowState.current).toBe('PREVIEWING')
  })

  test('preserves fresh documenting context when document facts still exist', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T12:00:00.000Z'))

    const cache = storage.initCache()
    cache.documents = [{ compressedPath: '/doc-1.jpg' }]
    cache.updatedAt = '2026-04-24T11:59:30.000Z'
    cache.workflowState = {
      current: 'DOCUMENTING',
      updatedAt: '2026-04-24T11:59:30.000Z'
    }

    const safeCache = schema.getSafeResumeCache(cache)

    expect(safeCache.documents).toHaveLength(1)
    expect(safeCache.workflowState.current).toBe('DOCUMENTING')
    expect(safeCache.fromPreview).toBe(false)
    expect(safeCache.retakeMode.enabled).toBe(false)
  })

  test('clears confirming state into capturing instead of restoring transient modal state', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.workflowState = {
      current: 'CONFIRMING',
      updatedAt: cache.updatedAt
    }

    const resolved = schema.resolveSafeResumeCache(cache)

    expect(resolved.reasons).toContain('confirming_state_cleared')
    expect(resolved.cache.workflowState.current).toBe('CAPTURING')
    expect(resolved.cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
  })

  test('clearTransientContext removes preview and retake residue conservatively', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    cache.fromPreview = true
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: 0,
      photoType: constants.PHOTO_TYPE.DAMAGE,
      damageIndex: 0
    }
    cache.workflowState = {
      current: 'LOCAL_COMPLETED',
      updatedAt: cache.updatedAt
    }

    const cleared = storage.clearTransientContext(cache)

    expect(cleared.currentStep).toBe(constants.SHOOT_STEP.PREVIEW)
    expect(cleared.workflowState.current).toBe('PREVIEWING')
    expect(cleared.fromPreview).toBe(false)
    expect(cleared.retakeMode.enabled).toBe(false)
  })

  test('clearCompletionContext resets empty shell to idle baseline', () => {
    const cleared = storage.clearCompletionContext(storage.initCache())

    expect(cleared.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(cleared.currentVehicleIndex).toBe(0)
    expect(cleared.workflowState.current).toBe('IDLE')
    expect(cleared.fromPreview).toBe(false)
    expect(cleared.retakeMode.enabled).toBe(false)
  })

  test('safe resume entry persists repaired cache after stale preview flag cleanup', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T12:00:00.000Z'))

    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.fromPreview = true
    cache.updatedAt = '2026-04-24T11:58:00.000Z'
    cache.workflowState = {
      current: 'CAPTURING',
      updatedAt: '2026-04-24T11:58:00.000Z'
    }
    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(cache)

    const safeCache = storage.loadCacheForResume()
    const persisted = JSON.parse(memoryStorage[storage.STORAGE_KEY])

    expect(safeCache.fromPreview).toBe(false)
    expect(safeCache.workflowState.current).toBe('CAPTURING')
    expect(persisted.fromPreview).toBe(false)
    expect(persisted.workflowState.current).toBe('CAPTURING')
  })
})
