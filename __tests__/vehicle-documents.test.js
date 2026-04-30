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
    documents = require('../utils/documents')
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
})
