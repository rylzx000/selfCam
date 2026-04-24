const {
  QUALITY_CONFIG_CACHE_KEY,
  QUALITY_CONFIG_CACHE_SCHEMA_VERSION,
  cloneQualityConfigDefaults,
  cloneQualityConfigSource
} = require('./quality-config-default')

const LOCAL_MOCK_QUALITY_CONFIG = require('../mock/quality-config.mock.json')

const BOOLEAN_TRUE_SET = {
  true: true,
  '1': true,
  yes: true,
  on: true
}

const BOOLEAN_FALSE_SET = {
  false: true,
  '0': true,
  no: true,
  off: true
}

const MOCK_ENV_VERSIONS = {
  develop: true,
  trial: true
}

function clonePlainData(value) {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

function getNow(options = {}) {
  if (typeof options.now === 'function') {
    return options.now()
  }

  if (typeof options.now === 'number' && Number.isFinite(options.now)) {
    return options.now
  }

  return Date.now()
}

function getWx() {
  if (typeof wx === 'undefined') {
    return null
  }

  return wx
}

function getMiniProgramEnvVersion(options = {}) {
  if (typeof options.envVersion === 'string' && options.envVersion.trim()) {
    return options.envVersion.trim().toLowerCase()
  }

  const wxRef = getWx()

  if (!wxRef || typeof wxRef.getAccountInfoSync !== 'function') {
    return 'develop'
  }

  try {
    const envVersion = wxRef.getAccountInfoSync()?.miniProgram?.envVersion
    return sanitizeString(envVersion, 'develop', 32).toLowerCase()
  } catch (error) {
    return 'develop'
  }
}

function sanitizeBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (BOOLEAN_TRUE_SET[normalized]) {
      return true
    }

    if (BOOLEAN_FALSE_SET[normalized]) {
      return false
    }
  }

  return fallback
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function sanitizeNumber(value, fallback, minValue, maxValue, integerOnly = false) {
  const parsed = toFiniteNumber(value)

  if (parsed === null) {
    return fallback
  }

  let nextValue = integerOnly ? Math.round(parsed) : parsed

  if (typeof minValue === 'number') {
    nextValue = Math.max(minValue, nextValue)
  }

  if (typeof maxValue === 'number') {
    nextValue = Math.min(maxValue, nextValue)
  }

  return nextValue
}

function sanitizeString(value, fallback, maxLength = 128) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) {
      return trimmed.slice(0, maxLength)
    }
    return fallback
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).slice(0, maxLength)
  }

  return fallback
}

function sanitizeQualityConfig(remoteConfig, defaultConfig = cloneQualityConfigDefaults()) {
  if (!isPlainObject(remoteConfig)) {
    return {}
  }

  const sanitized = {}

  if (hasOwn(remoteConfig, 'enabled')) {
    sanitized.enabled = sanitizeBoolean(remoteConfig.enabled, defaultConfig.enabled)
  }

  if (hasOwn(remoteConfig, 'showUserHint')) {
    sanitized.showUserHint = sanitizeBoolean(remoteConfig.showUserHint, defaultConfig.showUserHint)
  }

  if (hasOwn(remoteConfig, 'saveQualityMeta')) {
    sanitized.saveQualityMeta = sanitizeBoolean(remoteConfig.saveQualityMeta, defaultConfig.saveQualityMeta)
  }

  if (hasOwn(remoteConfig, 'blurEnabled')) {
    sanitized.blurEnabled = sanitizeBoolean(remoteConfig.blurEnabled, defaultConfig.blurEnabled)
  }

  if (hasOwn(remoteConfig, 'exposureEnabled')) {
    sanitized.exposureEnabled = sanitizeBoolean(remoteConfig.exposureEnabled, defaultConfig.exposureEnabled)
  }

  if (hasOwn(remoteConfig, 'brightnessEnabled')) {
    sanitized.brightnessEnabled = sanitizeBoolean(remoteConfig.brightnessEnabled, defaultConfig.brightnessEnabled)
  }

  if (hasOwn(remoteConfig, 'nearFarEnabled')) {
    sanitized.nearFarEnabled = sanitizeBoolean(remoteConfig.nearFarEnabled, defaultConfig.nearFarEnabled)
  }

  if (isPlainObject(remoteConfig.thresholds)) {
    const thresholds = {}

    if (hasOwn(remoteConfig.thresholds, 'blur')) {
      thresholds.blur = sanitizeNumber(remoteConfig.thresholds.blur, defaultConfig.thresholds.blur, 0, 1)
    }

    if (hasOwn(remoteConfig.thresholds, 'dark')) {
      thresholds.dark = sanitizeNumber(remoteConfig.thresholds.dark, defaultConfig.thresholds.dark, 0, 1)
    }

    if (hasOwn(remoteConfig.thresholds, 'bright')) {
      thresholds.bright = sanitizeNumber(remoteConfig.thresholds.bright, defaultConfig.thresholds.bright, 0, 1)
    }

    if (Object.keys(thresholds).length > 0) {
      sanitized.thresholds = thresholds
    }
  }

  if (isPlainObject(remoteConfig.processing)) {
    const processing = {}

    if (hasOwn(remoteConfig.processing, 'maxEdge')) {
      processing.maxEdge = sanitizeNumber(remoteConfig.processing.maxEdge, defaultConfig.processing.maxEdge, 256, 4096, true)
    }

    if (hasOwn(remoteConfig.processing, 'timeoutMs')) {
      processing.timeoutMs = sanitizeNumber(remoteConfig.processing.timeoutMs, defaultConfig.processing.timeoutMs, 100, 10000, true)
    }

    if (Object.keys(processing).length > 0) {
      sanitized.processing = processing
    }
  }

  if (hasOwn(remoteConfig, 'configVersion')) {
    sanitized.configVersion = sanitizeString(remoteConfig.configVersion, defaultConfig.configVersion, 64)
  }

  if (hasOwn(remoteConfig, 'expiresInSeconds')) {
    sanitized.expiresInSeconds = sanitizeNumber(remoteConfig.expiresInSeconds, defaultConfig.expiresInSeconds, 60, 86400, true)
  }

  return sanitized
}

function mergeQualityConfig(defaultConfig = cloneQualityConfigDefaults(), remoteConfig = {}) {
  const baseConfig = clonePlainData(defaultConfig)
  const patch = sanitizeQualityConfig(remoteConfig, baseConfig)

  return {
    ...baseConfig,
    ...patch,
    thresholds: {
      ...baseConfig.thresholds,
      ...(patch.thresholds || {})
    },
    processing: {
      ...baseConfig.processing,
      ...(patch.processing || {})
    }
  }
}

function validateQualityConfig(remoteConfig) {
  const issues = []

  if (!isPlainObject(remoteConfig)) {
    issues.push('QUALITY_CONFIG_NOT_OBJECT')
  }

  return {
    valid: issues.length === 0,
    issues
  }
}

function joinRemoteUrl(baseUrl, path) {
  const sanitizedBaseUrl = sanitizeString(baseUrl, '', 512).replace(/\/+$/, '')
  const sanitizedPath = sanitizeString(path, '', 512)
  const normalizedPath = sanitizedPath
    ? sanitizedPath.charAt(0) === '/' ? sanitizedPath : `/${sanitizedPath}`
    : ''

  return `${sanitizedBaseUrl}${normalizedPath}`
}

function hasConfiguredRemoteSource(source) {
  const remoteUrl = sanitizeString(source.remoteUrl, '', 512)

  if (remoteUrl) {
    return /^https:\/\//i.test(remoteUrl)
  }

  const remoteBaseUrl = sanitizeString(source.remoteBaseUrl, '', 512)

  if (!remoteBaseUrl) {
    return false
  }

  return /^https:\/\//i.test(joinRemoteUrl(remoteBaseUrl, source.remotePath))
}

function resolveRemoteSource(source, envVersion) {
  const remoteUrl = source.remoteUrl
    ? sanitizeString(source.remoteUrl, '', 512)
    : joinRemoteUrl(source.remoteBaseUrl, source.remotePath)

  if (!/^https:\/\//i.test(remoteUrl)) {
    throw new Error('QUALITY_CONFIG_REMOTE_URL_MUST_USE_HTTPS')
  }

  return {
    ...source,
    type: 'remote',
    envVersion,
    remoteUrl
  }
}

function resolveReleaseDefaultSource(source, envVersion) {
  return {
    ...source,
    type: 'default',
    envVersion,
    reason: 'QUALITY_CONFIG_RELEASE_REMOTE_UNCONFIGURED',
    cachePolicy: {
      allowSourceTypes: ['remote'],
      skipSourceSignatureCheck: true
    }
  }
}

function resolveConfigSource(options = {}) {
  const defaultSource = cloneQualityConfigSource()
  const sourceOverride = isPlainObject(options.source) ? options.source : {}
  const resolvedSource = {
    ...defaultSource,
    ...sourceOverride
  }
  const envVersion = getMiniProgramEnvVersion(options)
  const requestedType = sanitizeString(resolvedSource.type, defaultSource.type, 32).toLowerCase()

  if (requestedType === 'mock') {
    return {
      ...resolvedSource,
      type: 'mock',
      envVersion
    }
  }

  if (requestedType === 'remote') {
    return resolveRemoteSource(resolvedSource, envVersion)
  }

  if (MOCK_ENV_VERSIONS[envVersion]) {
    return {
      ...resolvedSource,
      type: 'mock',
      envVersion
    }
  }

  if (hasConfiguredRemoteSource(resolvedSource)) {
    return resolveRemoteSource(resolvedSource, envVersion)
  }

  if (envVersion === 'release') {
    return resolveReleaseDefaultSource(resolvedSource, envVersion)
  }

  return {
    ...resolvedSource,
    type: 'mock',
    envVersion
  }
}

function getConfigSourceSignature(source) {
  if (!source || !source.type) {
    return ''
  }

  if (source.type === 'mock') {
    return source.envVersion ? `mock:${source.envVersion}` : 'mock'
  }

  if (source.type === 'default') {
    return ''
  }

  return `remote:${source.remoteUrl || ''}`
}

function parseJsonPayload(rawPayload) {
  if (typeof rawPayload === 'string') {
    const normalized = rawPayload.replace(/^\uFEFF/, '').trim()
    if (!normalized) {
      throw new Error('QUALITY_CONFIG_EMPTY_RESPONSE')
    }
    return JSON.parse(normalized)
  }

  if (isPlainObject(rawPayload)) {
    return rawPayload
  }

  throw new Error('QUALITY_CONFIG_INVALID_PAYLOAD')
}

function requestRemoteJson(source) {
  const wxRef = getWx()

  return new Promise((resolve, reject) => {
    if (!wxRef || typeof wxRef.request !== 'function') {
      reject(new Error('QUALITY_CONFIG_REQUEST_UNAVAILABLE'))
      return
    }

    wxRef.request({
      url: source.remoteUrl,
      method: 'GET',
      timeout: source.requestTimeoutMs,
      responseType: 'text',
      header: {
        Accept: 'application/json; charset=utf-8'
      },
      success(res) {
        if (!res || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`QUALITY_CONFIG_HTTP_${res ? res.statusCode : 'UNKNOWN'}`))
          return
        }

        try {
          resolve(parseJsonPayload(res.data))
        } catch (error) {
          reject(error)
        }
      },
      fail(error) {
        reject(error instanceof Error ? error : new Error(error?.errMsg || 'QUALITY_CONFIG_REQUEST_FAILED'))
      }
    })
  })
}

async function loadRemoteConfig(options = {}) {
  const defaultConfig = options.defaultConfig || cloneQualityConfigDefaults()
  const source = resolveConfigSource(options)

  if (source.type === 'default') {
    console.warn('[quality-config] release env has no remote static JSON url, fallback to default config')
    const error = new Error(source.reason || 'QUALITY_CONFIG_SOURCE_DEFAULT_ONLY')
    error.code = source.reason || 'QUALITY_CONFIG_SOURCE_DEFAULT_ONLY'
    throw error
  }

  const rawConfig = source.type === 'mock'
    ? clonePlainData(LOCAL_MOCK_QUALITY_CONFIG)
    : await requestRemoteJson(source)
  const validation = validateQualityConfig(rawConfig)

  if (!validation.valid) {
    throw new Error(validation.issues.join(',') || 'QUALITY_CONFIG_INVALID')
  }

  return {
    source,
    sourceType: source.type,
    rawConfig,
    remoteConfig: sanitizeQualityConfig(rawConfig, defaultConfig)
  }
}

function parseStoredRecord(rawValue) {
  if (!rawValue) {
    return null
  }

  if (typeof rawValue === 'string') {
    return JSON.parse(rawValue)
  }

  if (isPlainObject(rawValue)) {
    return rawValue
  }

  return null
}

function validateCacheRecord(record) {
  if (!isPlainObject(record)) {
    return false
  }

  if (record.schemaVersion !== QUALITY_CONFIG_CACHE_SCHEMA_VERSION) {
    return false
  }

  if (typeof record.cachedAt !== 'number' || !Number.isFinite(record.cachedAt)) {
    return false
  }

  if (typeof record.expiresAt !== 'number' || !Number.isFinite(record.expiresAt)) {
    return false
  }

  if (record.expiresAt <= record.cachedAt) {
    return false
  }

  if (!isPlainObject(record.remoteConfig)) {
    return false
  }

  return true
}

function clearQualityConfigCache() {
  const wxRef = getWx()

  if (!wxRef || typeof wxRef.removeStorageSync !== 'function') {
    return
  }

  wxRef.removeStorageSync(QUALITY_CONFIG_CACHE_KEY)
}

function buildQualityConfigCacheRecord(remoteConfig, options = {}) {
  const defaultConfig = options.defaultConfig || cloneQualityConfigDefaults()
  const now = getNow(options)
  const sanitizedRemoteConfig = sanitizeQualityConfig(remoteConfig, defaultConfig)
  const mergedConfig = mergeQualityConfig(defaultConfig, sanitizedRemoteConfig)

  return {
    schemaVersion: QUALITY_CONFIG_CACHE_SCHEMA_VERSION,
    cachedAt: now,
    expiresAt: now + mergedConfig.expiresInSeconds * 1000,
    sourceType: options.sourceType || 'remote',
    sourceSignature: options.sourceSignature || '',
    configVersion: mergedConfig.configVersion,
    remoteConfig: sanitizedRemoteConfig
  }
}

function writeQualityConfigCache(remoteConfig, options = {}) {
  const wxRef = getWx()
  const record = buildQualityConfigCacheRecord(remoteConfig, options)

  if (!wxRef || typeof wxRef.setStorageSync !== 'function') {
    return record
  }

  try {
    wxRef.setStorageSync(QUALITY_CONFIG_CACHE_KEY, JSON.stringify(record))
  } catch (error) {
    return record
  }

  return record
}

function readQualityConfigCache(options = {}) {
  const wxRef = getWx()
  const defaultConfig = options.defaultConfig || cloneQualityConfigDefaults()
  let resolvedSource = null

  if (!wxRef || typeof wxRef.getStorageSync !== 'function') {
    return null
  }

  let parsedRecord = null

  try {
    parsedRecord = parseStoredRecord(wxRef.getStorageSync(QUALITY_CONFIG_CACHE_KEY))
  } catch (error) {
    clearQualityConfigCache()
    return null
  }

  if (!validateCacheRecord(parsedRecord)) {
    clearQualityConfigCache()
    return null
  }

  let currentSourceSignature = ''
  let shouldSkipSignatureCheck = false
  let allowedSourceTypes = null

  try {
    resolvedSource = resolveConfigSource(options)
    currentSourceSignature = getConfigSourceSignature(resolvedSource)
    shouldSkipSignatureCheck = !!resolvedSource?.cachePolicy?.skipSourceSignatureCheck
    allowedSourceTypes = Array.isArray(resolvedSource?.cachePolicy?.allowSourceTypes)
      ? resolvedSource.cachePolicy.allowSourceTypes
      : null
  } catch (error) {
    currentSourceSignature = ''
  }

  if (allowedSourceTypes && !allowedSourceTypes.includes(parsedRecord.sourceType)) {
    return null
  }

  if (!shouldSkipSignatureCheck && parsedRecord.sourceSignature && currentSourceSignature && parsedRecord.sourceSignature !== currentSourceSignature) {
    return null
  }

  const now = getNow(options)
  const remoteConfig = sanitizeQualityConfig(parsedRecord.remoteConfig, defaultConfig)
  const config = mergeQualityConfig(defaultConfig, remoteConfig)

  return {
    cachedAt: parsedRecord.cachedAt,
    expiresAt: parsedRecord.expiresAt,
    sourceType: parsedRecord.sourceType || 'remote',
    configVersion: parsedRecord.configVersion || config.configVersion,
    remoteConfig,
    config,
    isExpired: now >= parsedRecord.expiresAt
  }
}

async function loadQualityConfig(options = {}) {
  const defaultConfig = options.defaultConfig || cloneQualityConfigDefaults()
  const cacheRecord = readQualityConfigCache({
    ...options,
    defaultConfig
  })
  const hasFreshCache = !!cacheRecord && !cacheRecord.isExpired

  if (hasFreshCache && !options.forceRefresh) {
    return {
      config: cacheRecord.config,
      source: 'cache',
      sourceType: cacheRecord.sourceType,
      cacheHit: true,
      usedFallback: false,
      configVersion: cacheRecord.configVersion,
      cachedAt: cacheRecord.cachedAt,
      expiresAt: cacheRecord.expiresAt
    }
  }

  try {
    const remoteResult = await loadRemoteConfig({
      ...options,
      defaultConfig
    })
    const config = mergeQualityConfig(defaultConfig, remoteResult.remoteConfig)
    const cacheWriteResult = writeQualityConfigCache(remoteResult.remoteConfig, {
      now: options.now,
      defaultConfig,
      sourceType: remoteResult.sourceType,
      sourceSignature: getConfigSourceSignature(remoteResult.source)
    })

    return {
      config,
      source: remoteResult.sourceType === 'mock' ? 'mock' : 'remote',
      sourceType: remoteResult.sourceType,
      cacheHit: false,
      usedFallback: false,
      configVersion: config.configVersion,
      cachedAt: cacheWriteResult.cachedAt,
      expiresAt: cacheWriteResult.expiresAt
    }
  } catch (error) {
    if (hasFreshCache) {
      return {
        config: cacheRecord.config,
        source: 'cache',
        sourceType: cacheRecord.sourceType,
        cacheHit: true,
        usedFallback: true,
        configVersion: cacheRecord.configVersion,
        cachedAt: cacheRecord.cachedAt,
        expiresAt: cacheRecord.expiresAt,
        error
      }
    }

    return {
      config: clonePlainData(defaultConfig),
      source: 'default',
      sourceType: 'default',
      cacheHit: false,
      usedFallback: true,
      configVersion: defaultConfig.configVersion,
      cachedAt: null,
      expiresAt: null,
      error
    }
  }
}

module.exports = {
  sanitizeQualityConfig,
  validateQualityConfig,
  mergeQualityConfig,
  resolveConfigSource,
  loadRemoteConfig,
  loadQualityConfig,
  readQualityConfigCache,
  writeQualityConfigCache,
  buildQualityConfigCacheRecord,
  clearQualityConfigCache,
  getConfigSourceSignature
}
