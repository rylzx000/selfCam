describe('packageD bootstrap', () => {
  let bootstrap
  let app
  let envConfig
  let qualityConfig

  function loadBootstrap() {
    jest.resetModules()
    app = {
      globalData: {
        ticket: 'HOST_LOGIN_TICKET',
        selfCam: {
          source: 'host'
        }
      }
    }
    envConfig = {
      getRuntimeFlags: jest.fn(() => ({
        envVersion: 'trial',
        appEnv: 'sit',
        enableVerboseConsole: false
      }))
    }
    qualityConfig = {
      initQualityConfig: jest.fn(() => Promise.resolve())
    }

    global.wx = {
      setStorageSync: jest.fn(),
      getStorageSync: jest.fn(() => '')
    }
    global.getApp = jest.fn(() => app)

    jest.doMock('../packageD/utils/env-config', () => envConfig)
    jest.doMock('../packageD/utils/quality-config', () => qualityConfig)

    bootstrap = require('../packageD/utils/bootstrap')
    bootstrap.resetForTest()
  }

  beforeEach(() => {
    loadBootstrap()
  })

  afterEach(() => {
    delete global.wx
    delete global.getApp
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/quality-config')
  })

  test('initializes selfCam context from page query without overwriting host ticket', () => {
    const context = bootstrap.bootstrap({
      query: {
        reportNo: ' RPT202605180001 ',
        ticket: ' AUX202605220001 '
      }
    })

    expect(context.reportNo).toBe('RPT202605180001')
    expect(context.ticket).toBe('AUX202605220001')
    expect(bootstrap.getReportNo()).toBe('RPT202605180001')
    expect(bootstrap.getTicket()).toBe('AUX202605220001')
    expect(global.wx.setStorageSync).toHaveBeenCalledWith('selfcam_report_no', 'RPT202605180001')
    expect(global.wx.setStorageSync).toHaveBeenCalledWith('selfcam_aux_ticket', 'AUX202605220001')
    expect(qualityConfig.initQualityConfig).toHaveBeenCalledWith({ envVersion: 'trial' })
    expect(app.globalData.ticket).toBe('HOST_LOGIN_TICKET')
    expect(app.globalData.selfCam).toEqual(expect.objectContaining({
      source: 'host',
      reportNo: 'RPT202605180001',
      ticket: 'AUX202605220001',
      envVersion: 'trial'
    }))
  })

  test('clears runtime ticket when current entry has no ticket', () => {
    bootstrap.bootstrap({
      query: {
        ticket: ' AUX202605220001 '
      }
    })

    bootstrap.bootstrap({ query: {} })

    expect(bootstrap.getTicket()).toBe('')
    expect(app.globalData.ticket).toBe('HOST_LOGIN_TICKET')
    expect(app.globalData.selfCam.ticket).toBe('')
  })

  test('falls back to stored report number for logger context only', () => {
    global.wx.getStorageSync.mockImplementation((key) => (key === 'selfcam_report_no' ? ' RPT_STORED ' : 'OLD_TICKET'))

    bootstrap.bootstrap({ query: {} })

    expect(bootstrap.getReportNo()).toBe('RPT_STORED')
    expect(bootstrap.getTicket()).toBe('')
  })
})
