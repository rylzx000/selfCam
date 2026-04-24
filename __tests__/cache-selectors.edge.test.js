describe('cache selectors edge cases', () => {
  let storage
  let selectors
  let constants

  function createVehicle(index, options = {}) {
    const vehicle = storage.createVehicle(index)

    if (options.licensePlate) {
      vehicle.licensePlate = {
        compressedPath: `/plate-${index}.jpg`,
        status: 'completed'
      }
    }

    if (options.vinCode) {
      vehicle.vinCode = {
        compressedPath: `/vin-${index}.jpg`,
        status: 'completed'
      }
    }

    if (typeof options.damageCount === 'number') {
      vehicle.damages = Array.from({ length: options.damageCount }, (_, damageIndex) => ({
        compressedPath: `/damage-${index}-${damageIndex}.jpg`
      }))
    }

    return vehicle
  }

  beforeEach(() => {
    jest.resetModules()
    global.wx = {
      env: {
        USER_DATA_PATH: '/tmp'
      },
      getStorageSync() {
        return null
      },
      setStorageSync() {},
      removeStorageSync() {}
    }

    storage = require('../utils/storage')
    selectors = require('../utils/cache-selectors')
    constants = require('../utils/constants')
  })

  afterEach(() => {
    delete global.wx
  })

  test('keeps summary stable when fields are missing or malformed', () => {
    const cache = {
      vehicles: [
        {
          type: 'target',
          licensePlate: {},
          vinCode: null,
          damages: null
        }
      ],
      documents: null,
      currentVehicleIndex: 9,
      currentStep: 'not_a_step',
      workflowState: null
    }

    const summary = selectors.getCacheSummary(cache)

    expect(summary.vehicleCount).toBe(1)
    expect(summary.documentCount).toBe(0)
    expect(summary.totalPhotos).toBe(0)
    expect(summary.photoCounts).toEqual({
      licensePlate: 0,
      vinCode: 0,
      damage: 0,
      document: 0,
      total: 0
    })
    expect(summary.flowContext.currentVehicleIndex).toBe(0)
    expect(summary.flowContext.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(summary.flowContext.workflowState).toBe('IDLE')
  })

  test('ignores invalid retake context and anchors flow to current vehicle summary', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createVehicle(0, { licensePlate: true, vinCode: true, damageCount: 1 }))
    cache.vehicles.push(createVehicle(1, { licensePlate: true }))
    cache.currentVehicleIndex = 1
    cache.currentStep = constants.SHOOT_STEP.VIN_CODE
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: 1,
      photoType: constants.PHOTO_TYPE.DAMAGE,
      damageIndex: 99
    }

    const flowContext = selectors.getCurrentFlowContext(cache)

    expect(selectors.hasRetakeContext(cache)).toBe(false)
    expect(flowContext.hasRetakeContext).toBe(false)
    expect(flowContext.currentVehicleIndex).toBe(1)
    expect(flowContext.currentStep).toBe(constants.SHOOT_STEP.VIN_CODE)
    expect(flowContext.currentVehicle.type).toBe(cache.vehicles[1].type)
  })

  test('marks incomplete and unfinished workflow reasons independently in complete summary', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createVehicle(0, { licensePlate: true }))
    cache.workflowState = {
      current: 'PREVIEWING',
      updatedAt: cache.updatedAt
    }

    const summary = selectors.getCacheSummary(cache)

    expect(summary.shouldSuggestBackToEdit).toBe(true)
    expect(summary.shouldSuggestBackToEditReasons).toEqual(expect.arrayContaining([
      'incomplete_vehicle',
      'workflow_not_completed'
    ]))
  })

  test('clamps document remaining count and vehicle index at boundaries', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createVehicle(0, { licensePlate: true, vinCode: true, damageCount: 5 }))
    cache.currentVehicleIndex = 7
    cache.documents = Array.from({ length: constants.LIMITS.MAX_DOCUMENTS + 2 }, (_, index) => ({
      compressedPath: `/doc-${index}.jpg`
    }))

    const documentSummary = selectors.getDocumentSummary(cache)
    const vehicleSummary = selectors.getVehicleSummary(cache)

    expect(documentSummary.count).toBe(constants.LIMITS.MAX_DOCUMENTS + 2)
    expect(documentSummary.remainingCount).toBe(0)
    expect(vehicleSummary.currentVehicleIndex).toBe(0)
    expect(vehicleSummary.photoCounts.total).toBe(7)
  })

  test('does not mutate source cache while building summaries', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createVehicle(0, { licensePlate: true, vinCode: true, damageCount: 2 }))
    cache.documents = [{ compressedPath: '/doc-1.jpg' }]
    const snapshot = JSON.stringify(cache)

    selectors.getVehicleSummary(cache)
    selectors.getDocumentSummary(cache)
    selectors.getCurrentFlowContext(cache)
    selectors.getCacheSummary(cache)

    expect(JSON.stringify(cache)).toBe(snapshot)
  })
})
