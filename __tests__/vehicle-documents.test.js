describe('vehicle document cache support', () => {
  let storage
  let documents
  let memoryStorage

  function createCacheWithVehicles(count = 1) {
    const cache = storage.initCache()
    for (let index = 0; index < count; index += 1) {
      cache.vehicles.push(storage.createVehicle(index))
    }
    storage.saveCache(cache)
    return storage.loadCache()
  }

  function buildDrivingLicenseDocument(docSide, overrides = {}) {
    return {
      docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
      docSide,
      label: documents.DRIVING_LICENSE_LABELS[docSide],
      sourceType: 'album',
      tempFilePath: `/tmp/${docSide}.jpg`,
      compressedPath: `/tmp/${docSide}-compressed.jpg`,
      createdAt: 1000,
      updatedAt: 1000,
      ...overrides
    }
  }

  function buildVehicleDocument(docType, docSide, overrides = {}) {
    const labels = docType === documents.DOCUMENT_TYPES.DRIVER_LICENSE
      ? documents.DRIVER_LICENSE_LABELS
      : documents.DRIVING_LICENSE_LABELS

    return {
      docType,
      docSide,
      label: labels[docSide],
      sourceType: 'album',
      tempFilePath: `/tmp/${docType}-${docSide}.jpg`,
      compressedPath: `/tmp/${docType}-${docSide}-compressed.jpg`,
      createdAt: 1000,
      updatedAt: 1000,
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

    storage = require('../packageD/utils/storage')
    documents = require('../packageD/utils/documents')
  })

  afterEach(() => {
    delete global.wx
  })

  test('repairs legacy vehicles without documents and documentSelections', () => {
    const legacyCache = storage.initCache()
    legacyCache.schemaVersion = 1
    legacyCache.vehicles.push({
      id: 'legacy-vehicle',
      type: '标的车',
      licensePlate: { status: 'pending' },
      vinCode: { status: 'pending' },
      damages: []
    })

    memoryStorage[storage.STORAGE_KEY] = JSON.stringify(legacyCache)

    const cache = storage.loadCache()

    expect(cache.schemaVersion).toBe(storage.CACHE_SCHEMA_VERSION)
    expect(cache.vehicles[0].documents).toEqual([])
    expect(cache.vehicles[0].documentSelections).toEqual({
      driver_license: 'physical',
      driving_license: 'physical'
    })
    expect(storage.validateCache(cache).valid).toBe(true)
  })

  test('keeps generic document type and side constants available for future document kinds', () => {
    expect(documents.DOCUMENT_TYPES).toEqual(expect.objectContaining({
      DRIVING_LICENSE: 'driving_license',
      DRIVER_LICENSE: 'driver_license',
      ID_CARD: 'id_card',
      BANK_CARD: 'bank_card'
    }))
    expect(documents.DOCUMENT_SIDES).toEqual(expect.objectContaining({
      FRONT_PAGE: 'front_page',
      BACK_PAGE: 'back_page',
      FRONT: 'front',
      BACK: 'back',
      ELECTRONIC: 'electronic'
    }))
  })

  test('maps driving license sides to backend photo types', () => {
    expect(documents.getDrivingLicensePhotoType(documents.DRIVING_LICENSE_SIDES.FRONT_PAGE))
      .toBe('DRIVING_LICENSE_FRONT')
    expect(documents.getDrivingLicensePhotoType(documents.DRIVING_LICENSE_SIDES.BACK_PAGE))
      .toBe('DRIVING_LICENSE_BACK')
    expect(documents.getDrivingLicensePhotoType(documents.DRIVING_LICENSE_SIDES.ELECTRONIC))
      .toBe('DRIVING_LICENSE_ELECTRONIC')
  })

  test('builds driving license slots with backend upload item metadata', () => {
    const vehicle = storage.createVehicle(0)
    vehicle.vehicleId = 'LOSS_VEHICLE_100001'
    vehicle.uploadItems = [
      {
        uploadItemId: 'V1_LICENSE_FRONT',
        photoType: 'DRIVING_LICENSE_FRONT',
        photoName: '行驶证正页',
        maxCount: 1,
        uploadedCount: 0
      },
      {
        uploadItemId: 'V1_LICENSE_BACK',
        photoType: 'DRIVING_LICENSE_BACK',
        photoName: '行驶证副页',
        maxCount: 1,
        uploadedCount: 0
      },
      {
        uploadItemId: 'V1_LICENSE_ELECTRONIC',
        photoType: 'DRIVING_LICENSE_ELECTRONIC',
        photoName: '电子行驶证',
        maxCount: 1,
        uploadedCount: 0
      }
    ]

    const physicalSlots = documents.buildDrivingLicenseSlots(
      vehicle,
      documents.DOCUMENT_SELECTIONS.PHYSICAL
    )
    const electronicSlots = documents.buildDrivingLicenseSlots(
      vehicle,
      documents.DOCUMENT_SELECTIONS.ELECTRONIC
    )

    expect(physicalSlots).toEqual([
      expect.objectContaining({
        docSide: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE,
        photoType: 'DRIVING_LICENSE_FRONT',
        uploadItemId: 'V1_LICENSE_FRONT',
        vehicleId: 'LOSS_VEHICLE_100001',
        uploadable: true
      }),
      expect.objectContaining({
        docSide: documents.DRIVING_LICENSE_SIDES.BACK_PAGE,
        photoType: 'DRIVING_LICENSE_BACK',
        uploadItemId: 'V1_LICENSE_BACK',
        vehicleId: 'LOSS_VEHICLE_100001',
        uploadable: true
      })
    ])
    expect(electronicSlots).toEqual([
      expect.objectContaining({
        docSide: documents.DRIVING_LICENSE_SIDES.ELECTRONIC,
        photoType: 'DRIVING_LICENSE_ELECTRONIC',
        uploadItemId: 'V1_LICENSE_ELECTRONIC',
        vehicleId: 'LOSS_VEHICLE_100001',
        uploadable: true
      })
    ])
  })

  test('requires front page and back page in physical driving license mode', () => {
    const vehicle = storage.createVehicle(0)

    vehicle.documents = [
      buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.FRONT_PAGE)
    ]
    expect(documents.isDrivingLicenseComplete(vehicle)).toBe(false)

    vehicle.documents.push(buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.BACK_PAGE))
    expect(documents.isDrivingLicenseComplete(vehicle)).toBe(true)
  })

  test('requires only electronic document in electronic driving license mode', () => {
    const vehicle = storage.createVehicle(0)
    vehicle.documentSelections.driving_license = 'electronic'

    expect(documents.isDrivingLicenseComplete(vehicle)).toBe(false)

    vehicle.documents = [
      buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.ELECTRONIC)
    ]
    expect(documents.isDrivingLicenseComplete(vehicle)).toBe(true)
  })

  test('switching physical and electronic mode keeps uploaded documents', () => {
    createCacheWithVehicles(1)
    storage.saveVehicleDocument(0, buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.FRONT_PAGE))
    storage.saveVehicleDocument(0, buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.BACK_PAGE))

    storage.setVehicleDocumentSelection(0, documents.DOCUMENT_TYPES.DRIVING_LICENSE, documents.DOCUMENT_SELECTIONS.ELECTRONIC)

    const cache = storage.loadCache()
    expect(cache.vehicles[0].documentSelections.driving_license).toBe('electronic')
    expect(cache.vehicles[0].documents).toHaveLength(2)
  })

  test('saving the same driving license side replaces instead of duplicating', () => {
    createCacheWithVehicles(1)
    storage.saveVehicleDocument(0, buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.FRONT_PAGE, {
      compressedPath: '/front-old.jpg'
    }))
    storage.saveVehicleDocument(0, buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.FRONT_PAGE, {
      compressedPath: '/front-new.jpg'
    }))

    const vehicle = storage.loadCache().vehicles[0]
    expect(vehicle.documents).toHaveLength(1)
    expect(vehicle.documents[0].compressedPath).toBe('/front-new.jpg')
  })

  test('deleting a vehicle document removes only that side', () => {
    createCacheWithVehicles(1)
    storage.saveVehicleDocument(0, buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.FRONT_PAGE))
    storage.saveVehicleDocument(0, buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.BACK_PAGE))

    const deleted = storage.deleteVehicleDocument(
      0,
      documents.DOCUMENT_TYPES.DRIVING_LICENSE,
      documents.DRIVING_LICENSE_SIDES.FRONT_PAGE
    )

    const vehicle = storage.loadCache().vehicles[0]
    expect(deleted).toBe(true)
    expect(vehicle.documents).toHaveLength(1)
    expect(vehicle.documents[0].docSide).toBe(documents.DRIVING_LICENSE_SIDES.BACK_PAGE)
  })

  test('target vehicle and third vehicle documents do not mix', () => {
    createCacheWithVehicles(2)
    storage.saveVehicleDocument(0, buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.FRONT_PAGE, {
      compressedPath: '/target-front.jpg'
    }))
    storage.saveVehicleDocument(1, buildDrivingLicenseDocument(documents.DRIVING_LICENSE_SIDES.FRONT_PAGE, {
      compressedPath: '/third-front.jpg'
    }))

    const cache = storage.loadCache()
    expect(cache.vehicles[0].documents[0].compressedPath).toBe('/target-front.jpg')
    expect(cache.vehicles[1].documents[0].compressedPath).toBe('/third-front.jpg')
  })

  test('builds flat vehicle document display items with two upload entries when empty', () => {
    const vehicle = storage.createVehicle(0)

    const preview = documents.buildVehicleDocumentPreview(vehicle)

    expect(preview.displayItems).toEqual([
      expect.objectContaining({
        type: 'upload',
        docType: documents.DOCUMENT_TYPES.DRIVER_LICENSE,
        label: '驾驶证',
        uploaded: false
      }),
      expect.objectContaining({
        type: 'upload',
        docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        label: '行驶证',
        uploaded: false
      })
    ])
  })

  test('builds flat electronic document display labels without electronic prefix', () => {
    const vehicle = storage.createVehicle(0)
    vehicle.documentSelections = {
      driver_license: documents.DOCUMENT_SELECTIONS.ELECTRONIC,
      driving_license: documents.DOCUMENT_SELECTIONS.ELECTRONIC
    }
    vehicle.documents = [
      buildVehicleDocument(
        documents.DOCUMENT_TYPES.DRIVER_LICENSE,
        documents.DOCUMENT_SIDES.ELECTRONIC
      ),
      buildVehicleDocument(
        documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        documents.DOCUMENT_SIDES.ELECTRONIC
      )
    ]

    const preview = documents.buildVehicleDocumentPreview(vehicle)

    expect(preview.displayItems.map((item) => item.label)).toEqual(['驾驶证', '行驶证'])
    expect(preview.displayItems.every((item) => item.type === 'document')).toBe(true)
  })

  test('builds flat physical document display labels in one row order', () => {
    const vehicle = storage.createVehicle(0)
    vehicle.documentSelections = {
      driver_license: documents.DOCUMENT_SELECTIONS.PHYSICAL,
      driving_license: documents.DOCUMENT_SELECTIONS.PHYSICAL
    }
    vehicle.documents = [
      buildVehicleDocument(documents.DOCUMENT_TYPES.DRIVER_LICENSE, documents.DOCUMENT_SIDES.FRONT_PAGE),
      buildVehicleDocument(documents.DOCUMENT_TYPES.DRIVER_LICENSE, documents.DOCUMENT_SIDES.BACK_PAGE),
      buildVehicleDocument(documents.DOCUMENT_TYPES.DRIVING_LICENSE, documents.DOCUMENT_SIDES.FRONT_PAGE),
      buildVehicleDocument(documents.DOCUMENT_TYPES.DRIVING_LICENSE, documents.DOCUMENT_SIDES.BACK_PAGE)
    ]

    const preview = documents.buildVehicleDocumentPreview(vehicle)

    expect(preview.displayItems.map((item) => item.label)).toEqual([
      '驾驶证-正页',
      '驾驶证-副页',
      '行驶证-正页',
      '行驶证-副页'
    ])
    expect(preview.displayItems.every((item) => item.type === 'document')).toBe(true)
  })
})
