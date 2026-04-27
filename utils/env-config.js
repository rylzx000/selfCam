const DEFAULT_ENV_VERSION = 'develop'

const SUPPORTED_ENV_VERSIONS = {
  develop: 'develop',
  trial: 'trial',
  release: 'release'
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

const AI_ENDPOINTS_BY_ENV = {
  develop: {
    modelHost: 'http://192.168.100.100:8000'
  },
  trial: {
    modelHost: ''
  },
  release: {
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
  const envVersion = getEnvVersion(options)
  const policy = getPolicy(envVersion)

  return {
    envVersion,
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
  const envEndpoints = AI_ENDPOINTS_BY_ENV[runtimeFlags.envVersion] || AI_ENDPOINTS_BY_ENV[DEFAULT_ENV_VERSION]
  const modelHost = runtimeFlags.allowLocalModelHost
    ? sanitizeString(envEndpoints.modelHost, '')
    : ''

  return {
    envVersion: runtimeFlags.envVersion,
    allowLocalModelHost: runtimeFlags.allowLocalModelHost,
    modelHost,
    plateModelPath: buildUserDataPath('plate.onnx', options),
    damageModelPath: buildUserDataPath('damage.onnx', options),
    plateModelUrl: joinUrl(modelHost, '/plate.onnx'),
    damageModelUrl: joinUrl(modelHost, '/damage.onnx')
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
    envVersion: runtimeFlags.envVersion,
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
    envVersion: runtimeFlags.envVersion,
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
  SUPPORTED_ENV_VERSIONS,
  getEnvVersion,
  isDevelop,
  isTrial,
  isRelease,
  getRuntimeFlags,
  getDebugConfig,
  getAiConfig,
  getQualityConfigSourcePolicy,
  clonePlainData
}
