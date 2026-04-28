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
      workflowState: 'LOCAL_COMPLETED'
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
      workflowState: 'LOCAL_COMPLETED'
    })
  })

  test('keeps return-to-edit flow without clearing capture cache', () => {
    const config = loadPage()
    const cache = {
      workflowState: {
        current: 'LOCAL_COMPLETED'
      }
    }
    const clearedCache = {
      workflowState: {
        current: 'PREVIEWING'
      }
    }

    storage.loadCache.mockReturnValueOnce(cache)
    storage.clearCompletionContext.mockReturnValueOnce(clearedCache)

    config.onBackToEdit.call({})

    expect(storage.clearCompletionContext).toHaveBeenCalledWith(cache)
    expect(storage.saveCache).toHaveBeenCalledWith(clearedCache)
    expect(storage.clearCache).not.toHaveBeenCalled()
    expect(global.wx.redirectTo).toHaveBeenCalledWith({
      url: '/pages/preview/preview'
    })
  })

  test('keeps exit behavior as direct cache clear and exit', () => {
    const config = loadPage()

    config.onExit.call({})

    expect(storage.clearCache).toHaveBeenCalledTimes(1)
    expect(global.wx.exitMiniProgram).toHaveBeenCalledTimes(1)
  })
})
