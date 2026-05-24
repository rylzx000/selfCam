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
    jest.dontMock('../utils/realtime-log')
    jest.dontMock('../utils/env-config')
  })

  function setupRuntimeLoggerTest({
    reportNo = 'RPT202605180001',
    requestImpl,
    errorLogConfig = {}
  } = {}) {
    const storage = {
      selfcam_report_no: reportNo
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
              code: 'SUCCESS'
            }
          })
        }
        if (options.complete) {
          options.complete()
        }
      })),
      getSystemInfoSync: jest.fn(() => ({
        brand: 'HUAWEI',
        model: 'nova13',
        system: 'OpenHarmony',
        platform: 'ohos',
        SDKVersion: '3.15.1',
        version: '8.0.1'
      }))
    }
    global.getApp = jest.fn(() => ({
      globalData: {
        reportNo
      }
    }))
    jest.doMock('../utils/realtime-log', () => realtimeLog)
    jest.doMock('../utils/env-config', () => ({
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
        uploadUrl: 'https://online-platform.example.com/api/selfcam/v1/error-logs/batch',
        batchSize: 20,
        maxPendingEntries: 20,
        uploadThrottleMs: 1000,
        requestTimeoutMs: 2500,
        ...errorLogConfig
      }))
    }))
  }

  test('uploads whitelisted error logs with reportNo and safe payload', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../utils/runtime-logger')

    const entry = runtimeLogger.forceError('ai_model', 'session_create_failed', {
      feedbackId: 'selfCam_feedback-1',
      step: 'damage',
      stage: 'inference_session_create',
      statusCode: 500,
      message: 'create session failed',
      errMsg: 'wx.createInferenceSession failed',
      token: 'secret-token',
      systemInfo: {
        cookie: 'secret-cookie',
        system: 'OpenHarmony'
      }
    })

    jest.runOnlyPendingTimers()

    expect(global.wx.request).toHaveBeenCalledTimes(1)
    const requestOptions = global.wx.request.mock.calls[0][0]
    expect(requestOptions).toEqual(expect.objectContaining({
      url: 'https://online-platform.example.com/api/selfcam/v1/error-logs/batch',
      method: 'POST',
      timeout: 2500
    }))
    expect(requestOptions.data).toEqual(expect.objectContaining({
      appCode: 'selfCam',
      clientType: 'wechat_miniprogram',
      appEnv: 'sit',
      wxEnvVersion: 'trial',
      reportNo: 'RPT202605180001',
      sessionId: entry.sessionId,
      feedbackId: 'selfCam_feedback-1',
      logs: [
        expect.objectContaining({
          clientLogId: entry.id,
          level: 'error',
          scope: 'ai_model',
          event: 'session_create_failed',
          step: 'damage',
          stage: 'inference_session_create',
          statusCode: 500,
          message: 'create session failed',
          errMsg: 'wx.createInferenceSession failed',
          payload: expect.objectContaining({
            systemInfo: {
              system: 'OpenHarmony'
            }
          })
        })
      ]
    }))
    expect(JSON.stringify(requestOptions.data)).not.toContain('secret-token')
    expect(JSON.stringify(requestOptions.data)).not.toContain('secret-cookie')
  })

  test('does not upload non-error diagnostic logs', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../utils/runtime-logger')

    runtimeLogger.forceWarn('ai', 'camera_layout_snapshot', {
      feedbackId: 'selfCam_feedback-2',
      windowWidth: 1084
    })

    jest.runOnlyPendingTimers()

    expect(global.wx.request).not.toHaveBeenCalled()
  })

  test('does not upload when reportNo is missing', () => {
    setupRuntimeLoggerTest({ reportNo: '' })
    const runtimeLogger = require('../utils/runtime-logger')

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
    const runtimeLogger = require('../utils/runtime-logger')

    expect(() => {
      runtimeLogger.forceError('capture', 'auto_capture_failed', {
        message: 'take photo failed'
      })
      jest.runOnlyPendingTimers()
    }).not.toThrow()

    expect(runtimeLogger.readLogs()).toHaveLength(1)
    expect(global.wx.request).toHaveBeenCalledTimes(1)
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
    const runtimeLogger = require('../utils/runtime-logger')

    runtimeLogger.forceError('camera', 'camera_error', {
      message: 'camera failed'
    })
    jest.runOnlyPendingTimers()
    jest.runOnlyPendingTimers()

    expect(global.wx.request).toHaveBeenCalledTimes(1)
  })
})
