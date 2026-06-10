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
    jest.dontMock('../packageD/utils/realtime-log')
    jest.dontMock('../packageD/utils/runtime-logger')
    jest.dontMock('../packageD/utils/env-config')
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
    jest.doMock('../packageD/utils/realtime-log', () => realtimeLog)
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
      }))
    }))
  }

  function expectNoRealtimeLog() {
    expect(realtimeLog.info).not.toHaveBeenCalled()
    expect(realtimeLog.warn).not.toHaveBeenCalled()
    expect(realtimeLog.error).not.toHaveBeenCalled()
  }

  test('runtimeLogger.addLog keeps local logs but filters non-critical realtime logs', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    const entry = runtimeLogger.addLog('info', 'ai', 'model_probe', {
      modelName: 'plate',
      extraDetail: 'local only'
    })

    expect(entry).toEqual(expect.objectContaining({
      sessionId: expect.any(String),
      scope: 'ai',
      event: 'model_probe',
      at: expect.any(String)
    }))
    expect(realtimeLog.setFilterMsg).toHaveBeenCalledWith(entry.sessionId)
    expectNoRealtimeLog()
    expect(runtimeLogger.readLogs()[0]).toEqual(expect.objectContaining({
      payload: expect.objectContaining({
        modelName: 'plate',
        extraDetail: 'local only'
      })
    }))
  })

  test('runtimeLogger.startSession sets filter without forwarding camera session_start', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../packageD/utils/runtime-logger')
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const sessionId = runtimeLogger.startSession('camera', { step: 'damage' })

      expect(realtimeLog.setFilterMsg).toHaveBeenCalledWith(sessionId)
      expectNoRealtimeLog()
    } finally {
      consoleLogSpy.mockRestore()
    }
  })

  test('runtimeLogger.getSessionId always returns a session id', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    const sessionId = runtimeLogger.getSessionId()

    expect(sessionId).toEqual(expect.any(String))
    expect(sessionId).not.toBe('')
    expect(realtimeLog.setFilterMsg).toHaveBeenCalledWith(sessionId)
  })

  test('runtimeLogger.forceWarn forwards realtime log without level filtering', () => {
    setupRuntimeLoggerTest()
    jest.doMock('../packageD/utils/env-config', () => ({
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
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    const entry = runtimeLogger.forceWarn('diagnostic', 'realtime_probe', {
      feedbackId: 'feedback-1',
      probe: 'selfCam_realtime_probe',
      largePayload: { nested: true }
    })

    expect(entry).toEqual(expect.objectContaining({
      sessionId: expect.any(String),
      level: 'warn',
      scope: 'diagnostic',
      event: 'realtime_probe'
    }))
    expect(realtimeLog.warn).toHaveBeenCalledWith('diagnostic', 'realtime_probe', {
      sessionId: entry.sessionId,
      feedbackId: 'feedback-1'
    })
  })

  test('runtimeLogger.forceError forwards realtime log without level filtering', () => {
    setupRuntimeLoggerTest()
    jest.doMock('../packageD/utils/env-config', () => ({
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
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    const entry = runtimeLogger.forceError('ai', 'ai_unavailable', {
      reason: 'detector_init_failed',
      detail: { huge: true }
    })

    expect(entry).toEqual(expect.objectContaining({
      sessionId: expect.any(String),
      level: 'error',
      scope: 'ai',
      event: 'ai_unavailable'
    }))
    expect(realtimeLog.error).toHaveBeenCalledWith('ai', 'ai_unavailable', {
      sessionId: entry.sessionId,
      reason: 'detector_init_failed'
    })
  })

  test('runtimeLogger.forceWarn forwards slim camera geometry diagnostics for WeChat realtime logs', () => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    const entry = runtimeLogger.forceWarn('ai', 'auto_capture_gate_sample', {
      feedbackId: 'selfCam_feedback-4',
      step: 'licensePlate',
      runId: 3,
      windowWidth: 1084,
      windowHeight: 488,
      cameraWidth: 574.12,
      cameraHeight: 430.59,
      layoutScale: 1.435,
      needsResponsiveUiScale: true,
      frameWidth: 800,
      frameHeight: 450,
      frameAspect: 1.7778,
      mappingMode: 'aspectFillCrop',
      scale: 0.6667,
      offsetX: -66.67,
      offsetY: 0,
      captureBox: { x: 100, y: 176, width: 200, height: 68 },
      mappedBox: { centerX: 200, centerY: 210, width: 140, height: 40 },
      inBox: false,
      centerInBox: true,
      centerAligned: true,
      areaInRange: true,
      areaRatio: 0.41,
      minAreaRatio: 0.35,
      maxAreaRatio: 1.5,
      centerOffsetThreshold: 0.16,
      centerOffsetX: 0,
      centerOffsetY: 0.18,
      consecutiveCount: 1,
      failReason: 'center_offset_y',
      phase: 'SEEK',
      hasTrack: true,
      centerOffset: 0.12,
      imageAreaRatio: 0.14,
      effectiveMinAreaRatio: 0.07,
      effectiveMaxAreaRatio: 0.14,
      holdStableCount: 0,
      rawFrameBytes: new ArrayBuffer(8),
      rawDetection: { huge: true }
    })

    expect(realtimeLog.warn).toHaveBeenCalledWith('ai', 'auto_capture_gate_sample', {
      sessionId: entry.sessionId,
      feedbackId: 'selfCam_feedback-4',
      step: 'licensePlate',
      runId: 3,
      windowWidth: 1084,
      windowHeight: 488,
      cameraWidth: 574.12,
      cameraHeight: 430.59,
      layoutScale: 1.435,
      needsResponsiveUiScale: true,
      frameWidth: 800,
      frameHeight: 450,
      frameAspect: 1.7778,
      mappingMode: 'aspectFillCrop',
      scale: 0.6667,
      offsetX: -66.67,
      offsetY: 0,
      captureBox: { x: 100, y: 176, width: 200, height: 68 },
      mappedBox: { centerX: 200, centerY: 210, width: 140, height: 40 },
      inBox: false,
      centerInBox: true,
      centerAligned: true,
      areaInRange: true,
      areaRatio: 0.41,
      minAreaRatio: 0.35,
      maxAreaRatio: 1.5,
      centerOffsetThreshold: 0.16,
      centerOffsetX: 0,
      centerOffsetY: 0.18,
      consecutiveCount: 1,
      failReason: 'center_offset_y',
      phase: 'SEEK',
      hasTrack: true,
      centerOffset: 0.12,
      imageAreaRatio: 0.14,
      effectiveMinAreaRatio: 0.07,
      effectiveMaxAreaRatio: 0.14,
      holdStableCount: 0
    })
  })

  test.each([
    ['camera', 'page_show'],
    ['workflow', 'transition'],
    ['ai', 'resume_detection_skipped']
  ])('runtimeLogger.addLog filters %s/%s from realtime log', (scope, event) => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    const entry = runtimeLogger.addLog('info', scope, event, {
      feedbackId: 'feedback-2',
      largePayload: { localOnly: true }
    })

    expect(entry).toEqual(expect.objectContaining({
      scope,
      event,
      payload: expect.objectContaining({
        feedbackId: 'feedback-2',
        largePayload: { localOnly: true }
      })
    }))
    expectNoRealtimeLog()
  })

  test.each([
    ['error', 'ai', 'ai_unavailable'],
    ['error', 'ai', 'detector_init_failed'],
    ['error', 'ai_model', 'session_create_failed'],
    ['error', 'ai_model', 'session_load_failed']
  ])('runtimeLogger.addLog forwards critical %s %s/%s with slim payload', (level, scope, event) => {
    setupRuntimeLoggerTest()
    const runtimeLogger = require('../packageD/utils/runtime-logger')

    const entry = runtimeLogger.addLog(level, scope, event, {
      feedbackId: 'feedback-3',
      appEnv: 'sit',
      wxEnvVersion: 'trial',
      reason: 'detector_init_failed',
      stage: 'inference_session',
      modelName: 'plate',
      statusCode: 503,
      message: 'AI unavailable',
      errMsg: 'session failed',
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      modelUrl: 'https://example.com/plate.onnx',
      modelPath: '/tmp/plate.onnx',
      plateModelUrl: 'https://example.com/plate.onnx',
      damageModelUrl: 'https://example.com/damage.onnx',
      system: 'Android',
      model: 'Pixel',
      platform: 'android',
      SDKVersion: '3.15.1',
      version: '8.0.1',
      at: 'should-not-forward',
      rawPayload: { huge: true }
    })

    expect(realtimeLog[level]).toHaveBeenCalledWith(scope, event, {
      sessionId: entry.sessionId,
      feedbackId: 'feedback-3',
      appEnv: 'sit',
      wxEnvVersion: 'trial',
      reason: 'detector_init_failed',
      stage: 'inference_session',
      modelName: 'plate',
      statusCode: 503,
      message: 'AI unavailable',
      errMsg: 'session failed',
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      modelUrl: 'https://example.com/plate.onnx',
      modelPath: '/tmp/plate.onnx',
      plateModelUrl: 'https://example.com/plate.onnx',
      damageModelUrl: 'https://example.com/damage.onnx',
      system: 'Android',
      model: 'Pixel',
      platform: 'android',
      SDKVersion: '3.15.1',
      version: '8.0.1'
    })
  })

  function setupDetectorTest(fsMock, wxOverrides = {}) {
    global.wx = {
      getFileSystemManager: jest.fn(() => fsMock),
      downloadFile: jest.fn(),
      createInferenceSession: jest.fn(),
      ...wxOverrides
    }
    jest.doMock('../packageD/utils/runtime-logger', () => runtimeLogger)
    jest.doMock('../packageD/utils/env-config', () => ({
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

  function createLoadedSession() {
    return {
      onLoad: jest.fn((callback) => callback()),
      onError: jest.fn()
    }
  }

  function createFailedSession(errMsg) {
    return {
      onLoad: jest.fn(),
      onError: jest.fn((callback) => callback({ errMsg }))
    }
  }

  const detectorSessionCases = [
    {
      modelName: 'plate',
      detectorPath: '../packageD/utils/plate-detector',
      modelUrl: 'https://example.com/plate.onnx',
      modelPath: '/tmp/plate.onnx'
    },
    {
      modelName: 'damage',
      detectorPath: '../packageD/utils/damage-detector',
      modelUrl: 'https://example.com/damage.onnx',
      modelPath: '/tmp/damage.onnx'
    }
  ]

  test.each(detectorSessionCases)('$modelName detector creates compatible session options', async ({
    detectorPath,
    modelUrl,
    modelPath
  }) => {
    const fsMock = {
      accessSync: jest.fn(),
      copyFileSync: jest.fn()
    }
    const fastSession = createLoadedSession()
    const createInferenceSession = jest.fn(() => fastSession)
    setupDetectorTest(fsMock, { createInferenceSession })
    const Detector = require(detectorPath)
    const detector = new Detector({ modelUrl, modelPath })

    await expect(detector.loadSession()).resolves.toBeUndefined()

    expect(createInferenceSession).toHaveBeenCalledTimes(1)
    expect(createInferenceSession).toHaveBeenNthCalledWith(1, {
      model: modelPath,
      allowNPU: false,
      precisionLevel: 0,
      allowQuantize: false
    })
    expect(runtimeLogger.info).toHaveBeenCalledWith('ai_model', 'session_load_success', expect.objectContaining({
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      allowNPU: false,
      allowQuantize: false
    }))
    expect(fastSession.onLoad).toHaveBeenCalledTimes(1)
  })

  test.each(detectorSessionCases)('$modelName detector throws structured create error when compatible mode returns undefined', async ({
    modelName,
    detectorPath,
    modelUrl,
    modelPath
  }) => {
    const fsMock = {
      accessSync: jest.fn(),
      copyFileSync: jest.fn()
    }
    const createInferenceSession = jest.fn(() => undefined)
    setupDetectorTest(fsMock, { createInferenceSession })
    const Detector = require(detectorPath)
    const detector = new Detector({ modelUrl, modelPath })

    const error = await detector.loadSession().catch((err) => err)

    expect(createInferenceSession).toHaveBeenNthCalledWith(1, {
      model: modelPath,
      allowNPU: false,
      precisionLevel: 0,
      allowQuantize: false
    })
    expect(createInferenceSession).toHaveBeenCalledTimes(1)
    expect(error).toMatchObject({
      stage: 'inference_session_create',
      modelName,
      modelPath,
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      allowNPU: false,
      allowQuantize: false,
      errMsg: 'wx.createInferenceSession returned invalid session'
    })
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'session_create_failed', expect.objectContaining({
      modelName,
      modelPath,
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      stage: 'inference_session_create',
      errMsg: 'wx.createInferenceSession returned invalid session',
      sessionType: 'undefined',
      sessionKeys: ''
    }))
  })

  test.each(detectorSessionCases)('$modelName detector throws structured create error when compatible mode throws', async ({
    modelName,
    detectorPath,
    modelUrl,
    modelPath
  }) => {
    const fsMock = {
      accessSync: jest.fn(),
      copyFileSync: jest.fn()
    }
    const createInferenceSession = jest.fn(() => {
      throw new Error('createInferenceSession:fail precision unsupported')
    })
    setupDetectorTest(fsMock, { createInferenceSession })
    const Detector = require(detectorPath)
    const detector = new Detector({ modelUrl, modelPath })

    await expect(detector.loadSession()).rejects.toMatchObject({
      stage: 'inference_session_create',
      modelName,
      modelPath,
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      allowNPU: false,
      allowQuantize: false,
      errMsg: 'createInferenceSession:fail precision unsupported'
    })

    expect(createInferenceSession).toHaveBeenCalledTimes(1)
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'session_create_failed', expect.objectContaining({
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      allowNPU: false,
      allowQuantize: false
    }))
  })

  test.each(detectorSessionCases)('$modelName detector keeps structured create error for invalid compatible session', async ({
    modelName,
    detectorPath,
    modelUrl,
    modelPath
  }) => {
    const fsMock = {
      accessSync: jest.fn(),
      copyFileSync: jest.fn()
    }
    const createInferenceSession = jest.fn(() => undefined)
    setupDetectorTest(fsMock, { createInferenceSession })
    const Detector = require(detectorPath)
    const detector = new Detector({ modelUrl, modelPath })

    const error = await detector.loadSession().catch((err) => err)

    expect(error).toMatchObject({
      stage: 'inference_session_create',
      modelName,
      modelPath,
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      allowNPU: false,
      allowQuantize: false,
      errMsg: 'wx.createInferenceSession returned invalid session'
    })
    expect(error).not.toBeInstanceOf(TypeError)
    expect(createInferenceSession).toHaveBeenCalledTimes(1)
  })

  test.each(detectorSessionCases)('$modelName detector throws structured load error when compatible session onError fires', async ({
    modelName,
    detectorPath,
    modelUrl,
    modelPath
  }) => {
    const fsMock = {
      accessSync: jest.fn(),
      copyFileSync: jest.fn()
    }
    const createInferenceSession = jest.fn(() => createFailedSession('createInferenceSession:fail compatible session'))
    setupDetectorTest(fsMock, { createInferenceSession })
    const Detector = require(detectorPath)
    const detector = new Detector({ modelUrl, modelPath })

    await expect(detector.loadSession()).rejects.toMatchObject({
      stage: 'inference_session',
      modelName,
      modelPath,
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      allowNPU: false,
      allowQuantize: false,
      errMsg: 'createInferenceSession:fail compatible session'
    })

    expect(createInferenceSession).toHaveBeenNthCalledWith(1, {
      model: modelPath,
      allowNPU: false,
      precisionLevel: 0,
      allowQuantize: false
    })
    expect(createInferenceSession).toHaveBeenCalledTimes(1)
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'session_load_failed', expect.objectContaining({
      modelName,
      modelPath,
      attemptName: 'cpu_precision_0',
      precisionLevel: 0,
      stage: 'inference_session',
      errMsg: 'createInferenceSession:fail compatible session'
    }))
  })

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
    const PlateDetector = require('../packageD/utils/plate-detector')
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
    const PlateDetector = require('../packageD/utils/plate-detector')
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
    const DamageDetector = require('../packageD/utils/damage-detector')
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
    const DamageDetector = require('../packageD/utils/damage-detector')
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
    const PlateDetector = require('../packageD/utils/plate-detector')
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
    const DamageDetector = require('../packageD/utils/damage-detector')
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
