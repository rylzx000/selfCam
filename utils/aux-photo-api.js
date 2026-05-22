const envConfig = require('./env-config')
const auxPhotoMock = require('./aux-photo-mock')

const CLIENT_VERSION = '1.4.2'
const INIT_PATH = '/onlineclaim/AuxPhotoService/init'

function sanitizeTicket(ticket) {
  if (typeof ticket !== 'string') {
    return ''
  }

  return ticket.trim().slice(0, 256)
}

function joinUrl(baseUrl, path) {
  const safeBaseUrl = typeof baseUrl === 'string' ? baseUrl.trim().replace(/\/+$/, '') : ''
  const safePath = typeof path === 'string' ? path.trim() : ''

  if (!safeBaseUrl || !safePath) {
    return ''
  }

  return `${safeBaseUrl}${safePath.charAt(0) === '/' ? safePath : `/${safePath}`}`
}

function buildError(code, message, detail = {}) {
  return {
    success: false,
    code,
    message,
    ...detail
  }
}

function normalizeSuccessPayload(payload) {
  if (payload && typeof payload === 'object') {
    if (payload.success === false) {
      return null
    }

    if (payload.data && typeof payload.data === 'object') {
      return {
        success: payload.success !== false,
        code: payload.code || '0000',
        message: payload.message || '',
        data: payload.data
      }
    }

    return {
      success: true,
      code: payload.code || '0000',
      message: payload.message || '',
      data: payload
    }
  }

  return null
}

function requestInit(ticket, config) {
  if (typeof wx === 'undefined' || typeof wx.request !== 'function') {
    return Promise.reject(buildError(
      'AUX_PHOTO_REQUEST_UNAVAILABLE',
      '当前环境不支持辅助拍照接口请求'
    ))
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: joinUrl(config.baseUrl, INIT_PATH),
      method: 'POST',
      timeout: config.requestTimeoutMs,
      header: {
        'content-type': 'application/json',
        'X-Client-Type': 'selfCam-miniprogram',
        'X-App-Version': CLIENT_VERSION
      },
      data: {
        ticket,
        clientVersion: CLIENT_VERSION
      },
      success: (res = {}) => {
        const statusCode = Number(res.statusCode || 0)
        if (statusCode < 200 || statusCode >= 300) {
          reject(buildError('AUX_PHOTO_HTTP_ERROR', '辅助拍照初始化失败', {
            statusCode
          }))
          return
        }

        const payload = normalizeSuccessPayload(res.data)
        if (!payload) {
          reject(buildError(
            (res.data && res.data.code) || 'AUX_PHOTO_INIT_FAILED',
            (res.data && res.data.message) || '辅助拍照初始化失败'
          ))
          return
        }

        resolve(payload)
      },
      fail: (err = {}) => {
        reject(buildError('AUX_PHOTO_REQUEST_FAILED', '辅助拍照初始化请求失败', {
          errMsg: err.errMsg || ''
        }))
      }
    })
  })
}

function init(rawTicket) {
  const ticket = sanitizeTicket(rawTicket)
  const config = envConfig.getAuxPhotoConfig()

  if (config.mockEnabled && auxPhotoMock.isMockTicket(ticket)) {
    return Promise.resolve(auxPhotoMock.buildMockInitResponse(ticket))
  }

  if (!config.requestEnabled || !config.baseUrl) {
    return Promise.reject(buildError(
      'AUX_PHOTO_BASE_URL_MISSING',
      '辅助拍照接口未配置'
    ))
  }

  return requestInit(ticket, config)
}

module.exports = {
  CLIENT_VERSION,
  INIT_PATH,
  init
}
