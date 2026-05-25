describe('upload state', () => {
  let storage
  let documents
  let uploadState

  function buildUploadItems(vehicleId) {
    return [
      { uploadItemId: `${vehicleId}_PLATE`, photoType: 'LICENSE_PLATE', photoName: '车牌', maxCount: 1 },
      { uploadItemId: `${vehicleId}_VIN`, photoType: 'VIN', photoName: 'VIN', maxCount: 1 },
      { uploadItemId: `${vehicleId}_DAMAGE`, photoType: 'DAMAGE', photoName: '车损', maxCount: 5 },
      { uploadItemId: `${vehicleId}_DRIVING_LICENSE_ELECTRONIC`, photoType: 'DRIVING_LICENSE_ELECTRONIC', photoName: '电子行驶证', maxCount: 1 }
    ]
  }

  function createAuxCache() {
    const cache = storage.initCache()
    const vehicle = storage.createVehicle(0)
    const vehicleId = 'LOSS_VEHICLE_100001'

    cache.auxPhoto = {
      enabled: true,
      ticket: 'mock-2'
    }
    vehicle.id = vehicleId
    vehicle.vehicleId = vehicleId
    vehicle.backendVehicleId = vehicleId
    vehicle.displayName = '标的车 京A12345'
    vehicle.uploadItems = buildUploadItems(vehicleId)
    vehicle.uploadItemsByPhotoType = vehicle.uploadItems.reduce((result, item) => {
      result[item.photoType] = item
      return result
    }, {})
    vehicle.licensePlate = {
      status: 'completed',
      compressedPath: '/tmp/plate.jpg',
      localPhotoId: 'plate-id',
      compressedSize: 101
    }
    vehicle.vinCode = {
      status: 'completed',
      compressedPath: '/tmp/vin.jpg',
      localPhotoId: 'vin-id',
      compressedSize: 102
    }
    vehicle.damages = [
      {
        compressedPath: '/tmp/damage-1.jpg',
        localPhotoId: 'damage-id',
        compressedSize: 103
      }
    ]
    vehicle.documentSelections[documents.DOCUMENT_TYPES.DRIVING_LICENSE] = documents.DOCUMENT_SELECTIONS.ELECTRONIC
    vehicle.documents = [
      {
        docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        docSide: documents.DRIVING_LICENSE_SIDES.ELECTRONIC,
        label: '电子行驶证',
        sourceType: 'album',
        compressedPath: '/tmp/license.jpg',
        localPhotoId: 'license-id',
        vehicleId,
        uploadItemId: `${vehicleId}_DRIVING_LICENSE_ELECTRONIC`,
        photoType: 'DRIVING_LICENSE_ELECTRONIC'
      }
    ]
    cache.vehicles.push(vehicle)
    return cache
  }

  beforeEach(() => {
    jest.resetModules()
    storage = require('../utils/storage')
    documents = require('../utils/documents')
    uploadState = require('../utils/upload-state')
  })

  test('builds reusable upload items from vehicle photos and driving license documents', () => {
    const items = uploadState.buildUploadItems(createAuxCache())

    expect(items).toHaveLength(4)
    expect(items.map((item) => item.photoType)).toEqual([
      'LICENSE_PLATE',
      'VIN',
      'DAMAGE',
      'DRIVING_LICENSE_ELECTRONIC'
    ])
    expect(items[0]).toEqual(expect.objectContaining({
      clientPhotoId: 'plate-id',
      vehicleId: 'LOSS_VEHICLE_100001',
      uploadItemId: 'LOSS_VEHICLE_100001_PLATE',
      filePath: '/tmp/plate.jpg',
      sortNo: 1,
      label: '标的车 京A12345 - 车牌'
    }))
    expect(items[2]).toEqual(expect.objectContaining({
      clientPhotoId: 'damage-id',
      uploadItemId: 'LOSS_VEHICLE_100001_DAMAGE',
      sortNo: 1,
      label: '标的车 京A12345 - 车损1'
    }))
    expect(items[3]).toEqual(expect.objectContaining({
      clientPhotoId: 'license-id',
      uploadItemId: 'LOSS_VEHICLE_100001_DRIVING_LICENSE_ELECTRONIC',
      sortNo: 1,
      label: '标的车 京A12345 - 电子行驶证'
    }))
  })

  test('marks a fail-once mock item successful after retry without reuploading successful items', () => {
    const session = uploadState.createUploadSession(createAuxCache(), {
      now: '2026-05-25T00:00:00.000Z'
    })
    const firstFailure = uploadState.applyMockUploadStep(session, {
      scenario: 'fail-once'
    })

    expect(firstFailure.phase).toBe(uploadState.UPLOAD_PHASE.FAILED)
    expect(firstFailure.items[0]).toEqual(expect.objectContaining({
      status: uploadState.UPLOAD_ITEM_STATUS.FAILED,
      attempts: 1,
      lastErrorCode: 'MOCK_UPLOAD_FAILED'
    }))

    const retrying = uploadState.retryFailedItems(firstFailure)
    const afterRetry = uploadState.applyMockUploadStep(retrying, {
      scenario: 'fail-once'
    })

    expect(afterRetry.items[0]).toEqual(expect.objectContaining({
      status: uploadState.UPLOAD_ITEM_STATUS.SUCCESS,
      attempts: 2
    }))
    expect(afterRetry.uploaded).toBe(1)
    expect(afterRetry.failed).toBe(0)
    expect(afterRetry.items[1].status).toBe(uploadState.UPLOAD_ITEM_STATUS.PENDING)
  })

  test('keeps a fail-always mock session failed after retry', () => {
    const session = uploadState.createUploadSession(createAuxCache())
    const failed = uploadState.applyMockUploadStep(session, {
      scenario: 'fail-always'
    })
    const retrying = uploadState.retryFailedItems(failed)
    const failedAgain = uploadState.applyMockUploadStep(retrying, {
      scenario: 'fail-always'
    })

    expect(failedAgain.phase).toBe(uploadState.UPLOAD_PHASE.FAILED)
    expect(failedAgain.uploaded).toBe(0)
    expect(failedAgain.failed).toBe(1)
    expect(failedAgain.items[0].attempts).toBe(2)
  })
})
