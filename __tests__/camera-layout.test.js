describe('camera responsive layout', () => {
  let pageConfig

  beforeEach(() => {
    jest.resetModules()
    pageConfig = null

    jest.doMock('../utils/storage', () => ({}))
    jest.doMock('../utils/cache-selectors', () => ({}))
    jest.doMock('../utils/constants', () => ({
      SHOOT_STEP: {
        LICENSE_PLATE: 'licensePlate',
        VIN_CODE: 'vinCode',
        DAMAGE: 'damage'
      },
      GUIDE_TIPS: {
        licensePlate: '将车牌号放入框内',
        vinCode: '请拍摄 VIN',
        damage: '请对准车损处'
      },
      VEHICLE_TYPE: {
        TARGET: '标的车'
      },
      LIMITS: {
        MAX_DAMAGES: 5,
        MAX_TOTAL_PHOTOS: 50
      }
    }))
    jest.doMock('../utils/compress', () => ({}))
    jest.doMock('../utils/photo-quality', () => ({}))
    jest.doMock('../utils/runtime-logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      forceWarn: jest.fn(),
      forceError: jest.fn(),
      startSession: jest.fn(() => 'layout-test'),
      endSession: jest.fn(),
      getSessionId: jest.fn(() => 'layout-test')
    }))
    jest.doMock('../utils/env-config', () => ({
      getDebugConfig: jest.fn(() => ({ showAIPanel: false })),
      getAppEnvBadgeText: jest.fn(() => ''),
      getAiConfig: jest.fn(() => ({}))
    }))
    jest.doMock('../utils/plate-detector', () => jest.fn())
    jest.doMock('../utils/damage-detector', () => jest.fn())
    jest.doMock('../utils/frame-utils', () => ({
      PlateFrameUtils: jest.fn()
    }))
    jest.doMock('../utils/damage-auto-capture-engine', () => jest.fn())
    jest.doMock('../utils/ai-config', () => ({
      AUTO_CAPTURE: {
        LOW_QUALITY: 0.3,
        STATUS_TEXT: {}
      }
    }))
    jest.doMock('../utils/workflow-state', () => ({
      STATES: {
        IDLE: 'IDLE'
      }
    }))
    jest.doMock('../utils/workflow-page', () => ({}))
    jest.doMock('../utils/album', () => ({}))

    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })

    require('../pages/camera/camera')
  })

  afterEach(() => {
    delete global.Page
    jest.clearAllMocks()
    jest.dontMock('../utils/storage')
    jest.dontMock('../utils/cache-selectors')
    jest.dontMock('../utils/constants')
    jest.dontMock('../utils/compress')
    jest.dontMock('../utils/photo-quality')
    jest.dontMock('../utils/runtime-logger')
    jest.dontMock('../utils/env-config')
    jest.dontMock('../utils/plate-detector')
    jest.dontMock('../utils/damage-detector')
    jest.dontMock('../utils/frame-utils')
    jest.dontMock('../utils/damage-auto-capture-engine')
    jest.dontMock('../utils/ai-config')
    jest.dontMock('../utils/workflow-state')
    jest.dontMock('../utils/workflow-page')
    jest.dontMock('../utils/album')
  })

  test('keeps normal landscape camera size close to the old rpx layout', () => {
    expect(pageConfig.computeCameraLayout).toEqual(expect.any(Function))

    const layout = pageConfig.computeCameraLayout({
      windowWidth: 844,
      windowHeight: 390,
      safeArea: {
        left: 24,
        right: 844,
        top: 0,
        bottom: 390
      }
    })

    expect(layout.cameraWidth / layout.cameraHeight).toBeCloseTo(4 / 3, 4)
    expect(layout.cameraWidth).toBeGreaterThanOrEqual(448)
    expect(layout.cameraHeight).toBeGreaterThanOrEqual(336)
    expect(layout.sideWidth).toBeGreaterThanOrEqual(134)
    expect(layout.gap).toBeGreaterThanOrEqual(26)
    expect(pageConfig.getPlateCaptureBox()).toEqual({
      x: 100,
      y: 176,
      width: 200,
      height: 68
    })
    expect(pageConfig.getDamageCaptureBox()).toEqual({
      x: 134,
      y: 84,
      width: 132,
      height: 132
    })
  })

  test('ignores portrait safeArea width when the page is already landscape', () => {
    const layout = pageConfig.computeCameraLayout({
      windowWidth: 844,
      windowHeight: 390,
      safeArea: {
        left: 0,
        right: 390,
        top: 0,
        bottom: 844
      }
    })

    expect(layout.cameraWidth).toBeGreaterThanOrEqual(448)
    expect(layout.cameraHeight).toBeGreaterThanOrEqual(336)
    expect(layout.cameraWidth / layout.cameraHeight).toBeCloseTo(4 / 3, 4)
  })

  test('keeps nova-like wide screens large without using a device-specific rule', () => {
    const layout = pageConfig.computeCameraLayout({
      windowWidth: 1084,
      windowHeight: 488
    })

    expect(layout.cameraWidth).toBeGreaterThanOrEqual(574)
    expect(layout.cameraHeight).toBeGreaterThanOrEqual(430)
    expect(layout.cameraHeight / layout.windowHeight).toBeGreaterThan(0.86)
    expect(layout.cameraWidth / layout.cameraHeight).toBeCloseTo(4 / 3, 4)
  })

  test('keeps normal landscape UI on existing rpx styles', () => {
    const layout = pageConfig.computeCameraLayout({
      windowWidth: 844,
      windowHeight: 390
    })

    expect(layout.needsResponsiveUiScale).toBe(false)
    expect(layout.guideTipStyle).toBe('')
    expect(layout.aiTipStyle).toBe('')
    expect(layout.captureButtonStyle).toBe('')
    expect(layout.captureTextStyle).toBe('')
    expect(layout.plateFrameStyle).toBe('')
    expect(layout.damageFrameStyle).toBe('')
  })

  test('enables px UI scaling on OpenHarmony landscape even below the high resolution threshold', () => {
    const layout = pageConfig.computeCameraLayout({
      windowWidth: 960,
      windowHeight: 480,
      platform: 'ohos',
      system: 'OpenHarmonyOS 6.0.0',
      brand: 'HUAWEI'
    })

    expect(layout.layoutScale).toBeLessThan(1.3)
    expect(layout.needsResponsiveUiScale).toBe(true)
    expect(layout.uiScaleReason).toBe('ohosLandscape')
    expect(layout.cardStyle).toContain('padding-top:')
    expect(layout.labelTextStyle).toContain('font-size:')
    expect(layout.captureButtonStyle).toContain('width:')
    expect(layout.captureTextStyle).toContain('font-size:')
  })

  test('enables px UI scaling only on nova-like high resolution landscape screens', () => {
    const layout = pageConfig.computeCameraLayout({
      windowWidth: 1084,
      windowHeight: 488
    })

    expect(layout.needsResponsiveUiScale).toBe(true)
    expect(layout.uiScale).toBeCloseTo(layout.layoutScale, 2)
    expect(layout.guideTipStyle).toContain('font-size:')
    expect(layout.aiTipStyle).toContain('font-size:')
    expect(layout.captureButtonStyle).toContain('width:')
    expect(layout.captureButtonStyle).toContain('height:')
    expect(layout.captureTextStyle).toContain('font-size:')
    expect(layout.plateFrameStyle).toContain('width: 50%')
    expect(layout.damageFrameStyle).toContain('width: 33%')
  })

  test('keeps visual capture boxes and AI capture boxes from the same virtual geometry', () => {
    expect(pageConfig.getPlateCaptureBox()).toEqual({
      x: 100,
      y: 176,
      width: 200,
      height: 68
    })
    expect(pageConfig.getDamageCaptureBox()).toEqual({
      x: 134,
      y: 84,
      width: 132,
      height: 132
    })
    expect(pageConfig.getCaptureBoxStyles()).toEqual(expect.objectContaining({
      plateFrameStyle: expect.stringContaining('width: 50%'),
      damageFrameStyle: expect.stringContaining('width: 33%')
    }))
  })
})
