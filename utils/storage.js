const schema = require('./storage-schema')

const STORAGE_KEY = 'car_damage_photos_cache'

function logStorage(level, event, payload = {}) {
  const logger = level === 'error'
    ? console.error
    : level === 'warn'
      ? console.warn
      : console.log

  logger('[storage]', event, payload)
}

function initCache() {
  return schema.createCache()
}

function validateCache(cache) {
  return schema.validateCache(cache)
}

function sanitizeCache(cache) {
  return schema.sanitizeCache(cache)
}

function migrateCache(oldCache) {
  return schema.migrateCache(oldCache)
}

function clearRetakeContext(cache) {
  return schema.clearRetakeContext(cache)
}

function clearPreviewFlags(cache) {
  return schema.clearPreviewFlags(cache)
}

function clearCompletionContext(cache) {
  return schema.clearCompletionContext(cache)
}

function clearTransientContext(cache) {
  return schema.clearTransientContext(cache)
}

function getSafeResumeCache(cache) {
  return schema.getSafeResumeCache(cache)
}

function persistCache(data, options = {}) {
  const { preserveUpdatedAt = false } = options
  const sanitizedCache = sanitizeCache(data)
  const cacheToStore = {
    ...sanitizedCache,
    schemaVersion: schema.CACHE_SCHEMA_VERSION
  }

  if (!preserveUpdatedAt) {
    cacheToStore.updatedAt = new Date().toISOString()
  }

  wx.setStorageSync(STORAGE_KEY, JSON.stringify(cacheToStore))
  return cacheToStore
}

function saveCache(data) {
  persistCache(data)
}

function parseStoredCache(rawValue) {
  if (typeof rawValue === 'string') {
    return JSON.parse(rawValue)
  }

  if (rawValue && typeof rawValue === 'object') {
    return rawValue
  }

  throw new Error('INVALID_STORAGE_PAYLOAD')
}

function loadCache() {
  const rawValue = wx.getStorageSync(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  let parsedCache

  try {
    parsedCache = parseStoredCache(rawValue)
  } catch (error) {
    const fallbackCache = initCache()
    logStorage('warn', 'cache_parse_failed_reset', {
      message: error.message
    })
    persistCache(fallbackCache, { preserveUpdatedAt: true })
    return fallbackCache
  }

  const repaired = schema.repairCache(parsedCache)

  if (repaired.fatal) {
    logStorage('warn', 'cache_fallback_reset', {
      issues: repaired.issues
    })
    persistCache(repaired.cache, { preserveUpdatedAt: true })
    return repaired.cache
  }

  if (repaired.changed) {
    logStorage('log', 'cache_repaired', {
      issues: repaired.issues
    })
    persistCache(repaired.cache, { preserveUpdatedAt: true })
  }

  return repaired.cache
}

function loadCacheForResume() {
  const cache = loadCache()

  if (!cache) {
    return null
  }

  const safeResume = schema.resolveSafeResumeCache(cache)

  if (safeResume.changed) {
    logStorage('log', 'cache_safe_resume_applied', {
      reasons: safeResume.reasons
    })
    return persistCache(safeResume.cache)
  }

  return safeResume.cache
}

function clearCache() {
  wx.removeStorageSync(STORAGE_KEY)
}

function getOrInitCache() {
  let cache = loadCache()
  if (!cache) {
    cache = initCache()
    saveCache(cache)
  }
  return cache
}

function createVehicle(index) {
  return schema.createVehicle(index)
}

function getVehicleType(index) {
  return schema.getVehicleType(index)
}

function getThirdVehicleCount(vehicles) {
  return Array.isArray(vehicles) ? vehicles.length - 1 : -1
}

function shouldAskThirdVehicle(vehicles) {
  const thirdVehicleCount = getThirdVehicleCount(vehicles)
  return thirdVehicleCount < 2
}

function checkVehicleComplete(vehicle) {
  const hasLicensePlate = vehicle.licensePlate && vehicle.licensePlate.status === 'completed'
  const hasVinCode = vehicle.vinCode && vehicle.vinCode.status === 'completed'
  const hasDamage = vehicle.damages && vehicle.damages.length > 0

  return hasLicensePlate && hasVinCode && hasDamage
}

function getMissingPhotos(vehicle) {
  const missing = []

  if (!vehicle.licensePlate || vehicle.licensePlate.status === 'pending') {
    missing.push('licensePlate')
  }
  if (!vehicle.vinCode || vehicle.vinCode.status === 'pending') {
    missing.push('vinCode')
  }

  return missing
}

function enterRetakeMode(vehicleIndex, photoType, damageIndex = null) {
  const cache = getOrInitCache()
  cache.retakeMode = {
    enabled: true,
    vehicleIndex,
    photoType,
    damageIndex
  }
  saveCache(cache)
}

function saveRetakenPhoto(newPhoto) {
  const cache = loadCache()

  if (!cache || !cache.retakeMode || !cache.retakeMode.enabled) {
    logStorage('warn', 'save_retaken_photo_without_retake_mode')
    return false
  }

  const { vehicleIndex, photoType, damageIndex } = cache.retakeMode
  const vehicle = cache.vehicles[vehicleIndex]

  if (!vehicle) {
    logStorage('warn', 'save_retaken_photo_vehicle_missing', {
      vehicleIndex,
      photoType
    })
    saveCache(clearRetakeContext(cache))
    return false
  }

  if (photoType === 'licensePlate') {
    vehicle.licensePlate = {
      ...normalizePhotoMeta(newPhoto),
      status: 'completed'
    }
  } else if (photoType === 'vinCode') {
    vehicle.vinCode = {
      ...normalizePhotoMeta(newPhoto),
      status: 'completed'
    }
  } else if (photoType === 'damage') {
    if (!Array.isArray(vehicle.damages) || damageIndex === null || damageIndex < 0 || !vehicle.damages[damageIndex]) {
      logStorage('warn', 'save_retaken_photo_damage_missing', {
        vehicleIndex,
        damageIndex
      })
      saveCache(clearRetakeContext(cache))
      return false
    }

    vehicle.damages[damageIndex] = normalizePhotoMeta(newPhoto)
  }

  saveCache(clearRetakeContext(cache))
  return true
}

function normalizePhotoMeta(photo = {}, meta = {}) {
  return schema.normalizePhotoMeta(photo, meta)
}

function isRetakeMode() {
  const cache = loadCache()
  return cache && cache.retakeMode && cache.retakeMode.enabled
}

function deletePhoto(vehicleIndex, photoType, damageIndex = null) {
  const cache = loadCache()
  const vehicle = cache && cache.vehicles && cache.vehicles[vehicleIndex]

  if (!vehicle) {
    logStorage('warn', 'delete_photo_vehicle_missing', {
      vehicleIndex,
      photoType,
      damageIndex
    })
    return false
  }

  if (photoType === 'licensePlate') {
    vehicle.licensePlate = { status: 'pending' }
  } else if (photoType === 'vinCode') {
    vehicle.vinCode = { status: 'pending' }
  } else if (photoType === 'damage') {
    if (!Array.isArray(vehicle.damages) || damageIndex === null || damageIndex < 0 || damageIndex >= vehicle.damages.length) {
      logStorage('warn', 'delete_photo_damage_missing', {
        vehicleIndex,
        damageIndex
      })
      return false
    }

    vehicle.damages.splice(damageIndex, 1)
  } else {
    return false
  }

  saveCache(cache)
  return true
}

function deleteDocument(index) {
  const cache = loadCache()

  if (!cache || !Array.isArray(cache.documents) || index < 0 || index >= cache.documents.length) {
    logStorage('warn', 'delete_document_invalid_index', { index })
    return false
  }

  cache.documents.splice(index, 1)
  saveCache(cache)
  return true
}

function deleteVehicle(vehicleIndex) {
  const cache = loadCache()

  if (!cache || !Array.isArray(cache.vehicles)) {
    return false
  }

  if (vehicleIndex > 0 && vehicleIndex < cache.vehicles.length) {
    cache.vehicles.splice(vehicleIndex, 1)

    if (cache.currentVehicleIndex >= cache.vehicles.length) {
      cache.currentVehicleIndex = Math.max(cache.vehicles.length - 1, 0)
    }

    saveCache(cache)
    return true
  }

  return false
}

module.exports = {
  STORAGE_KEY,
  CACHE_SCHEMA_VERSION: schema.CACHE_SCHEMA_VERSION,
  initCache,
  validateCache,
  sanitizeCache,
  migrateCache,
  saveCache,
  loadCache,
  loadCacheForResume,
  clearCache,
  clearRetakeContext,
  clearPreviewFlags,
  clearCompletionContext,
  clearTransientContext,
  getSafeResumeCache,
  getOrInitCache,
  createVehicle,
  getVehicleType,
  getThirdVehicleCount,
  shouldAskThirdVehicle,
  checkVehicleComplete,
  getMissingPhotos,
  normalizePhotoMeta,
  enterRetakeMode,
  saveRetakenPhoto,
  isRetakeMode,
  deletePhoto,
  deleteDocument,
  deleteVehicle
}
