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

    storage = require('../packageD/utils/storage')
    constants = require('../packageD/utils/constants')
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
    expect(savedCache.uploadSession).toBeNull()
  })

  test('persists and repairs upload session state', () => {
    const cache = storage.initCache()
    cache.uploadSession = {
      version: 1,
      sessionId: 'upload-test',
      phase: 'complete_failed',
      ticket: 'mock-2',
      total: 1,
      uploaded: 1,
      failed: 0,
      complete: {
        status: 'failed',
        attempts: 1,
        lastErrorCode: 'AUX_SERVER_ERROR',
        lastErrorMessage: '完成提交失败',
        submittedAt: '2026-05-25T00:00:01.000Z',
        completedAt: '',
        ticketStatus: '',
        uploadedCount: 0,
        completeTime: '',
        response: null
      },
      createdAt: '2026-05-25T00:00:00.000Z',
      updatedAt: '2026-05-25T00:00:00.000Z',
      items: [
        {
          id: 'vehicle0-licensePlate',
          clientPhotoId: 'plate-id',
          vehicleIndex: 0,
          vehicleId: 'LOSS_VEHICLE_100001',
          uploadItemId: 'UPLOAD_PLATE',
          photoType: 'LICENSE_PLATE',
          sortNo: 1,
          filePath: '/tmp/plate.jpg',
          fileSize: 100,
          label: '标的车 - 车牌',
          status: 'success',
          attempts: 1,
          startedAt: '2026-05-25T00:00:01.000Z',
          uploadedAt: '2026-05-25T00:00:02.000Z',
          failedAt: '',
          uploadRecordId: 'AUP202605250001',
          photoId: 'DOC202605250001',
          duplicate: true,
          itemUploadedCount: 1,
          ticketStatus: 'UPLOADING',
          lastErrorCode: '',
          lastErrorMessage: ''
        }
      ]
    }

    storage.saveCache(cache)
    const savedCache = storage.loadCache()

    expect(savedCache.uploadSession).toEqual(expect.objectContaining({
      phase: 'complete_failed',
      total: 1,
      uploaded: 1,
      failed: 0
    }))
    expect(savedCache.uploadSession.items[0]).toEqual(expect.objectContaining({
      id: 'vehicle0-licensePlate',
      status: 'success',
      uploadRecordId: 'AUP202605250001',
      photoId: 'DOC202605250001',
      duplicate: true,
      uploadedAt: '2026-05-25T00:00:02.000Z'
    }))
    expect(savedCache.uploadSession.complete).toEqual(expect.objectContaining({
      status: 'failed',
      attempts: 1,
      lastErrorMessage: '完成提交失败'
    }))

    savedCache.uploadSession.phase = 'bad-phase'
    savedCache.uploadSession.items[0].status = 'bad-status'
    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(savedCache)

    const repairedCache = storage.loadCache()
    expect(repairedCache.uploadSession.phase).toBe('uploading')
    expect(repairedCache.uploadSession.items[0].status).toBe('pending')
    expect(storage.validateCache(repairedCache).valid).toBe(true)
  })

  test('clears completed upload session when returning from complete page to edit', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    cache.workflowState = {
      current: 'LOCAL_COMPLETED',
      updatedAt: cache.updatedAt
    }
    cache.uploadSession = {
      version: 1,
      sessionId: 'upload-completed',
      phase: 'completed',
      ticket: 'mock-2',
      total: 1,
      uploaded: 1,
      failed: 0,
      complete: {
        status: 'success',
        attempts: 1,
        ticketStatus: 'COMPLETED',
        uploadedCount: 1
      },
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
      items: [
        {
          id: 'vehicle0-licensePlate',
          clientPhotoId: 'plate-id',
          filePath: '/tmp/plate.jpg',
          label: '标的车 - 车牌',
          status: 'success',
          attempts: 1
        }
      ]
    }

    const editingCache = storage.clearCompletionContext(cache)

    expect(editingCache.workflowState.current).toBe('PREVIEWING')
    expect(editingCache.uploadSession).toBeNull()
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
    expect(cache.albumSaveRecords).toEqual({})
    expect(cache.albumSaveSummary).toEqual({
      decision: 'none',
      total: 0,
      saved: 0,
      failed: 0,
      permissionDenied: 0,
      updatedAt: ''
    })
    expect(cache.vehicles[0].licensePlate.localPhotoId).toMatch(/^photo_/)
    expect(cache.vehicles[0].damages[0].localPhotoId).toMatch(/^photo_/)
    expect(cache.documents[0].localPhotoId).toMatch(/^photo_/)
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

  test('keeps stale completed upload session as local completed during safe resume', () => {
    const cache = storage.initCache()
    cache.vehicles.push(createCompletedVehicle(0, 1))
    cache.currentVehicleIndex = 0
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    cache.workflowState = {
      current: 'LOCAL_COMPLETED',
      updatedAt: '2000-01-01T00:00:00.000Z'
    }
    cache.updatedAt = '2000-01-01T00:00:00.000Z'
    cache.uploadSession = {
      version: 1,
      sessionId: 'upload-completed',
      phase: 'completed',
      ticket: 'mock-2',
      total: 1,
      uploaded: 1,
      failed: 0,
      complete: {
        status: 'success',
        attempts: 1,
        ticketStatus: 'COMPLETED',
        uploadedCount: 1
      },
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
      items: [
        {
          id: 'vehicle0-licensePlate',
          clientPhotoId: 'plate-id',
          filePath: '/tmp/plate.jpg',
          label: '鏍囩殑杞?- 杞︾墝',
          status: 'success',
          attempts: 1
        }
      ]
    }

    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(cache)

    const safeCache = storage.loadCacheForResume()

    expect(safeCache.currentStep).toBe(constants.SHOOT_STEP.PREVIEW)
    expect(safeCache.workflowState.current).toBe('LOCAL_COMPLETED')
    expect(safeCache.uploadSession.phase).toBe('completed')
    expect(safeCache.uploadSession.complete.status).toBe('success')
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

  test('normalizes photo quality meta and keeps legacy photos without quality compatible', () => {
    const legacyPhoto = storage.normalizePhotoMeta({
      compressedPath: '/legacy.jpg'
    })

    const qualityPhoto = storage.normalizePhotoMeta({
      compressedPath: '/quality.jpg',
      quality: {
        level: 'bad',
        suggestRetake: true,
        reasons: ['blur', '', 'dark'],
        metrics: {
          brightness: 0.22,
          darkRatio: 0.81,
          blurScore: 0.11,
          sampledWidth: 320.4,
          sampledHeight: 180.2
        },
        analyzedAt: '2026-04-26T00:00:00.000Z',
        configVersion: 'quality-v1'
      }
    })

    expect(legacyPhoto).not.toHaveProperty('quality')
    expect(qualityPhoto.quality).toEqual({
      level: 'bad',
      suggestRetake: true,
      reasons: ['blur', 'dark'],
      metrics: {
        brightness: 0.22,
        darkRatio: 0.81,
        brightRatio: 0,
        blurScore: 0.11,
        contrast: 0,
        sampledWidth: 320,
        sampledHeight: 180
      },
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'quality-v1'
    })
  })
})
