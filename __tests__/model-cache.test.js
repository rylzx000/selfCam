describe('AI model cache utilities', () => {
  let envConfig
  let runtimeLogger

  function setup(fsMock) {
    jest.resetModules()

    envConfig = {
      getAiConfig: jest.fn(() => ({
        appEnv: 'sit',
        wxEnvVersion: 'trial',
        plateModelUrl: 'https://example.com/plate.onnx',
        damageModelUrl: 'https://example.com/damage.onnx',
        plateModelPath: '/user-data/plate-sit.onnx',
        damageModelPath: '/user-data/damage-sit.onnx'
      }))
    }
    runtimeLogger = {
      forceWarn: jest.fn(),
      forceError: jest.fn()
    }

    global.wx = {
      env: {
        USER_DATA_PATH: '/user-data'
      },
      getFileSystemManager: jest.fn(() => fsMock)
    }

    jest.doMock('../packageD/utils/env-config', () => envConfig)
    jest.doMock('../packageD/utils/runtime-logger', () => runtimeLogger)

    return require('../packageD/utils/model-cache')
  }

  afterEach(() => {
    delete global.wx
    jest.clearAllMocks()
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/runtime-logger')
  })

  test('getAiModelCachePaths reads current AI config paths', () => {
    const modelCache = setup({
      accessSync: jest.fn(),
      unlinkSync: jest.fn()
    })

    expect(modelCache.getAiModelCachePaths()).toEqual({
      appEnv: 'sit',
      wxEnvVersion: 'trial',
      plateModelUrl: 'https://example.com/plate.onnx',
      damageModelUrl: 'https://example.com/damage.onnx',
      plateModelPath: '/user-data/plate-sit.onnx',
      damageModelPath: '/user-data/damage-sit.onnx'
    })
  })

  test('clearAiModelCache deletes existing plate and damage model files', () => {
    const fsMock = {
      accessSync: jest.fn(),
      unlinkSync: jest.fn()
    }
    const modelCache = setup(fsMock)

    const result = modelCache.clearAiModelCache()

    expect(fsMock.unlinkSync).toHaveBeenCalledWith('/user-data/plate-sit.onnx')
    expect(fsMock.unlinkSync).toHaveBeenCalledWith('/user-data/damage-sit.onnx')
    expect(result.results).toEqual([
      expect.objectContaining({ modelName: 'plate', deleted: true, reason: 'deleted' }),
      expect.objectContaining({ modelName: 'damage', deleted: true, reason: 'deleted' })
    ])
    expect(runtimeLogger.forceWarn).toHaveBeenCalledWith('ai_model', 'cache_clear_start', expect.objectContaining({
      appEnv: 'sit',
      wxEnvVersion: 'trial'
    }))
    expect(runtimeLogger.forceWarn).toHaveBeenCalledWith('ai_model', 'cache_clear_done', result)
  })

  test('clearAiModelCache marks missing files as not_found without throwing', () => {
    const fsMock = {
      accessSync: jest.fn(() => {
        throw new Error('no such file or directory')
      }),
      unlinkSync: jest.fn()
    }
    const modelCache = setup(fsMock)

    const result = modelCache.clearAiModelCache()

    expect(fsMock.unlinkSync).not.toHaveBeenCalled()
    expect(result.results).toEqual([
      expect.objectContaining({ modelName: 'plate', deleted: false, reason: 'not_found', errMsg: '' }),
      expect.objectContaining({ modelName: 'damage', deleted: false, reason: 'not_found', errMsg: '' })
    ])
  })

  test('clearAiModelCache records delete errors and reports forceError', () => {
    const fsMock = {
      accessSync: jest.fn(),
      unlinkSync: jest.fn((path) => {
        if (path.includes('plate')) {
          throw new Error('permission denied')
        }
      })
    }
    const modelCache = setup(fsMock)

    const result = modelCache.clearAiModelCache()

    expect(result.results[0]).toEqual(expect.objectContaining({
      modelName: 'plate',
      deleted: false,
      reason: 'delete_failed',
      errMsg: 'permission denied'
    }))
    expect(runtimeLogger.forceError).toHaveBeenCalledWith('ai_model', 'cache_clear_failed', expect.objectContaining({
      modelName: 'plate',
      path: '/user-data/plate-sit.onnx',
      reason: 'delete_failed',
      errMsg: 'permission denied'
    }))
  })

  test('clearAiModelCache does not delete non-model files', () => {
    const fsMock = {
      accessSync: jest.fn(),
      unlinkSync: jest.fn()
    }
    const modelCache = setup(fsMock)

    modelCache.clearAiModelCache()

    expect(fsMock.unlinkSync).toHaveBeenCalledTimes(2)
    expect(fsMock.unlinkSync).not.toHaveBeenCalledWith('/user-data/photo.jpg')
    expect(fsMock.unlinkSync).not.toHaveBeenCalledWith('/user-data/selfcam_runtime_logs')
  })
})
