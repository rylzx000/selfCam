describe('workflow-state', () => {
  let storage
  let workflow
  let constants
  let memoryStorage

  function createCache(overrides = {}) {
    const checkpointAt = '2026-04-23T00:00:00.000Z'
    const cache = storage.initCache()
    cache.vehicles.push(storage.createVehicle(0))
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

  test('returns IDLE when there is no active vehicle', () => {
    expect(workflow.inferStateFromCache(storage.initCache())).toBe(workflow.STATES.IDLE)
  })

  test('retake mode overrides stored preview state', () => {
    const cache = createCache({
      workflowState: {
        current: workflow.STATES.PREVIEWING,
        updatedAt: '2026-04-23T00:00:00.000Z'
      },
      retakeMode: {
        enabled: true,
        vehicleIndex: 0,
        photoType: constants.SHOOT_STEP.DAMAGE,
        damageIndex: 0
      }
    })

    expect(workflow.inferStateFromCache(cache)).toBe(workflow.STATES.RETAKING)
  })

  test('degrades stored CONFIRMING to CAPTURING during recovery', () => {
    const cache = createCache({
      workflowState: {
        current: workflow.STATES.CONFIRMING,
        updatedAt: '2026-04-23T00:00:00.000Z'
      }
    })

    expect(workflow.inferStateFromCache(cache)).toBe(workflow.STATES.CAPTURING)
  })

  test('keeps stable preview checkpoint when not leaving preview', () => {
    const cache = createCache({
      workflowState: {
        current: workflow.STATES.PREVIEWING,
        updatedAt: '2026-04-23T00:00:00.000Z'
      },
      fromPreview: false
    })

    expect(workflow.inferStateFromCache(cache)).toBe(workflow.STATES.PREVIEWING)
  })

  test('prefers capture facts when leaving preview for camera', () => {
    const cache = createCache({
      workflowState: {
        current: workflow.STATES.PREVIEWING,
        updatedAt: '2026-04-23T00:00:00.000Z'
      },
      fromPreview: true
    })

    expect(workflow.inferStateFromCache(cache)).toBe(workflow.STATES.CAPTURING)
  })

  test('does not restore DOCUMENTING without document facts', () => {
    const cache = createCache({
      documents: [],
      workflowState: {
        current: workflow.STATES.DOCUMENTING,
        updatedAt: '2026-04-23T00:00:00.000Z'
      }
    })

    expect(workflow.inferStateFromCache(cache)).toBe(workflow.STATES.CAPTURING)
  })

  test('does not prioritize restoring LOCAL_COMPLETED from stored state', () => {
    const freshCache = createCache({
      workflowState: {
        current: workflow.STATES.LOCAL_COMPLETED,
        updatedAt: '2026-04-23T00:00:00.000Z'
      }
    })
    const staleCache = createCache({
      updatedAt: '2026-04-23T00:00:10.500Z',
      workflowState: {
        current: workflow.STATES.LOCAL_COMPLETED,
        updatedAt: '2026-04-23T00:00:00.000Z'
      }
    })

    expect(workflow.inferStateFromCache(freshCache)).toBe(workflow.STATES.CAPTURING)
    expect(workflow.inferStateFromCache(staleCache)).toBe(workflow.STATES.CAPTURING)
  })

  test('does not persist CONFIRMING into cache', () => {
    const cache = createCache()
    storage.saveCache(cache)

    const result = workflow.transitionTo(workflow.STATES.CONFIRMING, {
      page: 'camera',
      step: constants.SHOOT_STEP.DAMAGE
    })
    const savedCache = storage.loadCache()

    expect(result.ok).toBe(true)
    expect(result.state).toBe(workflow.STATES.CONFIRMING)
    expect(savedCache.workflowState.current).toBe(workflow.STATES.CAPTURING)
    expect(savedCache.workflowState.payload).toBeUndefined()
  })

  test('persists only minimal checkpoint fields for stable states', () => {
    const cache = createCache()
    storage.saveCache(cache)

    workflow.transitionTo(workflow.STATES.PREVIEWING, {
      page: 'preview',
      debugOnly: 'should_not_persist'
    })
    const savedCache = storage.loadCache()

    expect(savedCache.workflowState.current).toBe(workflow.STATES.PREVIEWING)
    expect(typeof savedCache.workflowState.updatedAt).toBe('string')
    expect(savedCache.workflowState.payload).toBeUndefined()
    expect(savedCache.workflowState.previous).toBeUndefined()
  })
})
