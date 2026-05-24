describe('aux-photo api init', () => {
  afterEach(() => {
    delete global.wx
    jest.resetModules()
    jest.dontMock('../utils/env-config')
  })

  function loadApi(config) {
    jest.resetModules()
    jest.doMock('../utils/env-config', () => ({
      getAuxPhotoConfig: jest.fn(() => config)
    }))
    return require('../utils/aux-photo-api')
  }

  test('uses mock init for mock tickets outside release', async () => {
    const api = loadApi({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      mockEnabled: true,
      requestEnabled: false,
      baseUrl: '',
      requestTimeoutMs: 5000
    })

    const result = await api.init('mock-2')

    expect(result.success).toBe(true)
    expect(result.data.ticket).toBe('mock-2')
    expect(result.data.vehicles).toHaveLength(2)
    expect(result.data.vehicles[0]).toEqual(expect.objectContaining({
      vehicleRole: 'INSURED',
      licenseNo: '京A12345'
    }))
  })

  test('does not use mock init in release', async () => {
    const api = loadApi({
      wxEnvVersion: 'release',
      envVersion: 'release',
      appEnv: 'prod',
      mockEnabled: false,
      requestEnabled: false,
      baseUrl: '',
      requestTimeoutMs: 5000
    })

    await expect(api.init('mock-2')).rejects.toEqual(expect.objectContaining({
      code: 'AUX_PHOTO_BASE_URL_MISSING'
    }))
  })

  test('calls real init endpoint when backend base url is configured', async () => {
    global.wx = {
      request: jest.fn(({ success }) => {
        success({
          statusCode: 200,
          data: {
            success: true,
            code: '0000',
            message: '初始化成功',
            data: {
              ticket: 'AUX_REAL_001',
              vehicles: []
            }
          }
        })
      })
    }
    const api = loadApi({
      wxEnvVersion: 'trial',
      envVersion: 'trial',
      appEnv: 'sit',
      mockEnabled: true,
      requestEnabled: true,
      baseUrl: 'https://onlineclaim.example.com',
      requestTimeoutMs: 5000
    })

    const result = await api.init('AUX_REAL_001')

    expect(result.data.ticket).toBe('AUX_REAL_001')
    expect(global.wx.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://onlineclaim.example.com/onlineclaim/AuxPhotoService/init',
      method: 'POST',
      timeout: 5000,
      data: {
        ticket: 'AUX_REAL_001',
        clientVersion: '1.4.2'
      }
    }))
  })
})
