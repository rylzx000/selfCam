const constants = require('../../utils/constants')
const vehicleDocuments = require('../../utils/documents')
const { SHOOT_STEP, createPhoto, createCache } = require('./fixtures')

function nowIso() {
  return new Date().toISOString()
}

function resolveCount(value, index, fallback) {
  if (Array.isArray(value)) {
    return Number.isInteger(value[index]) ? Math.max(value[index], 0) : fallback
  }

  return Number.isInteger(value) ? Math.max(value, 0) : fallback
}

function createScenarioPhoto(key, overrides = {}) {
  return createPhoto({
    tempFilePath: `wxfile://tmp/${key}-original.jpg`,
    compressedPath: `wxfile://tmp/${key}.jpg`,
    fileSize: 1024,
    captureTrigger: 'scenario_builder',
    ...overrides
  })
}

function createVehicleDocument(vehicleIndex, documentIndex) {
  const drivingSides = [
    vehicleDocuments.DRIVING_LICENSE_SIDES.FRONT_PAGE,
    vehicleDocuments.DRIVING_LICENSE_SIDES.BACK_PAGE,
    vehicleDocuments.DRIVING_LICENSE_SIDES.ELECTRONIC
  ]
  const docSide = drivingSides[documentIndex] || `extra_${documentIndex}`
  const docType = documentIndex < drivingSides.length
    ? vehicleDocuments.DOCUMENT_TYPES.DRIVING_LICENSE
    : `extra_doc_${documentIndex}`
  const label = vehicleDocuments.DRIVING_LICENSE_LABELS[docSide] || `补充单证${documentIndex + 1}`
  const timestamp = Date.now() + vehicleIndex * 100 + documentIndex

  return {
    id: `vehicle_${vehicleIndex}_document_${documentIndex}`,
    docType,
    docSide,
    label,
    sourceType: 'album',
    tempFilePath: `wxfile://tmp/e2e-vehicle-${vehicleIndex}-document-${documentIndex}-original.jpg`,
    compressedPath: `wxfile://tmp/e2e-vehicle-${vehicleIndex}-document-${documentIndex}.jpg`,
    size: 1024,
    compressedSize: 512,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function createRootDocument(index) {
  return {
    tempFilePath: `wxfile://tmp/e2e-root-document-${index}-original.jpg`,
    compressedPath: `wxfile://tmp/e2e-root-document-${index}.jpg`,
    fileSize: 1024,
    source: 'album',
    captureMode: 'manual',
    captureTrigger: 'scenario_builder'
  }
}

function createVehicleWithPhotos(vehicleIndex, options = {}) {
  const damageCount = resolveCount(options.damageCount, vehicleIndex, constants.LIMITS.MAX_DAMAGES)
  const documentCount = resolveCount(options.documentCount, vehicleIndex, 0)

  return {
    id: `vehicle_e2e_${vehicleIndex}`,
    type: vehicleIndex === 0 ? '标的车' : `三者车${vehicleIndex}`,
    licensePlate: options.includeLicensePlate === false
      ? { status: 'pending' }
      : createScenarioPhoto(`e2e-vehicle-${vehicleIndex}-license`, {
        recognizedText: '',
        isManualInput: true,
        isNewEnergy: false
      }),
    vinCode: options.includeVinCode === false
      ? { status: 'pending' }
      : createScenarioPhoto(`e2e-vehicle-${vehicleIndex}-vin`, {
        recognizedText: '',
        isManualInput: true
      }),
    damages: Array.from({ length: damageCount }, (_, damageIndex) => (
      createScenarioPhoto(`e2e-vehicle-${vehicleIndex}-damage-${damageIndex}`)
    )),
    documents: Array.from({ length: documentCount }, (_, documentIndex) => (
      createVehicleDocument(vehicleIndex, documentIndex)
    )),
    documentSelections: vehicleDocuments.getDefaultDocumentSelections()
  }
}

function cloneCacheSnapshot(cache) {
  return JSON.parse(JSON.stringify(cache))
}

function pushPhotoPath(paths, photo) {
  if (photo && typeof photo.compressedPath === 'string' && photo.compressedPath) {
    paths.push(photo.compressedPath)
  }
}

function collectAllPhotoPaths(cache) {
  const paths = []
  const vehicles = Array.isArray(cache && cache.vehicles) ? cache.vehicles : []
  const documents = Array.isArray(cache && cache.documents) ? cache.documents : []

  vehicles.forEach((vehicle) => {
    pushPhotoPath(paths, vehicle.licensePlate)
    pushPhotoPath(paths, vehicle.vinCode)

    if (Array.isArray(vehicle.damages)) {
      vehicle.damages.forEach((damage) => pushPhotoPath(paths, damage))
    }

    if (Array.isArray(vehicle.documents)) {
      vehicle.documents.forEach((document) => pushPhotoPath(paths, document))
    }
  })

  documents.forEach((document) => pushPhotoPath(paths, document))
  return paths
}

function assertNoDuplicatePhotoPaths(cache) {
  const paths = collectAllPhotoPaths(cache)
  const seen = new Set()
  const duplicates = []

  paths.forEach((path) => {
    if (seen.has(path)) {
      duplicates.push(path)
      return
    }
    seen.add(path)
  })

  if (duplicates.length) {
    throw new Error(`重复图片路径: ${duplicates.join(', ')}`)
  }

  return true
}

function fillRootDocumentsToTotal(cache, totalPhotoCount) {
  if (!Number.isInteger(totalPhotoCount)) {
    return
  }

  let currentCount = collectAllPhotoPaths(cache).length
  if (currentCount > totalPhotoCount) {
    throw new Error(`场景照片数 ${currentCount} 已超过目标 ${totalPhotoCount}`)
  }

  while (currentCount < totalPhotoCount) {
    cache.documents.push(createRootDocument(cache.documents.length))
    currentCount += 1
  }
}

function createScenario({
  vehicleCount = 1,
  damageCountPerVehicle = constants.LIMITS.MAX_DAMAGES,
  documentCountPerVehicle = 0,
  totalPhotoCount
} = {}) {
  const timestamp = nowIso()
  const safeVehicleCount = Math.max(vehicleCount, 0)
  const vehicles = Array.from({ length: safeVehicleCount }, (_, vehicleIndex) => (
    createVehicleWithPhotos(vehicleIndex, {
      damageCount: resolveCount(damageCountPerVehicle, vehicleIndex, constants.LIMITS.MAX_DAMAGES),
      documentCount: resolveCount(documentCountPerVehicle, vehicleIndex, 0)
    })
  ))
  const currentVehicleIndex = vehicles.length ? vehicles.length - 1 : 0

  const cache = createCache({
    schemaVersion: 2,
    vehicles,
    documents: [],
    currentStep: SHOOT_STEP.PREVIEW,
    currentVehicleIndex,
    currentDamageCount: vehicles[currentVehicleIndex]?.damages?.length || 0,
    retakeMode: {
      enabled: false,
      vehicleIndex: null,
      photoType: null,
      damageIndex: null
    },
    workflowState: {
      current: 'PREVIEWING',
      updatedAt: timestamp
    },
    fromPreview: false,
    createdAt: timestamp,
    updatedAt: timestamp
  })

  fillRootDocumentsToTotal(cache, totalPhotoCount)
  return cache
}

function createFullDamageScenario({ vehicleCount = 1, damageCountPerVehicle = constants.LIMITS.MAX_DAMAGES } = {}) {
  return createScenario({
    vehicleCount,
    damageCountPerVehicle,
    documentCountPerVehicle: 0
  })
}

function createNearLimitScenario({ totalPhotoCount } = {}) {
  return createScenario({
    vehicleCount: 3,
    damageCountPerVehicle: constants.LIMITS.MAX_DAMAGES,
    documentCountPerVehicle: 7,
    totalPhotoCount
  })
}

module.exports = {
  createVehicleWithPhotos,
  createScenario,
  createFullDamageScenario,
  createNearLimitScenario,
  cloneCacheSnapshot,
  collectAllPhotoPaths,
  assertNoDuplicatePhotoPaths
}
