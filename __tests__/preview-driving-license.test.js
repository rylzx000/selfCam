describe('preview page driving license flow', () => {
  let storage
  let documents
  let compress
  let album
  let memoryStorage
  let actionSheetTapIndexes
  let selectedMediaFile
  let pageConfig

  function createPageInstance(config) {
    return {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      isLeaving: false,
      setData(updates) {
        this.data = {
          ...this.data,
          ...updates
        }
      }
    }
  }

  function loadPreviewPageWithVehicles(vehicleCount = 1) {
    const cache = storage.initCache()
    for (let index = 0; index < vehicleCount; index += 1) {
      cache.vehicles.push(storage.createVehicle(index))
    }
    storage.saveCache(cache)

    pageConfig = null
    jest.isolateModules(() => {
      require('../packageD/pages/preview/preview')
    })

    const page = createPageInstance(pageConfig)
    page.loadData()
    return page
  }

  function loadPreviewPageWithCache(cache) {
    storage.saveCache(cache)

    pageConfig = null
    jest.isolateModules(() => {
      require('../packageD/pages/preview/preview')
    })

    const page = createPageInstance(pageConfig)
    page.loadData()
    return page
  }

  function buildAuxUploadItems(vehicleId) {
    return [
      {
        uploadItemId: `${vehicleId}_DRIVING_LICENSE_FRONT`,
        photoType: 'DRIVING_LICENSE_FRONT',
        photoName: '行驶证正页',
        maxCount: 1,
        uploadedCount: 0
      },
      {
        uploadItemId: `${vehicleId}_DRIVING_LICENSE_BACK`,
        photoType: 'DRIVING_LICENSE_BACK',
        photoName: '行驶证副页',
        maxCount: 1,
        uploadedCount: 0
      },
      {
        uploadItemId: `${vehicleId}_DRIVING_LICENSE_ELECTRONIC`,
        photoType: 'DRIVING_LICENSE_ELECTRONIC',
        photoName: '电子行驶证',
        maxCount: 1,
        uploadedCount: 0
      }
    ]
  }

  function createAuxVehicle(index, vehicleId) {
    const vehicle = storage.createVehicle(index)
    vehicle.id = vehicleId
    vehicle.vehicleId = vehicleId
    vehicle.backendVehicleId = vehicleId
    vehicle.vehicleRoleName = index === 0 ? '标的车' : '三者车'
    vehicle.displayName = `${vehicle.vehicleRoleName} 京A0000${index}`
    vehicle.uploadItems = buildAuxUploadItems(vehicleId)
    return vehicle
  }

  beforeEach(() => {
    jest.resetModules()
    memoryStorage = {}
    actionSheetTapIndexes = []
    selectedMediaFile = {
      tempFilePath: '/tmp/license.jpg',
      size: 456789
    }

    jest.doMock('../packageD/utils/compress', () => ({
      compressImage: jest.fn(async (filePath) => ({
        tempFilePath: filePath,
        compressedPath: `${filePath}.compressed`,
        fileSize: 123456
      }))
    }))

    jest.doMock('../packageD/utils/album', () => ({
      SAVE_FAIL_TEXT: '照片未保存到相册，不影响拍摄',
      saveConfirmedPhotoToAlbum: jest.fn(async (photo) => ({
        saved: true,
        filePath: photo.compressedPath
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
      showActionSheet: jest.fn(({ success }) => {
        success({ tapIndex: actionSheetTapIndexes.shift() || 0 })
      }),
      chooseMedia: jest.fn(({ success }) => {
        success({ tempFiles: [selectedMediaFile] })
      }),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showToast: jest.fn(),
      showModal: jest.fn(({ success }) => {
        success({ confirm: true })
      }),
      previewImage: jest.fn(),
      redirectTo: jest.fn(),
      navigateTo: jest.fn()
    }

    global.Page = jest.fn((config) => {
      pageConfig = config
    })

    storage = require('../packageD/utils/storage')
    documents = require('../packageD/utils/documents')
    compress = require('../packageD/utils/compress')
    album = require('../packageD/utils/album')
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../packageD/utils/compress')
    jest.dontMock('../packageD/utils/album')
  })

  test('uploads front page into current vehicle documents from camera without saving album immediately', async () => {
    actionSheetTapIndexes = [0]
    const page = loadPreviewPageWithVehicles(1)

    page.onOpenDrivingLicensePanel({
      currentTarget: {
        dataset: { vehicle: 0 }
      }
    })
    page.onSwitchDrivingLicenseMode({
      currentTarget: {
        dataset: { mode: documents.DOCUMENT_SELECTIONS.PHYSICAL }
      }
    })

    await page.onTapDrivingLicenseSlot({
      currentTarget: {
        dataset: {
          side: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE,
          uploaded: false
        }
      }
    })

    const vehicle = storage.loadCache().vehicles[0]
    expect(global.wx.chooseMedia).toHaveBeenCalledWith(expect.objectContaining({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera']
    }))
    expect(compress.compressImage).toHaveBeenCalledWith('/tmp/license.jpg', {
      maxFileSize: 400 * 1024
    })
    expect(vehicle.documents).toHaveLength(1)
    expect(vehicle.documents[0]).toEqual(expect.objectContaining({
      docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
      docSide: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE,
      sourceType: 'camera',
      tempFilePath: '/tmp/license.jpg',
      compressedPath: '/tmp/license.jpg.compressed',
      size: 456789,
      compressedSize: 123456
    }))
    expect(album.saveConfirmedPhotoToAlbum).not.toHaveBeenCalled()
  })

  test('opens missing document slot directly in custom panel without electronic or physical native sheet', () => {
    const page = loadPreviewPageWithVehicles(1)

    page.onOpenDrivingLicensePanel({
      currentTarget: {
        dataset: {
          vehicle: 0,
          docType: documents.DOCUMENT_TYPES.DRIVER_LICENSE
        }
      }
    })

    const vehicle = storage.loadCache().vehicles[0]
    expect(global.wx.showActionSheet).not.toHaveBeenCalled()
    expect(vehicle.documentSelections.driver_license).toBe(documents.DOCUMENT_SELECTIONS.ELECTRONIC)
    expect(page.data.showDrivingLicensePanel).toBe(true)
    expect(page.data.drivingLicenseMode).toBe(documents.DOCUMENT_SELECTIONS.ELECTRONIC)
    expect(page.data.activeDrivingLicenseDocType).toBe(documents.DOCUMENT_TYPES.DRIVER_LICENSE)
    expect(page.data.activeDrivingLicenseSlots).toHaveLength(1)
  })

  test('switches document panel between electronic and physical modes before choosing source', () => {
    const page = loadPreviewPageWithVehicles(1)

    page.onOpenDrivingLicensePanel({
      currentTarget: {
        dataset: {
          vehicle: 0,
          docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE
        }
      }
    })
    expect(page.data.drivingLicenseMode).toBe(documents.DOCUMENT_SELECTIONS.ELECTRONIC)
    expect(page.data.activeDrivingLicenseSlots.map((slot) => slot.docSide)).toEqual([
      documents.DOCUMENT_SIDES.ELECTRONIC
    ])

    page.onSwitchDrivingLicenseMode({
      currentTarget: {
        dataset: { mode: documents.DOCUMENT_SELECTIONS.PHYSICAL }
      }
    })

    expect(page.data.drivingLicenseMode).toBe(documents.DOCUMENT_SELECTIONS.PHYSICAL)
    expect(page.data.activeDrivingLicenseSlots.map((slot) => slot.docSide)).toEqual([
      documents.DOCUMENT_SIDES.FRONT_PAGE,
      documents.DOCUMENT_SIDES.BACK_PAGE
    ])
    expect(storage.loadCache().vehicles[0].documentSelections.driving_license).toBe(documents.DOCUMENT_SELECTIONS.PHYSICAL)
    expect(global.wx.showActionSheet).not.toHaveBeenCalled()
  })

  test('keeps uploaded document action menu with view reupload and delete', async () => {
    const cache = storage.initCache()
    const vehicle = storage.createVehicle(0)
    vehicle.documentSelections[documents.DOCUMENT_TYPES.DRIVING_LICENSE] = documents.DOCUMENT_SELECTIONS.ELECTRONIC
    vehicle.documents = [{
      id: 'electronic-driving-license',
      docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
      docSide: documents.DOCUMENT_SIDES.ELECTRONIC,
      label: '行驶证',
      sourceType: 'album',
      tempFilePath: '/tmp/electronic.jpg',
      compressedPath: '/tmp/electronic-compressed.jpg',
      createdAt: 1000,
      updatedAt: 1000
    }]
    cache.vehicles.push(vehicle)
    const page = loadPreviewPageWithCache(cache)

    page.onOpenDrivingLicensePanel({
      currentTarget: {
        dataset: {
          vehicle: 0,
          docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE
        }
      }
    })
    expect(global.wx.showActionSheet).not.toHaveBeenCalled()

    await page.onTapDrivingLicenseSlot({
      currentTarget: {
        dataset: {
          docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
          side: documents.DOCUMENT_SIDES.ELECTRONIC,
          uploaded: true,
          uploadable: true
        }
      }
    })

    expect(global.wx.showActionSheet).toHaveBeenCalledWith(expect.objectContaining({
      itemList: ['查看', '重新上传', '删除']
    }))
  })

  test('uploads from album without saving back to system album', async () => {
    actionSheetTapIndexes = [1]
    selectedMediaFile = {
      tempFilePath: '/tmp/album-license.jpg',
      size: 1000
    }
    const page = loadPreviewPageWithVehicles(1)

    page.onOpenDrivingLicensePanel({
      currentTarget: {
        dataset: { vehicle: 0 }
      }
    })

    await page.onTapDrivingLicenseSlot({
      currentTarget: {
        dataset: {
          side: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE,
          uploaded: false
        }
      }
    })

    const vehicle = storage.loadCache().vehicles[0]
    expect(global.wx.chooseMedia).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: ['album']
    }))
    expect(vehicle.documents[0].sourceType).toBe('album')
    expect(album.saveConfirmedPhotoToAlbum).not.toHaveBeenCalled()
  })

  test('uploads electronic driving license with backend upload metadata in aux photo mode', async () => {
    actionSheetTapIndexes = [0]
    const cache = storage.initCache()
    cache.auxPhoto = {
      enabled: true,
      ticket: 'mock-1'
    }
    cache.vehicles.push(createAuxVehicle(0, 'LOSS_VEHICLE_100001'))
    const page = loadPreviewPageWithCache(cache)

    page.onOpenDrivingLicensePanel({
      currentTarget: {
        dataset: { vehicle: 0 }
      }
    })
    page.onSwitchDrivingLicenseMode({
      currentTarget: {
        dataset: { mode: documents.DOCUMENT_SELECTIONS.PHYSICAL }
      }
    })

    await page.onTapDrivingLicenseSlot({
      currentTarget: {
        dataset: {
          side: documents.DRIVING_LICENSE_SIDES.ELECTRONIC,
          uploaded: false,
          uploadable: true
        }
      }
    })

    const vehicle = storage.loadCache().vehicles[0]
    expect(vehicle.documents).toHaveLength(1)
    expect(vehicle.documents[0]).toEqual(expect.objectContaining({
      docSide: documents.DRIVING_LICENSE_SIDES.ELECTRONIC,
      vehicleId: 'LOSS_VEHICLE_100001',
      uploadItemId: 'LOSS_VEHICLE_100001_DRIVING_LICENSE_ELECTRONIC',
      photoType: 'DRIVING_LICENSE_ELECTRONIC'
    }))
  })

  test('defensively blocks manual vehicle changes in aux photo mode', () => {
    const cache = storage.initCache()
    cache.auxPhoto = {
      enabled: true,
      ticket: 'mock-2'
    }
    cache.vehicles.push(
      createAuxVehicle(0, 'LOSS_VEHICLE_100001'),
      createAuxVehicle(1, 'LOSS_VEHICLE_100002')
    )
    const page = loadPreviewPageWithCache(cache)

    page.addThirdVehicle()
    page.onDeleteVehicle({
      currentTarget: {
        dataset: { vehicleIndex: 1 }
      }
    })

    expect(storage.loadCache().vehicles).toHaveLength(2)
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(global.wx.showModal).not.toHaveBeenCalledWith(expect.objectContaining({
      title: '删除确认'
    }))
  })

  test('keeps uploaded camera document without final album save side effects', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    actionSheetTapIndexes = [0]
    const page = loadPreviewPageWithVehicles(1)

    page.onOpenDrivingLicensePanel({
      currentTarget: {
        dataset: { vehicle: 0 }
      }
    })
    page.onSwitchDrivingLicenseMode({
      currentTarget: {
        dataset: { mode: documents.DOCUMENT_SELECTIONS.PHYSICAL }
      }
    })

    await page.onTapDrivingLicenseSlot({
      currentTarget: {
        dataset: {
          side: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE,
          uploaded: false
        }
      }
    })

    const vehicle = storage.loadCache().vehicles[0]
    expect(vehicle.documents).toHaveLength(1)
    expect(vehicle.documents[0].compressedPath).toBe('/tmp/license.jpg.compressed')
    expect(global.wx.showToast).not.toHaveBeenCalledWith({ title: '处理失败', icon: 'none' })
    expect(album.saveConfirmedPhotoToAlbum).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalledWith(
      '[preview] save_driving_license_album_failed',
      expect.anything()
    )

    warnSpy.mockRestore()
  })

  test('shows one risk prompt when any vehicle driving license is incomplete', () => {
    const page = loadPreviewPageWithVehicles(3)

    page.onSubmit()

    expect(page.data.showModal).toBe(true)
    expect(page.data.modalType).toBe('drivingLicenseRisk')
    expect(page.data.modalContent).toBe('证件信息不全，建议补充驾驶证和行驶证。如确实无法提供，可后续通过其他方式提供。是否确认提交？')
    expect(page.data.modalCancelText).toBe('返回补充')
    expect(page.data.modalConfirmText).toBe('确认提交')
  })

  test('shows backend vehicle display name and disables manual vehicle changes in aux photo mode', () => {
    const cache = storage.initCache()
    const vehicle = storage.createVehicle(0)
    cache.auxPhoto = {
      enabled: true,
      ticket: 'mock-1'
    }
    vehicle.vehicleRoleName = '标的车'
    vehicle.licenseNo = '京A12345'
    vehicle.displayName = '标的车 京A12345'
    cache.vehicles.push(vehicle)
    storage.saveCache(cache)

    pageConfig = null
    jest.isolateModules(() => {
      require('../packageD/pages/preview/preview')
    })
    const page = createPageInstance(pageConfig)
    page.loadData()

    expect(page.data.vehicles[0]).toEqual(expect.objectContaining({
      previewName: '标的车 京A12345',
      previewTag: '标的车',
      canDelete: false
    }))
    expect(page.data.canAddThirdVehicle).toBe(false)
  })

  test('asks for third vehicle before driving license risk prompt', () => {
    const page = loadPreviewPageWithVehicles(1)

    page.onSubmit()

    expect(page.data.showModal).toBe(true)
    expect(page.data.modalType).toBe('thirdVehicle')
    expect(page.data.modalContent).toBe('确认所有车辆损伤均已拍摄，无需增加其他三者车？')
    expect(page.data.modalCancelText).toBe('否，添加其他三者车')
    expect(page.data.modalConfirmText).toBe('是，继续提交')

    page.onModalConfirm()

    expect(page.data.showModal).toBe(true)
    expect(page.data.modalType).toBe('drivingLicenseRisk')
    expect(page.data.modalConfirmText).toBe('确认提交')
  })

  test('dismisses third vehicle prompt from mask without adding a vehicle', () => {
    const page = loadPreviewPageWithVehicles(1)

    page.onSubmit()
    page.onModalMaskTap()

    expect(page.data.showModal).toBe(false)
    expect(storage.loadCache().vehicles).toHaveLength(1)
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
  })

  test('continues to upload overlay after risk confirmation', () => {
    const page = loadPreviewPageWithVehicles(3)

    page.onSubmit()
    page.onModalConfirm()

    const cache = storage.loadCache()
    expect(page.data.showUploadOverlay).toBe(true)
    expect(cache.uploadSession).toEqual(expect.objectContaining({
      phase: 'ready',
      total: 0
    }))
    expect(global.wx.redirectTo).not.toHaveBeenCalledWith({
      url: '/packageD/pages/complete/complete'
    })
    page.onUnload()
  })

  test('taps driving license thumbnail into the existing fullscreen preview', () => {
    const cache = storage.initCache()
    const vehicle = storage.createVehicle(0)
    vehicle.documents = [{
      id: 'front-id',
      docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
      docSide: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE,
      label: '行驶证正页',
      sourceType: 'album',
      tempFilePath: '/tmp/front.jpg',
      compressedPath: '/tmp/front-compressed.jpg',
      createdAt: 1000,
      updatedAt: 1000
    }]
    cache.vehicles.push(vehicle)
    storage.saveCache(cache)

    pageConfig = null
    jest.isolateModules(() => {
      require('../packageD/pages/preview/preview')
    })
    const page = createPageInstance(pageConfig)
    page.loadData()

    page.onPreview({
      currentTarget: {
        dataset: {
          vehicle: 0,
          type: 'vehicleDocument',
          docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
          docSide: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE
        }
      }
    })

    expect(page.data.showPreview).toBe(true)
    expect(page.data.currentPhoto).toEqual(expect.objectContaining({
      type: 'vehicleDocument',
      docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
      docSide: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE,
      url: '/tmp/front-compressed.jpg'
    }))
    expect(page.data.currentPhoto.captureMode).toBeUndefined()
  })

  test('deletes driving license from fullscreen preview footer', () => {
    const page = loadPreviewPageWithVehicles(1)
    storage.saveVehicleDocument(0, {
      docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
      docSide: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE,
      label: '行驶证正页',
      sourceType: 'album',
      tempFilePath: '/tmp/front.jpg',
      compressedPath: '/tmp/front-compressed.jpg',
      createdAt: 1000,
      updatedAt: 1000
    })
    page.loadData()
    page.setData({
      showPreview: true,
      currentPhoto: {
        vehicle: 0,
        type: 'vehicleDocument',
        docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        docSide: documents.DRIVING_LICENSE_SIDES.FRONT_PAGE
      }
    })

    page.onDelete()

    expect(storage.loadCache().vehicles[0].documents).toEqual([])
    expect(page.data.showPreview).toBe(false)
  })

  test('delete returns the document tile to matching upload entry', () => {
    const page = loadPreviewPageWithVehicles(1)
    storage.saveVehicleDocument(0, {
      docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
      docSide: documents.DOCUMENT_SIDES.ELECTRONIC,
      label: '行驶证',
      sourceType: 'album',
      tempFilePath: '/tmp/electronic.jpg',
      compressedPath: '/tmp/electronic-compressed.jpg',
      createdAt: 1000,
      updatedAt: 1000
    })
    page.loadData()
    page.setData({
      showPreview: true,
      currentPhoto: {
        vehicle: 0,
        type: 'vehicleDocument',
        docType: documents.DOCUMENT_TYPES.DRIVING_LICENSE,
        docSide: documents.DOCUMENT_SIDES.ELECTRONIC
      }
    })

    page.onDelete()

    const drivingLicenseTile = page.data.vehicles[0].vehicleDocumentPreview.displayItems
      .find((item) => item.docType === documents.DOCUMENT_TYPES.DRIVING_LICENSE)
    expect(drivingLicenseTile).toEqual(expect.objectContaining({
      type: 'upload',
      label: '行驶证',
      uploaded: false
    }))
  })

  test('retakes collected document through existing source sheet', () => {
    const cache = storage.initCache()
    const vehicle = storage.createVehicle(0)
    vehicle.documents = [{
      id: 'electronic-id',
      docType: documents.DOCUMENT_TYPES.DRIVER_LICENSE,
      docSide: documents.DOCUMENT_SIDES.ELECTRONIC,
      label: '驾驶证',
      sourceType: 'album',
      tempFilePath: '/tmp/driver.jpg',
      compressedPath: '/tmp/driver-compressed.jpg',
      createdAt: 1000,
      updatedAt: 1000
    }]
    cache.vehicles.push(vehicle)
    const page = loadPreviewPageWithCache(cache)
    page.setData({
      currentPhoto: {
        vehicle: 0,
        type: 'vehicleDocument',
        docType: documents.DOCUMENT_TYPES.DRIVER_LICENSE,
        docSide: documents.DOCUMENT_SIDES.ELECTRONIC
      }
    })

    page.onRetake()

    expect(page.data.showPreview).toBe(false)
    expect(page.data.activeDrivingLicenseVehicleIndex).toBe(0)
    expect(page.data.activeDrivingLicenseDocType).toBe(documents.DOCUMENT_TYPES.DRIVER_LICENSE)
    expect(global.wx.showActionSheet).toHaveBeenCalledWith(expect.objectContaining({
      itemList: ['拍照', '从手机相册选择']
    }))
  })
})
