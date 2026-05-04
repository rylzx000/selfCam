const DEFAULT_ENV_VERSION = 'develop'
const DEFAULT_WX_ENV_VERSION = DEFAULT_ENV_VERSION
const APP_ENV_STORAGE_KEY = 'SELF_CAM_APP_ENV'

const SUPPORTED_ENV_VERSIONS = {
  develop: 'develop',
  trial: 'trial',
  release: 'release'
}

const SUPPORTED_APP_ENVS = {
  dev: 'dev',
  sit: 'sit',
  pilot: 'pilot',
  prod: 'prod'
}

const DEFAULT_APP_ENV_BY_WX_ENV_VERSION = {
  develop: 'dev',
  trial: 'sit',
  release: 'prod'
}

const APP_ENV_OVERRIDES_BY_WX_ENV_VERSION = {
  develop: ['dev', 'sit', 'pilot'],
  trial: ['sit', 'pilot'],
  release: []
}

const APP_ENV_ALLOWLIST_BY_WX_ENV_VERSION = {
  develop: ['dev', 'sit', 'pilot'],
  trial: ['sit', 'pilot'],
  release: ['prod']
}

const APP_ENV_BADGE_TEXT = {
  dev: '\u672c\u5730',
  sit: 'sit',
  pilot: '\u5b9e\u76d8'
}

const ENV_POLICY_MAP = {
  develop: {
    allowMock: true,
    allowTestConfig: true,
    allowLocalModelHost: true,
    allowControlledDebug: true,
    showDevPanel: true,
    showAIDebugPanel: true,
    enableVerboseConsole: true,
    runtimeLoggerLevel: 'info',
    enableDebugUpload: true,
    qualityConfigDefaultSourceType: 'mock'
  },
  trial: {
    allowMock: true,
    allowTestConfig: true,
    allowLocalModelHost: false,
    allowControlledDebug: true,
    showDevPanel: false,
    showAIDebugPanel: false,
    enableVerboseConsole: false,
    runtimeLoggerLevel: 'warn',
    enableDebugUpload: false,
    qualityConfigDefaultSourceType: 'mock'
  },
  release: {
    allowMock: false,
    allowTestConfig: false,
    allowLocalModelHost: false,
    allowControlledDebug: false,
    showDevPanel: false,
    showAIDebugPanel: false,
    enableVerboseConsole: false,
    runtimeLoggerLevel: 'error',
    enableDebugUpload: false,
    qualityConfigDefaultSourceType: 'remote'
  }
}

const BUSINESS_ENV_ENDPOINTS = {
  dev: {
    modelHost: 'http://192.168.100.100:8000'
  },
  sit: {
    modelHost: 'https://onlineclaimsit.chinalife-p.com.cn/video/model'
  },
  pilot: {
    modelHost: ''
  },
  prod: {
    modelHost: ''
  }
}

function clonePlainData(value) {
  return JSON.parse(JSON.stringify(value))
}

function sanitizeString(value, fallback = '', maxLength = 512) {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : fallback
}

function sanitizeEnvVersion(value, fallback = DEFAULT_ENV_VERSION) {
  const normalized = sanitizeString(value, '', 32).toLowerCase()
  return SUPPORTED_ENV_VERSIONS[normalized] || fallback
}

function sanitizeAppEnv(value, fallback = '') {
  const normalized = sanitizeString(value, '', 32).toLowerCase()
  return SUPPORTED_APP_ENVS[normalized] || fallback
}

function getWx(options = {}) {
  if (options.wx && typeof options.wx === 'object') {
    return options.wx
  }

  if (typeof wx === 'undefined') {
    return null
  }

  return wx
}

function getEnvVersion(options = {}) {
  if (typeof options.wxEnvVersion === 'string' && options.wxEnvVersion.trim()) {
    return sanitizeEnvVersion(options.wxEnvVersion)
  }

  if (typeof options.envVersion === 'string' && options.envVersion.trim()) {
    return sanitizeEnvVersion(options.envVersion)
  }

  const wxRef = getWx(options)

  if (!wxRef || typeof wxRef.getAccountInfoSync !== 'function') {
    return DEFAULT_ENV_VERSION
  }

  try {
    const envVersion = wxRef.getAccountInfoSync()?.miniProgram?.envVersion
    return sanitizeEnvVersion(envVersion)
  } catch (error) {
    return DEFAULT_ENV_VERSION
  }
}

function readStoredAppEnv(options = {}) {
  const wxRef = getWx(options)

  if (!wxRef || typeof wxRef.getStorageSync !== 'function') {
    return ''
  }

  try {
    return sanitizeAppEnv(wxRef.getStorageSync(APP_ENV_STORAGE_KEY), '')
  } catch (error) {
    return ''
  }
}

function isAppEnvAllowedForWxEnv(appEnv, wxEnvVersion) {
  const safeWxEnvVersion = sanitizeEnvVersion(wxEnvVersion)
  const safeAppEnv = sanitizeAppEnv(appEnv, '')
  const allowlist = APP_ENV_ALLOWLIST_BY_WX_ENV_VERSION[safeWxEnvVersion] || []
  return !!safeAppEnv && allowlist.indexOf(safeAppEnv) >= 0
}

function getAppEnv(options = {}) {
  const wxEnvVersion = getEnvVersion(options)
  const defaultAppEnv = DEFAULT_APP_ENV_BY_WX_ENV_VERSION[wxEnvVersion] || 'dev'

  if (wxEnvVersion === 'release') {
    return 'prod'
  }

  const overrideAppEnv = Object.prototype.hasOwnProperty.call(options, 'appEnv')
    ? sanitizeAppEnv(options.appEnv, '')
    : readStoredAppEnv(options)

  return isAppEnvAllowedForWxEnv(overrideAppEnv, wxEnvVersion)
    ? overrideAppEnv
    : defaultAppEnv
}

function getAppEnvBadgeText(options = {}) {
  return APP_ENV_BADGE_TEXT[getAppEnv(options)] || ''
}

function canSwitchAppEnv(options = {}) {
  return getEnvVersion(options) !== 'release'
}

function getAvailableAppEnvs(options = {}) {
  const wxEnvVersion = getEnvVersion(options)
  const itemList = APP_ENV_OVERRIDES_BY_WX_ENV_VERSION[wxEnvVersion] || []
  return itemList.slice()
}

function saveAppEnvOverride(appEnv, options = {}) {
  const wxEnvVersion = getEnvVersion(options)
  const safeAppEnv = sanitizeAppEnv(appEnv, '')
  const wxRef = getWx(options)
  const switchableAppEnvs = APP_ENV_OVERRIDES_BY_WX_ENV_VERSION[wxEnvVersion] || []

  if (!wxRef || typeof wxRef.setStorageSync !== 'function') {
    return false
  }

  if (!safeAppEnv || switchableAppEnvs.indexOf(safeAppEnv) < 0) {
    return false
  }

  try {
    wxRef.setStorageSync(APP_ENV_STORAGE_KEY, safeAppEnv)
    return true
  } catch (error) {
    return false
  }
}

function clearAppEnvOverride(options = {}) {
  const wxRef = getWx(options)

  if (!wxRef || typeof wxRef.removeStorageSync !== 'function') {
    return false
  }

  try {
    wxRef.removeStorageSync(APP_ENV_STORAGE_KEY)
    return true
  } catch (error) {
    return false
  }
}

function isDevelop(options = {}) {
  return getEnvVersion(options) === 'develop'
}

function isTrial(options = {}) {
  return getEnvVersion(options) === 'trial'
}

function isRelease(options = {}) {
  return getEnvVersion(options) === 'release'
}

function joinUrl(baseUrl, path) {
  const normalizedBaseUrl = sanitizeString(baseUrl, '').replace(/\/+$/, '')
  const normalizedPath = sanitizeString(path, '')

  if (!normalizedBaseUrl || !normalizedPath) {
    return ''
  }

  return `${normalizedBaseUrl}${normalizedPath.charAt(0) === '/' ? normalizedPath : `/${normalizedPath}`}`
}

function parseUrlHost(value) {
  const normalizedValue = sanitizeString(value, '', 512)
  const match = normalizedValue.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)/i)

  if (!match) {
    return {
      protocol: '',
      hostname: ''
    }
  }

  const hostPart = match[2].split('@').pop()
  const hostname = hostPart
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(':')[0]
    .toLowerCase()

  return {
    protocol: `${match[1].toLowerCase()}:`,
    hostname
  }
}

function isLanIp(hostname) {
  return /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    || /^169\.254\./.test(hostname)
}

function isUnsafeNonDevModelHost(modelHost) {
  const normalizedModelHost = sanitizeString(modelHost, '')

  if (!normalizedModelHost) {
    return false
  }

  const parsed = parseUrlHost(normalizedModelHost)

  if (!parsed.protocol || !parsed.hostname) {
    return true
  }

  return parsed.protocol === 'http:'
    || parsed.hostname === 'localhost'
    || parsed.hostname === '127.0.0.1'
    || /^127\./.test(parsed.hostname)
    || isLanIp(parsed.hostname)
}

function isModelHostAllowed(appEnv, modelHost) {
  const safeAppEnv = sanitizeAppEnv(appEnv, 'dev')

  if (!modelHost) {
    return true
  }

  return safeAppEnv === 'dev' || !isUnsafeNonDevModelHost(modelHost)
}

function resolveModelHost(appEnv, options = {}) {
  const endpoints = options.businessEnvEndpoints || BUSINESS_ENV_ENDPOINTS
  const envEndpoints = endpoints[sanitizeAppEnv(appEnv, 'dev')] || {}
  const modelHost = sanitizeString(envEndpoints.modelHost, '')

  return isModelHostAllowed(appEnv, modelHost) ? modelHost : ''
}

function hashString(value) {
  const source = sanitizeString(value, '', 1024)
  let hash = 2166136261

  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function buildModelCacheKey(modelName, appEnv, modelUrl) {
  const safeModelName = sanitizeString(modelName, '', 32)
  const safeAppEnv = sanitizeAppEnv(appEnv, 'dev')
  const source = sanitizeString(modelUrl, '') || safeAppEnv
  return `${safeModelName}:${safeAppEnv}:${hashString(source)}`
}

function buildModelCacheFileName(modelName, appEnv, modelUrl) {
  const safeModelName = sanitizeString(modelName, '', 32)
  const safeAppEnv = sanitizeAppEnv(appEnv, 'dev')
  const source = sanitizeString(modelUrl, '') || safeAppEnv
  return `${safeModelName}-${safeAppEnv}-${hashString(source)}.onnx`
}

function getUserDataPath(options = {}) {
  const wxRef = getWx(options)
  return sanitizeString(wxRef?.env?.USER_DATA_PATH, '')
}

function buildUserDataPath(fileName, options = {}) {
  const safeFileName = sanitizeString(fileName, '', 128)
  const userDataPath = getUserDataPath(options)

  if (!safeFileName) {
    return ''
  }

  if (!userDataPath) {
    return safeFileName
  }

  return `${userDataPath}/${safeFileName}`
}

function getPolicy(envVersion) {
  return ENV_POLICY_MAP[sanitizeEnvVersion(envVersion)] || ENV_POLICY_MAP[DEFAULT_ENV_VERSION]
}

function getRuntimeFlags(options = {}) {
  const wxEnvVersion = getEnvVersion(options)
  const appEnv = getAppEnv({ ...options, envVersion: wxEnvVersion })
  const policy = getPolicy(wxEnvVersion)

  return {
    wxEnvVersion,
    envVersion: wxEnvVersion,
    appEnv,
    allowMock: policy.allowMock,
    allowTestConfig: policy.allowTestConfig,
    allowLocalModelHost: policy.allowLocalModelHost,
    allowControlledDebug: policy.allowControlledDebug,
    allowDebug: policy.showDevPanel || policy.showAIDebugPanel || policy.enableVerboseConsole,
    showDevPanel: policy.showDevPanel,
    showAIDebugPanel: policy.showAIDebugPanel,
    enableVerboseConsole: policy.enableVerboseConsole,
    enableDebugUpload: policy.enableDebugUpload,
    runtimeLoggerLevel: policy.runtimeLoggerLevel,
    qualityConfigDefaultSourceType: policy.qualityConfigDefaultSourceType
  }
}

function getAiConfig(options = {}) {
  const runtimeFlags = getRuntimeFlags(options)
  const wxEnvVersion = runtimeFlags.wxEnvVersion
  const appEnv = runtimeFlags.appEnv
  const modelHost = resolveModelHost(appEnv, options)
  const plateModelUrl = joinUrl(modelHost, '/plate.onnx')
  const damageModelUrl = joinUrl(modelHost, '/damage.onnx')
  const plateModelCacheKey = buildModelCacheKey('plate', appEnv, plateModelUrl)
  const damageModelCacheKey = buildModelCacheKey('damage', appEnv, damageModelUrl)

  return {
    wxEnvVersion,
    envVersion: wxEnvVersion,
    appEnv,
    allowLocalModelHost: runtimeFlags.allowLocalModelHost,
    modelHost,
    plateModelPath: buildUserDataPath(buildModelCacheFileName('plate', appEnv, plateModelUrl), options),
    damageModelPath: buildUserDataPath(buildModelCacheFileName('damage', appEnv, damageModelUrl), options),
    plateModelCacheKey,
    damageModelCacheKey,
    plateModelUrl,
    damageModelUrl
  }
}

function getDebugConfig(options = {}) {
  const runtimeFlags = getRuntimeFlags(options)
  const aiConfig = getAiConfig(options)
  const uploadHost = aiConfig.modelHost
    ? aiConfig.modelHost.replace(/:\d+$/, ':8101')
    : ''
  const uploadUrl = runtimeFlags.enableDebugUpload ? joinUrl(uploadHost, '/capture-log') : ''

  return {
    wxEnvVersion: runtimeFlags.wxEnvVersion,
    envVersion: runtimeFlags.envVersion,
    appEnv: runtimeFlags.appEnv,
    enabled: runtimeFlags.allowDebug,
    showDevPanel: runtimeFlags.showDevPanel,
    showAIPanel: runtimeFlags.showAIDebugPanel,
    enableVerboseConsole: runtimeFlags.enableVerboseConsole,
    runtimeLoggerLevel: runtimeFlags.runtimeLoggerLevel,
    uploadEnabled: !!uploadUrl,
    uploadUrl,
    batchSize: 20,
    maxEntries: 400,
    maxPendingEntries: 120,
    uploadThrottleMs: 1500,
    requestTimeoutMs: 2500
  }
}

function getQualityConfigSourcePolicy(options = {}) {
  const runtimeFlags = getRuntimeFlags(options)

  return {
    wxEnvVersion: runtimeFlags.wxEnvVersion,
    envVersion: runtimeFlags.envVersion,
    appEnv: runtimeFlags.appEnv,
    defaultSourceType: runtimeFlags.qualityConfigDefaultSourceType,
    allowMockAsDefault: runtimeFlags.allowMock,
    allowTestConfig: runtimeFlags.allowTestConfig,
    allowExplicitMockOverride: true,
    requireConfiguredRemoteInRelease: runtimeFlags.envVersion === 'release',
    fallbackToDefaultOnMissingRemote: runtimeFlags.envVersion === 'release'
  }
}

module.exports = {
  DEFAULT_ENV_VERSION,
  DEFAULT_WX_ENV_VERSION,
  SUPPORTED_ENV_VERSIONS,
  SUPPORTED_APP_ENVS,
  APP_ENV_STORAGE_KEY,
  DEFAULT_APP_ENV_BY_WX_ENV_VERSION,
  BUSINESS_ENV_ENDPOINTS,
  getEnvVersion,
  getAppEnv,
  getAppEnvBadgeText,
  getAvailableAppEnvs,
  canSwitchAppEnv,
  saveAppEnvOverride,
  clearAppEnvOverride,
  isModelHostAllowed,
  buildModelCacheKey,
  isDevelop,
  isTrial,
  isRelease,
  getRuntimeFlags,
  getDebugConfig,
  getAiConfig,
  getQualityConfigSourcePolicy,
  clonePlainData
}
