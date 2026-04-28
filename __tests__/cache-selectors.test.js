describe('cache selectors', () => {
  let storage
  let selectors
  let constants

  function createQuality(overrides = {}) {
    return {
      level: 'good',
      suggestRetake: false,
      reasons: [],
      metrics: {
        brightness: 0.52,
        darkRatio: 0.1,
        brightRatio: 0.05,
        blurScore: 0.62,
        contrast: 0.2,
        sampledWidth: 320,
        sampledHeight: 240
      },
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'test-config',
      ...overrides
    }
  }

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
    storage = require('../utils/storage')
    selectors = require('../utils/cache-selectors')
    constants = require('../utils/constants')
  })

  test('builds cache summary with shared counts and preview progress', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, constants.LIMITS.MAX_DAMAGES))
    cache.vehicles.push(createCompletedVehicle(1, 2))
    cache.documents = [
      { compressedPath: '/doc-1.jpg' },
      { compressedPath: '/doc-2.jpg' }
    ]
    cache.currentVehicleIndex = 1
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.workflowState = {
      current: 'LOCAL_COMPLETED',
      updatedAt: cache.updatedAt
    }

    const summary = selectors.getCacheSummary(cache)

    expect(summary.vehicleCount).toBe(2)
    expect(summary.damagePhotoCount).toBe(7)
    expect(summary.documentCount).toBe(2)
    expect(summary.documentPhotoCount).toBe(2)
    expect(summary.photoCounts).toEqual({
      licensePlate: 2,
      vinCode: 2,
      damage: 7,
      document: 2,
      total: 13
    })
    expect(summary.totalPhotos).toBe(13)
    expect(summary.progress).toEqual({
      step1: 2,
      step2: 1,
      step3: true
    })
    expect(summary.canAddThirdVehicle).toBe(true)
    expect(summary.shouldSuggestBackToEdit).toBe(false)
    expect(summary.qualitySummary).toEqual(expect.objectContaining({
      totalPhotos: 13,
      analyzedCount: 0,
      riskCount: 0,
      suggestRetakeCount: 0,
      riskReasons: []
    }))
  })

  test('prefers retake context when resolving current flow', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: 0,
      photoType: constants.PHOTO_TYPE.VIN_CODE,
      damageIndex: null
    }

    const flowContext = selectors.getCurrentFlowContext(cache)
    const summary = selectors.getCacheSummary(cache)

    expect(selectors.hasRetakeContext(cache)).toBe(true)
    expect(flowContext.hasRetakeContext).toBe(true)
    expect(flowContext.currentStep).toBe(constants.SHOOT_STEP.VIN_CODE)
    expect(flowContext.currentVehicleIndex).toBe(0)
    expect(flowContext.currentVehicleType).toBe(cache.vehicles[0].type)
    expect(summary.hasRetakeContext).toBe(true)
    expect(summary.shouldSuggestBackToEdit).toBe(true)
    expect(summary.shouldSuggestBackToEditReasons).toContain('retake_context')
  })

  test('returns safe document summary for empty cache', () => {
    const documentSummary = selectors.getDocumentSummary(null)

    expect(documentSummary.documents).toEqual([])
    expect(documentSummary.count).toBe(0)
    expect(documentSummary.remainingCount).toBe(constants.LIMITS.MAX_DOCUMENTS)
    expect(documentSummary.photoEntries).toEqual([])
  })

  test('builds quality summary with zero risks when analyzed photos are all good', () => {
    const cache = storage.initCache()
    const vehicle = createCompletedVehicle(0, 1)

    vehicle.licensePlate.quality = createQuality()
    vehicle.vinCode.quality = createQuality()
    vehicle.damages[0].quality = createQuality()
    cache.vehicles.push(vehicle)
    cache.documents = [
      {
        compressedPath: '/doc-1.jpg',
        quality: createQuality()
      }
    ]

    const qualitySummary = selectors.getQualitySummary(cache)
    const summary = selectors.getCacheSummary(cache)

    expect(qualitySummary).toEqual(expect.objectContaining({
      totalPhotos: 4,
      analyzedCount: 4,
      riskCount: 0,
      suggestRetakeCount: 0,
      riskReasons: []
    }))
    expect(qualitySummary.riskPhotos).toEqual([])
    expect(summary.qualitySummary).toEqual(qualitySummary)
  })
})
