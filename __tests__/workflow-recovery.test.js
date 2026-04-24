describe('workflow recovery edge cases', () => {
  let storage
  let workflow
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

  function createCache(overrides = {}) {
    const checkpointAt = '2026-04-24T10:00:00.000Z'
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.updatedAt = checkpointAt
    cache.workflowState = {
      current: workflow.STATES.CAPTURING,
      updatedAt: checkpointAt
    }

    return {
      ...cache,
      ...overrides
    }
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
    workflow = require('../utils/workflow-state')
    constants = require('../utils/constants')
  })

  afterEach(() => {
    delete global.wx
  })

  test('rejects unknown and illegal transitions without corrupting checkpoint', () => {
    const cache = createCache()
    storage.saveCache(cache)

    const unknown = workflow.transitionTo('NOT_A_STATE', { source: 'test' })
    const illegal = workflow.transitionTo(workflow.STATES.LOCAL_COMPLETED, { source: 'test' })
    const savedCache = storage.loadCache()

    expect(unknown.ok).toBe(false)
    expect(unknown.reason).toBe('UNKNOWN_STATE')
    expect(illegal.ok).toBe(false)
    expect(illegal.reason).toBe('ILLEGAL_TRANSITION')
    expect(savedCache.workflowState.current).toBe(workflow.STATES.CAPTURING)
  })

  test('prefers preview facts over stale historical state when current step is preview', () => {
    const cache = createCache({
      currentStep: constants.SHOOT_STEP.PREVIEW,
      workflowState: {
        current: workflow.STATES.IDLE,
        updatedAt: '2026-04-24T09:59:30.000Z'
      }
    })

    expect(workflow.inferStateFromCache(cache)).toBe(workflow.STATES.PREVIEWING)
  })

  test('restores DOCUMENTING only when document facts and fresh checkpoint both exist', () => {
    const freshCache = createCache({
      documents: [{ compressedPath: '/doc-1.jpg' }],
      workflowState: {
        current: workflow.STATES.DOCUMENTING,
        updatedAt: '2026-04-24T10:00:00.000Z'
      }
    })
    const staleCache = createCache({
      documents: [{ compressedPath: '/doc-1.jpg' }],
      updatedAt: '2026-04-24T10:00:20.000Z',
      workflowState: {
        current: workflow.STATES.DOCUMENTING,
        updatedAt: '2026-04-24T10:00:00.000Z'
      }
    })

    expect(workflow.inferStateFromCache(freshCache)).toBe(workflow.STATES.DOCUMENTING)
    expect(workflow.inferStateFromCache(staleCache)).toBe(workflow.STATES.CAPTURING)
  })

  test('sanitized invalid retake residue does not push current state into wrong flow', () => {
    const cache = createCache({
      retakeMode: {
        enabled: true,
        vehicleIndex: 0,
        photoType: constants.PHOTO_TYPE.DAMAGE,
        damageIndex: 9
      }
    })
    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(cache)

    const currentState = workflow.getCurrentState()
    const repairedCache = storage.loadCache()

    expect(currentState).toBe(workflow.STATES.CAPTURING)
    expect(repairedCache.retakeMode.enabled).toBe(false)
  })

  test('preview return flag still resolves to capturing when facts show leaving preview', () => {
    const cache = createCache({
      workflowState: {
        current: workflow.STATES.PREVIEWING,
        updatedAt: '2026-04-24T10:00:00.000Z'
      },
      fromPreview: true
    })

    expect(workflow.inferStateFromCache(cache)).toBe(workflow.STATES.CAPTURING)
  })
})
