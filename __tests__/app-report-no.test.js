describe('host app shell', () => {
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
  })

  test('onLaunch keeps host launch options without owning selfCam ticket fields', () => {
    require('../app')

    const launchOptions = {
      query: {
        reportNo: ' RPT202605180001 ',
        ticket: ' AUX202605220001 '
      }
    }

    appConfig.onLaunch.call(appConfig, launchOptions)

    expect(appConfig.globalData.launchOptions).toBe(launchOptions)
    expect(appConfig.globalData.selfCam).toEqual({})
    expect(appConfig.globalData.ticket).toBeUndefined()
    expect(appConfig.globalData.reportNo).toBeUndefined()
  })
})
