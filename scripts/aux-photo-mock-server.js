const http = require('http')

const DEFAULT_PORT = 8787
const PORT = Number(process.env.PORT || DEFAULT_PORT)
const HOST = process.env.HOST || '127.0.0.1'

const state = {
  uploadRequestCount: 0,
  completeRequestCount: 0,
  uploadedClientPhotoIds: new Set(),
  requests: []
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  })
  res.end(JSON.stringify(body, null, 2))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function getBoundary(contentType = '') {
  const match = contentType.match(/boundary=([^;]+)/i)
  return match ? match[1].replace(/^"|"$/g, '') : ''
}

function parseContentDisposition(value = '') {
  return value.split(';').reduce((result, part) => {
    const [rawKey, rawValue] = part.trim().split('=')
    if (!rawKey || typeof rawValue === 'undefined') {
      return result
    }
    result[rawKey] = rawValue.replace(/^"|"$/g, '')
    return result
  }, {})
}

function parseMultipart(buffer, boundary) {
  const raw = buffer.toString('utf8')
  const parts = raw.split(`--${boundary}`)
  const fields = {}
  const files = []

  parts.forEach((part) => {
    const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, '')
    if (!trimmed || trimmed === '--') {
      return
    }

    const headerEndIndex = trimmed.indexOf('\r\n\r\n')
    if (headerEndIndex < 0) {
      return
    }

    const headerText = trimmed.slice(0, headerEndIndex)
    const body = trimmed.slice(headerEndIndex + 4).replace(/\r\n--$/, '')
    const headers = headerText.split('\r\n').reduce((result, line) => {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex < 0) {
        return result
      }
      result[line.slice(0, separatorIndex).trim().toLowerCase()] = line.slice(separatorIndex + 1).trim()
      return result
    }, {})
    const disposition = parseContentDisposition(headers['content-disposition'] || '')
    const name = disposition.name

    if (!name) {
      return
    }

    if (disposition.filename) {
      files.push({
        name,
        fileName: disposition.filename,
        contentType: headers['content-type'] || '',
        size: Buffer.byteLength(body)
      })
      return
    }

    fields[name] = body
  })

  return { fields, files }
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

function shouldFailUpload(requestIndex) {
  const failOnceAt = Number(process.env.AUX_MOCK_UPLOAD_FAIL_ONCE_AT || 0)
  const failAlwaysAt = Number(process.env.AUX_MOCK_UPLOAD_FAIL_ALWAYS_AT || 0)

  if (failAlwaysAt > 0 && requestIndex === failAlwaysAt) {
    return true
  }

  if (failOnceAt > 0 && requestIndex === failOnceAt) {
    return true
  }

  return false
}

function shouldFailComplete(requestIndex) {
  if (process.env.AUX_MOCK_COMPLETE_FAIL_ALWAYS === '1') {
    return true
  }

  return process.env.AUX_MOCK_COMPLETE_FAIL_ONCE === '1' && requestIndex === 1
}

async function handleUploadPhoto(req, res) {
  state.uploadRequestCount += 1
  const requestIndex = state.uploadRequestCount
  const boundary = getBoundary(req.headers['content-type'] || '')
  const body = await readBody(req)

  if (!boundary) {
    sendJson(res, 400, {
      success: false,
      code: 'MOCK_MULTIPART_BOUNDARY_MISSING',
      message: 'multipart boundary missing'
    })
    return
  }

  const multipart = parseMultipart(body, boundary)
  const metadata = parseJson(multipart.fields.metadata, null)
  const file = multipart.files.find((item) => item.name === 'file') || null

  state.requests.push({
    type: 'uploadPhoto',
    requestIndex,
    metadata,
    file
  })

  console.log('[aux-photo-mock] uploadPhoto', {
    requestIndex,
    metadata,
    file
  })

  if (!metadata || !file) {
    sendJson(res, 400, {
      success: false,
      code: 'MOCK_UPLOAD_PARAM_INVALID',
      message: 'metadata or file missing'
    })
    return
  }

  if (shouldFailUpload(requestIndex)) {
    sendJson(res, 200, {
      success: false,
      code: 'AUX_UPLOAD_FAILED',
      message: `mock upload failed at request ${requestIndex}`
    })
    return
  }

  const duplicate = state.uploadedClientPhotoIds.has(metadata.clientPhotoId)
  state.uploadedClientPhotoIds.add(metadata.clientPhotoId)

  sendJson(res, 200, {
    success: true,
    code: '0000',
    message: duplicate ? '图片已上传' : '图片上传成功',
    data: {
      uploadRecordId: `MOCK_AUP_${String(requestIndex).padStart(4, '0')}`,
      photoId: `MOCK_DOC_${String(requestIndex).padStart(4, '0')}`,
      vehicleId: metadata.vehicleId,
      uploadItemId: metadata.uploadItemId,
      photoType: metadata.photoType,
      duplicate,
      itemUploadedCount: metadata.sortNo || 1,
      ticketStatus: 'UPLOADING'
    }
  })
}

async function handleUploadPhotoBase64(req, res) {
  state.uploadRequestCount += 1
  const requestIndex = state.uploadRequestCount
  const body = await readBody(req)
  const payload = parseJson(body.toString('utf8'), {})
  const fileBase64 = typeof payload.fileBase64 === 'string' && payload.fileBase64
    ? payload.fileBase64
    : payload.base64

  state.requests.push({
    type: 'uploadPhotoBase64',
    requestIndex,
    payload: {
      ...payload,
      fileBase64: fileBase64 ? `[base64:${fileBase64.length}]` : ''
    }
  })

  console.log('[aux-photo-mock] uploadPhotoBase64', {
    requestIndex,
    payload: {
      ...payload,
      fileBase64: fileBase64 ? `[base64:${fileBase64.length}]` : ''
    }
  })

  if (!payload.ticket || !payload.vehicleId || !payload.uploadItemId || !payload.photoType || !fileBase64) {
    sendJson(res, 400, {
      success: false,
      code: 'MOCK_UPLOAD_PARAM_INVALID',
      message: 'upload payload invalid'
    })
    return
  }

  if (shouldFailUpload(requestIndex)) {
    sendJson(res, 200, {
      success: false,
      code: 'AUX_UPLOAD_FAILED',
      message: `mock upload failed at request ${requestIndex}`
    })
    return
  }

  const duplicate = state.uploadedClientPhotoIds.has(payload.clientPhotoId)
  state.uploadedClientPhotoIds.add(payload.clientPhotoId)

  sendJson(res, 200, {
    success: true,
    code: '0000',
    message: duplicate ? '图片已上传' : '图片上传成功',
    data: {
      uploadRecordId: `MOCK_AUP_${String(requestIndex).padStart(4, '0')}`,
      photoId: `MOCK_DOC_${String(requestIndex).padStart(4, '0')}`,
      vehicleId: payload.vehicleId,
      uploadItemId: payload.uploadItemId,
      photoType: payload.photoType,
      duplicate,
      itemUploadedCount: payload.sortNo || 1,
      ticketStatus: 'UPLOADING'
    }
  })
}

async function handleComplete(req, res) {
  state.completeRequestCount += 1
  const requestIndex = state.completeRequestCount
  const body = await readBody(req)
  const payload = parseJson(body.toString('utf8'), {})

  state.requests.push({
    type: 'complete',
    requestIndex,
    payload
  })

  console.log('[aux-photo-mock] complete', {
    requestIndex,
    payload
  })

  if (shouldFailComplete(requestIndex)) {
    sendJson(res, 200, {
      success: false,
      code: 'AUX_SERVER_ERROR',
      message: `mock complete failed at request ${requestIndex}`
    })
    return
  }

  sendJson(res, 200, {
    success: true,
    code: '0000',
    message: '辅助拍照已完成',
    data: {
      ticket: payload.ticket,
      ticketStatus: 'COMPLETED',
      uploadedCount: payload.clientUploadCount || state.uploadedClientPhotoIds.size,
      requiredPassed: true,
      missingItems: [],
      completeTime: new Date().toISOString(),
      phase2TriggerStatus: 'NOT_ENABLED'
    }
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`)

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }

    if (req.method === 'GET' && url.pathname === '/__requests') {
      sendJson(res, 200, {
        success: true,
        uploadRequestCount: state.uploadRequestCount,
        completeRequestCount: state.completeRequestCount,
        requests: state.requests
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/onlineclaim/AuxPhotoService/uploadPhoto') {
      await handleUploadPhoto(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === '/onlineclaim/AuxPhotoService/uploadPhotoBase64') {
      await handleUploadPhotoBase64(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === '/onlineclaim/AuxPhotoService/complete') {
      await handleComplete(req, res)
      return
    }

    sendJson(res, 404, {
      success: false,
      code: 'MOCK_NOT_FOUND',
      message: `${req.method} ${url.pathname} not found`
    })
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      code: 'MOCK_SERVER_ERROR',
      message: error.message || String(error)
    })
  }
})

server.listen(PORT, HOST, () => {
  const baseUrl = `http://${HOST}:${PORT}`
  console.log(`[aux-photo-mock] listening on ${baseUrl}`)
  console.log(`[aux-photo-mock] set host in DevTools: wx.setStorageSync('SELF_CAM_AUX_PHOTO_HOST', '${baseUrl}')`)
  console.log('[aux-photo-mock] optional env: AUX_MOCK_UPLOAD_FAIL_ONCE_AT=2 AUX_MOCK_COMPLETE_FAIL_ONCE=1')
})
