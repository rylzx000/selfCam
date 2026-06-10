const envConfig = require('./env-config')

let manager = null
let systemInfoCache = null

function getWx() {
  if (typeof wx === 'undefined') {
    return null
  }
  return wx
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
    Object.keys(value).slice(0, 30).forEach((key) => {
      result[key] = safeClone(value[key], depth + 1)
    })
    return result
  }
  if (typeof value === 'function') {
    return '[function]'
  }
  return value
}

function getManager() {
  const wxRef = getWx()
  if (!wxRef || typeof wxRef.getRealtimeLogManager !== 'function') {
    return null
  }

  if (manager) {
    return manager
  }

  try {
    manager = wxRef.getRealtimeLogManager()
    return manager
  } catch (error) {
    return null
  }
}

function getSystemInfo() {
  if (systemInfoCache) {
    return systemInfoCache
  }

  const wxRef = getWx()
  let info = {}

  try {
    if (wxRef && typeof wxRef.getSystemInfoSync === 'function') {
      info = wxRef.getSystemInfoSync() || {}
    }
  } catch (error) {
    info = {}
  }

  systemInfoCache = {
    SDKVersion: info.SDKVersion || '',
    system: info.system || '',
    model: info.model || '',
    platform: info.platform || '',
    brand: info.brand || '',
    version: info.version || ''
  }
  return systemInfoCache
}

function getEnvInfo() {
  try {
    const runtimeFlags = envConfig.getRuntimeFlags()
    return {
      appEnv: runtimeFlags.appEnv || '',
      wxEnvVersion: runtimeFlags.wxEnvVersion || runtimeFlags.envVersion || ''
    }
  } catch (error) {
    return {
      appEnv: '',
      wxEnvVersion: ''
    }
  }
}

function getSessionInfo() {
  const wxRef = getWx()
  if (!wxRef || typeof wxRef.getStorageSync !== 'function') {
    return {}
  }

  try {
    const value = wxRef.getStorageSync('selfcam_runtime_session')
    const session = value ? JSON.parse(value) : null
    return session?.sessionId ? { sessionId: session.sessionId } : {}
  } catch (error) {
    return {}
  }
}

function buildPayload(payload = {}) {
  return {
    ...getEnvInfo(),
    ...getSystemInfo(),
    ...getSessionInfo(),
    ...safeClone(payload)
  }
}

function log(level, scope, event, payload = {}) {
  try {
    const realtimeLogManager = getManager()
    if (!realtimeLogManager || typeof realtimeLogManager[level] !== 'function') {
      return false
    }

    realtimeLogManager[level]('selfCam', scope, event, buildPayload(payload))
    return true
  } catch (error) {
    return false
  }
}

function forceLog(level, scope, event, payload = {}) {
  try {
    const realtimeLogManager = getManager()
    if (!realtimeLogManager || typeof realtimeLogManager[level] !== 'function') {
      return false
    }

    realtimeLogManager[level]('selfCam', scope, event, buildPayload(payload))
    return true
  } catch (error) {
    return false
  }
}

function setFilterMsg(sessionId) {
  try {
    const realtimeLogManager = getManager()
    if (!realtimeLogManager || typeof realtimeLogManager.setFilterMsg !== 'function' || !sessionId) {
      return false
    }

    realtimeLogManager.setFilterMsg(`selfCam_${sessionId}`)
    return true
  } catch (error) {
    return false
  }
}

module.exports = {
  setFilterMsg,
  info(scope, event, payload = {}) {
    return log('info', scope, event, payload)
  },
  warn(scope, event, payload = {}) {
    return log('warn', scope, event, payload)
  },
  error(scope, event, payload = {}) {
    return log('error', scope, event, payload)
  },
  probe(scope, event, payload = {}) {
    return forceLog('warn', scope, event, {
      ...payload,
      probe: 'selfCam_realtime_probe'
    })
  },
  forceWarn(scope, event, payload = {}) {
    return forceLog('warn', scope, event, payload)
  },
  forceError(scope, event, payload = {}) {
    return forceLog('error', scope, event, payload)
  },
  getSystemInfo
}
