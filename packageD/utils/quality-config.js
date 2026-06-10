const loader = require('./quality-config-loader')
const { cloneQualityConfigDefaults } = require('./quality-config-default')

let currentConfig = cloneQualityConfigDefaults()
let currentMeta = createDefaultMeta()
let currentSourceOverride = null
let pendingInitPromise = null

function getNow(options = {}) {
  if (typeof options.now === 'function') {
    return options.now()
  }

  if (typeof options.now === 'number' && Number.isFinite(options.now)) {
    return options.now
  }

  return Date.now()
}

function clonePlainData(value) {
  if (value === undefined) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeError(error) {
  if (!error) {
    return null
  }

  return {
    message: error.message || String(error)
  }
}

function createDefaultMeta() {
  const defaultConfig = cloneQualityConfigDefaults()

  return {
    initialized: false,
    source: 'default',
    sourceType: 'default',
    cacheHit: false,
    usedFallback: false,
    configVersion: defaultConfig.configVersion,
    cachedAt: null,
    expiresAt: null,
    lastLoadedAt: null,
    error: null
  }
}

function buildLoadOptions(options = {}) {
  const nextOptions = { ...options }

  if (!nextOptions.source && currentSourceOverride) {
    nextOptions.source = clonePlainData(currentSourceOverride)
  }

  return nextOptions
}

function commitLoadResult(result) {
  currentConfig = clonePlainData(result.config)
  currentMeta = {
    initialized: true,
    source: result.source,
    sourceType: result.sourceType,
    cacheHit: !!result.cacheHit,
    usedFallback: !!result.usedFallback,
    configVersion: result.configVersion || result.config.configVersion,
    cachedAt: result.cachedAt || null,
    expiresAt: result.expiresAt || null,
    lastLoadedAt: Date.now(),
    error: normalizeError(result.error)
  }

  return getQualityConfig()
}

function setQualityConfigSource(source) {
  currentSourceOverride = source ? clonePlainData(source) : null
  currentMeta = {
    ...currentMeta,
    initialized: false
  }
  return getQualityConfigSource()
}

function getQualityConfigSource() {
  return currentSourceOverride ? clonePlainData(currentSourceOverride) : null
}

function getQualityConfig() {
  return clonePlainData(currentConfig)
}

function getQualityConfigMeta() {
  return clonePlainData(currentMeta)
}

function isCurrentConfigExpired(options = {}) {
  if (typeof currentMeta.expiresAt !== 'number' || !Number.isFinite(currentMeta.expiresAt)) {
    return false
  }

  return getNow(options) >= currentMeta.expiresAt
}

async function initQualityConfig(options = {}) {
  if (pendingInitPromise && !options.forceRefresh) {
    return pendingInitPromise
  }

  if (currentMeta.initialized && !options.forceRefresh && !isCurrentConfigExpired(options)) {
    return getQualityConfig()
  }

  pendingInitPromise = loader.loadQualityConfig(buildLoadOptions(options))
    .then((result) => commitLoadResult(result))
    .catch((error) => {
      currentConfig = cloneQualityConfigDefaults()
      currentMeta = {
        ...createDefaultMeta(),
        initialized: true,
        usedFallback: true,
        lastLoadedAt: Date.now(),
        error: normalizeError(error)
      }
      return getQualityConfig()
    })
    .finally(() => {
      pendingInitPromise = null
    })

  return pendingInitPromise
}

function refreshQualityConfig(options = {}) {
  return initQualityConfig({
    ...options,
    forceRefresh: true
  })
}

function resetQualityConfigState(options = {}) {
  currentConfig = cloneQualityConfigDefaults()
  currentMeta = createDefaultMeta()
  pendingInitPromise = null

  if (!options.preserveSourceOverride) {
    currentSourceOverride = null
  }

  if (options.clearCache) {
    loader.clearQualityConfigCache()
  }

  return getQualityConfig()
}

function clearQualityConfigCache() {
  loader.clearQualityConfigCache()
}

module.exports = {
  getQualityConfig,
  getQualityConfigMeta,
  initQualityConfig,
  refreshQualityConfig,
  setQualityConfigSource,
  getQualityConfigSource,
  resetQualityConfigState,
  clearQualityConfigCache
}
