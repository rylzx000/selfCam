describe('app launch bootstrap', () => {
  let appConfig

  beforeEach(() => {
    jest.resetModules()
    appConfig = null
    global.App = jest.fn((config) => {
      appConfig = config
    })
  })

  afterEach(() => {
    delete global.App
    delete global.wx
    jest.dontMock('../utils/env-config')
    jest.dontMock('../utils/quality-config')
  })

  function setupApp() {
    global.wx = {
      setStorageSync: jest.fn()
    }
    jest.doMock('../utils/env-config', () => ({
      getRuntimeFlags: jest.fn(() => ({
        envVersion: 'trial',
        appEnv: 'sit',
        enableVerboseConsole: false
      }))
    }))
    jest.doMock('../utils/quality-config', () => ({
      initQualityConfig: jest.fn(() => Promise.resolve())
    }))

    require('../app')
    return appConfig
  }

  test('onLaunch saves trimmed reportNo and ticket from launch query', () => {
    const app = setupApp()

    app.onLaunch.call(app, {
      query: {
        reportNo: ' RPT202605180001 ',
        ticket: ' AUX202605220001 '
      }
    })

    expect(app.globalData.reportNo).toBe('RPT202605180001')
    expect(app.globalData.ticket).toBe('AUX202605220001')
    expect(global.wx.setStorageSync).toHaveBeenCalledWith('selfcam_report_no', 'RPT202605180001')
    expect(global.wx.setStorageSync).toHaveBeenCalledWith('selfcam_aux_ticket', 'AUX202605220001')
  })

  test('onLaunch does not block when reportNo and ticket are missing', () => {
    const app = setupApp()

    expect(() => {
      app.onLaunch.call(app, { query: {} })
    }).not.toThrow()

    expect(app.globalData.reportNo).toBe('')
    expect(app.globalData.ticket).toBe('')
    expect(global.wx.setStorageSync).not.toHaveBeenCalledWith('selfcam_report_no', expect.any(String))
    expect(global.wx.setStorageSync).not.toHaveBeenCalledWith('selfcam_aux_ticket', expect.any(String))
  })
})
