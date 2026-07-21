const DOCUMENT_TYPES = {
  DRIVING_LICENSE: 'driving_license',
  DRIVER_LICENSE: 'driver_license',
  ID_CARD: 'id_card',
  BANK_CARD: 'bank_card'
}

const DOCUMENT_SIDES = {
  FRONT_PAGE: 'front_page',
  BACK_PAGE: 'back_page',
  FRONT: 'front',
  BACK: 'back',
  ELECTRONIC: 'electronic'
}

const VEHICLE_DOCUMENT_SIDES = {
  FRONT_PAGE: DOCUMENT_SIDES.FRONT_PAGE,
  BACK_PAGE: DOCUMENT_SIDES.BACK_PAGE,
  ELECTRONIC: DOCUMENT_SIDES.ELECTRONIC
}

const DRIVING_LICENSE_SIDES = VEHICLE_DOCUMENT_SIDES
const DRIVER_LICENSE_SIDES = VEHICLE_DOCUMENT_SIDES

const DOCUMENT_SELECTIONS = {
  PHYSICAL: 'physical',
  ELECTRONIC: 'electronic'
}

const DRIVING_LICENSE_LABELS = {
  [DRIVING_LICENSE_SIDES.FRONT_PAGE]: '行驶证-正页',
  [DRIVING_LICENSE_SIDES.BACK_PAGE]: '行驶证-副页',
  [DRIVING_LICENSE_SIDES.ELECTRONIC]: '行驶证'
}

const DRIVER_LICENSE_LABELS = {
  [DRIVER_LICENSE_SIDES.FRONT_PAGE]: '驾驶证-正页',
  [DRIVER_LICENSE_SIDES.BACK_PAGE]: '驾驶证-副页',
  [DRIVER_LICENSE_SIDES.ELECTRONIC]: '驾驶证'
}

const DRIVING_LICENSE_PHOTO_TYPES = {
  [DRIVING_LICENSE_SIDES.FRONT_PAGE]: 'DRIVING_LICENSE_FRONT',
  [DRIVING_LICENSE_SIDES.BACK_PAGE]: 'DRIVING_LICENSE_BACK',
  [DRIVING_LICENSE_SIDES.ELECTRONIC]: 'DRIVING_LICENSE_ELECTRONIC'
}

const DRIVER_LICENSE_PHOTO_TYPES = {
  [DRIVER_LICENSE_SIDES.FRONT_PAGE]: 'DRIVER_LICENSE_FRONT',
  [DRIVER_LICENSE_SIDES.BACK_PAGE]: 'DRIVER_LICENSE_BACK',
  [DRIVER_LICENSE_SIDES.ELECTRONIC]: 'DRIVER_LICENSE_ELECTRONIC'
}

const DOCUMENT_LABELS = {
  [DOCUMENT_TYPES.DRIVING_LICENSE]: DRIVING_LICENSE_LABELS,
  [DOCUMENT_TYPES.DRIVER_LICENSE]: DRIVER_LICENSE_LABELS
}

const DOCUMENT_PHOTO_TYPES = {
  [DOCUMENT_TYPES.DRIVING_LICENSE]: DRIVING_LICENSE_PHOTO_TYPES,
  [DOCUMENT_TYPES.DRIVER_LICENSE]: DRIVER_LICENSE_PHOTO_TYPES
}

const DOCUMENT_BASE_LABELS = {
  [DOCUMENT_TYPES.DRIVING_LICENSE]: '行驶证',
  [DOCUMENT_TYPES.DRIVER_LICENSE]: '驾驶证'
}

function nowMs() {
  return Date.now()
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

function isPlainUploadItem(value) {
  return isPlainObject(value) && isNonEmptyString(value.photoType)
}

function isValidSourceType(value) {
  return value === 'camera' || value === 'album'
}

function isValidDrivingLicenseSide(value) {
  return [
    DRIVING_LICENSE_SIDES.FRONT_PAGE,
    DRIVING_LICENSE_SIDES.BACK_PAGE,
    DRIVING_LICENSE_SIDES.ELECTRONIC
  ].indexOf(value) >= 0
}

function isSupportedVehicleDocumentType(value) {
  return value === DOCUMENT_TYPES.DRIVING_LICENSE || value === DOCUMENT_TYPES.DRIVER_LICENSE
}

function isValidDrivingLicenseSelection(value) {
  return value === DOCUMENT_SELECTIONS.PHYSICAL || value === DOCUMENT_SELECTIONS.ELECTRONIC
}

function getDefaultDocumentSelections() {
  return {
    [DOCUMENT_TYPES.DRIVER_LICENSE]: DOCUMENT_SELECTIONS.PHYSICAL,
    [DOCUMENT_TYPES.DRIVING_LICENSE]: DOCUMENT_SELECTIONS.PHYSICAL
  }
}

function normalizeDocumentSelections(documentSelections) {
  const defaults = getDefaultDocumentSelections()

  if (!isPlainObject(documentSelections)) {
    return defaults
  }

  return {
    ...documentSelections,
    [DOCUMENT_TYPES.DRIVER_LICENSE]: isValidDrivingLicenseSelection(documentSelections[DOCUMENT_TYPES.DRIVER_LICENSE])
      ? documentSelections[DOCUMENT_TYPES.DRIVER_LICENSE]
      : defaults[DOCUMENT_TYPES.DRIVER_LICENSE],
    [DOCUMENT_TYPES.DRIVING_LICENSE]: isValidDrivingLicenseSelection(documentSelections[DOCUMENT_TYPES.DRIVING_LICENSE])
      ? documentSelections[DOCUMENT_TYPES.DRIVING_LICENSE]
      : defaults[DOCUMENT_TYPES.DRIVING_LICENSE]
  }
}

function buildDocumentId(docType, docSide, timestamp = nowMs()) {
  return `${docType}_${docSide}_${timestamp}`
}

function buildLocalPhotoId(timestamp = nowMs()) {
  return `photo_${timestamp}_${Math.random().toString(36).slice(2, 10)}`
}

function getDrivingLicensePhotoType(docSide) {
  return getVehicleDocumentPhotoType(DOCUMENT_TYPES.DRIVING_LICENSE, docSide)
}

function getDriverLicensePhotoType(docSide) {
  return getVehicleDocumentPhotoType(DOCUMENT_TYPES.DRIVER_LICENSE, docSide)
}

function getVehicleDocumentPhotoType(docType, docSide) {
  const typeMap = DOCUMENT_PHOTO_TYPES[docType] || {}
  return typeMap[docSide] || ''
}

function getVehicleDocumentLabel(docType, docSide) {
  const labelMap = DOCUMENT_LABELS[docType] || {}
  return labelMap[docSide] || '单证资料'
}

function getVehicleUploadItemsByPhotoType(vehicle) {
  const result = {}

  if (isPlainObject(vehicle && vehicle.uploadItemsByPhotoType)) {
    Object.keys(vehicle.uploadItemsByPhotoType).forEach((photoType) => {
      const uploadItem = vehicle.uploadItemsByPhotoType[photoType]
      if (isPlainUploadItem(uploadItem)) {
        result[photoType] = uploadItem
      }
    })
  }

  if (Array.isArray(vehicle && vehicle.uploadItems)) {
    vehicle.uploadItems.forEach((uploadItem) => {
      if (isPlainUploadItem(uploadItem)) {
        result[uploadItem.photoType] = uploadItem
      }
    })
  }

  return result
}

function hasVehicleUploadRules(vehicle) {
  return Array.isArray(vehicle && vehicle.uploadItems)
    || isPlainObject(vehicle && vehicle.uploadItemsByPhotoType)
}

function getVehicleUploadId(vehicle) {
  return sanitizeString(
    vehicle && (vehicle.vehicleId || vehicle.backendVehicleId || vehicle.id)
  )
}

function buildVehicleDocumentUploadMeta(vehicle, docType, docSide) {
  const photoType = getVehicleDocumentPhotoType(docType, docSide)
  const uploadItemsByPhotoType = getVehicleUploadItemsByPhotoType(vehicle)
  const uploadItem = photoType ? uploadItemsByPhotoType[photoType] : null
  const hasBackendRules = hasVehicleUploadRules(vehicle)

  return {
    vehicleId: getVehicleUploadId(vehicle),
    photoType,
    uploadItemId: sanitizeString(uploadItem && uploadItem.uploadItemId),
    uploadItem: uploadItem || null,
    maxCount: Number.isFinite(uploadItem && uploadItem.maxCount) ? uploadItem.maxCount : 1,
    uploadedCount: Number.isFinite(uploadItem && uploadItem.uploadedCount) ? uploadItem.uploadedCount : 0,
    uploadable: !hasBackendRules || !!uploadItem
  }
}

function buildDrivingLicenseUploadMeta(vehicle, docSide) {
  return buildVehicleDocumentUploadMeta(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE, docSide)
}

function normalizeVehicleDocument(record, existingRecord = null, timestamp = nowMs()) {
  if (!isPlainObject(record) || !isNonEmptyString(record.compressedPath)) {
    return null
  }

  const rawDocType = isNonEmptyString(record.docType)
    ? record.docType
    : DOCUMENT_TYPES.DRIVING_LICENSE
  const docType = isSupportedVehicleDocumentType(rawDocType)
    ? rawDocType
    : DOCUMENT_TYPES.DRIVING_LICENSE
  const docSide = isNonEmptyString(record.docSide)
    ? record.docSide
    : DRIVING_LICENSE_SIDES.FRONT_PAGE
  const createdAt = existingRecord && Number.isFinite(existingRecord.createdAt)
    ? existingRecord.createdAt
    : Number.isFinite(record.createdAt)
      ? record.createdAt
      : timestamp

  const normalized = {
    id: isNonEmptyString(record.id)
      ? record.id
      : existingRecord && isNonEmptyString(existingRecord.id)
        ? existingRecord.id
        : buildDocumentId(docType, docSide, timestamp),
    docType,
    docSide,
    label: isNonEmptyString(record.label)
      ? record.label
      : getVehicleDocumentLabel(docType, docSide),
    sourceType: isValidSourceType(record.sourceType) ? record.sourceType : 'album',
    tempFilePath: isNonEmptyString(record.tempFilePath) ? record.tempFilePath : '',
    compressedPath: record.compressedPath,
    localPhotoId: isNonEmptyString(record.localPhotoId) ? record.localPhotoId : buildLocalPhotoId(timestamp),
    createdAt,
    updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : timestamp
  }

  const photoType = sanitizeString(
    record.photoType,
    getVehicleDocumentPhotoType(docType, docSide)
  )
  if (photoType) {
    normalized.photoType = photoType
  }

  const uploadItemId = sanitizeString(record.uploadItemId)
  if (uploadItemId) {
    normalized.uploadItemId = uploadItemId
  }

  const vehicleId = sanitizeString(record.vehicleId)
  if (vehicleId) {
    normalized.vehicleId = vehicleId
  }

  if (Number.isFinite(record.size)) {
    normalized.size = record.size
  }

  if (Number.isFinite(record.compressedSize)) {
    normalized.compressedSize = record.compressedSize
  }

  return normalized
}

function normalizeVehicleDocuments(documents) {
  if (!Array.isArray(documents)) {
    return []
  }

  return documents
    .map((item) => normalizeVehicleDocument(item))
    .filter(Boolean)
}

function getVehicleDocuments(vehicle) {
  return Array.isArray(vehicle && vehicle.documents) ? vehicle.documents : []
}

function getDrivingLicenseSelection(vehicle) {
  return getVehicleDocumentSelection(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE)
}

function getVehicleDocumentSelection(vehicle, docType) {
  const selections = normalizeDocumentSelections(vehicle && vehicle.documentSelections)
  return selections[docType] || DOCUMENT_SELECTIONS.PHYSICAL
}

function getVehicleDocumentBySide(vehicle, docType, docSide) {
  return getVehicleDocuments(vehicle).find((document) => (
    document.docType === docType && document.docSide === docSide && isNonEmptyString(document.compressedPath)
  )) || null
}

function getDrivingLicenseDocumentBySide(vehicle, docSide) {
  return getVehicleDocumentBySide(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE, docSide)
}

function getVehicleDocumentSides(selection) {
  return selection === DOCUMENT_SELECTIONS.ELECTRONIC
    ? [DOCUMENT_SIDES.ELECTRONIC]
    : [DOCUMENT_SIDES.FRONT_PAGE, DOCUMENT_SIDES.BACK_PAGE]
}

function getVehicleDocumentDisplaySides() {
  return [
    DOCUMENT_SIDES.FRONT_PAGE,
    DOCUMENT_SIDES.BACK_PAGE,
    DOCUMENT_SIDES.ELECTRONIC
  ]
}

function isVehicleDocumentComplete(vehicle, docType) {
  const selection = getVehicleDocumentSelection(vehicle, docType)

  if (selection === DOCUMENT_SELECTIONS.ELECTRONIC) {
    return !!getVehicleDocumentBySide(vehicle, docType, DOCUMENT_SIDES.ELECTRONIC)
  }

  return !!getVehicleDocumentBySide(vehicle, docType, DOCUMENT_SIDES.FRONT_PAGE)
    && !!getVehicleDocumentBySide(vehicle, docType, DOCUMENT_SIDES.BACK_PAGE)
}

function isDrivingLicenseComplete(vehicle) {
  return isVehicleDocumentComplete(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE)
}

function isAllVehicleDocumentsComplete(vehicle) {
  return isVehicleDocumentComplete(vehicle, DOCUMENT_TYPES.DRIVER_LICENSE)
    && isVehicleDocumentComplete(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE)
}

function buildVehicleDocumentItems(vehicle, docType) {
  return getVehicleDocumentDisplaySides()
    .map((docSide) => getVehicleDocumentBySide(vehicle, docType, docSide))
    .filter(Boolean)
    .map((document) => {
      const uploadMeta = buildVehicleDocumentUploadMeta(vehicle, docType, document.docSide)
      return {
        ...document,
        vehicleId: document.vehicleId || uploadMeta.vehicleId,
        photoType: document.photoType || uploadMeta.photoType,
        uploadItemId: document.uploadItemId || uploadMeta.uploadItemId,
        uploadItem: uploadMeta.uploadItem,
        maxCount: uploadMeta.maxCount,
        uploadedCount: uploadMeta.uploadedCount,
        uploadable: uploadMeta.uploadable,
        thumbText: '证件图'
      }
    })
}

function buildDrivingLicenseItems(vehicle) {
  return buildVehicleDocumentItems(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE)
}

function buildVehicleDocumentSlots(vehicle, docType, selection = getVehicleDocumentSelection(vehicle, docType)) {
  const sides = getVehicleDocumentSides(selection)

  return sides.map((docSide) => {
    const document = getVehicleDocumentBySide(vehicle, docType, docSide)
    const uploadMeta = buildVehicleDocumentUploadMeta(vehicle, docType, docSide)

    return {
      docType,
      docSide,
      label: getVehicleDocumentLabel(docType, docSide),
      ...uploadMeta,
      uploaded: !!document,
      document
    }
  })
}

function buildDrivingLicenseSlots(vehicle, selection = getDrivingLicenseSelection(vehicle)) {
  return buildVehicleDocumentSlots(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE, selection)
}

function buildVehicleDocumentGroup(vehicle, docType) {
  const mode = getVehicleDocumentSelection(vehicle, docType)
  const isComplete = isVehicleDocumentComplete(vehicle, docType)

  return {
    docType,
    label: DOCUMENT_BASE_LABELS[docType] || '证件',
    mode,
    isComplete,
    items: buildVehicleDocumentItems(vehicle, docType),
    slots: buildVehicleDocumentSlots(vehicle, docType, mode),
    showUploadEntry: !isComplete
  }
}

function buildVehicleDocumentDisplayItems(vehicle, docType) {
  const items = buildVehicleDocumentItems(vehicle, docType)

  if (items.length > 0) {
    return items.map((item) => ({
      ...item,
      type: 'document',
      uploaded: true
    }))
  }

  return [{
    type: 'upload',
    docType,
    label: DOCUMENT_BASE_LABELS[docType] || '证件',
    uploaded: false
  }]
}

function buildVehicleDocumentPreview(vehicle) {
  return {
    groups: [
      buildVehicleDocumentGroup(vehicle, DOCUMENT_TYPES.DRIVER_LICENSE),
      buildVehicleDocumentGroup(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE)
    ],
    displayItems: [
      ...buildVehicleDocumentDisplayItems(vehicle, DOCUMENT_TYPES.DRIVER_LICENSE),
      ...buildVehicleDocumentDisplayItems(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE)
    ]
  }
}

function buildDrivingLicensePreview(vehicle) {
  return buildVehicleDocumentGroup(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE)
}

function hasIncompleteVehicleDocumentVehicles(vehicles) {
  return Array.isArray(vehicles) && vehicles.some((vehicle) => !isAllVehicleDocumentsComplete(vehicle))
}

function hasIncompleteDrivingLicenseVehicles(vehicles) {
  return hasIncompleteVehicleDocumentVehicles(vehicles)
}

module.exports = {
  DOCUMENT_TYPES,
  DOCUMENT_SIDES,
  DRIVING_LICENSE_SIDES,
  DRIVER_LICENSE_SIDES,
  DRIVING_LICENSE_PHOTO_TYPES,
  DRIVER_LICENSE_PHOTO_TYPES,
  DOCUMENT_SELECTIONS,
  DRIVING_LICENSE_LABELS,
  DRIVER_LICENSE_LABELS,
  getDrivingLicensePhotoType,
  getDriverLicensePhotoType,
  getVehicleDocumentPhotoType,
  getVehicleDocumentLabel,
  buildVehicleDocumentUploadMeta,
  buildDrivingLicenseUploadMeta,
  getDefaultDocumentSelections,
  normalizeDocumentSelections,
  normalizeVehicleDocument,
  normalizeVehicleDocuments,
  getVehicleDocuments,
  getVehicleDocumentSelection,
  getDrivingLicenseSelection,
  getDrivingLicenseDocumentBySide,
  getVehicleDocumentBySide,
  isVehicleDocumentComplete,
  isDrivingLicenseComplete,
  isAllVehicleDocumentsComplete,
  buildVehicleDocumentItems,
  buildDrivingLicenseItems,
  buildVehicleDocumentSlots,
  buildDrivingLicenseSlots,
  buildVehicleDocumentGroup,
  buildVehicleDocumentDisplayItems,
  buildVehicleDocumentPreview,
  buildDrivingLicensePreview,
  hasIncompleteVehicleDocumentVehicles,
  hasIncompleteDrivingLicenseVehicles
}
