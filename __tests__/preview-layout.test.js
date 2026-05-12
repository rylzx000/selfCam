describe('preview responsive layout', () => {
  let pageConfig

  beforeEach(() => {
    jest.resetModules()
    pageConfig = null

    jest.doMock('../utils/env-config', () => ({
      getAppEnvBadgeText: jest.fn(() => ''),
      getDebugConfig: jest.fn(() => ({ runtimeLoggerLevel: 'silent' })),
      getEnvVersion: jest.fn(() => 'trial')
    }))

    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })

    require('../pages/preview/preview')
  })

  afterEach(() => {
    delete global.Page
    jest.clearAllMocks()
    jest.dontMock('../utils/env-config')
  })

  test('keeps normal landscape preview UI on existing rpx styles', () => {
    expect(pageConfig.computePreviewLayout).toEqual(expect.any(Function))

    const layout = pageConfig.computePreviewLayout({
      windowWidth: 844,
      windowHeight: 390,
      platform: 'ios',
      system: 'iOS 18.0'
    })

    expect(layout.needsResponsiveUiScale).toBe(false)
    expect(layout.pageStyle).toBe('')
    expect(layout.topbarStyle).toBe('')
    expect(layout.vehicleSectionStyle).toBe('')
    expect(layout.thumbStyle).toBe('')
    expect(layout.primaryButtonStyle).toBe('')
  })

  test('enables px scaling for OpenHarmony landscape preview UI below the high resolution threshold', () => {
    expect(pageConfig.computePreviewLayout).toEqual(expect.any(Function))

    const layout = pageConfig.computePreviewLayout({
      windowWidth: 960,
      windowHeight: 480,
      platform: 'ohos',
      system: 'OpenHarmonyOS 6.0.0',
      brand: 'HUAWEI'
    })

    expect(layout.layoutScale).toBeLessThan(1.3)
    expect(layout.needsResponsiveUiScale).toBe(true)
    expect(layout.uiScaleReason).toBe('ohosLandscape')
    expect(layout.pageStyle).toContain('padding-top:')
    expect(layout.titleStyle).toContain('font-size:')
    expect(layout.subtitleStyle).toContain('font-size:')
    expect(layout.vehicleSectionStyle).toContain('padding-top:')
    expect(layout.thumbStyle).toContain('width:')
    expect(layout.thumbStyle).toContain('height:')
    expect(layout.photoLabelStyle).toContain('font-size:')
    expect(layout.bottomBarStyle).toContain('height:')
    expect(layout.primaryButtonStyle).toContain('height:')
    expect(layout.licensePanelStyle).toContain('width:')
    expect(layout.licenseUploadSlotStyle).toContain('height:')
    expect(layout.previewButtonStyle).toContain('font-size:')
  })
})
