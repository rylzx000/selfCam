const constants = require('./constants')
const vehicleDocuments = require('./documents')

const UPLOAD_PHASE = {
  UPLOADING: 'uploading',
  FAILED: 'failed',
  READY: 'ready'
}

const UPLOAD_ITEM_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  SUCCESS: 'success',
  FAILED: 'failed'
}

const MOCK_ERROR = {
  code: 'MOCK_UPLOAD_FAILED',
  message: '模拟上传失败'
}

function nowIso() {
  return new Date().toISOString()
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function sanitizeString(value, fallback = '') {
  return isNonEmptyString(value) ? value.trim() : fallback
}

function getPhotoFilePath(photo = {}) {
  return photo.compressedPath || photo.tempFilePath || photo.originalPath || photo.filePath || ''
}

function getPhotoFileSize(photo = {}) {
  if (Number.isFinite(photo.compressedSize)) return Math.round(photo.compressedSize)
  if (Number.isFinite(photo.fileSize)) return Math.round(photo.fileSize)
  if (Number.isFinite(photo.size)) return Math.round(photo.size)
  return 0
}

function getVehicleDisplayName(vehicle, index) {
  return sanitizeString(
    vehicle && (vehicle.displayName || vehicle.vehicleRoleName || vehicle.type),
    index === 0 ? constants.VEHICLE_TYPE.TARGET : `三者车${index}`
  )
}

function getVehicleId(vehicle, index) {
  return sanitizeString(
    vehicle && (vehicle.vehicleId || vehicle.backendVehicleId || vehicle.id),
    `vehicle_${index}`
  )
}

function getUploadItem(vehicle, photoType) {
  if (!vehicle || !photoType) {
    return null
  }

  if (isPlainObject(vehicle.uploadItemsByPhotoType) && isPlainObject(vehicle.uploadItemsByPhotoType[photoType])) {
    return vehicle.uploadItemsByPhotoType[photoType]
  }

  if (Array.isArray(vehicle.uploadItems)) {
    return vehicle.uploadItems.find((item) => item && item.photoType === photoType) || null
  }

  return null
}

function getClientPhotoId(photo, fallbackId) {
  return sanitizeString(photo && photo.localPhotoId, fallbackId)
}

function buildUploadItem({
  id,
  photo,
  vehicle,
  vehicleIndex,
  photoType,
  sortNo,
  label,
  uploadItemId
}) {
  const filePath = getPhotoFilePath(photo)

  if (!photo || !filePath) {
    return null
  }

  const vehicleId = getVehicleId(vehicle, vehicleIndex)

  return {
    id,
    clientPhotoId: getClientPhotoId(photo, id),
    vehicleIndex,
    vehicleId,
    uploadItemId: sanitizeString(uploadItemId),
    photoType,
    sortNo,
    filePath,
    fileSize: getPhotoFileSize(photo),
    label,
    status: UPLOAD_ITEM_STATUS.PENDING,
    attempts: 0,
    lastErrorCode: '',
    lastErrorMessage: ''
  }
}

function pushVehiclePhoto(result, vehicle, vehicleIndex, slotName, photo, photoType, labelSuffix) {
  if (!photo || photo.status !== 'completed' || !getPhotoFilePath(photo)) {
    return
  }

  const uploadItem = getUploadItem(vehicle, photoType)
  const vehicleName = getVehicleDisplayName(vehicle, vehicleIndex)
  const id = `vehicle${vehicleIndex}-${slotName}`

  result.push(buildUploadItem({
    id,
    photo,
    vehicle,
    vehicleIndex,
    photoType,
    sortNo: 1,
    label: `${vehicleName} - ${labelSuffix}`,
    uploadItemId: uploadItem && uploadItem.uploadItemId
  }))
}

function pushDamagePhotos(result, vehicle, vehicleIndex) {
  const damages = Array.isArray(vehicle && vehicle.damages) ? vehicle.damages : []
  const vehicleName = getVehicleDisplayName(vehicle, vehicleIndex)
  const uploadItem = getUploadItem(vehicle, 'DAMAGE')

  damages.forEach((photo, damageIndex) => {
    if (!photo || !getPhotoFilePath(photo)) {
      return
    }

    result.push(buildUploadItem({
      id: `vehicle${vehicleIndex}-damage-${damageIndex}`,
      photo,
      vehicle,
      vehicleIndex,
      photoType: 'DAMAGE',
      sortNo: damageIndex + 1,
      label: `${vehicleName} - 车损${damageIndex + 1}`,
      uploadItemId: uploadItem && uploadItem.uploadItemId
    }))
  })
}

function pushVehicleDocuments(result, vehicle, vehicleIndex) {
  const vehicleName = getVehicleDisplayName(vehicle, vehicleIndex)

  vehicleDocuments.getVehicleDocuments(vehicle).forEach((document, documentIndex) => {
    const filePath = getPhotoFilePath(document)
    if (!filePath) {
      return
    }

    const uploadMeta = vehicleDocuments.buildDrivingLicenseUploadMeta(vehicle, document.docSide)
    const photoType = sanitizeString(document.photoType, uploadMeta.photoType)
    const uploadItemId = sanitizeString(document.uploadItemId, uploadMeta.uploadItemId)

    result.push(buildUploadItem({
      id: `vehicle${vehicleIndex}-document-${document.docType || 'document'}-${document.docSide || documentIndex}`,
      photo: document,
      vehicle,
      vehicleIndex,
      photoType,
      sortNo: 1,
      label: `${vehicleName} - ${document.label || '单证资料'}`,
      uploadItemId
    }))
  })
}

function buildUploadItems(cache) {
  const result = []
  const vehicles = Array.isArray(cache && cache.vehicles) ? cache.vehicles : []

  vehicles.forEach((vehicle, vehicleIndex) => {
    pushVehiclePhoto(result, vehicle, vehicleIndex, 'licensePlate', vehicle.licensePlate, 'LICENSE_PLATE', '车牌')
    pushVehiclePhoto(result, vehicle, vehicleIndex, 'vin', vehicle.vinCode, 'VIN', 'VIN')
    pushDamagePhotos(result, vehicle, vehicleIndex)
    pushVehicleDocuments(result, vehicle, vehicleIndex)
  })

  return result.filter(Boolean)
}

function recalculateSession(session, updatedAt = nowIso()) {
  const items = Array.isArray(session && session.items) ? session.items : []
  const uploaded = items.filter((item) => item.status === UPLOAD_ITEM_STATUS.SUCCESS).length
  const failed = items.filter((item) => item.status === UPLOAD_ITEM_STATUS.FAILED).length
  const total = items.length
  const phase = failed > 0
    ? UPLOAD_PHASE.FAILED
    : total === 0 || uploaded === total
      ? UPLOAD_PHASE.READY
      : UPLOAD_PHASE.UPLOADING

  return {
    ...session,
    phase,
    total,
    uploaded,
    failed,
    updatedAt
  }
}

function createUploadSession(cache, options = {}) {
  const timestamp = options.now || nowIso()
  const items = buildUploadItems(cache)

  return recalculateSession({
    version: 1,
    sessionId: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phase: UPLOAD_PHASE.UPLOADING,
    ticket: sanitizeString(cache && cache.auxPhoto && cache.auxPhoto.ticket),
    total: items.length,
    uploaded: 0,
    failed: 0,
    items,
    createdAt: timestamp,
    updatedAt: timestamp
  }, timestamp)
}

function getNextUploadItemIndex(session) {
  const items = Array.isArray(session && session.items) ? session.items : []
  return items.findIndex((item) => item.status === UPLOAD_ITEM_STATUS.PENDING)
}

function shouldMockFail(item, scenario) {
  if (!item) {
    return false
  }

  if (scenario === 'fail-always') {
    return true
  }

  if (scenario === 'fail-once') {
    return item.attempts === 0
  }

  return false
}

function applyMockUploadStep(session, options = {}) {
  const nextSession = {
    ...session,
    items: Array.isArray(session && session.items)
      ? session.items.map((item) => ({ ...item }))
      : []
  }
  const itemIndex = getNextUploadItemIndex(nextSession)

  if (itemIndex < 0) {
    return recalculateSession(nextSession, options.now || nowIso())
  }

  const item = nextSession.items[itemIndex]
  const attempts = Number.isFinite(item.attempts) ? item.attempts + 1 : 1

  if (shouldMockFail(item, options.scenario)) {
    nextSession.items[itemIndex] = {
      ...item,
      status: UPLOAD_ITEM_STATUS.FAILED,
      attempts,
      lastErrorCode: MOCK_ERROR.code,
      lastErrorMessage: MOCK_ERROR.message
    }
    return recalculateSession(nextSession, options.now || nowIso())
  }

  nextSession.items[itemIndex] = {
    ...item,
    status: UPLOAD_ITEM_STATUS.SUCCESS,
    attempts,
    lastErrorCode: '',
    lastErrorMessage: ''
  }
  return recalculateSession(nextSession, options.now || nowIso())
}

function retryFailedItems(session, options = {}) {
  const nextSession = {
    ...session,
    items: Array.isArray(session && session.items)
      ? session.items.map((item) => (
        item.status === UPLOAD_ITEM_STATUS.FAILED
          ? {
            ...item,
            status: UPLOAD_ITEM_STATUS.PENDING,
            lastErrorCode: '',
            lastErrorMessage: ''
          }
          : { ...item }
      ))
      : []
  }

  return recalculateSession(nextSession, options.now || nowIso())
}

function resolveMockScenario(ticket = '') {
  const normalized = sanitizeString(ticket).toLowerCase()
  if (normalized.indexOf('fail-always') >= 0) return 'fail-always'
  if (normalized.indexOf('fail-once') >= 0) return 'fail-once'
  return 'success'
}

module.exports = {
  UPLOAD_PHASE,
  UPLOAD_ITEM_STATUS,
  buildUploadItems,
  createUploadSession,
  applyMockUploadStep,
  retryFailedItems,
  recalculateSession,
  resolveMockScenario
}
