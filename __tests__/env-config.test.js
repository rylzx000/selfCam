describe('env-config', () => {
  function loadEnvConfig() {
    jest.resetModules()
    return require('../utils/env-config')
  }

  function mockWxEnv(envVersion, extra = {}) {
    global.wx = {
      env: {
        USER_DATA_PATH: '/user-data'
      },
      getAccountInfoSync: jest.fn(() => ({
        miniProgram: {
          envVersion
        }
      })),
      ...extra
    }
  }

  afterEach(() => {
    delete global.wx
  })

  test('识别 develop 环境并开启默认开发能力', () => {
    mockWxEnv('develop')
    const envConfig = loadEnvConfig()

    expect(envConfig.getEnvVersion()).toBe('develop')
    expect(envConfig.isDevelop()).toBe(true)
    expect(envConfig.isTrial()).toBe(false)
    expect(envConfig.isRelease()).toBe(false)

    expect(envConfig.getRuntimeFlags()).toEqual(expect.objectContaining({
      envVersion: 'develop',
      allowMock: true,
      allowDebug: true,
      allowLocalModelHost: true,
      enableDebugUpload: true,
      runtimeLoggerLevel: 'info'
    }))

    expect(envConfig.getDebugConfig()).toEqual(expect.objectContaining({
      envVersion: 'develop',
      enabled: true,
      showAIPanel: true,
      uploadEnabled: true
    }))

    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      envVersion: 'develop',
      allowLocalModelHost: true,
      plateModelPath: '/user-data/plate.onnx',
      damageModelPath: '/user-data/damage.onnx'
    }))

    expect(envConfig.getQualityConfigSourcePolicy()).toEqual(expect.objectContaining({
      envVersion: 'develop',
      defaultSourceType: 'mock',
      allowMockAsDefault: true,
      fallbackToDefaultOnMissingRemote: false
    }))
  })

  test('识别 trial 环境并默认收紧调试输出', () => {
    mockWxEnv('trial')
    const envConfig = loadEnvConfig()

    expect(envConfig.getEnvVersion()).toBe('trial')
    expect(envConfig.isDevelop()).toBe(false)
    expect(envConfig.isTrial()).toBe(true)
    expect(envConfig.isRelease()).toBe(false)

    expect(envConfig.getRuntimeFlags()).toEqual(expect.objectContaining({
      envVersion: 'trial',
      allowMock: true,
      allowControlledDebug: true,
      allowDebug: false,
      allowLocalModelHost: false,
      enableDebugUpload: false,
      runtimeLoggerLevel: 'warn'
    }))

    expect(envConfig.getDebugConfig()).toEqual(expect.objectContaining({
      envVersion: 'trial',
      enabled: false,
      showAIPanel: false,
      uploadEnabled: false,
      uploadUrl: ''
    }))

    expect(envConfig.getQualityConfigSourcePolicy()).toEqual(expect.objectContaining({
      envVersion: 'trial',
      defaultSourceType: 'mock',
      allowMockAsDefault: true,
      fallbackToDefaultOnMissingRemote: false
    }))
  })

  test('识别 release 环境并默认关闭 mock、debug、upload', () => {
    mockWxEnv('release')
    const envConfig = loadEnvConfig()

    expect(envConfig.getEnvVersion()).toBe('release')
    expect(envConfig.isDevelop()).toBe(false)
    expect(envConfig.isTrial()).toBe(false)
    expect(envConfig.isRelease()).toBe(true)

    expect(envConfig.getRuntimeFlags()).toEqual(expect.objectContaining({
      envVersion: 'release',
      allowMock: false,
      allowDebug: false,
      allowLocalModelHost: false,
      enableDebugUpload: false,
      runtimeLoggerLevel: 'error'
    }))

    expect(envConfig.getDebugConfig()).toEqual(expect.objectContaining({
      envVersion: 'release',
      enabled: false,
      showAIPanel: false,
      uploadEnabled: false,
      uploadUrl: ''
    }))

    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      envVersion: 'release',
      allowLocalModelHost: false,
      plateModelUrl: '',
      damageModelUrl: ''
    }))

    expect(envConfig.getQualityConfigSourcePolicy()).toEqual(expect.objectContaining({
      envVersion: 'release',
      defaultSourceType: 'remote',
      allowMockAsDefault: false,
      requireConfiguredRemoteInRelease: true,
      fallbackToDefaultOnMissingRemote: true
    }))
  })

  test('release 环境下 ai-config 默认关闭调试日志与上传', () => {
    mockWxEnv('release')
    loadEnvConfig()
    const aiConfig = require('../utils/ai-config')

    expect(aiConfig.DEBUG_LOG.enabled).toBe(false)
    expect(aiConfig.DEBUG_LOG.uploadEnabled).toBe(false)
  })

  test('wx 不存在时安全降级到 develop', () => {
    const envConfig = loadEnvConfig()

    expect(envConfig.getEnvVersion()).toBe('develop')
    expect(envConfig.isDevelop()).toBe(true)
    expect(envConfig.getRuntimeFlags()).toEqual(expect.objectContaining({
      envVersion: 'develop',
      allowMock: true,
      allowDebug: true
    }))
  })

  test('wx API 异常时不会导致业务崩溃', () => {
    global.wx = {
      getAccountInfoSync: jest.fn(() => {
        throw new Error('env failed')
      })
    }
    const envConfig = loadEnvConfig()

    expect(() => envConfig.getEnvVersion()).not.toThrow()
    expect(() => envConfig.getRuntimeFlags()).not.toThrow()
    expect(() => envConfig.getDebugConfig()).not.toThrow()
    expect(() => envConfig.getAiConfig()).not.toThrow()
    expect(() => envConfig.getQualityConfigSourcePolicy()).not.toThrow()
    expect(envConfig.getEnvVersion()).toBe('develop')
  })
})
