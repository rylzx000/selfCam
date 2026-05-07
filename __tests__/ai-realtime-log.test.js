describe('AI realtime logging', () => {
  let realtimeLog
  let runtimeLogger

  beforeEach(() => {
    jest.resetModules()
    realtimeLog = {
      setFilterMsg: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      forceWarn: jest.fn(),
      forceError: jest.fn()
    }
    runtimeLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      forceWarn: jest.fn(),
      forceError: jest.fn()
    }
  })

  afterEach(() => {
    delete global.wx
    jest.dontMock('../utils/realtime-log')
    jest.dontMock('../utils/runtime-logger')
    jest.dontMock('../utils/env-config')
  })

  function setupRuntimeLoggerTest() {
    const storage = {}
    global.wx = {
      getStorageSync: jest.fn((key) => storage[key]),
      setStorageSync: jest.fn((key, value) => {
        storage[key] = value
      }),
      removeStorageSync: jest.fn()
    }
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
      }))
    }))
  }

  test('runtimeLogger.addLog forwards local logs to realtime log', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../utils/runtime-logger')

    const entry = runtimeLogger.addLog('info', 'ai', 'model_probe', {
      modelName: 'plate'
    })

    expect(entry).toEqual(expect.objectContaining({
      sessionId: expect.any(String),
      scope: 'ai',
      event: 'model_probe',
      at: expect.any(String)
    }))
    expect(realtimeLog.setFilterMsg).toHaveBeenCalledWith(entry.sessionId)
    expect(realtimeLog.info).toHaveBeenCalledWith('ai', 'model_probe', expect.objectContaining({
      sessionId: entry.sessionId,
      at: entry.at,
      modelName: 'plate'
    }))
  })

  test('runtimeLogger.startSession sets realtime log filter message', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../utils/runtime-logger')
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const sessionId = runtimeLogger.startSession('camera', { step: 'damage' })

      expect(realtimeLog.setFilterMsg).toHaveBeenCalledWith(sessionId)
      expect(realtimeLog.info).toHaveBeenCalledWith('camera', 'session_start', expect.objectContaining({
        sessionId,
        step: 'damage'
      }))
    } finally {
      consoleLogSpy.mockRestore()
    }
  })

  test('runtimeLogger.getSessionId always returns a session id', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../utils/runtime-logger')

    const sessionId = runtimeLogger.getSessionId()

    expect(sessionId).toEqual(expect.any(String))
    expect(sessionId).not.toBe('')
    expect(realtimeLog.setFilterMsg).toHaveBeenCalledWith(sessionId)
  })

  test('runtimeLogger.forceWarn forwards realtime log without level filtering', () => {
    setupRuntimeLoggerTest()
    jest.doMock('../utils/env-config', () => ({
      getEnvVersion: jest.fn(() => 'trial'),
      getDebugConfig: jest.fn(() => ({
        runtimeLoggerLevel: 'silent',
        uploadEnabled: false,
        uploadUrl: '',
        maxEntries: 20,
        maxPendingEntries: 10,
        batchSize: 10,
        uploadThrottleMs: 100,
        requestTimeoutMs: 1000
      }))
    }))
    const runtimeLogger = require('../utils/runtime-logger')

    const entry = runtimeLogger.forceWarn('diagnostic', 'realtime_probe', {
      probe: 'selfCam_realtime_probe'
    })

    expect(entry).toEqual(expect.objectContaining({
      sessionId: expect.any(String),
      level: 'warn',
      scope: 'diagnostic',
      event: 'realtime_probe'
    }))
    expect(realtimeLog.warn).toHaveBeenCalledWith('diagnostic', 'realtime_probe', expect.objectContaining({
      sessionId: entry.sessionId,
      probe: 'selfCam_realtime_probe'
    }))
  })

  test('runtimeLogger.forceError forwards realtime log without level filtering', () => {
    setupRuntimeLoggerTest()
    jest.doMock('../utils/env-config', () => ({
      getEnvVersion: jest.fn(() => 'trial'),
      getDebugConfig: jest.fn(() => ({
        runtimeLoggerLevel: 'silent',
        uploadEnabled: false,
        uploadUrl: '',
        maxEntries: 20,
        maxPendingEntries: 10,
        batchSize: 10,
        uploadThrottleMs: 100,
        requestTimeoutMs: 1000
      }))
    }))
    const runtimeLogger = require('../utils/runtime-logger')

    const entry = runtimeLogger.forceError('ai', 'ai_unavailable', {
      reason: 'detector_init_failed'
    })

    expect(entry).toEqual(expect.objectContaining({
      sessionId: expect.any(String),
      level: 'error',
      scope: 'ai',
      event: 'ai_unavailable'
    }))
    expect(realtimeLog.error).toHaveBeenCalledWith('ai', 'ai_unavailable', expect.objectContaining({
      sessionId: entry.sessionId,
      reason: 'detector_init_failed'
    }))
  })

  function setupDetectorTest(fsMock, wxOverrides = {}) {
    global.wx = {
      getFileSystemManager: jest.fn(() => fsMock),
      downloadFile: jest.fn(),
      createInferenceSession: jest.fn(),
      ...wxOverrides
    }
    jest.doMock('../utils/runtime-logger', () => runtimeLogger)
    jest.doMock('../utils/env-config', () => ({
      getAiConfig: jest.fn(() => ({
        plateModelUrl: 'https://example.com/plate.onnx',
        plateModelPath: '/tmp/plate.onnx',
        damageModelUrl: 'https://example.com/damage.onnx',
        damageModelPath: '/tmp/damage.onnx'
      })),
      getRuntimeFlags: jest.fn(() => ({
        appEnv: 'sit',
        wxEnvVersion: 'trial'
      }))
    }))
  }

  test('plate detector throws stage/statusCode/modelName when download status is not 200', async () => {
    const fsMock = {
      accessSync: jest.fn(() => {
        throw new Error('cache missing')
      }),
      copyFileSync: jest.fn()
    }
    setupDetectorTest(fsMock, {
      downloadFile: jest.fn(({ success }) => success({
        statusCode: 418,
        tempFilePath: '/tmp/plate-download.onnx'
      }))
    })
    const PlateDetector = require('../utils/plate-detector')
    const detector = new PlateDetector({
      modelUrl: 'https://example.com/plate.onnx',
      modelPath: '/tmp/plate.onnx'
    })

    await expect(detector.downloadModel()).rejects.toMatchObject({
      stage: 'download_status',
      modelName: 'plate',
      statusCode: 418,
      modelUrl: 'https://example.com/plate.onnx'
    })
    expect(runtimeLogger.info).toHaveBeenCalledWith('ai_model', 'download_start', expect.objectContaining({
      modelName: 'plate',
      modelUrl: 'https://example.com/plate.onnx',
      modelPath: '/tmp/plate.onnx'
    }))
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'download_status_failed', expect.objectContaining({
      modelName: 'plate',
      stage: 'download_status',
      statusCode: 418,
      modelUrl: 'https://example.com/plate.onnx',
      errMsg: ''
    }))
  })

  test('plate detector throws stage/modelUrl/errMsg when downloadFile fails', async () => {
    const fsMock = {
      accessSync: jest.fn(() => {
        throw new Error('cache missing')
      }),
      copyFileSync: jest.fn()
    }
    setupDetectorTest(fsMock, {
      downloadFile: jest.fn(({ fail }) => fail({
        errMsg: 'downloadFile:fail timeout'
      }))
    })
    const PlateDetector = require('../utils/plate-detector')
    const detector = new PlateDetector({
      modelUrl: 'https://example.com/plate.onnx',
      modelPath: '/tmp/plate.onnx'
    })

    await expect(detector.downloadModel()).rejects.toMatchObject({
      stage: 'download',
      modelName: 'plate',
      modelUrl: 'https://example.com/plate.onnx',
      errMsg: 'downloadFile:fail timeout'
    })
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'download_failed', expect.objectContaining({
      modelName: 'plate',
      stage: 'download',
      modelUrl: 'https://example.com/plate.onnx',
      errMsg: 'downloadFile:fail timeout'
    }))
  })

  test('damage detector throws stage/modelUrl/errMsg when downloadFile fails', async () => {
    const fsMock = {
      accessSync: jest.fn(() => {
        throw new Error('cache missing')
      }),
      copyFileSync: jest.fn()
    }
    setupDetectorTest(fsMock, {
      downloadFile: jest.fn(({ fail }) => fail({
        errMsg: 'downloadFile:fail url not in domain list'
      }))
    })
    const DamageDetector = require('../utils/damage-detector')
    const detector = new DamageDetector({
      modelUrl: 'https://example.com/damage.onnx',
      modelPath: '/tmp/damage.onnx'
    })

    await expect(detector.downloadModel()).rejects.toMatchObject({
      stage: 'download',
      modelName: 'damage',
      modelUrl: 'https://example.com/damage.onnx',
      errMsg: 'downloadFile:fail url not in domain list'
    })
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'download_failed', expect.objectContaining({
      modelName: 'damage',
      stage: 'download',
      modelUrl: 'https://example.com/damage.onnx',
      errMsg: 'downloadFile:fail url not in domain list'
    }))
  })

  test('damage detector throws stage/statusCode/modelName when download status is not 200', async () => {
    const fsMock = {
      accessSync: jest.fn(() => {
        throw new Error('cache missing')
      }),
      copyFileSync: jest.fn()
    }
    setupDetectorTest(fsMock, {
      downloadFile: jest.fn(({ success }) => success({
        statusCode: 503,
        errMsg: 'service unavailable',
        tempFilePath: '/tmp/damage-download.onnx'
      }))
    })
    const DamageDetector = require('../utils/damage-detector')
    const detector = new DamageDetector({
      modelUrl: 'https://example.com/damage.onnx',
      modelPath: '/tmp/damage.onnx'
    })

    await expect(detector.downloadModel()).rejects.toMatchObject({
      stage: 'download_status',
      modelName: 'damage',
      statusCode: 503,
      modelUrl: 'https://example.com/damage.onnx',
      errMsg: 'service unavailable'
    })
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'download_status_failed', expect.objectContaining({
      modelName: 'damage',
      stage: 'download_status',
      statusCode: 503,
      modelUrl: 'https://example.com/damage.onnx',
      errMsg: 'service unavailable'
    }))
  })

  test('plate detector throws inference_session when session loading fails', async () => {
    const fsMock = {
      accessSync: jest.fn(),
      copyFileSync: jest.fn()
    }
    setupDetectorTest(fsMock, {
      createInferenceSession: jest.fn(() => ({
        onLoad: jest.fn(),
        onError: jest.fn((callback) => callback({
          errMsg: 'createInferenceSession:fail invalid model'
        }))
      }))
    })
    const PlateDetector = require('../utils/plate-detector')
    const detector = new PlateDetector({
      modelUrl: 'https://example.com/plate.onnx',
      modelPath: '/tmp/plate.onnx'
    })

    await expect(detector.loadSession()).rejects.toMatchObject({
      stage: 'inference_session',
      modelName: 'plate',
      modelPath: '/tmp/plate.onnx',
      errMsg: 'createInferenceSession:fail invalid model'
    })
    expect(runtimeLogger.info).toHaveBeenCalledWith('ai_model', 'session_load_start', expect.objectContaining({
      modelName: 'plate',
      modelPath: '/tmp/plate.onnx'
    }))
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'session_load_failed', expect.objectContaining({
      modelName: 'plate',
      stage: 'inference_session',
      modelPath: '/tmp/plate.onnx'
    }))
  })

  test('damage detector throws inference_session when session loading fails', async () => {
    const fsMock = {
      accessSync: jest.fn(),
      copyFileSync: jest.fn()
    }
    setupDetectorTest(fsMock, {
      createInferenceSession: jest.fn(() => ({
        onLoad: jest.fn(),
        onError: jest.fn((callback) => callback({
          errMsg: 'createInferenceSession:fail unsupported device'
        }))
      }))
    })
    const DamageDetector = require('../utils/damage-detector')
    const detector = new DamageDetector({
      modelUrl: 'https://example.com/damage.onnx',
      modelPath: '/tmp/damage.onnx'
    })

    await expect(detector.loadSession()).rejects.toMatchObject({
      stage: 'inference_session',
      modelName: 'damage',
      modelPath: '/tmp/damage.onnx',
      errMsg: 'createInferenceSession:fail unsupported device'
    })
    expect(runtimeLogger.info).toHaveBeenCalledWith('ai_model', 'session_load_start', expect.objectContaining({
      modelName: 'damage',
      modelPath: '/tmp/damage.onnx'
    }))
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'session_load_failed', expect.objectContaining({
      modelName: 'damage',
      stage: 'inference_session',
      modelPath: '/tmp/damage.onnx'
    }))
  })
})
