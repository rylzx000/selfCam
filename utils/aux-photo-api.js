const envConfig = require('./env-config')
const auxPhotoMock = require('./aux-photo-mock')

const CLIENT_VERSION = '1.4.6'
const INIT_PATH = '/onlineclaim/AuxPhotoService/init'
const UPLOAD_PHOTO_BASE64_PATH = '/onlineclaim/AuxPhotoService/uploadPhotoBase64'
const COMPLETE_PATH = '/onlineclaim/AuxPhotoService/complete'

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

function sanitizeString(value, fallback = '', maxLength = 512) {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : fallback
}

function parseResponseData(data) {
  if (typeof data !== 'string') {
    return data
  }

  try {
    return JSON.parse(data)
  } catch (error) {
    return null
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

function normalizeDuplicatePayload(payload, item) {
  if (!payload || payload.code !== 'AUX_UPLOAD_DUPLICATE') {
    return null
  }

  return {
    success: true,
    code: payload.code,
    message: payload.message || '图片已上传',
    data: {
      ...(payload.data && typeof payload.data === 'object' ? payload.data : {}),
      vehicleId: item && item.vehicleId,
      uploadItemId: item && item.uploadItemId,
      photoType: item && item.photoType,
      duplicate: true
    }
  }
}

function normalizeCompletedPayload(payload, ticket) {
  if (!payload || payload.code !== 'AUX_TICKET_COMPLETED') {
    return null
  }

  return {
    success: true,
    code: payload.code,
    message: payload.message || '辅助拍照已完成',
    data: {
      ...(payload.data && typeof payload.data === 'object' ? payload.data : {}),
      ticket,
      ticketStatus: 'COMPLETED'
    }
  }
}

function getResponseError(payload, fallbackCode, fallbackMessage, detail = {}) {
  return buildError(
    payload && payload.code ? payload.code : fallbackCode,
    payload && payload.message ? payload.message : fallbackMessage,
    detail
  )
}

function getFileName(filePath = '', fallback = 'photo.jpg') {
  const normalized = sanitizeString(filePath, '')
  const pathWithoutQuery = normalized.split('?')[0]
  const fileName = pathWithoutQuery.split('/').filter(Boolean).pop()
  return sanitizeString(fileName, fallback, 128)
}

function getFileType(fileName = '') {
  const match = sanitizeString(fileName, '').match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : ''
}

function buildUploadMetadata(item = {}, ticket = '') {
  const fileName = getFileName(item.filePath, `${sanitizeString(item.clientPhotoId || item.id, 'photo')}.jpg`)

  return {
    ticket,
    clientPhotoId: sanitizeString(item.clientPhotoId || item.id, ''),
    vehicleId: sanitizeString(item.vehicleId, ''),
    uploadItemId: sanitizeString(item.uploadItemId, ''),
    photoType: sanitizeString(item.photoType, ''),
    fileName,
    fileType: getFileType(fileName),
    fileSize: Number.isFinite(item.fileSize) ? Math.round(item.fileSize) : 0,
    sortNo: Number.isFinite(item.sortNo) ? Math.round(item.sortNo) : 1,
    fileHash: sanitizeString(item.fileHash, ''),
    shootTime: sanitizeString(item.shootTime, '')
  }
}

function readFileBase64(filePath) {
  if (typeof wx === 'undefined' || typeof wx.getFileSystemManager !== 'function') {
    return Promise.reject(buildError(
      'AUX_PHOTO_UPLOAD_UNAVAILABLE',
      '当前环境不支持图片上传'
    ))
  }

  const fs = wx.getFileSystemManager()
  if (!fs || typeof fs.readFile !== 'function') {
    return Promise.reject(buildError(
      'AUX_PHOTO_UPLOAD_UNAVAILABLE',
      '当前环境不支持图片上传'
    ))
  }

  return new Promise((resolve, reject) => {
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (res = {}) => {
        if (typeof res.data !== 'string' || !res.data.trim()) {
          reject(buildError(
            'AUX_PHOTO_BASE64_EMPTY',
            '图片读取失败'
          ))
          return
        }

        resolve(res.data)
      },
      fail: (err = {}) => {
        reject(buildError('AUX_PHOTO_READ_FILE_FAILED', '图片读取失败', {
          errMsg: err.errMsg || ''
        }))
      }
    })
  })
}

function buildUploadBase64Payload(metadata, fileBase64) {
  const payload = {
    ticket: metadata.ticket,
    vehicleId: metadata.vehicleId,
    uploadItemId: metadata.uploadItemId,
    photoType: metadata.photoType,
    clientPhotoId: metadata.clientPhotoId,
    sortNo: metadata.sortNo,
    fileName: metadata.fileName,
    fileBase64
  }

  if (metadata.fileHash) {
    payload.fileHash = metadata.fileHash
  }

  if (metadata.shootTime) {
    payload.shootTime = metadata.shootTime
  }

  return payload
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

function requestUploadPhoto(item, ticket, config) {
  if (typeof wx === 'undefined' || typeof wx.request !== 'function') {
    return Promise.reject(buildError(
      'AUX_PHOTO_UPLOAD_UNAVAILABLE',
      '当前环境不支持图片上传'
    ))
  }

  const metadata = buildUploadMetadata(item, ticket)
  if (!metadata.ticket || !metadata.vehicleId || !metadata.uploadItemId || !metadata.photoType || !item.filePath) {
    return Promise.reject(buildError(
      'AUX_PHOTO_UPLOAD_PARAM_INVALID',
      '图片上传参数不完整'
    ))
  }

  return readFileBase64(item.filePath).then((fileBase64) => new Promise((resolve, reject) => {
    wx.request({
      url: joinUrl(config.baseUrl, UPLOAD_PHOTO_BASE64_PATH),
      method: 'POST',
      timeout: config.requestTimeoutMs,
      header: {
        'content-type': 'application/json',
        'X-Client-Type': 'selfCam-miniprogram',
        'X-App-Version': CLIENT_VERSION
      },
      data: buildUploadBase64Payload(metadata, fileBase64),
      success: (res = {}) => {
        const statusCode = Number(res.statusCode || 0)
        const payloadData = parseResponseData(res.data)

        if (statusCode < 200 || statusCode >= 300) {
          reject(buildError('AUX_PHOTO_UPLOAD_HTTP_ERROR', '图片上传失败', {
            statusCode,
            data: payloadData
          }))
          return
        }

        const duplicatePayload = normalizeDuplicatePayload(payloadData, item)
        const payload = duplicatePayload || normalizeSuccessPayload(payloadData)
        if (!payload) {
          reject(getResponseError(
            payloadData,
            'AUX_PHOTO_UPLOAD_FAILED',
            '图片上传失败'
          ))
          return
        }

        resolve(payload)
      },
      fail: (err = {}) => {
        reject(buildError('AUX_PHOTO_UPLOAD_REQUEST_FAILED', '图片上传请求失败', {
          errMsg: err.errMsg || ''
        }))
      }
    })
  }))
}

function requestComplete(params, config) {
  if (typeof wx === 'undefined' || typeof wx.request !== 'function') {
    return Promise.reject(buildError(
      'AUX_PHOTO_REQUEST_UNAVAILABLE',
      '当前环境不支持辅助拍照接口请求'
    ))
  }

  const ticket = sanitizeTicket(params && params.ticket)
  if (!ticket) {
    return Promise.reject(buildError(
      'AUX_PHOTO_COMPLETE_PARAM_INVALID',
      '完成提交参数不完整'
    ))
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: joinUrl(config.baseUrl, COMPLETE_PATH),
      method: 'POST',
      timeout: config.requestTimeoutMs,
      header: {
        'content-type': 'application/json',
        'X-Client-Type': 'selfCam-miniprogram',
        'X-App-Version': CLIENT_VERSION
      },
      data: {
        ticket,
        clientUploadCount: Number.isFinite(params.clientUploadCount)
          ? Math.round(params.clientUploadCount)
          : 0,
        remark: sanitizeString(params.remark, '', 256)
      },
      success: (res = {}) => {
        const statusCode = Number(res.statusCode || 0)
        if (statusCode < 200 || statusCode >= 300) {
          reject(buildError('AUX_PHOTO_COMPLETE_HTTP_ERROR', '完成提交失败', {
            statusCode
          }))
          return
        }

        const completedPayload = normalizeCompletedPayload(res.data, ticket)
        const payload = completedPayload || normalizeSuccessPayload(res.data)
        if (!payload) {
          reject(getResponseError(
            res.data,
            'AUX_PHOTO_COMPLETE_FAILED',
            '完成提交失败'
          ))
          return
        }

        resolve(payload)
      },
      fail: (err = {}) => {
        reject(buildError('AUX_PHOTO_COMPLETE_REQUEST_FAILED', '完成提交请求失败', {
          errMsg: err.errMsg || ''
        }))
      }
    })
  })
}

function shouldMockFailOnce(ticket, attempt) {
  return sanitizeString(ticket).toLowerCase().indexOf('fail-once') >= 0 && attempt <= 1
}

function shouldMockFailAlways(ticket) {
  return sanitizeString(ticket).toLowerCase().indexOf('fail-always') >= 0
}

function mockUploadPhoto(item = {}, ticket = '') {
  if (shouldMockFailAlways(ticket) || shouldMockFailOnce(ticket, item.attempts || 0)) {
    return Promise.reject(buildError('MOCK_UPLOAD_FAILED', '模拟上传失败'))
  }

  return Promise.resolve({
    success: true,
    code: '0000',
    message: '图片上传成功',
    data: {
      uploadRecordId: `MOCK_UPLOAD_${sanitizeString(item.id || item.clientPhotoId, 'photo', 64)}`,
      photoId: `MOCK_PHOTO_${sanitizeString(item.clientPhotoId || item.id, 'photo', 64)}`,
      vehicleId: item.vehicleId,
      uploadItemId: item.uploadItemId,
      photoType: item.photoType,
      duplicate: false,
      itemUploadedCount: Number.isFinite(item.sortNo) ? Math.round(item.sortNo) : 1,
      ticketStatus: 'UPLOADING'
    }
  })
}

function mockComplete(params = {}) {
  const ticket = sanitizeTicket(params.ticket)
  const attempt = Number.isFinite(params.completeAttempt) ? params.completeAttempt : 0
  const normalizedTicket = sanitizeString(ticket).toLowerCase()

  if (normalizedTicket.indexOf('complete-fail-always') >= 0
    || (normalizedTicket.indexOf('complete-fail-once') >= 0 && attempt <= 1)) {
    return Promise.reject(buildError('MOCK_COMPLETE_FAILED', '模拟完成提交失败'))
  }

  return Promise.resolve({
    success: true,
    code: '0000',
    message: '辅助拍照已完成',
    data: {
      ticket,
      ticketStatus: 'COMPLETED',
      uploadedCount: Number.isFinite(params.clientUploadCount) ? Math.round(params.clientUploadCount) : 0,
      requiredPassed: true,
      missingItems: [],
      completeTime: '',
      phase2TriggerStatus: 'NOT_ENABLED'
    }
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

function uploadPhoto(item = {}, options = {}) {
  const ticket = sanitizeTicket(options.ticket)
  const config = envConfig.getAuxPhotoConfig()

  if (config.mockEnabled && auxPhotoMock.isMockTicket(ticket) && (!config.requestEnabled || !config.baseUrl)) {
    return mockUploadPhoto(item, ticket)
  }

  if (!config.requestEnabled || !config.baseUrl) {
    return Promise.reject(buildError(
      'AUX_PHOTO_BASE_URL_MISSING',
      '辅助拍照接口未配置'
    ))
  }

  return requestUploadPhoto(item, ticket, config)
}

function complete(params = {}) {
  const ticket = sanitizeTicket(params.ticket)
  const config = envConfig.getAuxPhotoConfig()

  if (config.mockEnabled && auxPhotoMock.isMockTicket(ticket) && (!config.requestEnabled || !config.baseUrl)) {
    return mockComplete({ ...params, ticket })
  }

  if (!config.requestEnabled || !config.baseUrl) {
    return Promise.reject(buildError(
      'AUX_PHOTO_BASE_URL_MISSING',
      '辅助拍照接口未配置'
    ))
  }

  return requestComplete({ ...params, ticket }, config)
}

module.exports = {
  CLIENT_VERSION,
  INIT_PATH,
  UPLOAD_PHOTO_BASE64_PATH,
  COMPLETE_PATH,
  init,
  uploadPhoto,
  complete
}
