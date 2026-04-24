describe('cache selectors', () => {
  let storage
  let selectors
  let constants

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
    expect(summary.documentCount).toBe(2)
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
})
