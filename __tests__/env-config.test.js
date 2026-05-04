describe('env-config', () => {
  function loadEnvConfig() {
    jest.resetModules()
    return require('../utils/env-config')
  }

  function mockWxEnv(envVersion, extra = {}) {
    const storageData = extra.storage || {}
    const wxExtra = {
      ...extra
    }
    delete wxExtra.storage

    global.wx = {
      env: {
        USER_DATA_PATH: '/user-data'
      },
      getAccountInfoSync: jest.fn(() => ({
        miniProgram: {
          envVersion
        }
      })),
      getStorageSync: jest.fn((key) => storageData[key]),
      setStorageSync: jest.fn((key, value) => {
        storageData[key] = value
      }),
      removeStorageSync: jest.fn((key) => {
        delete storageData[key]
      }),
      ...wxExtra
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
      wxEnvVersion: 'develop',
      envVersion: 'develop',
      appEnv: 'dev',
      allowMock: true,
      allowDebug: true,
      allowLocalModelHost: true,
      enableDebugUpload: true,
      runtimeLoggerLevel: 'info'
    }))

    expect(envConfig.getDebugConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'develop',
      envVersion: 'develop',
      appEnv: 'dev',
      enabled: true,
      showAIPanel: true,
      uploadEnabled: true
    }))

    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'develop',
      envVersion: 'develop',
      appEnv: 'dev',
      allowLocalModelHost: true,
      modelHost: 'http://192.168.100.100:8000',
      plateModelPath: expect.stringMatching(/^\/user-data\/plate-dev-[a-z0-9]+\.onnx$/),
      damageModelPath: expect.stringMatching(/^\/user-data\/damage-dev-[a-z0-9]+\.onnx$/),
      plateModelUrl: 'http://192.168.100.100:8000/plate.onnx',
      damageModelUrl: 'http://192.168.100.100:8000/damage.onnx'
    }))

    expect(envConfig.getQualityConfigSourcePolicy()).toEqual(expect.objectContaining({
      wxEnvVersion: 'develop',
      envVersion: 'develop',
      appEnv: 'dev',
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
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      allowMock: true,
      allowControlledDebug: true,
      allowDebug: false,
      allowLocalModelHost: false,
      enableDebugUpload: false,
      runtimeLoggerLevel: 'warn'
    }))

    expect(envConfig.getDebugConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      enabled: false,
      showAIPanel: false,
      uploadEnabled: false,
      uploadUrl: ''
    }))

    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      modelHost: 'https://onlineclaimsit.chinalife-p.com.cn/video/model',
      plateModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx',
      damageModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/damage.onnx'
    }))

    expect(envConfig.getQualityConfigSourcePolicy()).toEqual(expect.objectContaining({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
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
      wxEnvVersion: 'release',
      envVersion: 'release',
      appEnv: 'prod',
      allowMock: false,
      allowDebug: false,
      allowLocalModelHost: false,
      enableDebugUpload: false,
      runtimeLoggerLevel: 'error'
    }))

    expect(envConfig.getDebugConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'release',
      envVersion: 'release',
      appEnv: 'prod',
      enabled: false,
      showAIPanel: false,
      uploadEnabled: false,
      uploadUrl: ''
    }))

    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'release',
      envVersion: 'release',
      appEnv: 'prod',
      allowLocalModelHost: false,
      plateModelUrl: '',
      damageModelUrl: ''
    }))

    expect(envConfig.getQualityConfigSourcePolicy()).toEqual(expect.objectContaining({
      wxEnvVersion: 'release',
      envVersion: 'release',
      appEnv: 'prod',
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
      appEnv: 'dev',
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

  test('develop defaults appEnv to dev', () => {
    mockWxEnv('develop')
    const envConfig = loadEnvConfig()

    expect(envConfig.getAppEnv()).toBe('dev')
    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'develop',
      appEnv: 'dev'
    }))
  })

  test('trial defaults appEnv to sit', () => {
    mockWxEnv('trial')
    const envConfig = loadEnvConfig()

    expect(envConfig.getAppEnv()).toBe('sit')
    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'trial',
      appEnv: 'sit'
    }))
  })

  test('release forces appEnv to prod', () => {
    mockWxEnv('release')
    const envConfig = loadEnvConfig()

    expect(envConfig.getAppEnv()).toBe('prod')
    expect(envConfig.getAppEnvBadgeText()).toBe('')
    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'release',
      appEnv: 'prod'
    }))
  })

  test.each(['sit', 'pilot'])('trial local override %s is valid', (appEnv) => {
    mockWxEnv('trial', {
      storage: {
        SELF_CAM_APP_ENV: appEnv
      }
    })
    const envConfig = loadEnvConfig()

    expect(envConfig.getAppEnv()).toBe(appEnv)
    expect(envConfig.getAiConfig().appEnv).toBe(appEnv)
  })

  test('release ignores local appEnv override', () => {
    mockWxEnv('release', {
      storage: {
        SELF_CAM_APP_ENV: 'pilot'
      }
    })
    const envConfig = loadEnvConfig()

    expect(envConfig.getAppEnv()).toBe('prod')
    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      wxEnvVersion: 'release',
      appEnv: 'prod',
      modelHost: ''
    }))
  })

  test('sit model urls use the configured endpoint', () => {
    mockWxEnv('trial')
    const envConfig = loadEnvConfig()

    expect(envConfig.getAiConfig()).toEqual(expect.objectContaining({
      appEnv: 'sit',
      modelHost: 'https://onlineclaimsit.chinalife-p.com.cn/video/model',
      plateModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx',
      damageModelUrl: 'https://onlineclaimsit.chinalife-p.com.cn/video/model/damage.onnx'
    }))
  })

  test('local switch to sit resolves the sit plate model url', () => {
    mockWxEnv('develop', {
      storage: {
        SELF_CAM_APP_ENV: 'sit'
      }
    })
    const envConfig = loadEnvConfig()

    expect(envConfig.getAiConfig().plateModelUrl).toBe(
      'https://onlineclaimsit.chinalife-p.com.cn/video/model/plate.onnx'
    )
  })

  test.each([
    ['http host', 'http://example.com/video/model'],
    ['localhost host', 'https://localhost:8000/video/model'],
    ['127 host', 'https://127.0.0.1:8000/video/model'],
    ['lan host', 'https://192.168.1.3:8000/video/model']
  ])('non-dev appEnv rejects unsafe model host: %s', (caseName, modelHost) => {
    mockWxEnv('trial')
    const envConfig = loadEnvConfig()

    const aiConfig = envConfig.getAiConfig({
      envVersion: 'trial',
      appEnv: 'sit',
      businessEnvEndpoints: {
        sit: {
          modelHost
        }
      }
    })

    expect(aiConfig.modelHost).toBe('')
    expect(aiConfig.plateModelUrl).toBe('')
    expect(aiConfig.damageModelUrl).toBe('')
  })

  test('model cache key and path are isolated by appEnv or url', () => {
    mockWxEnv('trial')
    const envConfig = loadEnvConfig()

    const sitConfig = envConfig.getAiConfig({
      envVersion: 'trial',
      appEnv: 'sit'
    })
    const pilotConfig = envConfig.getAiConfig({
      envVersion: 'trial',
      appEnv: 'pilot'
    })

    expect(sitConfig.plateModelCacheKey).not.toBe(pilotConfig.plateModelCacheKey)
    expect(sitConfig.damageModelCacheKey).not.toBe(pilotConfig.damageModelCacheKey)
    expect(sitConfig.plateModelPath).toMatch(/^\/user-data\/plate-sit-[a-z0-9]+\.onnx$/)
    expect(pilotConfig.plateModelPath).toMatch(/^\/user-data\/plate-pilot-[a-z0-9]+\.onnx$/)
    expect(sitConfig.damageModelPath).not.toBe(pilotConfig.damageModelPath)
  })
})
