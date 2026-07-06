const constants = require('./constants')
const vehicleDocuments = require('./documents')

const UPLOAD_PHASE = {
  UPLOADING: 'uploading',
  FAILED: 'failed',
  READY: 'ready',
  COMPLETING: 'completing',
  COMPLETE_FAILED: 'complete_failed',
  COMPLETED: 'completed'
}

const UPLOAD_ITEM_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  SUCCESS: 'success',
  FAILED: 'failed'
}

const COMPLETE_STATUS = {
  PENDING: 'pending',
  SUBMITTING: 'submitting',
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
    startedAt: '',
    uploadedAt: '',
    failedAt: '',
    uploadRecordId: '',
    photoId: '',
    duplicate: false,
    itemUploadedCount: 0,
    ticketStatus: '',
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

    const uploadMeta = vehicleDocuments.buildVehicleDocumentUploadMeta(vehicle, document.docType, document.docSide)
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
  const complete = isPlainObject(session && session.complete)
    ? session.complete
    : buildCompleteState()
  const uploaded = items.filter((item) => item.status === UPLOAD_ITEM_STATUS.SUCCESS).length
  const failed = items.filter((item) => item.status === UPLOAD_ITEM_STATUS.FAILED).length
  const total = items.length
  const phase = failed > 0
    ? UPLOAD_PHASE.FAILED
    : total === 0 || uploaded === total
      ? resolveCompletePhase(complete)
      : UPLOAD_PHASE.UPLOADING

  return {
    ...session,
    complete,
    phase,
    total,
    uploaded,
    failed,
    updatedAt
  }
}

function buildCompleteState(overrides = {}) {
  return {
    status: COMPLETE_STATUS.PENDING,
    attempts: 0,
    lastErrorCode: '',
    lastErrorMessage: '',
    submittedAt: '',
    completedAt: '',
    ticketStatus: '',
    uploadedCount: 0,
    completeTime: '',
    response: null,
    ...overrides
  }
}

function resolveCompletePhase(complete) {
  if (complete && complete.status === COMPLETE_STATUS.SUCCESS) {
    return UPLOAD_PHASE.COMPLETED
  }

  if (complete && complete.status === COMPLETE_STATUS.SUBMITTING) {
    return UPLOAD_PHASE.COMPLETING
  }

  if (complete && complete.status === COMPLETE_STATUS.FAILED) {
    return UPLOAD_PHASE.COMPLETE_FAILED
  }

  return UPLOAD_PHASE.READY
}

function cloneSession(session) {
  return {
    ...session,
    complete: isPlainObject(session && session.complete)
      ? { ...session.complete }
      : buildCompleteState(),
    items: Array.isArray(session && session.items)
      ? session.items.map((item) => ({ ...item }))
      : []
  }
}

function normalizeError(error = {}, fallbackMessage = '上传失败') {
  return {
    code: sanitizeString(error.code || error.errCode, 'AUX_PHOTO_ERROR'),
    message: sanitizeString(error.message || error.errMsg, fallbackMessage)
  }
}

function getResponseData(response = {}) {
  return isPlainObject(response.data) ? response.data : response
}

function getUploadResultField(response, field, fallback = '') {
  const data = getResponseData(response)
  return typeof data[field] === 'undefined' ? fallback : data[field]
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
    complete: buildCompleteState(),
    createdAt: timestamp,
    updatedAt: timestamp
  }, timestamp)
}

function getNextUploadItemIndex(session) {
  const items = Array.isArray(session && session.items) ? session.items : []
  return items.findIndex((item) => item.status === UPLOAD_ITEM_STATUS.PENDING)
}

function getNextUploadItem(session) {
  const itemIndex = getNextUploadItemIndex(session)
  return itemIndex >= 0 && Array.isArray(session && session.items)
    ? session.items[itemIndex]
    : null
}

function updateUploadItem(session, itemId, updater, options = {}) {
  const timestamp = options.now || nowIso()
  const nextSession = cloneSession(session)
  const itemIndex = nextSession.items.findIndex((item) => item.id === itemId)

  if (itemIndex < 0) {
    return recalculateSession(nextSession, timestamp)
  }

  nextSession.items[itemIndex] = updater(nextSession.items[itemIndex], timestamp)
  return recalculateSession(nextSession, timestamp)
}

function markUploadItemUploading(session, itemId, options = {}) {
  return updateUploadItem(session, itemId, (item, timestamp) => ({
    ...item,
    status: UPLOAD_ITEM_STATUS.UPLOADING,
    attempts: Number.isFinite(item.attempts) ? item.attempts + 1 : 1,
    startedAt: timestamp,
    failedAt: '',
    lastErrorCode: '',
    lastErrorMessage: ''
  }), options)
}

function markUploadItemSuccess(session, itemId, response = {}, options = {}) {
  return updateUploadItem(session, itemId, (item, timestamp) => ({
    ...item,
    status: UPLOAD_ITEM_STATUS.SUCCESS,
    uploadedAt: timestamp,
    failedAt: '',
    uploadRecordId: sanitizeString(getUploadResultField(response, 'uploadRecordId'), item.uploadRecordId || ''),
    photoId: sanitizeString(getUploadResultField(response, 'photoId'), item.photoId || ''),
    duplicate: getUploadResultField(response, 'duplicate', item.duplicate) === true,
    itemUploadedCount: Number.isFinite(getUploadResultField(response, 'itemUploadedCount', item.itemUploadedCount))
      ? Math.round(getUploadResultField(response, 'itemUploadedCount', item.itemUploadedCount))
      : 0,
    ticketStatus: sanitizeString(getUploadResultField(response, 'ticketStatus'), item.ticketStatus || ''),
    lastErrorCode: '',
    lastErrorMessage: ''
  }), options)
}

function markUploadItemFailed(session, itemId, error = {}, options = {}) {
  const normalizedError = normalizeError(error)
  return updateUploadItem(session, itemId, (item, timestamp) => ({
    ...item,
    status: UPLOAD_ITEM_STATUS.FAILED,
    failedAt: timestamp,
    lastErrorCode: normalizedError.code,
    lastErrorMessage: normalizedError.message
  }), options)
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
  const nextSession = cloneSession(session)
  nextSession.items = nextSession.items.map((item) => (
        item.status === UPLOAD_ITEM_STATUS.FAILED
          ? {
            ...item,
            status: UPLOAD_ITEM_STATUS.PENDING,
            failedAt: '',
            lastErrorCode: '',
            lastErrorMessage: ''
          }
          : { ...item }
      ))

  return recalculateSession(nextSession, options.now || nowIso())
}

function restoreInterruptedSession(session, options = {}) {
  const nextSession = cloneSession(session)
  let changed = false
  const timestamp = options.now || nowIso()

  nextSession.items = nextSession.items.map((item) => {
    if (item.status !== UPLOAD_ITEM_STATUS.UPLOADING) {
      return item
    }

    changed = true
    return {
      ...item,
      status: UPLOAD_ITEM_STATUS.PENDING,
      startedAt: '',
      lastErrorCode: '',
      lastErrorMessage: ''
    }
  })

  if (nextSession.complete.status === COMPLETE_STATUS.SUBMITTING) {
    changed = true
    nextSession.complete = {
      ...nextSession.complete,
      status: COMPLETE_STATUS.FAILED,
      lastErrorCode: 'AUX_COMPLETE_INTERRUPTED',
      lastErrorMessage: '完成提交中断，请重试完成提交'
    }
  }

  return {
    changed,
    session: recalculateSession(nextSession, timestamp)
  }
}

function markCompleteSubmitting(session, options = {}) {
  const timestamp = options.now || nowIso()
  const nextSession = cloneSession(session)
  nextSession.complete = {
    ...buildCompleteState(nextSession.complete),
    status: COMPLETE_STATUS.SUBMITTING,
    attempts: Number.isFinite(nextSession.complete.attempts) ? nextSession.complete.attempts + 1 : 1,
    submittedAt: timestamp,
    lastErrorCode: '',
    lastErrorMessage: ''
  }

  return recalculateSession(nextSession, timestamp)
}

function markCompleteFailed(session, error = {}, options = {}) {
  const timestamp = options.now || nowIso()
  const normalizedError = normalizeError(error, '完成提交失败')
  const nextSession = cloneSession(session)
  nextSession.complete = {
    ...buildCompleteState(nextSession.complete),
    status: COMPLETE_STATUS.FAILED,
    lastErrorCode: normalizedError.code,
    lastErrorMessage: normalizedError.message
  }

  return recalculateSession(nextSession, timestamp)
}

function markCompleteSuccess(session, response = {}, options = {}) {
  const timestamp = options.now || nowIso()
  const data = getResponseData(response)
  const nextSession = cloneSession(session)
  nextSession.complete = {
    ...buildCompleteState(nextSession.complete),
    status: COMPLETE_STATUS.SUCCESS,
    completedAt: timestamp,
    ticketStatus: sanitizeString(data.ticketStatus, nextSession.complete.ticketStatus || ''),
    uploadedCount: Number.isFinite(data.uploadedCount) ? Math.round(data.uploadedCount) : nextSession.uploaded,
    completeTime: sanitizeString(data.completeTime, nextSession.complete.completeTime || ''),
    response: data,
    lastErrorCode: '',
    lastErrorMessage: ''
  }

  return recalculateSession(nextSession, timestamp)
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
  COMPLETE_STATUS,
  buildUploadItems,
  createUploadSession,
  getNextUploadItem,
  markUploadItemUploading,
  markUploadItemSuccess,
  markUploadItemFailed,
  applyMockUploadStep,
  retryFailedItems,
  restoreInterruptedSession,
  markCompleteSubmitting,
  markCompleteFailed,
  markCompleteSuccess,
  recalculateSession,
  resolveMockScenario
}
