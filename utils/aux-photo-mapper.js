const storage = require('./storage')
const constants = require('./constants')
const vehicleDocuments = require('./documents')

function sanitizeString(value, fallback = '', maxLength = 512) {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : fallback
}

function buildVehicleDisplayName(vehicleRoleName, licenseNo) {
  const safeRoleName = sanitizeString(vehicleRoleName, '车辆', 64)
  const safeLicenseNo = sanitizeString(licenseNo, '', 64)
  return `${safeRoleName} ${safeLicenseNo || '车牌待确认'}`
}

function normalizeUploadItem(item = {}) {
  const uploadItemId = sanitizeString(item.uploadItemId, '', 128)
  const photoType = sanitizeString(item.photoType, '', 64)

  if (!uploadItemId || !photoType) {
    return null
  }

  return {
    uploadItemId,
    photoType,
    photoName: sanitizeString(item.photoName, photoType, 64),
    required: item.required === true,
    maxCount: Number.isFinite(item.maxCount) && item.maxCount > 0 ? Math.round(item.maxCount) : 1,
    uploadedCount: Number.isFinite(item.uploadedCount) && item.uploadedCount >= 0
      ? Math.round(item.uploadedCount)
      : 0
  }
}

function buildUploadItemsByPhotoType(uploadItems) {
  return uploadItems.reduce((result, item) => {
    result[item.photoType] = item
    return result
  }, {})
}

function mapVehicle(rawVehicle = {}, index = 0) {
  const vehicleId = sanitizeString(rawVehicle.vehicleId, `AUX_VEHICLE_${index}`, 128)
  const vehicleRole = sanitizeString(rawVehicle.vehicleRole, index === 0 ? 'INSURED' : 'THIRD_PARTY', 64)
  const vehicleRoleName = sanitizeString(
    rawVehicle.vehicleRoleName,
    index === 0 ? constants.VEHICLE_TYPE.TARGET : `三者车${index}`,
    64
  )
  const licenseNo = sanitizeString(rawVehicle.licenseNo, '', 64)
  const plateColor = sanitizeString(rawVehicle.plateColor, '', 32)
  const energyType = sanitizeString(rawVehicle.energyType, '', 32)
  const uploadItems = Array.isArray(rawVehicle.uploadItems)
    ? rawVehicle.uploadItems.map(normalizeUploadItem).filter(Boolean)
    : []

  return {
    id: vehicleId,
    type: vehicleRoleName,
    backendVehicleId: vehicleId,
    vehicleId,
    vehicleRole,
    vehicleRoleName,
    licenseNo,
    plateColor,
    energyType,
    displayName: buildVehicleDisplayName(vehicleRoleName, licenseNo),
    uploadItems,
    uploadItemsByPhotoType: buildUploadItemsByPhotoType(uploadItems),
    licensePlate: { status: 'pending' },
    vinCode: { status: 'pending' },
    damages: [],
    documents: [],
    documentSelections: vehicleDocuments.getDefaultDocumentSelections()
  }
}

function buildCacheFromInit(initData = {}) {
  const cache = storage.initCache()
  const vehicles = Array.isArray(initData.vehicles) ? initData.vehicles : []

  cache.auxPhoto = {
    enabled: true,
    ticket: sanitizeString(initData.ticket, '', 256),
    ticketStatus: sanitizeString(initData.ticketStatus, '', 64),
    registNo: sanitizeString(initData.registNo, '', 64),
    expireTime: sanitizeString(initData.expireTime, '', 64)
  }
  cache.vehicles = vehicles.map(mapVehicle)
  cache.currentVehicleIndex = 0
  cache.currentDamageCount = 0
  cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE

  return storage.sanitizeCache(cache)
}

module.exports = {
  buildCacheFromInit,
  buildVehicleDisplayName
}
