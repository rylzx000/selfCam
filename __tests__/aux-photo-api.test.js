describe('aux-photo api', () => {
  let runtimeLogger

  afterEach(() => {
    delete global.wx
    jest.resetModules()
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/runtime-logger')
  })

  function loadApi(config) {
    jest.resetModules()
    runtimeLogger = {
      error: jest.fn()
    }
    jest.doMock('../packageD/utils/env-config', () => ({
      getAuxPhotoConfig: jest.fn(() => config)
    }))
    jest.doMock('../packageD/utils/runtime-logger', () => runtimeLogger)
    return require('../packageD/utils/aux-photo-api')
  }

  test('uses mock init for mock tickets outside release', async () => {
    const api = loadApi({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      mockEnabled: true,
      requestEnabled: false,
      baseUrl: '',
      requestTimeoutMs: 5000
    })

    const result = await api.init('mock-2')

    expect(result.success).toBe(true)
    expect(result.data.ticket).toBe('mock-2')
    expect(result.data.vehicles).toHaveLength(2)
    expect(result.data.vehicles[0]).toEqual(expect.objectContaining({
      vehicleRole: 'INSURED',
      licenseNo: '京A12345'
    }))
  })

  test('does not use mock init in release', async () => {
    const api = loadApi({
      wxEnvVersion: 'release',
      envVersion: 'release',
      appEnv: 'prod',
      mockEnabled: false,
      requestEnabled: false,
      baseUrl: '',
      requestTimeoutMs: 5000
    })

    await expect(api.init('mock-2')).rejects.toEqual(expect.objectContaining({
      code: 'AUX_PHOTO_BASE_URL_MISSING'
    }))
  })

  test('calls real init endpoint when backend base url is configured', async () => {
    global.wx = {
      request: jest.fn(({ success }) => {
        success({
          statusCode: 200,
          data: {
            success: true,
            code: '0000',
            message: '初始化成功',
            data: {
              ticket: 'AUX_REAL_001',
              vehicles: []
            }
          }
        })
      })
    }
    const api = loadApi({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      mockEnabled: true,
      requestEnabled: true,
      baseUrl: 'https://onlineclaim.example.com',
      requestTimeoutMs: 5000
    })

    const result = await api.init('AUX_REAL_001')

    expect(result.data.ticket).toBe('AUX_REAL_001')
    expect(global.wx.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://onlineclaim.example.com/onlineclaim/AuxPhotoService/init',
      method: 'POST',
      timeout: 5000,
      data: {
        ticket: 'AUX_REAL_001',
        clientVersion: '1.4.9'
      }
    }))
  })

  test('uploads one photo as base64 json through wx.request', async () => {
    const readFile = jest.fn(({ success }) => {
      success({ data: 'BASE64_IMAGE_DATA' })
    })
    global.wx = {
      getFileSystemManager: jest.fn(() => ({
        readFile
      })),
      request: jest.fn(({ success }) => {
        success({
          statusCode: 200,
          data: {
            success: true,
            code: '0000',
            message: '图片上传成功',
            data: {
              uploadRecordId: 'AUP202605260001',
              photoId: 'DOC202605260001',
              vehicleId: 'LOSS_VEHICLE_100001',
              uploadItemId: 'LOSS_VEHICLE_100001_DAMAGE',
              photoType: 'DAMAGE',
              duplicate: false,
              itemUploadedCount: 1,
              ticketStatus: 'UPLOADING'
            }
          }
        })
      })
    }
    const api = loadApi({
      wxEnvVersion: 'develop',
      envVersion: 'develop',
      appEnv: 'dev',
      mockEnabled: true,
      requestEnabled: true,
      baseUrl: 'http://127.0.0.1:8787',
      requestTimeoutMs: 5000
    })

    const result = await api.uploadPhoto({
      clientPhotoId: 'damage-local-id',
      vehicleId: 'LOSS_VEHICLE_100001',
      uploadItemId: 'LOSS_VEHICLE_100001_DAMAGE',
      photoType: 'DAMAGE',
      sortNo: 2,
      filePath: 'wxfile://tmp/damage-2.jpg',
      fileSize: 2048
    }, {
      ticket: 'mock-2'
    })

    expect(result.data.uploadRecordId).toBe('AUP202605260001')
    expect(readFile).toHaveBeenCalledWith(expect.objectContaining({
      filePath: 'wxfile://tmp/damage-2.jpg',
      encoding: 'base64'
    }))
    expect(global.wx.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://127.0.0.1:8787/onlineclaim/AuxPhotoService/uploadPhotoBase64',
      method: 'POST',
      timeout: 5000,
      header: expect.objectContaining({
        'content-type': 'application/json'
      }),
      data: expect.objectContaining({
        ticket: 'mock-2',
        clientPhotoId: 'damage-local-id',
        vehicleId: 'LOSS_VEHICLE_100001',
        uploadItemId: 'LOSS_VEHICLE_100001_DAMAGE',
        photoType: 'DAMAGE',
        sortNo: 2,
        fileName: 'damage-2.jpg',
        fileBase64: 'BASE64_IMAGE_DATA'
      })
    }))
  })

  test('calls complete endpoint after uploads are ready', async () => {
    global.wx = {
      request: jest.fn(({ success }) => {
        success({
          statusCode: 200,
          data: {
            success: true,
            code: '0000',
            message: '辅助拍照已完成',
            data: {
              ticket: 'AUX_REAL_001',
              ticketStatus: 'COMPLETED',
              uploadedCount: 3,
              requiredPassed: true,
              missingItems: [],
              completeTime: '2026-05-26 10:30:00',
              phase2TriggerStatus: 'NOT_ENABLED'
            }
          }
        })
      })
    }
    const api = loadApi({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      mockEnabled: true,
      requestEnabled: true,
      baseUrl: 'https://onlineclaim.example.com',
      requestTimeoutMs: 5000
    })

    const result = await api.complete({
      ticket: 'AUX_REAL_001',
      clientUploadCount: 3
    })

    expect(result.data.ticketStatus).toBe('COMPLETED')
    expect(global.wx.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://onlineclaim.example.com/onlineclaim/AuxPhotoService/complete',
      method: 'POST',
      timeout: 5000,
      data: {
        ticket: 'AUX_REAL_001',
        clientUploadCount: 3,
        remark: ''
      }
    }))
  })

  test('logs init request failure through runtimeLogger.error', async () => {
    global.wx = {
      request: jest.fn(({ fail }) => {
        fail({ errMsg: 'request:fail timeout' })
      })
    }
    const api = loadApi({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      mockEnabled: true,
      requestEnabled: true,
      baseUrl: 'https://onlineclaim.example.com',
      requestTimeoutMs: 5000
    })

    await expect(api.init('AUX_REAL_001')).rejects.toEqual(expect.objectContaining({
      code: 'AUX_PHOTO_REQUEST_FAILED'
    }))

    expect(runtimeLogger.error).toHaveBeenCalledWith('api', 'request_failed', expect.objectContaining({
      apiName: 'init',
      stage: 'request',
      errorCode: 'AUX_PHOTO_REQUEST_FAILED',
      message: expect.any(String),
      errMsg: 'request:fail timeout'
    }))
  })

  test('logs uploadPhotoBase64 request failure through runtimeLogger.error without image data', async () => {
    const readFile = jest.fn(({ success }) => {
      success({ data: 'BASE64_IMAGE_DATA' })
    })
    global.wx = {
      getFileSystemManager: jest.fn(() => ({
        readFile
      })),
      request: jest.fn(({ fail }) => {
        fail({ errMsg: 'request:fail timeout' })
      })
    }
    const api = loadApi({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      mockEnabled: true,
      requestEnabled: true,
      baseUrl: 'https://onlineclaim.example.com',
      requestTimeoutMs: 5000
    })

    await expect(api.uploadPhoto({
      clientPhotoId: 'damage-local-id',
      vehicleId: 'LOSS_VEHICLE_100001',
      uploadItemId: 'LOSS_VEHICLE_100001_DAMAGE',
      photoType: 'DAMAGE',
      sortNo: 2,
      filePath: 'wxfile://tmp/damage-2.jpg',
      fileSize: 2048
    }, {
      ticket: 'AUX_REAL_001'
    })).rejects.toEqual(expect.objectContaining({
      code: 'AUX_PHOTO_UPLOAD_REQUEST_FAILED'
    }))

    expect(runtimeLogger.error).toHaveBeenCalledWith('api', 'request_failed', expect.objectContaining({
      apiName: 'uploadPhotoBase64',
      stage: 'request',
      errorCode: 'AUX_PHOTO_UPLOAD_REQUEST_FAILED',
      errMsg: 'request:fail timeout'
    }))
    const payload = runtimeLogger.error.mock.calls[0][2]
    expect(JSON.stringify(payload)).not.toContain('BASE64_IMAGE_DATA')
    expect(JSON.stringify(payload)).not.toContain('wxfile://tmp/damage-2.jpg')
  })

  test('logs complete request failure through runtimeLogger.error', async () => {
    global.wx = {
      request: jest.fn(({ fail }) => {
        fail({ errMsg: 'request:fail timeout' })
      })
    }
    const api = loadApi({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      mockEnabled: true,
      requestEnabled: true,
      baseUrl: 'https://onlineclaim.example.com',
      requestTimeoutMs: 5000
    })

    await expect(api.complete({
      ticket: 'AUX_REAL_001',
      clientUploadCount: 3
    })).rejects.toEqual(expect.objectContaining({
      code: 'AUX_PHOTO_COMPLETE_REQUEST_FAILED'
    }))

    expect(runtimeLogger.error).toHaveBeenCalledWith('api', 'request_failed', expect.objectContaining({
      apiName: 'complete',
      stage: 'request',
      errorCode: 'AUX_PHOTO_COMPLETE_REQUEST_FAILED',
      errMsg: 'request:fail timeout'
    }))
  })

  test('does not log mock upload or complete failures', async () => {
    const api = loadApi({
      wxEnvVersion: 'develop',
      envVersion: 'develop',
      appEnv: 'dev',
      mockEnabled: true,
      requestEnabled: false,
      baseUrl: '',
      requestTimeoutMs: 5000
    })

    await expect(api.uploadPhoto({
      clientPhotoId: 'damage-local-id',
      vehicleId: 'LOSS_VEHICLE_100001',
      uploadItemId: 'LOSS_VEHICLE_100001_DAMAGE',
      photoType: 'DAMAGE',
      sortNo: 2,
      filePath: 'wxfile://tmp/damage-2.jpg',
      fileSize: 2048,
      attempts: 2
    }, {
      ticket: 'mock-fail-always'
    })).rejects.toEqual(expect.objectContaining({
      code: 'MOCK_UPLOAD_FAILED'
    }))

    await expect(api.complete({
      ticket: 'mock-complete-fail-always',
      clientUploadCount: 3
    })).rejects.toEqual(expect.objectContaining({
      code: 'MOCK_COMPLETE_FAILED'
    }))

    expect(runtimeLogger.error).not.toHaveBeenCalled()
  })
})
