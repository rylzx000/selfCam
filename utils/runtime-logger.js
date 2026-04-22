const { DEBUG_LOG } = require('./ai-config')

const LOG_STORAGE_KEY = 'selfcam_runtime_logs'
const SESSION_STORAGE_KEY = 'selfcam_runtime_session'

let uploadTimer = null
let uploading = false
let pendingUploadQueue = []

function getNow() {
  return Date.now()
}

function getIsoTime(timestamp = getNow()) {
  return new Date(timestamp).toISOString()
}

function getEnvVersion() {
  if (typeof wx.getAccountInfoSync !== 'function') {
    return 'unknown'
  }

  try {
    return wx.getAccountInfoSync()?.miniProgram?.envVersion || 'unknown'
  } catch (error) {
    return 'unknown'
  }
}

function shouldUpload() {
  return !!DEBUG_LOG.enabled
    && !!DEBUG_LOG.uploadUrl
    && getEnvVersion() !== 'release'
    && typeof wx.request === 'function'
}

function safeClone(value, depth = 0) {
  if (value === null || value === undefined) {
    return value
  }

  if (depth >= 3) {
    return '[depth_limited]'
  }

  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => safeClone(item, depth + 1))
  }

  if (typeof value === 'object') {
    const result = {}
    Object.keys(value).slice(0, 20).forEach((key) => {
      result[key] = safeClone(value[key], depth + 1)
    })
    return result
  }

  if (typeof value === 'function') {
    return '[function]'
  }

  return value
}

function readStorageObject(storageKey, fallbackValue) {
  try {
    const value = wx.getStorageSync(storageKey)
    if (!value) {
      return fallbackValue
    }
    return JSON.parse(value)
  } catch (error) {
    return fallbackValue
  }
}

function writeStorageObject(storageKey, value) {
  wx.setStorageSync(storageKey, JSON.stringify(value))
}

function readLogs() {
  return readStorageObject(LOG_STORAGE_KEY, [])
}

function writeLogs(logs) {
  const trimmedLogs = logs.slice(-DEBUG_LOG.maxEntries)
  writeStorageObject(LOG_STORAGE_KEY, trimmedLogs)
}

function getSession() {
  return readStorageObject(SESSION_STORAGE_KEY, null)
}

function createSession(meta = {}) {
  const timestamp = getNow()
  const session = {
    sessionId: `${timestamp}-${Math.random().toString(16).slice(2, 8)}`,
    startedAt: timestamp,
    startedAtIso: getIsoTime(timestamp),
    envVersion: getEnvVersion(),
    meta: safeClone(meta)
  }
  writeStorageObject(SESSION_STORAGE_KEY, session)
  return session
}

function ensureSession(meta = {}) {
  return getSession() || createSession(meta)
}

function appendLocalLog(entry) {
  const logs = readLogs()
  logs.push(entry)
  writeLogs(logs)
}

function scheduleUpload() {
  if (!shouldUpload() || uploadTimer || uploading || pendingUploadQueue.length === 0) {
    return
  }

  uploadTimer = setTimeout(() => {
    uploadTimer = null
    flush()
  }, DEBUG_LOG.uploadThrottleMs)
}

function flush() {
  if (!shouldUpload() || uploading || pendingUploadQueue.length === 0) {
    return
  }

  const batch = pendingUploadQueue.slice(0, DEBUG_LOG.batchSize)
  uploading = true

  wx.request({
    url: DEBUG_LOG.uploadUrl,
    method: 'POST',
    timeout: DEBUG_LOG.requestTimeoutMs,
    data: {
      app: 'selfCam',
      sentAt: getIsoTime(),
      logs: batch
    },
    success: (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        pendingUploadQueue = pendingUploadQueue.slice(batch.length)
      }
    },
    complete: () => {
      uploading = false
      if (pendingUploadQueue.length > 0) {
        scheduleUpload()
      }
    }
  })
}

function addLog(level, scope, event, payload = {}, sessionMeta = null) {
  const session = ensureSession(sessionMeta || {})
  const timestamp = getNow()
  const entry = {
    id: `${timestamp}-${Math.random().toString(16).slice(2, 8)}`,
    sessionId: session.sessionId,
    level,
    scope,
    event,
    timestamp,
    at: getIsoTime(timestamp),
    payload: safeClone(payload)
  }

  appendLocalLog(entry)

  if (shouldUpload()) {
    pendingUploadQueue.push(entry)
    if (pendingUploadQueue.length > DEBUG_LOG.maxPendingEntries) {
      pendingUploadQueue = pendingUploadQueue.slice(-DEBUG_LOG.maxPendingEntries)
    }
    scheduleUpload()
  }

  return entry
}

function startSession(scope, meta = {}) {
  clearSession(false)
  const session = createSession(meta)
  addLog('info', scope || 'runtime', 'session_start', meta)
  return session.sessionId
}

function endSession(scope, meta = {}) {
  addLog('info', scope || 'runtime', 'session_end', meta)
  flush()
}

function clearSession(clearLogs = true) {
  pendingUploadQueue = []
  if (uploadTimer) {
    clearTimeout(uploadTimer)
    uploadTimer = null
  }
  wx.removeStorageSync(SESSION_STORAGE_KEY)
  if (clearLogs) {
    wx.removeStorageSync(LOG_STORAGE_KEY)
  }
}

function info(scope, event, payload = {}) {
  return addLog('info', scope, event, payload)
}

function warn(scope, event, payload = {}) {
  return addLog('warn', scope, event, payload)
}

function error(scope, event, payload = {}) {
  return addLog('error', scope, event, payload)
}

module.exports = {
  LOG_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  startSession,
  endSession,
  clearSession,
  info,
  warn,
  error,
  flush,
  readLogs
}
