const DOCUMENT_TYPES = {
  DRIVING_LICENSE: 'driving_license'
}

const DRIVING_LICENSE_SIDES = {
  FRONT_PAGE: 'front_page',
  BACK_PAGE: 'back_page',
  ELECTRONIC: 'electronic'
}

const DOCUMENT_SELECTIONS = {
  PHYSICAL: 'physical',
  ELECTRONIC: 'electronic'
}

const DRIVING_LICENSE_LABELS = {
  [DRIVING_LICENSE_SIDES.FRONT_PAGE]: '行驶证正页',
  [DRIVING_LICENSE_SIDES.BACK_PAGE]: '行驶证副页',
  [DRIVING_LICENSE_SIDES.ELECTRONIC]: '电子行驶证'
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

function isValidDrivingLicenseSelection(value) {
  return value === DOCUMENT_SELECTIONS.PHYSICAL || value === DOCUMENT_SELECTIONS.ELECTRONIC
}

function getDefaultDocumentSelections() {
  return {
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
    [DOCUMENT_TYPES.DRIVING_LICENSE]: isValidDrivingLicenseSelection(documentSelections[DOCUMENT_TYPES.DRIVING_LICENSE])
      ? documentSelections[DOCUMENT_TYPES.DRIVING_LICENSE]
      : defaults[DOCUMENT_TYPES.DRIVING_LICENSE]
  }
}

function buildDocumentId(docType, docSide, timestamp = nowMs()) {
  return `${docType}_${docSide}_${timestamp}`
}

function normalizeVehicleDocument(record, existingRecord = null, timestamp = nowMs()) {
  if (!isPlainObject(record) || !isNonEmptyString(record.compressedPath)) {
    return null
  }

  const docType = isNonEmptyString(record.docType)
    ? record.docType
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
      : DRIVING_LICENSE_LABELS[docSide] || '单证资料',
    sourceType: isValidSourceType(record.sourceType) ? record.sourceType : 'album',
    tempFilePath: isNonEmptyString(record.tempFilePath) ? record.tempFilePath : '',
    compressedPath: record.compressedPath,
    createdAt,
    updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : timestamp
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
  const selections = normalizeDocumentSelections(vehicle && vehicle.documentSelections)
  return selections[DOCUMENT_TYPES.DRIVING_LICENSE]
}

function getVehicleDocumentBySide(vehicle, docType, docSide) {
  return getVehicleDocuments(vehicle).find((document) => (
    document.docType === docType && document.docSide === docSide && isNonEmptyString(document.compressedPath)
  )) || null
}

function getDrivingLicenseDocumentBySide(vehicle, docSide) {
  return getVehicleDocumentBySide(vehicle, DOCUMENT_TYPES.DRIVING_LICENSE, docSide)
}

function isDrivingLicenseComplete(vehicle) {
  const selection = getDrivingLicenseSelection(vehicle)

  if (selection === DOCUMENT_SELECTIONS.ELECTRONIC) {
    return !!getDrivingLicenseDocumentBySide(vehicle, DRIVING_LICENSE_SIDES.ELECTRONIC)
  }

  return !!getDrivingLicenseDocumentBySide(vehicle, DRIVING_LICENSE_SIDES.FRONT_PAGE)
    && !!getDrivingLicenseDocumentBySide(vehicle, DRIVING_LICENSE_SIDES.BACK_PAGE)
}

function buildDrivingLicenseItems(vehicle) {
  const selection = getDrivingLicenseSelection(vehicle)
  const sides = selection === DOCUMENT_SELECTIONS.ELECTRONIC
    ? [DRIVING_LICENSE_SIDES.ELECTRONIC]
    : [DRIVING_LICENSE_SIDES.FRONT_PAGE, DRIVING_LICENSE_SIDES.BACK_PAGE]

  return sides
    .map((docSide) => getDrivingLicenseDocumentBySide(vehicle, docSide))
    .filter(Boolean)
    .map((document) => ({
      ...document,
      thumbText: '证件图'
    }))
}

function buildDrivingLicenseSlots(vehicle, selection = getDrivingLicenseSelection(vehicle)) {
  const sides = selection === DOCUMENT_SELECTIONS.ELECTRONIC
    ? [DRIVING_LICENSE_SIDES.ELECTRONIC]
    : [DRIVING_LICENSE_SIDES.FRONT_PAGE, DRIVING_LICENSE_SIDES.BACK_PAGE]

  return sides.map((docSide) => {
    const document = getDrivingLicenseDocumentBySide(vehicle, docSide)

    return {
      docSide,
      label: DRIVING_LICENSE_LABELS[docSide],
      uploaded: !!document,
      document
    }
  })
}

function buildDrivingLicensePreview(vehicle) {
  const mode = getDrivingLicenseSelection(vehicle)
  const isComplete = isDrivingLicenseComplete(vehicle)

  return {
    mode,
    isComplete,
    items: buildDrivingLicenseItems(vehicle),
    showUploadEntry: !isComplete
  }
}

function hasIncompleteDrivingLicenseVehicles(vehicles) {
  return Array.isArray(vehicles) && vehicles.some((vehicle) => !isDrivingLicenseComplete(vehicle))
}

module.exports = {
  DOCUMENT_TYPES,
  DRIVING_LICENSE_SIDES,
  DOCUMENT_SELECTIONS,
  DRIVING_LICENSE_LABELS,
  getDefaultDocumentSelections,
  normalizeDocumentSelections,
  normalizeVehicleDocument,
  normalizeVehicleDocuments,
  getVehicleDocuments,
  getDrivingLicenseSelection,
  getDrivingLicenseDocumentBySide,
  isDrivingLicenseComplete,
  buildDrivingLicenseItems,
  buildDrivingLicenseSlots,
  buildDrivingLicensePreview,
  hasIncompleteDrivingLicenseVehicles
}
