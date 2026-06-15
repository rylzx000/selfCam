describe('preview upload overlay flow', () => {
  let storage
  let constants
  let documents
  let auxPhotoApi
  let uploadState
  let pageConfig
  let memoryStorage

  function createPageInstance(config) {
    return {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      isLeaving: false,
      setData(updates, callback) {
        this.data = {
          ...this.data,
          ...updates
        }
        if (typeof callback === 'function') {
          callback()
        }
      }
    }
  }

  function completeVehicle(index) {
    const vehicle = storage.createVehicle(index)
    vehicle.displayName = index === 0 ? '标的车 京A12345' : `三者车 京B1234${index}`
    vehicle.vehicleId = `LOSS_VEHICLE_${index}`
    vehicle.uploadItems = [
      { uploadItemId: `V${index}_PLATE`, photoType: 'LICENSE_PLATE', photoName: '车牌', maxCount: 1 },
      { uploadItemId: `V${index}_VIN`, photoType: 'VIN', photoName: 'VIN', maxCount: 1 },
      { uploadItemId: `V${index}_DAMAGE`, photoType: 'DAMAGE', photoName: '车损', maxCount: 5 },
      { uploadItemId: `V${index}_LICENSE_ELECTRONIC`, photoType: 'DRIVING_LICENSE_ELECTRONIC', photoName: '电子行驶证', maxCount: 1 }
    ]
    vehicle.uploadItemsByPhotoType = vehicle.uploadItems.reduce((result, item) => {
      result[item.photoType] = item
      return result
    }, {})
    vehicle.licensePlate = {
      status: 'completed',
      source: 'album',
      compressedPath: `/plate-${index}.jpg`,
      localPhotoId: `plate-${index}`
    }
    vehicle.vinCode = {
      status: 'completed',
      source: 'album',
      compressedPath: `/vin-${index}.jpg`,
      localPhotoId: `vin-${index}`
    }
    vehicle.damages = [
      {
        source: 'album',
        compressedPath: `/damage-${index}.jpg`,
        localPhotoId: `damage-${index}`
      }
    ]
    vehicle.documentSelections[documents.DOCUMENT_TYPES.DRIVING_LICENSE] = documents.DOCUMENT_SELECTIONS.ELECTRONIC
    vehicle.documents = [
      {
        docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        docSide: documents.DRIVING_LICENSE_SIDES.ELECTRONIC,
        label: '电子行驶证',
        sourceType: 'album',
        compressedPath: `/license-${index}.jpg`,
        localPhotoId: `license-${index}`,
        vehicleId: vehicle.vehicleId,
        uploadItemId: `V${index}_LICENSE_ELECTRONIC`,
        photoType: 'DRIVING_LICENSE_ELECTRONIC'
      }
    ]
    return vehicle
  }

  function saveReadyPreviewCache(ticket = 'mock-2', options = {}) {
    const cache = storage.initCache()
    cache.auxPhoto = {
      enabled: true,
      ticket,
      ticketStatus: options.ticketStatus || ''
    }
    cache.vehicles.push(completeVehicle(0), completeVehicle(1), completeVehicle(2))
    cache.currentStep = constants.SHOOT_STEP.PREVIEW
    cache.workflowState = {
      current: 'PREVIEWING',
      updatedAt: cache.updatedAt
    }
    storage.saveCache(cache)
    return storage.loadCache()
  }

  function savePreviewCacheWithUploadSession({ phase, completeStatus = 'pending' }) {
    const cache = saveReadyPreviewCache('mock-2')
    const session = uploadState.createUploadSession(cache)
    session.items = session.items.map((item) => ({
      ...item,
      status: uploadState.UPLOAD_ITEM_STATUS.SUCCESS,
      attempts: 1
    }))
    session.phase = phase
    session.uploaded = session.items.length
    session.failed = 0
    session.complete = {
      ...session.complete,
      status: completeStatus
    }
    cache.uploadSession = session
    cache.workflowState = {
      current: phase === uploadState.UPLOAD_PHASE.COMPLETED ? 'LOCAL_COMPLETED' : 'COMPLETE_FAILED',
      updatedAt: cache.updatedAt
    }
    storage.saveCache(cache)
    return storage.loadCache()
  }

  function createPreviewPage() {
    pageConfig = null
    jest.isolateModules(() => {
      require('../packageD/pages/preview/preview')
    })
    return createPageInstance(pageConfig)
  }

  function loadPreviewPage() {
    const page = createPreviewPage()
    page.loadData()
    return page
  }

  beforeEach(() => {
    jest.resetModules()
    memoryStorage = {}

    jest.doMock('../packageD/utils/album', () => ({
      savePhotosToAlbumBatch: jest.fn()
    }))

    jest.doMock('../packageD/utils/permission', () => ({
      ensureAlbumSavePermission: jest.fn()
    }))

    jest.doMock('../packageD/utils/aux-photo-api', () => ({
      uploadPhoto: jest.fn(async (item) => ({
        success: true,
        code: '0000',
        message: '图片上传成功',
        data: {
          uploadRecordId: `${item.id}-record`,
          photoId: `${item.id}-photo`,
          vehicleId: item.vehicleId,
          uploadItemId: item.uploadItemId,
          photoType: item.photoType,
          duplicate: false,
          itemUploadedCount: item.sortNo || 1,
          ticketStatus: 'UPLOADING'
        }
      })),
      complete: jest.fn(async ({ ticket, clientUploadCount }) => ({
        success: true,
        code: '0000',
        message: '辅助拍照已完成',
        data: {
          ticket,
          ticketStatus: 'COMPLETED',
          uploadedCount: clientUploadCount,
          requiredPassed: true,
          missingItems: [],
          completeTime: '2026-05-26 10:30:00',
          phase2TriggerStatus: 'NOT_ENABLED'
        }
      }))
    }))

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
      },
      showToast: jest.fn(),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showModal: jest.fn(),
      redirectTo: jest.fn(),
      navigateTo: jest.fn(),
      previewImage: jest.fn()
    }

    global.Page = jest.fn((config) => {
      pageConfig = config
    })

    storage = require('../packageD/utils/storage')
    constants = require('../packageD/utils/constants')
    documents = require('../packageD/utils/documents')
    uploadState = require('../packageD/utils/upload-state')
    auxPhotoApi = require('../packageD/utils/aux-photo-api')
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../packageD/utils/album')
    jest.dontMock('../packageD/utils/permission')
    jest.dontMock('../packageD/utils/aux-photo-api')
  })

  test('uploads photos one by one and calls complete only after upload ready', async () => {
    saveReadyPreviewCache('mock-2')
    const page = loadPreviewPage()

    page.onSubmit()
    await page.uploadFlowPromise

    let cache = storage.loadCache()
    expect(auxPhotoApi.uploadPhoto).toHaveBeenCalledTimes(12)
    expect(auxPhotoApi.complete).not.toHaveBeenCalled()
    expect(cache.uploadSession).toEqual(expect.objectContaining({
      phase: 'ready',
      total: 12,
      uploaded: 12
    }))
    expect(page.data.uploadOverlayPrimaryText).toBe('完成采集')
    expect(global.wx.redirectTo).not.toHaveBeenCalledWith({
      url: '/packageD/pages/complete/complete'
    })

    page.onUploadOverlayPrimaryTap()
    await page.completeFlowPromise

    cache = storage.loadCache()
    expect(auxPhotoApi.complete).toHaveBeenCalledTimes(1)
    expect(cache.uploadSession.phase).toBe('completed')
    expect(cache.workflowState.current).toBe('LOCAL_COMPLETED')
    expect(global.wx.redirectTo).toHaveBeenCalledWith({
      url: '/packageD/pages/complete/complete'
    })
  })

  test.each([
    ['COMPLETED', '照片已完成采集，请勿重复操作。'],
    ['EXPIRED', '辅助拍照链接已过期，请联系查勘员重新发送链接。'],
    ['REVOKED', '辅助拍照链接已作废，请联系查勘员重新发送链接。']
  ])('blocks upload when cached aux photo ticketStatus is %s', async (ticketStatus, message) => {
    saveReadyPreviewCache('mock-2', { ticketStatus })
    const page = loadPreviewPage()

    page.onSubmit()
    await Promise.resolve()

    const cache = storage.loadCache()
    expect(auxPhotoApi.uploadPhoto).not.toHaveBeenCalled()
    expect(auxPhotoApi.complete).not.toHaveBeenCalled()
    expect(cache.uploadSession).toBeFalsy()
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: message,
      icon: 'none'
    })
  })

  test.each([
    ['COMPLETED', '照片已完成采集，请勿重复操作。'],
    ['EXPIRED', '辅助拍照链接已过期，请联系查勘员重新发送链接。'],
    ['REVOKED', '辅助拍照链接已作废，请联系查勘员重新发送链接。']
  ])('blocks complete when cached aux photo ticketStatus is %s', async (ticketStatus, message) => {
    const cache = saveReadyPreviewCache('mock-2', { ticketStatus })
    const session = uploadState.createUploadSession(cache)
    session.items = session.items.map((item) => ({
      ...item,
      status: uploadState.UPLOAD_ITEM_STATUS.SUCCESS,
      attempts: 1
    }))
    session.phase = uploadState.UPLOAD_PHASE.READY
    session.uploaded = session.items.length
    session.failed = 0
    cache.uploadSession = session
    storage.saveCache(cache)
    const page = createPreviewPage()

    await page.onUploadOverlayPrimaryTap()

    const latestCache = storage.loadCache()
    expect(auxPhotoApi.uploadPhoto).not.toHaveBeenCalled()
    expect(auxPhotoApi.complete).not.toHaveBeenCalled()
    expect(latestCache.uploadSession.phase).toBe(uploadState.UPLOAD_PHASE.READY)
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: message,
      icon: 'none'
    })
  })

  test('redirects to complete page when restoring completed success upload session', () => {
    savePreviewCacheWithUploadSession({
      phase: uploadState.UPLOAD_PHASE.COMPLETED,
      completeStatus: uploadState.COMPLETE_STATUS.SUCCESS
    })
    const page = createPreviewPage()

    page.onLoad()

    expect(page.isLeaving).toBe(true)
    expect(auxPhotoApi.uploadPhoto).not.toHaveBeenCalled()
    expect(auxPhotoApi.complete).not.toHaveBeenCalled()
    expect(global.wx.redirectTo).toHaveBeenCalledWith({
      url: '/packageD/pages/complete/complete'
    })
  })

  test('does not redirect twice when onShow fires during completed success redirect', () => {
    savePreviewCacheWithUploadSession({
      phase: uploadState.UPLOAD_PHASE.COMPLETED,
      completeStatus: uploadState.COMPLETE_STATUS.SUCCESS
    })
    const page = createPreviewPage()

    page.onLoad()
    page.onShow()

    expect(global.wx.redirectTo).toHaveBeenCalledTimes(1)
    expect(global.wx.redirectTo).toHaveBeenCalledWith({
      url: '/packageD/pages/complete/complete'
    })
    expect(auxPhotoApi.uploadPhoto).not.toHaveBeenCalled()
    expect(auxPhotoApi.complete).not.toHaveBeenCalled()
  })

  test('keeps complete failed session on preview page for retry when restoring', () => {
    savePreviewCacheWithUploadSession({
      phase: uploadState.UPLOAD_PHASE.COMPLETE_FAILED,
      completeStatus: uploadState.COMPLETE_STATUS.FAILED
    })
    const page = createPreviewPage()

    page.onLoad()

    expect(page.isLeaving).toBe(false)
    expect(page.data.showUploadOverlay).toBe(true)
    expect(page.data.uploadOverlayTitle).toBe('\u5b8c\u6210\u63d0\u4ea4\u5931\u8d25')
    expect(page.data.uploadOverlayPrimaryText).toBe('\u91cd\u8bd5\u5b8c\u6210')
    expect(auxPhotoApi.uploadPhoto).not.toHaveBeenCalled()
    expect(auxPhotoApi.complete).not.toHaveBeenCalled()
    expect(global.wx.redirectTo).not.toHaveBeenCalledWith({
      url: '/packageD/pages/complete/complete'
    })
  })

  test('stops after upload failure and retries only unfinished photos', async () => {
    saveReadyPreviewCache('mock-2')
    auxPhotoApi.uploadPhoto.mockImplementation(async (item) => {
      if (item.id === 'vehicle0-vin' && item.attempts === 1) {
        throw {
          code: 'AUX_UPLOAD_FAILED',
          message: '网络异常'
        }
      }

      return {
        success: true,
        code: '0000',
        message: '图片上传成功',
        data: {
          uploadRecordId: `${item.id}-record`
        }
      }
    })
    const page = loadPreviewPage()

    page.onSubmit()
    await page.uploadFlowPromise

    let cache = storage.loadCache()
    expect(cache.uploadSession).toEqual(expect.objectContaining({
      phase: 'failed',
      uploaded: 1,
      failed: 1
    }))
    expect(cache.uploadSession.items[0].status).toBe('success')
    expect(cache.uploadSession.items[1]).toEqual(expect.objectContaining({
      id: 'vehicle0-vin',
      status: 'failed',
      lastErrorMessage: '网络异常'
    }))
    expect(page.data.uploadOverlayTitle).toBe('有照片上传失败')
    expect(page.data.uploadOverlayPrimaryText).toBe('重试上传')

    page.onUploadOverlayPrimaryTap()
    await page.uploadFlowPromise

    cache = storage.loadCache()
    expect(cache.uploadSession.phase).toBe('ready')
    expect(cache.uploadSession.items[0].attempts).toBe(1)
    expect(cache.uploadSession.items[1]).toEqual(expect.objectContaining({
      status: 'success',
      attempts: 2
    }))
    expect(auxPhotoApi.complete).not.toHaveBeenCalled()
  })

  test('does not start duplicate upload runners when restoring the same uploading session twice', async () => {
    const cache = saveReadyPreviewCache('mock-2')
    const session = uploadState.createUploadSession(cache)
    session.items[0] = {
      ...session.items[0],
      status: uploadState.UPLOAD_ITEM_STATUS.SUCCESS,
      attempts: 1,
      uploadRecordId: 'vehicle0-licensePlate-record',
      photoId: 'vehicle0-licensePlate-photo'
    }
    session.items[1] = {
      ...session.items[1],
      status: uploadState.UPLOAD_ITEM_STATUS.UPLOADING,
      attempts: 1,
      startedAt: '2026-05-26T00:00:00.000Z'
    }
    cache.uploadSession = {
      ...session,
      phase: uploadState.UPLOAD_PHASE.UPLOADING,
      uploaded: 1,
      failed: 0
    }
    storage.saveCache(cache)
    auxPhotoApi.uploadPhoto.mockImplementation(() => new Promise(() => {}))

    const page = loadPreviewPage()
    page.restoreUploadOverlay(storage.loadCache())

    expect(auxPhotoApi.uploadPhoto).toHaveBeenCalledTimes(1)
    expect(auxPhotoApi.uploadPhoto.mock.calls[0][0].id).toBe('vehicle0-vin')
  })

  test('complete failure retries complete without reuploading photos', async () => {
    saveReadyPreviewCache('mock-2')
    auxPhotoApi.complete
      .mockRejectedValueOnce({
        code: 'AUX_SERVER_ERROR',
        message: '完成提交失败'
      })
      .mockResolvedValueOnce({
        success: true,
        code: '0000',
        message: '辅助拍照已完成',
        data: {
          ticket: 'mock-2',
          ticketStatus: 'COMPLETED',
          uploadedCount: 12,
          completeTime: '2026-05-26 10:30:00'
        }
      })
    const page = loadPreviewPage()

    page.onSubmit()
    await page.uploadFlowPromise
    page.onUploadOverlayPrimaryTap()
    await page.completeFlowPromise

    let cache = storage.loadCache()
    expect(cache.uploadSession.phase).toBe('complete_failed')
    expect(cache.uploadSession.uploaded).toBe(12)
    expect(page.data.uploadOverlayTitle).toBe('完成提交失败')
    expect(page.data.uploadOverlayPrimaryText).toBe('重试完成')
    expect(auxPhotoApi.uploadPhoto).toHaveBeenCalledTimes(12)

    page.onUploadOverlayPrimaryTap()
    await page.completeFlowPromise

    cache = storage.loadCache()
    expect(auxPhotoApi.uploadPhoto).toHaveBeenCalledTimes(12)
    expect(auxPhotoApi.complete).toHaveBeenCalledTimes(2)
    expect(cache.uploadSession.phase).toBe('completed')
    expect(global.wx.redirectTo).toHaveBeenCalledWith({
      url: '/packageD/pages/complete/complete'
    })
  })
})
