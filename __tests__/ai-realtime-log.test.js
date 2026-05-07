describe('AI realtime logging', () => {
  let realtimeLog

  beforeEach(() => {
    jest.resetModules()
    realtimeLog = {
      setFilterMsg: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  })

  afterEach(() => {
    delete global.wx
    jest.dontMock('../utils/realtime-log')
    jest.dontMock('../utils/env-config')
  })

  test('runtimeLogger forwards local logs to realtime log', () => {
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
    const runtimeLogger = require('../utils/runtime-logger')

    const entry = runtimeLogger.info('ai', 'model_probe', {
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
      scope: 'ai',
      event: 'model_probe',
      at: entry.at,
      modelName: 'plate'
    }))
  })

  function setupDetectorTest(fsMock, wxOverrides = {}) {
    global.wx = {
      getFileSystemManager: jest.fn(() => fsMock),
      downloadFile: jest.fn(),
      createInferenceSession: jest.fn(),
      ...wxOverrides
    }
    jest.doMock('../utils/realtime-log', () => realtimeLog)
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
    expect(realtimeLog.error).toHaveBeenCalledWith('ai_model', 'download_status_failed', expect.objectContaining({
      modelName: 'plate',
      stage: 'download_status',
      statusCode: 418
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
    expect(realtimeLog.error).toHaveBeenCalledWith('ai_model', 'download_failed', expect.objectContaining({
      modelName: 'damage',
      stage: 'download',
      errMsg: 'downloadFile:fail url not in domain list'
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
    expect(realtimeLog.error).toHaveBeenCalledWith('ai_model', 'session_load_failed', expect.objectContaining({
      modelName: 'plate',
      stage: 'inference_session',
      modelPath: '/tmp/plate.onnx'
    }))
  })
})
