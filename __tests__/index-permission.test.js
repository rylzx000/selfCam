describe('index start permission flow', () => {
  let pageConfig
  let storage
  let constants
  let permission
  let envConfig
  let modelCache
  let auxPhotoApi
  let auxPhotoMapper
  let bootstrap
  let consoleLogSpy
  let consoleWarnSpy

  const blockedMessages = {
    COMPLETED: '照片已完成采集，请勿重复操作。',
    EXPIRED: '辅助拍照链接已过期，请联系查勘员重新发送链接。',
    REVOKED: '辅助拍照链接已作废，请联系查勘员重新发送链接。'
  }

  function loadIndexPage() {
    jest.resetModules()
    pageConfig = null

    constants = {
      SHOOT_STEP: {
        SCENE_45: 'scene45',
        SCENE_SUPPLEMENT: 'sceneSupplement',
        LICENSE_PLATE: 'licensePlate',
        VIN_CODE: 'vinCode',
        DAMAGE: 'damage',
        MODULE_ONE_PREVIEW: 'moduleOnePreview',
        MODULE_THREE: 'moduleThree',
        FINAL_PREVIEW: 'finalPreview',
        PREVIEW: 'preview'
      }
    }
    storage = {
      initCache: jest.fn(() => ({
        vehicles: []
      })),
      createVehicle: jest.fn(() => ({
        type: 'target'
      })),
      saveCache: jest.fn(),
      loadCache: jest.fn(() => ({
        saved: true
      })),
      loadCacheForResume: jest.fn(() => null),
      clearCache: jest.fn()
    }
    permission = {
      ensureStartCapturePermissions: jest.fn()
    }
    envConfig = {
      getAppEnvBadgeText: jest.fn(() => ''),
      canSwitchAppEnv: jest.fn(() => true),
      getAvailableAppEnvs: jest.fn(() => ['dev', 'sit']),
      saveAppEnvOverride: jest.fn(() => true),
      clearAppEnvOverride: jest.fn(),
      isRelease: jest.fn(() => false)
    }
    modelCache = {
      clearAiModelCache: jest.fn(() => Promise.resolve({
        ok: true,
        appEnv: 'sit',
        wxEnvVersion: 'trial',
        results: [
          { modelName: 'plate', path: '/user-data/plate.onnx', deleted: true, reason: 'deleted', errMsg: '' },
          { modelName: 'damage', path: '/user-data/damage.onnx', deleted: true, reason: 'deleted', errMsg: '' }
        ]
      }))
    }
    auxPhotoApi = {
      init: jest.fn()
    }
    bootstrap = {
      bootstrap: jest.fn(),
      getTicket: jest.fn(() => '')
    }
    auxPhotoMapper = {
      buildCacheFromInit: jest.fn(() => ({
        auxPhoto: {
          enabled: true,
          ticket: 'mock-2'
        },
        vehicles: [
          {
            id: 'LOSS_VEHICLE_100001',
            displayName: '标的车 京A12345'
          },
          {
            id: 'LOSS_VEHICLE_100002',
            displayName: '三者车 京B12345'
          }
        ],
        currentVehicleIndex: 0,
        currentStep: 'licensePlate'
      }))
    }

    global.wx = {
      navigateTo: jest.fn(({ success }) => {
        success && success()
      }),
      showToast: jest.fn(),
      showModal: jest.fn(),
      showActionSheet: jest.fn()
    }
    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })

    jest.doMock('../packageD/utils/storage', () => storage)
    jest.doMock('../packageD/utils/constants', () => constants)
    jest.doMock('../packageD/utils/permission', () => permission)
    jest.doMock('../packageD/utils/env-config', () => envConfig)
    jest.doMock('../packageD/utils/model-cache', () => modelCache)
    jest.doMock('../packageD/utils/bootstrap', () => bootstrap)
    jest.doMock('../packageD/utils/aux-photo-api', () => auxPhotoApi)
    jest.doMock('../packageD/utils/aux-photo-mapper', () => auxPhotoMapper)

    require('../packageD/pages/index/index')
  }

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    loadIndexPage()
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    delete global.getApp
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    jest.clearAllMocks()
    jest.dontMock('../packageD/utils/storage')
    jest.dontMock('../packageD/utils/constants')
    jest.dontMock('../packageD/utils/permission')
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/model-cache')
    jest.dontMock('../packageD/utils/bootstrap')
    jest.dontMock('../packageD/utils/aux-photo-api')
    jest.dontMock('../packageD/utils/aux-photo-mapper')
  })

  test('does not initialize capture flow when camera permission is denied', async () => {
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: false,
      albumGranted: false
    })

    await pageConfig.onStart.call(pageConfig)

    expect(storage.initCache).not.toHaveBeenCalled()
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
  })

  test('continues original capture flow when album permission is denied but camera is granted', async () => {
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: false
    })

    await pageConfig.onStart.call(pageConfig)

    expect(storage.initCache).toHaveBeenCalled()
    expect(storage.createVehicle).toHaveBeenCalledWith(0)
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.SCENE_45,
      vehicles: [expect.objectContaining({ type: 'target' })]
    }))
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('does not clear existing aux photo cache on index load', () => {
    pageConfig.onLoad.call(pageConfig)

    expect(storage.clearCache).not.toHaveBeenCalled()
  })

  test.each([
    ['COMPLETED', ' completed '],
    ['EXPIRED', 'expired'],
    ['REVOKED', 'REVOKED']
  ])('blocks aux photo start when init ticketStatus is %s', async (status, rawStatus) => {
    bootstrap.getTicket.mockReturnValue('mock-2')
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        ticketStatus: rawStatus
      }
    })

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoApi.init).toHaveBeenCalledWith('mock-2')
    expect(permission.ensureStartCapturePermissions).not.toHaveBeenCalled()
    expect(storage.loadCacheForResume).not.toHaveBeenCalled()
    expect(auxPhotoMapper.buildCacheFromInit).not.toHaveBeenCalled()
    expect(storage.saveCache).not.toHaveBeenCalled()
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: blockedMessages[status],
      icon: 'none'
    })
  })

  test('blocks aux photo start when init data.status is expired', async () => {
    bootstrap.getTicket.mockReturnValue('mock-2')
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        status: ' expired '
      }
    })

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoApi.init).toHaveBeenCalledWith('mock-2')
    expect(permission.ensureStartCapturePermissions).not.toHaveBeenCalled()
    expect(auxPhotoMapper.buildCacheFromInit).not.toHaveBeenCalled()
    expect(storage.saveCache).not.toHaveBeenCalled()
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: blockedMessages.EXPIRED,
      icon: 'none'
    })
  })

  test.each(['CREATED', 'OPENED', 'UPLOADING'])('continues aux photo init flow when ticketStatus is %s', async (ticketStatus) => {
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        ticketStatus,
        vehicles: []
      }
    })
    bootstrap.getTicket.mockReturnValue('mock-2')

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoApi.init).toHaveBeenCalledWith('mock-2')
    expect(permission.ensureStartCapturePermissions).toHaveBeenCalledTimes(1)
    expect(auxPhotoMapper.buildCacheFromInit).toHaveBeenCalledWith(expect.objectContaining({
      ticket: 'mock-2',
      ticketStatus
    }))
    expect(storage.saveCache).toHaveBeenCalled()
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('resumes same ticket aux photo capture cache after init without overwrite', async () => {
    const existingCache = {
      auxPhoto: {
        enabled: true,
        ticket: 'mock-2'
      },
      vehicles: [
        {
          licensePlate: {
            status: 'completed',
            compressedPath: '/tmp/plate.jpg'
          },
          vinCode: {
            status: 'pending'
          },
          damages: []
        }
      ],
      currentVehicleIndex: 0,
      currentStep: constants.SHOOT_STEP.VIN_CODE,
      workflowState: {
        current: 'CAPTURING'
      }
    }
    storage.loadCacheForResume.mockReturnValue(existingCache)
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        ticketStatus: 'OPENED'
      }
    })
    bootstrap.getTicket.mockReturnValue('mock-2')

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoApi.init).toHaveBeenCalledWith('mock-2')
    expect(auxPhotoMapper.buildCacheFromInit).not.toHaveBeenCalled()
    expect(storage.saveCache).not.toHaveBeenCalled()
    expect(existingCache.vehicles[0].licensePlate.status).toBe('completed')
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test.each([
    ['scene45', 'CAPTURING', '/packageD/pages/camera/camera', 0],
    ['licensePlate', 'CAPTURING', '/packageD/pages/camera/camera', 1],
    ['vinCode', 'CAPTURING', '/packageD/pages/camera/camera', 1],
    ['damage', 'CAPTURING', '/packageD/pages/camera/camera', 1],
    ['moduleOnePreview', 'PREVIEWING', '/packageD/pages/preview/preview?mode=moduleOne', 0],
    ['damage', 'PREVIEWING', '/packageD/pages/preview/preview?mode=moduleTwo', 1],
    ['moduleThree', 'PREVIEWING', '/packageD/pages/preview/preview?mode=moduleThree', 1],
    ['finalPreview', 'PREVIEWING', '/packageD/pages/preview/preview?mode=final', 1]
  ])('resumes same ticket %s step to %s without overwriting vehicle index', async (currentStep, workflowState, expectedUrl, vehicleIndex) => {
    const existingCache = {
      auxPhoto: {
        enabled: true,
        ticket: 'mock-2'
      },
      vehicles: [
        {
          licensePlate: { status: 'completed', compressedPath: '/tmp/plate-0.jpg' },
          vinCode: { status: 'completed', compressedPath: '/tmp/vin-0.jpg' },
          damages: []
        },
        {
          licensePlate: { status: 'pending' },
          vinCode: { status: 'pending' },
          damages: []
        }
      ],
      currentVehicleIndex: vehicleIndex,
      currentStep,
      workflowState: {
        current: workflowState
      }
    }
    storage.loadCacheForResume.mockReturnValue(existingCache)
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        ticketStatus: 'OPENED'
      }
    })
    bootstrap.getTicket.mockReturnValue('mock-2')

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoMapper.buildCacheFromInit).not.toHaveBeenCalled()
    expect(storage.saveCache).not.toHaveBeenCalled()
    expect(existingCache.currentVehicleIndex).toBe(vehicleIndex)
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: expectedUrl
    }))
  })

  test('resumes same ticket upload cache to final preview page', async () => {
    storage.loadCacheForResume.mockReturnValue({
      auxPhoto: {
        enabled: true,
        ticket: 'mock-2'
      },
      vehicles: [{ licensePlate: { status: 'completed', compressedPath: '/tmp/plate.jpg' } }],
      currentStep: constants.SHOOT_STEP.PREVIEW,
      uploadSession: {
        phase: 'failed'
      },
      workflowState: {
        current: 'UPLOAD_FAILED'
      }
    })
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        ticketStatus: 'UPLOADING'
      }
    })
    bootstrap.getTicket.mockReturnValue('mock-2')

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoApi.init).toHaveBeenCalledWith('mock-2')
    expect(storage.saveCache).not.toHaveBeenCalled()
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/preview/preview?mode=final'
    }))
  })

  test('resumes same ticket completed cache to complete page', async () => {
    storage.loadCacheForResume.mockReturnValue({
      auxPhoto: {
        enabled: true,
        ticket: 'mock-2'
      },
      vehicles: [{ licensePlate: { status: 'completed', compressedPath: '/tmp/plate.jpg' } }],
      currentStep: constants.SHOOT_STEP.PREVIEW,
      uploadSession: {
        phase: 'completed',
        complete: {
          status: 'success'
        }
      },
      workflowState: {
        current: 'LOCAL_COMPLETED'
      }
    })
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        ticketStatus: 'OPENED'
      }
    })
    bootstrap.getTicket.mockReturnValue('mock-2')

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoApi.init).toHaveBeenCalledWith('mock-2')
    expect(storage.saveCache).not.toHaveBeenCalled()
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/complete/complete'
    }))
  })

  test('uses aux photo init and backend vehicles when ticket is present', async () => {
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        vehicles: [
          { vehicleId: 'LOSS_VEHICLE_100001', licenseNo: '京A12345' },
          { vehicleId: 'LOSS_VEHICLE_100002', licenseNo: '京B12345' }
        ]
      }
    })
    bootstrap.getTicket.mockReturnValue('mock-2')

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoApi.init).toHaveBeenCalledWith('mock-2')
    expect(auxPhotoMapper.buildCacheFromInit).toHaveBeenCalledWith(expect.objectContaining({
      ticket: 'mock-2'
    }))
    expect(storage.createVehicle).not.toHaveBeenCalled()
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      auxPhoto: expect.objectContaining({
        enabled: true,
        ticket: 'mock-2'
      }),
      vehicles: [
        expect.objectContaining({ displayName: '标的车 京A12345' }),
        expect.objectContaining({ displayName: '三者车 京B12345' })
      ]
    }))
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('reinitializes aux photo flow when cached ticket is different', async () => {
    storage.loadCacheForResume.mockReturnValue({
      auxPhoto: {
        enabled: true,
        ticket: 'mock-1'
      },
      vehicles: [
        {
          licensePlate: {
            status: 'completed',
            compressedPath: '/tmp/plate.jpg'
          }
        }
      ],
      currentStep: constants.SHOOT_STEP.VIN_CODE
    })
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    auxPhotoApi.init.mockResolvedValue({
      success: true,
      data: {
        ticket: 'mock-2',
        vehicles: []
      }
    })
    bootstrap.getTicket.mockReturnValue('mock-2')

    await pageConfig.onStart.call(pageConfig)

    expect(auxPhotoApi.init).toHaveBeenCalledWith('mock-2')
    expect(storage.saveCache).toHaveBeenCalledWith(expect.objectContaining({
      auxPhoto: expect.objectContaining({
        enabled: true,
        ticket: 'mock-2'
      })
    }))
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('blocks release start when ticket is missing', async () => {
    envConfig.isRelease.mockReturnValue(true)
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })

    await pageConfig.onStart.call(pageConfig)

    expect(permission.ensureStartCapturePermissions).not.toHaveBeenCalled()
    expect(storage.initCache).not.toHaveBeenCalled()
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '链接无效，请联系工作人员重新发送',
      icon: 'none'
    })
  })

  test('ignores duplicate start taps while capture flow is starting', async () => {
    let resolvePermission
    permission.ensureStartCapturePermissions.mockReturnValue(new Promise((resolve) => {
      resolvePermission = resolve
    }))

    const firstStart = pageConfig.onStart.call(pageConfig)
    const secondStart = pageConfig.onStart.call(pageConfig)

    expect(permission.ensureStartCapturePermissions).toHaveBeenCalledTimes(1)
    expect(storage.initCache).not.toHaveBeenCalled()

    resolvePermission({
      cameraGranted: true,
      albumGranted: true
    })

    await firstStart
    await secondStart

    expect(storage.initCache).toHaveBeenCalledTimes(1)
    expect(global.wx.navigateTo).toHaveBeenCalledTimes(1)
  })

  test('shows retry tip and releases start lock when start flow fails', async () => {
    const err = new Error('navigate failed')
    permission.ensureStartCapturePermissions.mockResolvedValue({
      cameraGranted: true,
      albumGranted: true
    })
    global.wx.navigateTo.mockImplementationOnce(({ fail }) => {
      fail(err)
    })

    await pageConfig.onStart.call(pageConfig)

    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '开始采集失败，请重试',
      icon: 'none'
    })
    expect(pageConfig.isStartingCapture).toBe(false)

    global.wx.navigateTo.mockImplementationOnce(({ success }) => {
      success && success()
    })

    await pageConfig.onStart.call(pageConfig)

    expect(global.wx.navigateTo).toHaveBeenCalledTimes(2)
  })

  test('hidden debug action clears AI model cache and shows success tip', async () => {
    const clearResult = await modelCache.clearAiModelCache()
    modelCache.clearAiModelCache.mockClear()
    global.wx.showActionSheet.mockImplementationOnce(({ itemList, success }) => {
      expect(itemList).toEqual(['dev', 'sit', '清除环境选择', '清除 AI 模型缓存'])
      success({ tapIndex: 3 })
    })

    pageConfig.showAppEnvSelector.call(pageConfig)
    await Promise.resolve()
    await Promise.resolve()

    expect(modelCache.clearAiModelCache).toHaveBeenCalledTimes(1)
    expect(consoleLogSpy).toHaveBeenCalledWith('[AI:model:cache:clear]', clearResult)
    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '模型缓存已清理',
      icon: 'none'
    })
  })
})
