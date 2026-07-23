describe('upload state', () => {
  let storage
  let documents
  let uploadState

  function buildUploadItems(vehicleId) {
    return [
      { uploadItemId: `${vehicleId}_PLATE`, photoType: 'LICENSE_PLATE', photoName: '车牌', maxCount: 1 },
      { uploadItemId: `${vehicleId}_VIN`, photoType: 'VIN', photoName: 'VIN', maxCount: 1 },
      { uploadItemId: `${vehicleId}_DAMAGE`, photoType: 'DAMAGE', photoName: '车损', maxCount: 10 },
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
    storage = require('../packageD/utils/storage')
    documents = require('../packageD/utils/documents')
    uploadState = require('../packageD/utils/upload-state')
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

  test('does not build DAMAGE upload items from VIN photo path or localPhotoId', () => {
    const emptyDamageCache = createAuxCache()
    emptyDamageCache.vehicles[0].vinCode = {
      status: 'completed',
      compressedPath: '/tmp/vin-final.jpg',
      localPhotoId: 'vin-final-id',
      compressedSize: 102
    }
    emptyDamageCache.vehicles[0].damages = []

    const emptyDamageItems = uploadState.buildUploadItems(emptyDamageCache)
      .filter((item) => item.photoType === 'DAMAGE')
    expect(emptyDamageItems).toHaveLength(0)

    const realDamageCache = createAuxCache()
    realDamageCache.vehicles[0].vinCode = {
      status: 'completed',
      compressedPath: '/tmp/vin-final.jpg',
      localPhotoId: 'vin-final-id',
      compressedSize: 102
    }
    realDamageCache.vehicles[0].damages = [{
      compressedPath: '/tmp/damage-real.jpg',
      localPhotoId: 'damage-real-id',
      compressedSize: 103
    }]

    const realDamageItems = uploadState.buildUploadItems(realDamageCache)
      .filter((item) => item.photoType === 'DAMAGE')
    expect(realDamageItems).toHaveLength(1)
    expect(realDamageItems[0]).toEqual(expect.objectContaining({
      filePath: '/tmp/damage-real.jpg',
      clientPhotoId: 'damage-real-id'
    }))
    expect(realDamageItems.map((item) => item.filePath)).not.toContain('/tmp/vin-final.jpg')
    expect(realDamageItems.map((item) => item.clientPhotoId)).not.toContain('vin-final-id')
  })

  test('builds case-level scene45 upload item without vehicleId', () => {
    const cache = createAuxCache()
    cache.caseUploadItems = [
      { uploadItemId: 'CASE_SCENE_45', photoType: 'SCENE_45', photoName: '现场45度', maxCount: 1 }
    ]
    cache.caseUploadItemsByPhotoType = {
      SCENE_45: cache.caseUploadItems[0]
    }
    cache.scenePhotos.scene45 = {
      status: 'completed',
      compressedPath: '/tmp/scene45.jpg',
      localPhotoId: 'scene45-id',
      compressedSize: 99
    }

    const items = uploadState.buildUploadItems(cache)
    const scene45Item = items.find((item) => item.photoType === 'SCENE_45')

    expect(scene45Item).toEqual(expect.objectContaining({
      id: 'case-scene45',
      clientPhotoId: 'scene45-id',
      uploadItemId: 'CASE_SCENE_45',
      sortNo: 1,
      filePath: '/tmp/scene45.jpg',
      label: '现场45度照片'
    }))
    expect(scene45Item).not.toHaveProperty('vehicleId')
  })

  test('builds up to three case-level scene supplement upload items with sortNo', () => {
    const cache = createAuxCache()
    cache.caseUploadItems = [
      { uploadItemId: 'CASE_SCENE_SUPPLEMENT', photoType: 'SCENE_SUPPLEMENT', photoName: '现场补充', maxCount: 3 }
    ]
    cache.caseUploadItemsByPhotoType = {
      SCENE_SUPPLEMENT: cache.caseUploadItems[0]
    }
    cache.scenePhotos.supplements = [1, 2, 3, 4].map((index) => ({
      status: 'completed',
      compressedPath: '/tmp/scene-supplement-' + index + '.jpg',
      localPhotoId: 'scene-supplement-' + index,
      compressedSize: 80 + index
    }))

    const items = uploadState.buildUploadItems(cache)
    const supplementItems = items.filter((item) => item.photoType === 'SCENE_SUPPLEMENT')

    expect(supplementItems).toHaveLength(3)
    expect(supplementItems.map((item) => item.sortNo)).toEqual([1, 2, 3])
    expect(supplementItems.map((item) => item.uploadItemId)).toEqual([
      'CASE_SCENE_SUPPLEMENT',
      'CASE_SCENE_SUPPLEMENT',
      'CASE_SCENE_SUPPLEMENT'
    ])
    supplementItems.forEach((item) => {
      expect(item).not.toHaveProperty('vehicleId')
    })
  })

  test('throws explicit error when caseUploadItems are missing for scene photos', () => {
    const cache = createAuxCache()
    cache.scenePhotos.scene45 = {
      status: 'completed',
      compressedPath: '/tmp/scene45.jpg',
      localPhotoId: 'scene45-id'
    }

    expect(() => uploadState.buildUploadItems(cache)).toThrow('案件级拍照项未下发，请联系后台配置。')
    try {
      uploadState.buildUploadItems(cache)
    } catch (error) {
      expect(error.code).toBe('AUX_CASE_UPLOAD_ITEM_MISSING')
      expect(error.message).toBe('案件级拍照项未下发，请联系后台配置。')
    }
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

  test('records upload success payload and skips successful items on retry', () => {
    const session = uploadState.createUploadSession(createAuxCache(), {
      now: '2026-05-26T00:00:00.000Z'
    })
    const uploading = uploadState.markUploadItemUploading(session, session.items[0].id, {
      now: '2026-05-26T00:00:01.000Z'
    })
    const succeeded = uploadState.markUploadItemSuccess(uploading, session.items[0].id, {
      data: {
        uploadRecordId: 'AUP202605260001',
        photoId: 'DOC202605260001',
        duplicate: true,
        itemUploadedCount: 1,
        ticketStatus: 'UPLOADING'
      }
    }, {
      now: '2026-05-26T00:00:02.000Z'
    })
    const failed = uploadState.markUploadItemFailed(succeeded, session.items[1].id, {
      code: 'AUX_UPLOAD_FAILED',
      message: '网络异常'
    }, {
      now: '2026-05-26T00:00:03.000Z'
    })
    const retrying = uploadState.retryFailedItems(failed)

    expect(retrying.items[0]).toEqual(expect.objectContaining({
      status: uploadState.UPLOAD_ITEM_STATUS.SUCCESS,
      uploadRecordId: 'AUP202605260001',
      photoId: 'DOC202605260001',
      duplicate: true,
      uploadedAt: '2026-05-26T00:00:02.000Z'
    }))
    expect(retrying.items[1]).toEqual(expect.objectContaining({
      status: uploadState.UPLOAD_ITEM_STATUS.PENDING,
      attempts: 0
    }))
    expect(retrying.uploaded).toBe(1)
    expect(retrying.failed).toBe(0)
  })

  test('tracks complete failure and retry separately from successful uploads', () => {
    const session = uploadState.createUploadSession(createAuxCache())
    const allUploaded = session.items.reduce((current, item) => (
      uploadState.markUploadItemSuccess(
        uploadState.markUploadItemUploading(current, item.id),
        item.id,
        { data: { uploadRecordId: `${item.id}-record` } }
      )
    ), session)

    expect(allUploaded.phase).toBe(uploadState.UPLOAD_PHASE.READY)

    const submitting = uploadState.markCompleteSubmitting(allUploaded, {
      now: '2026-05-26T00:01:00.000Z'
    })
    const failed = uploadState.markCompleteFailed(submitting, {
      code: 'AUX_SERVER_ERROR',
      message: '完成提交失败'
    }, {
      now: '2026-05-26T00:01:01.000Z'
    })
    const retrying = uploadState.markCompleteSubmitting(failed, {
      now: '2026-05-26T00:01:02.000Z'
    })
    const completed = uploadState.markCompleteSuccess(retrying, {
      data: {
        ticketStatus: 'COMPLETED',
        uploadedCount: 4,
        completeTime: '2026-05-26 10:30:00'
      }
    }, {
      now: '2026-05-26T00:01:03.000Z'
    })

    expect(failed.phase).toBe(uploadState.UPLOAD_PHASE.COMPLETE_FAILED)
    expect(failed.uploaded).toBe(4)
    expect(failed.items.every((item) => item.status === uploadState.UPLOAD_ITEM_STATUS.SUCCESS)).toBe(true)
    expect(retrying.complete.attempts).toBe(2)
    expect(completed.phase).toBe(uploadState.UPLOAD_PHASE.COMPLETED)
    expect(completed.complete).toEqual(expect.objectContaining({
      status: uploadState.COMPLETE_STATUS.SUCCESS,
      completedAt: '2026-05-26T00:01:03.000Z',
      ticketStatus: 'COMPLETED',
      uploadedCount: 4
    }))
  })
})
