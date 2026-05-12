const envConfig = require('./env-config')
const realtimeLog = require('./realtime-log')

const LOG_STORAGE_KEY = 'selfcam_runtime_logs'
const SESSION_STORAGE_KEY = 'selfcam_runtime_session'

let uploadTimer = null
let uploading = false
let pendingUploadQueue = []

const LOG_LEVEL_PRIORITY = {
  info: 1,
  warn: 2,
  error: 3
}

const REALTIME_FORWARD_EVENTS = {
  diagnostic: new Set(['realtime_probe']),
  ai: new Set(['model_config_probe', 'ai_unavailable', 'detector_init_failed']),
  ai_model: new Set([
    'download_failed',
    'download_status_failed',
    'cache_copy_failed',
    'model_file_invalid',
    'session_create_failed',
    'session_load_failed'
  ])
}

const REALTIME_PAYLOAD_KEYS = [
  'feedbackId',
  'appEnv',
  'wxEnvVersion',
  'reason',
  'stage',
  'modelName',
  'statusCode',
  'message',
  'errMsg',
  'attemptName',
  'precisionLevel',
  'modelUrl',
  'modelPath',
  'plateModelUrl',
  'damageModelUrl',
  'system',
  'model',
  'brand',
  'platform',
  'SDKVersion',
  'version',
  'step',
  'runId',
  'windowWidth',
  'windowHeight',
  'cameraWidth',
  'cameraHeight',
  'layoutScale',
  'uiScale',
  'uiScaleReason',
  'needsResponsiveUiScale',
  'rawWindowWidth',
  'rawWindowHeight',
  'safeAreaWidth',
  'safeAreaHeight',
  'pixelRatio',
  'frameWidth',
  'frameHeight',
  'frameAspect',
  'mappingMode',
  'scale',
  'offsetX',
  'offsetY',
  'captureBox',
  'mappedBox',
  'inBox',
  'centerInBox',
  'centerAligned',
  'areaInRange',
  'areaRatio',
  'minAreaRatio',
  'maxAreaRatio',
  'centerOffsetThreshold',
  'centerOffsetX',
  'centerOffsetY',
  'consecutiveCount',
  'failReason',
  'phase',
  'hasTrack',
  'centerOffset',
  'imageAreaRatio',
  'effectiveMinAreaRatio',
  'effectiveMaxAreaRatio',
  'holdStableCount',
  'finalReason'
]

function getNow() {
  return Date.now()
}

function getIsoTime(timestamp = getNow()) {
  return new Date(timestamp).toISOString()
}

function getWx() {
  if (typeof wx === 'undefined') {
    return null
  }

  return wx
}

function getLoggerConfig() {
  return envConfig.getDebugConfig()
}

function getEnvVersion() {
  return envConfig.getEnvVersion()
}

function shouldCaptureLevel(level) {
  const runtimeLoggerLevel = getLoggerConfig().runtimeLoggerLevel || 'silent'

  if (runtimeLoggerLevel === 'silent') {
    return false
  }

  return (LOG_LEVEL_PRIORITY[level] || 0) >= (LOG_LEVEL_PRIORITY[runtimeLoggerLevel] || 0)
}

function shouldForwardRealtimeLog(level, scope, event) {
  const allowedEvents = REALTIME_FORWARD_EVENTS[scope]
  return !!allowedEvents && allowedEvents.has(event)
}

function shouldUpload() {
  const wxRef = getWx()
  const loggerConfig = getLoggerConfig()

  return !!loggerConfig.uploadEnabled
    && !!loggerConfig.uploadUrl
    && !!wxRef
    && typeof wxRef.request === 'function'
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

function buildRealtimePayload(sessionId, payload = {}) {
  const realtimePayload = { sessionId }

  if (!payload || typeof payload !== 'object') {
    return realtimePayload
  }

  REALTIME_PAYLOAD_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined) {
      realtimePayload[key] = safeClone(payload[key])
    }
  })

  return realtimePayload
}

function readStorageObject(storageKey, fallbackValue) {
  const wxRef = getWx()

  if (!wxRef || typeof wxRef.getStorageSync !== 'function') {
    return fallbackValue
  }

  try {
    const value = wxRef.getStorageSync(storageKey)
    if (!value) {
      return fallbackValue
    }
    return JSON.parse(value)
  } catch (error) {
    return fallbackValue
  }
}

function writeStorageObject(storageKey, value) {
  const wxRef = getWx()

  if (!wxRef || typeof wxRef.setStorageSync !== 'function') {
    return
  }

  try {
    wxRef.setStorageSync(storageKey, JSON.stringify(value))
  } catch (error) {
    // 本地日志写入失败不阻断主流程
  }
}

function readLogs() {
  return readStorageObject(LOG_STORAGE_KEY, [])
}

function writeLogs(logs) {
  const trimmedLogs = logs.slice(-getLoggerConfig().maxEntries)
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
  try {
    realtimeLog.setFilterMsg(session.sessionId)
  } catch (error) {
    // 实时日志失败不影响主流程
  }
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

function getSessionId() {
  return ensureSession().sessionId
}

function syncRealtimeLog(level, scope, event, payload) {
  try {
    const logger = realtimeLog[level]
    if (typeof logger === 'function') {
      logger(scope, event, payload)
    }
  } catch (error) {
    // 实时日志失败不影响主流程
  }
}

function scheduleUpload() {
  const loggerConfig = getLoggerConfig()

  if (!shouldUpload() || uploadTimer || uploading || pendingUploadQueue.length === 0) {
    return
  }

  uploadTimer = setTimeout(() => {
    uploadTimer = null
    flush()
  }, loggerConfig.uploadThrottleMs)
}

function flush() {
  const wxRef = getWx()
  const loggerConfig = getLoggerConfig()

  if (!shouldUpload() || uploading || pendingUploadQueue.length === 0) {
    return
  }

  const batch = pendingUploadQueue.slice(0, loggerConfig.batchSize)
  uploading = true

  wxRef.request({
    url: loggerConfig.uploadUrl,
    method: 'POST',
    timeout: loggerConfig.requestTimeoutMs,
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
  if (!shouldCaptureLevel(level)) {
    return null
  }

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

  if (shouldForwardRealtimeLog(level, scope, event)) {
    syncRealtimeLog(level, scope, event, buildRealtimePayload(session.sessionId, payload))
  }

  if (shouldUpload()) {
    const loggerConfig = getLoggerConfig()
    pendingUploadQueue.push(entry)
    if (pendingUploadQueue.length > loggerConfig.maxPendingEntries) {
      pendingUploadQueue = pendingUploadQueue.slice(-loggerConfig.maxPendingEntries)
    }
    scheduleUpload()
  }

  return entry
}

function addForcedLog(level, scope, event, payload = {}, sessionMeta = null) {
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

  syncRealtimeLog(level, scope, event, buildRealtimePayload(session.sessionId, payload))

  if (shouldUpload()) {
    const loggerConfig = getLoggerConfig()
    pendingUploadQueue.push(entry)
    if (pendingUploadQueue.length > loggerConfig.maxPendingEntries) {
      pendingUploadQueue = pendingUploadQueue.slice(-loggerConfig.maxPendingEntries)
    }
    scheduleUpload()
  }

  return entry
}

function startSession(scope, meta = {}) {
  clearSession(false)
  const session = createSession(meta)
  console.log('[runtime] realtime log filter', `selfCam_${session.sessionId}`)
  addLog('info', scope || 'runtime', 'session_start', meta)
  return session.sessionId
}

function endSession(scope, meta = {}) {
  addLog('info', scope || 'runtime', 'session_end', meta)
  flush()
}

function clearSession(clearLogs = true) {
  const wxRef = getWx()

  pendingUploadQueue = []
  if (uploadTimer) {
    clearTimeout(uploadTimer)
    uploadTimer = null
  }

  if (!wxRef || typeof wxRef.removeStorageSync !== 'function') {
    return
  }

  try {
    wxRef.removeStorageSync(SESSION_STORAGE_KEY)
    if (clearLogs) {
      wxRef.removeStorageSync(LOG_STORAGE_KEY)
    }
  } catch (error) {
    // 清理失败不阻断主流程
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

function forceWarn(scope, event, payload = {}) {
  return addForcedLog('warn', scope, event, payload)
}

function forceError(scope, event, payload = {}) {
  return addForcedLog('error', scope, event, payload)
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
  forceWarn,
  forceError,
  flush,
  readLogs,
  addLog,
  getSessionId
}
