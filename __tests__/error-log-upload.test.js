describe('runtimeLogger backend error upload', () => {
  let realtimeLog

  beforeEach(() => {
    jest.useFakeTimers()
    jest.resetModules()
    realtimeLog = {
      setFilterMsg: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      forceWarn: jest.fn(),
      forceError: jest.fn()
    }
  })

  afterEach(() => {
    jest.useRealTimers()
    delete global.wx
    delete global.getApp
    jest.dontMock('../packageD/utils/realtime-log')
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/bootstrap')
  })

  function setupRuntimeLoggerTest({
    ticket = 'AUX202606150001',
    requestImpl,
    errorLogConfig = {},
    networkType = 'wifi'
  } = {}) {
    const storage = {
      selfcam_aux_ticket: ticket
    }
    global.wx = {
      getStorageSync: jest.fn((key) => storage[key]),
      setStorageSync: jest.fn((key, value) => {
        storage[key] = value
      }),
      removeStorageSync: jest.fn((key) => {
        delete storage[key]
      }),
      request: jest.fn(requestImpl || ((options) => {
        if (options.success) {
          options.success({
            statusCode: 200,
            data: {
              success: true
            }
          })
        }
        if (options.complete) {
          options.complete()
        }
      })),
      getNetworkType: jest.fn(({ success }) => {
        success({ networkType })
      }),
      getSystemInfoSync: jest.fn(() => ({
        brand: 'HUAWEI',
        model: 'nova13',
        system: 'OpenHarmony',
        platform: 'ohos',
        SDKVersion: '3.15.1',
        language: 'zh_CN',
        version: '8.0.1'
      }))
    }
    global.getApp = jest.fn(() => ({
      globalData: {
        selfCam: {
          ticket
        }
      }
    }))
    jest.doMock('../packageD/utils/realtime-log', () => realtimeLog)
    jest.doMock('../packageD/utils/bootstrap', () => ({
      AUX_TICKET_STORAGE_KEY: 'selfcam_aux_ticket',
      getTicket: jest.fn(() => ticket)
    }))
    jest.doMock('../packageD/utils/env-config', () => ({
      getEnvVersion: jest.fn(() => 'trial'),
      getDebugConfig: jest.fn(() => ({
        runtimeLoggerLevel: 'info',
        uploadEnabled: false,
        uploadUrl: '',
        maxEntries: 20,
        maxPendingEntries: 10,
        batchSize: 10,
        uploadThrottleMs: 100,
        requestTimeoutMs: 1000
      })),
      getErrorLogConfig: jest.fn(() => ({
        wxEnvVersion: 'trial',
        envVersion: 'trial',
        appEnv: 'sit',
        uploadEnabled: true,
        uploadUrl: 'https://onlineclaim.example.com/onlineclaim/rest/onlineclaim/AuxPhotoService/reportMiniappError',
        maxPendingEntries: 20,
        uploadThrottleMs: 1000,
        requestTimeoutMs: 2500,
        ...errorLogConfig
      }))
    }))
  }

  test('uploads whitelisted error logs with ticket and flat safe payload', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    runtimeLogger.forceError('ai_model', 'session_create_failed', {
      step: 'damage',
      stage: 'inference_session_create',
      statusCode: 500,
      message: 'create session failed',
      errMsg: 'wx.createInferenceSession failed',
      token: 'secret-token',
      fileBase64: 'BASE64_IMAGE_DATA',
      systemInfo: {
        cookie: 'secret-cookie',
        system: 'OpenHarmony'
      }
    })

    jest.runOnlyPendingTimers()

    expect(global.wx.request).toHaveBeenCalledTimes(1)
    const requestOptions = global.wx.request.mock.calls[0][0]
    expect(requestOptions).toEqual(expect.objectContaining({
      url: 'https://onlineclaim.example.com/onlineclaim/rest/onlineclaim/AuxPhotoService/reportMiniappError',
      method: 'POST',
      timeout: 2500
    }))
    expect(requestOptions.data).toEqual(expect.objectContaining({
      ticket: 'AUX202606150001',
      errorCode: 'AI_MODEL_SESSION_CREATE_FAILED',
      errorMessage: '模型会话创建失败',
      appVersion: '1.5.1',
      envVersion: 'trial',
      sdkVersion: '3.15.1',
      networkType: 'wifi',
      systemBrand: 'HUAWEI',
      systemModel: 'nova13',
      systemOs: 'OpenHarmony',
      systemPlatform: 'ohos',
      systemLanguage: 'zh_CN'
    }))
    expect(requestOptions.data.clientTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(requestOptions.data.errorStack).toContain('scope=ai_model')
    expect(requestOptions.data.errorStack).toContain('event=session_create_failed')
    expect(requestOptions.data.errorStack).toContain('stage=inference_session_create')
    expect(requestOptions.data.errorStack).toContain('statusCode=500')
    expect(requestOptions.data).not.toHaveProperty('reportNo')
    expect(requestOptions.data).not.toHaveProperty('logs')
    expect(JSON.stringify(requestOptions.data)).not.toContain('secret-token')
    expect(JSON.stringify(requestOptions.data)).not.toContain('secret-cookie')
    expect(JSON.stringify(requestOptions.data)).not.toContain('BASE64_IMAGE_DATA')
  })

  test('does not upload warnings even when the event is whitelisted', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    runtimeLogger.forceWarn('ai', 'detector_init_failed', {
      message: 'detector failed'
    })

    jest.runOnlyPendingTimers()

    expect(global.wx.request).not.toHaveBeenCalled()
  })

  test('does not upload when ticket is missing', () => {
    setupRuntimeLoggerTest({ ticket: '' })
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    runtimeLogger.forceError('camera', 'camera_error', {
      message: 'camera failed'
    })

    jest.runOnlyPendingTimers()

    expect(global.wx.request).not.toHaveBeenCalled()
  })

  test('does not fall back to stale stored ticket when current ticket is missing', () => {
    setupRuntimeLoggerTest({ ticket: '' })
    global.wx.getStorageSync.mockImplementation((key) => {
      if (key === 'selfcam_aux_ticket') {
        return 'AUX_OLD_TICKET_001'
      }
      return ''
    })
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    runtimeLogger.forceError('camera', 'camera_error', {
      message: 'camera failed'
    })

    jest.runOnlyPendingTimers()

    expect(global.wx.request).not.toHaveBeenCalled()
  })

  test('does not upload mock tickets', () => {
    setupRuntimeLoggerTest({ ticket: 'mock-2' })
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    runtimeLogger.forceError('camera', 'camera_error', {
      message: 'camera failed'
    })

    jest.runOnlyPendingTimers()

    expect(global.wx.request).not.toHaveBeenCalled()
  })

  test('upload failure does not throw or block local logging', () => {
    setupRuntimeLoggerTest({
      requestImpl(options) {
        if (options.fail) {
          options.fail({ errMsg: 'request:fail' })
        }
        if (options.complete) {
          options.complete()
        }
      }
    })
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    expect(() => {
      runtimeLogger.forceError('capture', 'auto_capture_failed', {
        message: 'take photo failed'
      })
      jest.runOnlyPendingTimers()
    }).not.toThrow()

    expect(runtimeLogger.readLogs()).toHaveLength(1)
    expect(global.wx.request).toHaveBeenCalledTimes(1)
  })

  test('network type failure falls back to unknown and does not block upload', () => {
    setupRuntimeLoggerTest()
    global.wx.getNetworkType.mockImplementation(({ fail }) => {
      fail({ errMsg: 'getNetworkType:fail' })
    })
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    runtimeLogger.forceError('camera', 'camera_error', {
      message: 'camera failed'
    })
    jest.runOnlyPendingTimers()

    expect(global.wx.request).toHaveBeenCalledTimes(1)
    expect(global.wx.request.mock.calls[0][0].data.networkType).toBe('unknown')
  })

  test('upload failure does not schedule immediate retry loop', () => {
    setupRuntimeLoggerTest({
      requestImpl(options) {
        if (options.fail) {
          options.fail({ errMsg: 'request:fail' })
        }
        if (options.complete) {
          options.complete()
        }
      }
    })
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    runtimeLogger.forceError('camera', 'camera_error', {
      message: 'camera failed'
    })
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    expect(global.wx.request).toHaveBeenCalledTimes(1)
  })
})
