describe('complete page', () => {
  let storage
  let cacheSelectors
  let workflow
  let pageConfig

  function loadPage(summaryOverrides = {}) {
    jest.resetModules()
    pageConfig = null

    storage = {
      loadCacheForResume: jest.fn(() => ({ workflowState: { current: 'LOCAL_COMPLETED' } })),
      loadCache: jest.fn(() => ({ workflowState: { current: 'LOCAL_COMPLETED' } })),
      saveCache: jest.fn((cache) => cache),
      clearCompletionContext: jest.fn((cache) => ({
        ...cache,
        workflowState: { current: 'PREVIEWING' }
      })),
      clearCache: jest.fn()
    }

    cacheSelectors = {
      getCacheSummary: jest.fn(() => ({
        hasCache: true,
        vehicleCount: 2,
        damagePhotoCount: 5,
        documentPhotoCount: 1,
        photoCounts: {
          damage: 5,
          document: 1
        },
        flowContext: {
          workflowState: 'LOCAL_COMPLETED'
        },
        albumSaveSummary: {
          decision: 'saved',
          total: 6,
          saved: 6,
          failed: 0,
          permissionDenied: 0
        },
        ...summaryOverrides
      }))
    }

    workflow = {
      STATES: {
        IDLE: 'IDLE',
        LOCAL_COMPLETED: 'LOCAL_COMPLETED'
      }
    }

    global.wx = {
      redirectTo: jest.fn(),
      exitMiniProgram: jest.fn(),
      reLaunch: jest.fn()
    }
    global.Page = jest.fn((config) => {
      pageConfig = config
      return config
    })

    jest.doMock('../utils/storage', () => storage)
    jest.doMock('../utils/cache-selectors', () => cacheSelectors)
    jest.doMock('../utils/workflow-state', () => workflow)

    require('../pages/complete/complete')

    return pageConfig
  }

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.clearAllMocks()
    jest.dontMock('../utils/storage')
    jest.dontMock('../utils/cache-selectors')
    jest.dontMock('../utils/workflow-state')
  })

  test('reads vehicle damage and document counts from cache summary', () => {
    const config = loadPage()
    const instance = {
      setData: jest.fn()
    }

    config.loadSummary.call(instance)

    expect(instance.setData).toHaveBeenCalledWith({
      vehicleCount: 2,
      damagePhotoCount: 5,
      documentPhotoCount: 1,
      workflowState: 'LOCAL_COMPLETED',
      albumSaveMessage: '本次照片已保存至手机相册'
    })
  })

  test('falls back to photoCounts when compact count fields are missing', () => {
    const config = loadPage({
      damagePhotoCount: undefined,
      documentPhotoCount: undefined,
      photoCounts: {
        damage: 3,
        document: 2
      }
    })
    const instance = {
      setData: jest.fn()
    }

    config.loadSummary.call(instance)

    expect(instance.setData).toHaveBeenCalledWith({
      vehicleCount: 2,
      damagePhotoCount: 3,
      documentPhotoCount: 2,
      workflowState: 'LOCAL_COMPLETED',
      albumSaveMessage: '本次照片已保存至手机相册'
    })
  })

  test('shows skipped album save message on completion page', () => {
    const config = loadPage({
      albumSaveSummary: {
        decision: 'skipped',
        total: 4,
        saved: 0,
        failed: 0,
        permissionDenied: 0
      }
    })
    const instance = {
      setData: jest.fn()
    }

    config.loadSummary.call(instance)

    expect(instance.setData).toHaveBeenCalledWith(expect.objectContaining({
      albumSaveMessage: '本次照片采集已完成，未保存至手机相册'
    }))
  })

  test('shows partial album save message on completion page', () => {
    const config = loadPage({
      albumSaveSummary: {
        decision: 'partial',
        total: 4,
        saved: 2,
        failed: 2,
        permissionDenied: 0
      }
    })
    const instance = {
      setData: jest.fn()
    }

    config.loadSummary.call(instance)

    expect(instance.setData).toHaveBeenCalledWith(expect.objectContaining({
      albumSaveMessage: '本次照片采集已完成，部分照片未保存至手机相册'
    }))
  })

  test('shows denied album save message on completion page', () => {
    const config = loadPage({
      albumSaveSummary: {
        decision: 'permission_denied',
        total: 4,
        saved: 0,
        failed: 4,
        permissionDenied: 4
      }
    })
    const instance = {
      setData: jest.fn()
    }

    config.loadSummary.call(instance)

    expect(instance.setData).toHaveBeenCalledWith(expect.objectContaining({
      albumSaveMessage: '本次照片采集已完成，未保存至手机相册'
    }))
  })

  test('does not expose a return-to-edit handler on completion page', () => {
    const config = loadPage()

    expect(config.onBackToEdit).toBeUndefined()
    expect(storage.clearCompletionContext).not.toHaveBeenCalled()
    expect(storage.clearCache).not.toHaveBeenCalled()
    expect(global.wx.redirectTo).not.toHaveBeenCalled()
  })

  test('keeps exit behavior as direct cache clear and exit', () => {
    const config = loadPage()

    config.onExit.call({})

    expect(storage.clearCache).toHaveBeenCalledTimes(1)
    expect(global.wx.exitMiniProgram).toHaveBeenCalledTimes(1)
  })
})
