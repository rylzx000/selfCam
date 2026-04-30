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
      require('../pages/preview/preview')
    })

    const page = createPageInstance(pageConfig)
    page.loadData()
    return page
  }

  beforeEach(() => {
    jest.resetModules()
    memoryStorage = {}
    actionSheetTapIndexes = []
    selectedMediaFile = {
      tempFilePath: '/tmp/license.jpg',
      size: 456789
    }

    jest.doMock('../utils/compress', () => ({
      compressImage: jest.fn(async (filePath) => ({
        tempFilePath: filePath,
        compressedPath: `${filePath}.compressed`,
        fileSize: 123456
      }))
    }))

    jest.doMock('../utils/album', () => ({
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

    storage = require('../utils/storage')
    documents = require('../utils/documents')
    compress = require('../utils/compress')
    album = require('../utils/album')
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../utils/compress')
    jest.dontMock('../utils/album')
  })

  test('uploads front page into current vehicle documents from camera and saves album', async () => {
    actionSheetTapIndexes = [0]
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
    expect(album.saveConfirmedPhotoToAlbum).toHaveBeenCalledWith(expect.objectContaining({
      compressedPath: '/tmp/license.jpg.compressed'
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

  test('keeps uploaded document when saving camera source to album fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    album.saveConfirmedPhotoToAlbum.mockRejectedValueOnce(new Error('album save failed'))
    actionSheetTapIndexes = [0]
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
    expect(vehicle.documents).toHaveLength(1)
    expect(vehicle.documents[0].compressedPath).toBe('/tmp/license.jpg.compressed')
    expect(global.wx.showToast).not.toHaveBeenCalledWith({ title: '处理失败', icon: 'none' })
    expect(warnSpy).toHaveBeenCalledWith(
      '[preview] save_driving_license_album_failed',
      expect.any(Error)
    )

    warnSpy.mockRestore()
  })

  test('shows one risk prompt when any vehicle driving license is incomplete', () => {
    const page = loadPreviewPageWithVehicles(3)

    page.onSubmit()

    expect(page.data.showModal).toBe(true)
    expect(page.data.modalType).toBe('drivingLicenseRisk')
    expect(page.data.modalContent).toBe('仍有车辆未上传行驶证，会影响定损金额准确性，建议上传。如确实无法提供，请后续联系案件处理人员补充。是否确认提交？')
    expect(page.data.modalCancelText).toBe('返回补充')
    expect(page.data.modalConfirmText).toBe('确认提交')
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

  test('continues original completion after risk confirmation', () => {
    const page = loadPreviewPageWithVehicles(3)

    page.onSubmit()
    page.onModalConfirm()

    expect(global.wx.redirectTo).toHaveBeenCalledWith({
      url: '/pages/complete/complete'
    })
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
      require('../pages/preview/preview')
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
})
