describe('quality config system', () => {
  let loader
  let qualityConfig
  let defaultConfig
  let requestMock
  let storageState
  let warnSpy

  function setupRequestSuccess(data, statusCode = 200) {
    requestMock.mockImplementation(({ success }) => {
      success({
        statusCode,
        data
      })
    })
  }

  function setupRequestFailure(message = 'network error') {
    requestMock.mockImplementation(({ fail }) => {
      fail({
        errMsg: message
      })
    })
  }

  beforeEach(() => {
    jest.resetModules()
    storageState = {}
    requestMock = jest.fn()
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    global.wx = {
      getStorageSync(key) {
        return storageState[key]
      },
      setStorageSync(key, value) {
        storageState[key] = value
      },
      removeStorageSync(key) {
        delete storageState[key]
      },
      request: requestMock
    }

    loader = require('../utils/quality-config-loader')
    qualityConfig = require('../utils/quality-config')
    defaultConfig = require('../utils/quality-config-default').cloneQualityConfigDefaults()
  })

  afterEach(() => {
    warnSpy.mockRestore()
    delete global.wx
  })

  test('returns default config before initialization', () => {
    expect(qualityConfig.getQualityConfig()).toEqual(defaultConfig)
    expect(qualityConfig.getQualityConfigMeta().source).toBe('default')
  })

  test('falls back to defaults when remote config misses fields', () => {
    const merged = loader.mergeQualityConfig(defaultConfig, {
      enabled: false,
      thresholds: {
        blur: 0.41
      }
    })

    expect(merged.enabled).toBe(false)
    expect(merged.showUserHint).toBe(defaultConfig.showUserHint)
    expect(merged.thresholds.blur).toBe(0.41)
    expect(merged.thresholds.dark).toBe(defaultConfig.thresholds.dark)
    expect(merged.processing.timeoutMs).toBe(defaultConfig.processing.timeoutMs)
  })

  test('sanitizes invalid remote field types', () => {
    const merged = loader.mergeQualityConfig(defaultConfig, {
      enabled: '0',
      showUserHint: 'true',
      saveQualityMeta: 1,
      nearFarEnabled: 'yes',
      thresholds: {
        blur: 'bad',
        dark: '0.33',
        bright: '2'
      },
      processing: {
        maxEdge: '2048.4',
        timeoutMs: '-20'
      },
      configVersion: 20260424,
      expiresInSeconds: '999999'
    })

    expect(merged.enabled).toBe(false)
    expect(merged.showUserHint).toBe(true)
    expect(merged.saveQualityMeta).toBe(true)
    expect(merged.nearFarEnabled).toBe(true)
    expect(merged.thresholds.blur).toBe(defaultConfig.thresholds.blur)
    expect(merged.thresholds.dark).toBe(0.33)
    expect(merged.thresholds.bright).toBe(1)
    expect(merged.processing.maxEdge).toBe(2048)
    expect(merged.processing.timeoutMs).toBe(100)
    expect(merged.configVersion).toBe('20260424')
    expect(merged.expiresInSeconds).toBe(86400)
  })

  test('returns merged config and writes cache after remote success', async () => {
    setupRequestSuccess({
      enabled: false,
      showUserHint: false,
      thresholds: {
        blur: 0.48
      },
      processing: {
        maxEdge: 1280
      },
      configVersion: 'gray-1',
      expiresInSeconds: 600
    })

    const result = await loader.loadQualityConfig({
      now: 1000,
      source: {
        type: 'remote',
        remoteUrl: 'https://config.example.com/selfcam-quality.json'
      }
    })

    expect(result.source).toBe('remote')
    expect(result.cacheHit).toBe(false)
    expect(result.config.enabled).toBe(false)
    expect(result.config.showUserHint).toBe(false)
    expect(result.config.thresholds.blur).toBe(0.48)
    expect(result.config.thresholds.dark).toBe(defaultConfig.thresholds.dark)
    expect(result.config.processing.maxEdge).toBe(1280)
    expect(result.config.configVersion).toBe('gray-1')
    expect(storageState.selfcam_quality_config_cache_v1).toBeTruthy()
  })

  test('uses fresh local cache before hitting remote again', async () => {
    loader.writeQualityConfigCache({
      enabled: false,
      configVersion: 'cache-hit',
      expiresInSeconds: 1800
    }, {
      now: 2000
    })

    const result = await loader.loadQualityConfig({
      now: 5000,
      source: {
        type: 'remote',
        remoteUrl: 'https://config.example.com/selfcam-quality.json'
      }
    })

    expect(result.source).toBe('cache')
    expect(result.cacheHit).toBe(true)
    expect(result.config.enabled).toBe(false)
    expect(result.config.configVersion).toBe('cache-hit')
    expect(requestMock).not.toHaveBeenCalled()
  })

  test('refreshes remote config after local cache expires', async () => {
    loader.writeQualityConfigCache({
      enabled: false,
      configVersion: 'cache-old',
      expiresInSeconds: 60
    }, {
      now: 1000
    })

    setupRequestSuccess({
      enabled: true,
      brightnessEnabled: false,
      configVersion: 'remote-new',
      expiresInSeconds: 900
    })

    const result = await loader.loadQualityConfig({
      now: 62000,
      source: {
        type: 'remote',
        remoteUrl: 'https://config.example.com/selfcam-quality.json'
      }
    })

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(result.source).toBe('remote')
    expect(result.config.enabled).toBe(true)
    expect(result.config.brightnessEnabled).toBe(false)
    expect(result.config.configVersion).toBe('remote-new')
  })

  test('falls back to defaults when expired config refresh fails', async () => {
    loader.writeQualityConfigCache({
      enabled: false,
      configVersion: 'cache-expired',
      expiresInSeconds: 60
    }, {
      now: 1000
    })

    setupRequestFailure('timeout')

    const result = await loader.loadQualityConfig({
      now: 62000,
      source: {
        type: 'remote',
        remoteUrl: 'https://config.example.com/selfcam-quality.json'
      }
    })

    expect(result.source).toBe('default')
    expect(result.usedFallback).toBe(true)
    expect(result.config).toEqual(defaultConfig)
  })

  test('falls back safely when remote payload is invalid', async () => {
    setupRequestSuccess('[]')

    const result = await loader.loadQualityConfig({
      now: 3000,
      source: {
        type: 'remote',
        remoteUrl: 'https://config.example.com/selfcam-quality.json'
      }
    })

    expect(result.source).toBe('default')
    expect(result.usedFallback).toBe(true)
    expect(result.config).toEqual(defaultConfig)
  })

  test('does not block the unified entry when loading fails', async () => {
    setupRequestFailure('network down')

    const config = await qualityConfig.initQualityConfig({
      now: 4000,
      source: {
        type: 'remote',
        remoteUrl: 'https://config.example.com/selfcam-quality.json'
      }
    })

    expect(config).toEqual(defaultConfig)
    expect(qualityConfig.getQualityConfigMeta().initialized).toBe(true)
    expect(qualityConfig.getQualityConfigMeta().usedFallback).toBe(true)
    expect(qualityConfig.getQualityConfigMeta().source).toBe('default')
  })

  test('reloads after switching the config source', async () => {
    const mockConfig = await qualityConfig.initQualityConfig({
      now: 1000
    })

    expect(mockConfig.configVersion).toBe('mock-2026-04-24')

    qualityConfig.setQualityConfigSource({
      type: 'remote',
      remoteUrl: 'https://config.example.com/selfcam-quality.json'
    })

    setupRequestSuccess({
      enabled: false,
      configVersion: 'remote-switch',
      expiresInSeconds: 900
    })

    const remoteConfig = await qualityConfig.initQualityConfig({
      now: 5000
    })

    expect(remoteConfig.enabled).toBe(false)
    expect(remoteConfig.configVersion).toBe('remote-switch')
    expect(qualityConfig.getQualityConfigMeta().source).toBe('remote')
  })

  test.each(['develop', 'trial'])('uses mock as the default source in %s env', (envVersion) => {
    global.wx.getAccountInfoSync = () => ({
      miniProgram: {
        envVersion
      }
    })

    const source = loader.resolveConfigSource()

    expect(source.type).toBe('mock')
    expect(source.envVersion).toBe(envVersion)
  })

  test('release env without remote url falls back to default and warns', async () => {
    global.wx.getAccountInfoSync = () => ({
      miniProgram: {
        envVersion: 'release'
      }
    })

    const result = await loader.loadQualityConfig({
      now: 1000
    })

    expect(result.source).toBe('default')
    expect(result.usedFallback).toBe(true)
    expect(result.config).toEqual(defaultConfig)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('release env has no remote static JSON url'))
  })

  test('release env does not reuse mock cache as a silent fallback', async () => {
    global.wx.getAccountInfoSync = () => ({
      miniProgram: {
        envVersion: 'release'
      }
    })

    loader.writeQualityConfigCache({
      enabled: false,
      configVersion: 'mock-cache',
      expiresInSeconds: 1800
    }, {
      now: 1000,
      sourceType: 'mock',
      sourceSignature: 'mock:develop'
    })

    const result = await loader.loadQualityConfig({
      now: 2000
    })

    expect(result.source).toBe('default')
    expect(result.config).toEqual(defaultConfig)
  })

  test('reloads when in-memory config has expired', async () => {
    const remoteSource = {
      type: 'remote',
      remoteUrl: 'https://config.example.com/selfcam-quality.json'
    }

    setupRequestSuccess({
      enabled: true,
      configVersion: 'memory-v1',
      expiresInSeconds: 60
    })

    const firstConfig = await qualityConfig.initQualityConfig({
      now: 1000,
      source: remoteSource
    })

    requestMock.mockReset()
    setupRequestSuccess({
      enabled: false,
      configVersion: 'memory-v2',
      expiresInSeconds: 60
    })

    const secondConfig = await qualityConfig.initQualityConfig({
      now: 30000,
      source: remoteSource
    })

    const thirdConfig = await qualityConfig.initQualityConfig({
      now: 62000,
      source: remoteSource
    })

    expect(firstConfig.configVersion).toBe('memory-v1')
    expect(secondConfig.configVersion).toBe('memory-v1')
    expect(thirdConfig.configVersion).toBe('memory-v2')
    expect(requestMock).toHaveBeenCalledTimes(1)
  })
})
