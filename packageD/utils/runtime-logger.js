const envConfig = require('./env-config')
const realtimeLog = require('./realtime-log')

const LOG_STORAGE_KEY = 'selfcam_runtime_logs'
const SESSION_STORAGE_KEY = 'selfcam_runtime_session'
const AUX_TICKET_STORAGE_KEY = 'selfcam_aux_ticket'

let uploadTimer = null
let uploading = false
let pendingUploadQueue = []
let errorUploadTimer = null
let errorUploading = false
let pendingErrorUploadQueue = []

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

const ERROR_UPLOAD_EVENTS = {
  ai_model: new Set([
    'download_failed',
    'download_status_failed',
    'cache_copy_failed',
    'model_file_invalid',
    'session_create_failed',
    'session_load_failed'
  ]),
  ai: new Set([
    'ai_unavailable',
    'detector_init_failed',
    'detect_loop_error'
  ]),
  capture: new Set(['auto_capture_failed']),
  camera: new Set(['camera_error']),
  api: new Set(['request_failed'])
}

const ERROR_UPLOAD_DETAILS = {
  ai_model: {
    download_failed: ['AI_MODEL_DOWNLOAD_FAILED', '模型下载失败'],
    download_status_failed: ['AI_MODEL_DOWNLOAD_FAILED', '模型下载失败'],
    cache_copy_failed: ['AI_MODEL_DOWNLOAD_FAILED', '模型下载失败'],
    model_file_invalid: ['AI_MODEL_DOWNLOAD_FAILED', '模型下载失败'],
    session_create_failed: ['AI_MODEL_SESSION_CREATE_FAILED', '模型会话创建失败'],
    session_load_failed: ['AI_MODEL_SESSION_LOAD_FAILED', '模型会话加载失败']
  },
  ai: {
    ai_unavailable: ['AI_UNAVAILABLE', 'AI能力不可用'],
    detector_init_failed: ['AI_DETECTOR_INIT_FAILED', '检测器初始化失败'],
    detect_loop_error: ['AI_DETECT_LOOP_ERROR', 'AI检测循环异常']
  },
  capture: {
    auto_capture_failed: ['CAPTURE_AUTO_CAPTURE_FAILED', '自动拍照失败']
  },
  camera: {
    camera_error: ['CAMERA_ERROR', '相机异常']
  }
}

const API_ERROR_DETAILS = {
  init: ['AUX_INIT_FAILED', '辅助拍照初始化失败'],
  uploadPhotoBase64: ['AUX_UPLOAD_FAILED', '图片上传失败'],
  complete: ['AUX_COMPLETE_FAILED', '完成采集失败']
}

const SENSITIVE_KEY_PATTERN = /(token|cookie|secret|sessionkey|session_key|authorization|password|credential)/i
const ERROR_LOG_PAYLOAD_KEYS = [
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
  'failReason',
  'page',
  'systemInfo'
]

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

function getErrorLoggerConfig() {
  if (typeof envConfig.getErrorLogConfig !== 'function') {
    return {
      uploadEnabled: false,
      uploadUrl: '',
      batchSize: 20,
      maxPendingEntries: 20,
      uploadThrottleMs: 1500,
      requestTimeoutMs: 2500,
      appEnv: '',
      wxEnvVersion: getEnvVersion(),
      envVersion: getEnvVersion()
    }
  }

  return envConfig.getErrorLogConfig()
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

function shouldUploadErrorLog(level, scope, event) {
  const allowedEvents = ERROR_UPLOAD_EVENTS[scope]
  return level === 'error' && !!allowedEvents && allowedEvents.has(event)
}

function shouldUpload() {
  const wxRef = getWx()
  const loggerConfig = getLoggerConfig()

  return !!loggerConfig.uploadEnabled
    && !!loggerConfig.uploadUrl
    && !!wxRef
    && typeof wxRef.request === 'function'
}

function normalizeTicket(value) {
  return typeof value === 'string' ? value.trim().slice(0, 256) : ''
}

function isMockTicket(ticket) {
  return /^mock(?:-|$)/i.test(normalizeTicket(ticket))
}

function getTicket() {
  try {
    const bootstrap = require('./bootstrap')
    if (bootstrap && typeof bootstrap.getTicket === 'function') {
      try {
        return normalizeTicket(bootstrap.getTicket())
      } catch (error) {
        return ''
      }
    }
  } catch (error) {
    // bootstrap may be unavailable in very early test lifecycles.
  }

  const wxRef = getWx()
  if (!wxRef || typeof wxRef.getStorageSync !== 'function') {
    return ''
  }

  try {
    return normalizeTicket(wxRef.getStorageSync(AUX_TICKET_STORAGE_KEY))
  } catch (error) {
    return ''
  }
}

function getSystemInfoSnapshot() {
  const wxRef = getWx()
  if (!wxRef || typeof wxRef.getSystemInfoSync !== 'function') {
    return {}
  }

  try {
    const info = wxRef.getSystemInfoSync() || {}
    return {
      sdkVersion: normalizeLogString(info.SDKVersion || '', 32),
      systemBrand: normalizeLogString(info.brand || '', 64),
      systemModel: normalizeLogString(info.model || '', 128),
      systemOs: normalizeLogString(info.system || '', 128),
      systemPlatform: normalizeLogString(info.platform || '', 64),
      systemLanguage: normalizeLogString(info.language || '', 64)
    }
  } catch (error) {
    return {}
  }
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

function safeErrorPayloadClone(value, depth = 0) {
  if (value === null || value === undefined) {
    return value
  }

  if (depth >= 3) {
    return '[depth_limited]'
  }

  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => safeErrorPayloadClone(item, depth + 1))
  }

  if (typeof value === 'object') {
    if (value instanceof ArrayBuffer) {
      return '[binary]'
    }

    const result = {}
    Object.keys(value).slice(0, 20).forEach((key) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return
      }
      result[key] = safeErrorPayloadClone(value[key], depth + 1)
    })
    return result
  }

  if (typeof value === 'string') {
    const normalized = value.length > 512 ? `${value.slice(0, 512)}...[truncated]` : value
    if (/^data:image\//i.test(normalized) || normalized.length > 256 && /^[A-Za-z0-9+/=]+$/.test(normalized)) {
      return '[redacted]'
    }
    return normalized
  }

  if (typeof value === 'function') {
    return '[function]'
  }

  return value
}

function buildErrorLogPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return {}
  }

  const result = {}
  ERROR_LOG_PAYLOAD_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== undefined && !SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = safeErrorPayloadClone(payload[key])
    }
  })
  return result
}

function normalizeLogString(value, maxLength = 1000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function normalizeStackValue(value, maxLength = 256) {
  if (value === undefined || value === null) {
    return ''
  }

  const normalized = String(value).replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return ''
  }

  if (/^data:image\//i.test(normalized) || normalized.length > 256 && /^[A-Za-z0-9+/=]+$/.test(normalized)) {
    return '[redacted]'
  }

  return normalized.slice(0, maxLength)
}

function padTimeNumber(value) {
  return String(value).padStart(2, '0')
}

function formatClientTime(timestamp = getNow()) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${padTimeNumber(date.getMonth() + 1)}-${padTimeNumber(date.getDate())} ${padTimeNumber(date.getHours())}:${padTimeNumber(date.getMinutes())}:${padTimeNumber(date.getSeconds())}`
}

function getClientVersion() {
  try {
    const auxPhotoApi = require('./aux-photo-api')
    return normalizeStackValue(auxPhotoApi.CLIENT_VERSION, 32)
  } catch (error) {
    return ''
  }
}

function getErrorUploadDetail(entry) {
  const payload = entry && entry.payload && typeof entry.payload === 'object' ? entry.payload : {}

  if (entry && entry.scope === 'api' && entry.event === 'request_failed') {
    const apiName = normalizeStackValue(payload.apiName, 64)
    const detail = API_ERROR_DETAILS[apiName]
    if (detail) {
      return {
        errorCode: detail[0],
        errorMessage: detail[1]
      }
    }
  }

  const detail = entry && ERROR_UPLOAD_DETAILS[entry.scope] && ERROR_UPLOAD_DETAILS[entry.scope][entry.event]
  return {
    errorCode: detail ? detail[0] : 'MINIAPP_ERROR',
    errorMessage: detail ? detail[1] : '小程序异常'
  }
}

function buildSafeErrorStack(entry) {
  const payload = entry && entry.payload && typeof entry.payload === 'object' ? entry.payload : {}
  const fields = [
    ['scope', entry && entry.scope],
    ['event', entry && entry.event],
    ['apiName', payload.apiName],
    ['stage', payload.stage],
    ['statusCode', payload.statusCode],
    ['errorCode', payload.errorCode || payload.code],
    ['message', payload.message],
    ['errMsg', payload.errMsg]
  ]
  const parts = []

  fields.forEach(([key, value]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return
    }
    const normalized = normalizeStackValue(value, 256)
    if (normalized) {
      parts.push(`${key}=${normalized}`)
    }
  })

  return parts.join('; ').slice(0, 1000)
}

function resolveNetworkType(callback) {
  const wxRef = getWx()

  if (!wxRef || typeof wxRef.getNetworkType !== 'function') {
    callback('unknown')
    return
  }

  let settled = false
  const done = (networkType) => {
    if (settled) {
      return
    }
    settled = true
    callback(normalizeStackValue(networkType, 32) || 'unknown')
  }

  try {
    wxRef.getNetworkType({
      success: (res = {}) => {
        done(res.networkType)
      },
      fail: () => {
        done('unknown')
      }
    })
  } catch (error) {
    done('unknown')
  }
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

function scheduleErrorUpload() {
  const loggerConfig = getErrorLoggerConfig()

  if (!shouldUploadErrorQueue() || errorUploadTimer || errorUploading || pendingErrorUploadQueue.length === 0) {
    return
  }

  errorUploadTimer = setTimeout(() => {
    errorUploadTimer = null
    flushErrorLogs()
  }, loggerConfig.uploadThrottleMs)
}

function shouldUploadErrorQueue() {
  const wxRef = getWx()
  const loggerConfig = getErrorLoggerConfig()
  const ticket = getTicket()

  return !!loggerConfig.uploadEnabled
    && !!loggerConfig.uploadUrl
    && !!ticket
    && !isMockTicket(ticket)
    && !!wxRef
    && typeof wxRef.request === 'function'
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

function buildErrorUploadRequest(entry, loggerConfig, ticket, networkType) {
  const detail = getErrorUploadDetail(entry)
  const systemInfo = getSystemInfoSnapshot()

  return {
    ticket,
    errorCode: detail.errorCode,
    errorMessage: detail.errorMessage,
    errorStack: buildSafeErrorStack(entry),
    appVersion: getClientVersion(),
    envVersion: loggerConfig.wxEnvVersion || loggerConfig.envVersion || getEnvVersion(),
    sdkVersion: systemInfo.sdkVersion || '',
    networkType: normalizeStackValue(networkType, 32) || 'unknown',
    clientTime: formatClientTime(entry && entry.timestamp ? entry.timestamp : getNow()),
    systemBrand: systemInfo.systemBrand || '',
    systemModel: systemInfo.systemModel || '',
    systemOs: systemInfo.systemOs || '',
    systemPlatform: systemInfo.systemPlatform || '',
    systemLanguage: systemInfo.systemLanguage || ''
  }
}

function finishErrorUpload() {
  pendingErrorUploadQueue = pendingErrorUploadQueue.slice(1)
  errorUploading = false
  if (pendingErrorUploadQueue.length > 0) {
    scheduleErrorUpload()
  }
}

function flushErrorLogs() {
  const wxRef = getWx()
  const loggerConfig = getErrorLoggerConfig()
  const ticket = getTicket()

  if (!shouldUploadErrorQueue() || errorUploading || pendingErrorUploadQueue.length === 0) {
    return
  }

  const entry = pendingErrorUploadQueue[0]
  errorUploading = true
  let finished = false
  const finish = () => {
    if (finished) {
      return
    }
    finished = true
    finishErrorUpload()
  }

  resolveNetworkType((networkType) => {
    try {
      wxRef.request({
        url: loggerConfig.uploadUrl,
        method: 'POST',
        timeout: loggerConfig.requestTimeoutMs,
        data: buildErrorUploadRequest(entry, loggerConfig, ticket, networkType),
        complete: finish
      })
    } catch (error) {
      finish()
    }
  })
}

function enqueueErrorUpload(entry) {
  if (!entry || !shouldUploadErrorLog(entry.level, entry.scope, entry.event)) {
    return
  }

  const loggerConfig = getErrorLoggerConfig()
  const ticket = getTicket()
  if (!loggerConfig.uploadEnabled || !loggerConfig.uploadUrl || !ticket || isMockTicket(ticket)) {
    return
  }

  pendingErrorUploadQueue.push(entry)
  if (pendingErrorUploadQueue.length > loggerConfig.maxPendingEntries) {
    pendingErrorUploadQueue = pendingErrorUploadQueue.slice(-loggerConfig.maxPendingEntries)
  }
  scheduleErrorUpload()
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

  enqueueErrorUpload(entry)

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

  enqueueErrorUpload(entry)

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
  flushErrorLogs()
}

function clearSession(clearLogs = true) {
  const wxRef = getWx()

  pendingUploadQueue = []
  pendingErrorUploadQueue = []
  if (uploadTimer) {
    clearTimeout(uploadTimer)
    uploadTimer = null
  }
  if (errorUploadTimer) {
    clearTimeout(errorUploadTimer)
    errorUploadTimer = null
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
  flushErrorLogs,
  readLogs,
  addLog,
  getSessionId
}
