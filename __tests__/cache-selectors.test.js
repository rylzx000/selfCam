describe('cache selectors', () => {
  let storage
  let selectors
  let constants
  let documents

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
    documents = require('../utils/documents')
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

  test('keeps vehicle documents in photo list without preview mode or quality risk participation', () => {
    const cache = storage.initCache()
    const vehicle = createCompletedVehicle(0, 1)
    vehicle.documents = [
      {
        docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        docSide: documents.DOCUMENT_SIDES.FRONT_PAGE,
        label: '行驶证正页',
        sourceType: 'camera',
        compressedPath: '/license-front.jpg',
        quality: createQuality({
          level: 'warn',
          suggestRetake: true,
          reasons: ['blur']
        })
      }
    ]
    cache.vehicles.push(vehicle)

    const summary = selectors.getCacheSummary(cache)
    const vehicleDocumentEntry = summary.allPhotos.find((photo) => photo.type === 'vehicleDocument')

    expect(summary.documentPhotoCount).toBe(1)
    expect(vehicleDocumentEntry).toEqual(expect.objectContaining({
      type: 'vehicleDocument',
      docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
      docSide: documents.DOCUMENT_SIDES.FRONT_PAGE,
      url: '/license-front.jpg'
    }))
    expect(vehicleDocumentEntry.captureMode).toBeUndefined()
    expect(summary.qualitySummary.totalPhotos).toBe(3)
    expect(summary.qualitySummary.riskPhotos).toEqual([])
  })

  test('builds album save candidates from current unsaved non-album photos', () => {
    const cache = storage.initCache()
    const vehicle = createCompletedVehicle(0, 2)
    vehicle.licensePlate.localPhotoId = 'plate-saved'
    vehicle.vinCode.localPhotoId = 'vin-unsaved'
    vehicle.damages[0].localPhotoId = 'damage-unsaved'
    vehicle.damages[1].localPhotoId = 'damage-duplicate-path'
    vehicle.damages[1].compressedPath = vehicle.damages[0].compressedPath
    vehicle.documents = [
      {
        docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        docSide: documents.DOCUMENT_SIDES.FRONT_PAGE,
        label: '行驶证正页',
        sourceType: 'camera',
        localPhotoId: 'license-camera',
        compressedPath: '/license-camera.jpg'
      },
      {
        docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        docSide: documents.DOCUMENT_SIDES.BACK_PAGE,
        label: '行驶证副页',
        sourceType: 'album',
        localPhotoId: 'license-album',
        compressedPath: '/license-album.jpg'
      }
    ]
    cache.vehicles.push(vehicle)
    cache.documents = [
      {
        source: 'camera',
        localPhotoId: 'root-camera-doc',
        compressedPath: '/root-camera-doc.jpg'
      },
      {
        source: 'album',
        localPhotoId: 'root-album-doc',
        compressedPath: '/root-album-doc.jpg'
      }
    ]
    cache.albumSaveRecords = {
      'plate-saved': {
        status: 'saved',
        filePath: '/plate-0.jpg'
      }
    }

    const candidates = selectors.getAlbumSaveCandidates(cache)

    expect(candidates.map((candidate) => candidate.localPhotoId)).toEqual([
      'vin-unsaved',
      'damage-unsaved',
      'license-camera',
      'root-camera-doc'
    ])
    expect(candidates.map((candidate) => candidate.filePath)).toEqual([
      '/vin-0.jpg',
      '/damage-0-0.jpg',
      '/license-camera.jpg',
      '/root-camera-doc.jpg'
    ])
  })

  test('uses stable fallback identity for legacy photos without localPhotoId', () => {
    const cache = storage.initCache()
    const vehicle = storage.createVehicle(0)
    vehicle.licensePlate = {
      compressedPath: '/legacy-plate.jpg',
      compressedSize: 123,
      updatedAt: '2026-05-01T00:00:00.000Z',
      status: 'completed'
    }
    vehicle.vinCode = {
      compressedPath: '/legacy-vin.jpg',
      compressedSize: 456,
      updatedAt: '2026-05-01T00:00:00.000Z',
      status: 'completed'
    }
    cache.vehicles.push(vehicle)

    const firstCandidates = selectors.getAlbumSaveCandidates(cache)
    const firstLegacyId = firstCandidates[0].localPhotoId
    cache.albumSaveRecords = {
      [firstLegacyId]: {
        status: 'saved',
        filePath: '/legacy-plate.jpg'
      }
    }

    const secondCandidates = selectors.getAlbumSaveCandidates(cache)

    expect(firstLegacyId).toBe('legacy:/legacy-plate.jpg|123|2026-05-01T00:00:00.000Z')
    expect(secondCandidates.map((candidate) => candidate.filePath)).toEqual(['/legacy-vin.jpg'])
  })
})
