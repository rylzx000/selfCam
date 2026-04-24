const constants = require('./constants')

function getVehicles(cache) {
  return Array.isArray(cache && cache.vehicles) ? cache.vehicles : []
}

function getDocuments(cache) {
  return Array.isArray(cache && cache.documents) ? cache.documents : []
}

function isCompletedPhoto(photo) {
  return !!photo && photo.status === 'completed' && !!photo.compressedPath
}

function getSafeCurrentVehicleIndex(cache, vehicles) {
  const currentVehicleIndex = cache && Number.isInteger(cache.currentVehicleIndex)
    ? cache.currentVehicleIndex
    : 0

  if (vehicles.length === 0) {
    return 0
  }

  if (currentVehicleIndex < 0) {
    return 0
  }

  if (currentVehicleIndex >= vehicles.length) {
    return vehicles.length - 1
  }

  return currentVehicleIndex
}

function getSafeCurrentStep(cache) {
  const currentStep = cache && cache.currentStep
  return [
    constants.SHOOT_STEP.LICENSE_PLATE,
    constants.SHOOT_STEP.VIN_CODE,
    constants.SHOOT_STEP.DAMAGE,
    constants.SHOOT_STEP.PREVIEW
  ].indexOf(currentStep) >= 0
    ? currentStep
    : constants.SHOOT_STEP.LICENSE_PLATE
}

function buildVehiclePhotoEntries(vehicle, vehicleIndex) {
  const photoEntries = []

  if (isCompletedPhoto(vehicle.licensePlate)) {
    photoEntries.push({
      id: `${vehicleIndex}-licensePlate`,
      url: vehicle.licensePlate.compressedPath,
      vehicle: vehicleIndex,
      type: constants.PHOTO_TYPE.LICENSE_PLATE,
      damage: null,
      label: `${vehicle.type} - 车牌`,
      captureMode: vehicle.licensePlate.captureMode || 'manual'
    })
  }

  if (isCompletedPhoto(vehicle.vinCode)) {
    photoEntries.push({
      id: `${vehicleIndex}-vinCode`,
      url: vehicle.vinCode.compressedPath,
      vehicle: vehicleIndex,
      type: constants.PHOTO_TYPE.VIN_CODE,
      damage: null,
      label: `${vehicle.type} - VIN码`,
      captureMode: vehicle.vinCode.captureMode || 'manual'
    })
  }

  const damages = Array.isArray(vehicle.damages) ? vehicle.damages : []
  damages.forEach((damage, damageIndex) => {
    photoEntries.push({
      id: `${vehicleIndex}-damage-${damageIndex}`,
      url: damage.compressedPath,
      vehicle: vehicleIndex,
      type: constants.PHOTO_TYPE.DAMAGE,
      damage: damageIndex,
      label: `${vehicle.type} - 车损${damageIndex + 1}`,
      captureMode: damage.captureMode || 'manual'
    })
  })

  return photoEntries
}

function getMainVehicleProgress(mainVehicle) {
  if (!mainVehicle) {
    return 0
  }

  if (mainVehicle.isPreviewProgressComplete) {
    return 2
  }

  if (mainVehicle.isStarted) {
    return 1
  }

  return 0
}

function getThirdVehicleProgress(thirdVehicles) {
  if (!thirdVehicles.length) {
    return 0
  }

  if (thirdVehicles.every((vehicle) => vehicle.isPreviewProgressComplete)) {
    return 2
  }

  if (thirdVehicles.some((vehicle) => vehicle.isStarted)) {
    return 1
  }

  return 0
}

function getVehicleSummary(cache) {
  const vehicles = getVehicles(cache).map((vehicle, index) => {
    const hasLicensePlate = isCompletedPhoto(vehicle.licensePlate)
    const hasVinCode = isCompletedPhoto(vehicle.vinCode)
    const damageCount = Array.isArray(vehicle.damages) ? vehicle.damages.length : 0
    const completedPhotoCount = (hasLicensePlate ? 1 : 0) + (hasVinCode ? 1 : 0) + damageCount
    const isStarted = completedPhotoCount > 0
    const isCoreComplete = hasLicensePlate && hasVinCode && damageCount > 0
    const isPreviewProgressComplete = hasLicensePlate
      && hasVinCode
      && damageCount >= constants.LIMITS.MAX_DAMAGES

    return {
      ...vehicle,
      index,
      isMainVehicle: index === 0,
      hasLicensePlate,
      hasVinCode,
      damageCount,
      completedPhotoCount,
      isStarted,
      isCoreComplete,
      isPreviewProgressComplete,
      missingPhotoTypes: [
        hasLicensePlate ? null : constants.PHOTO_TYPE.LICENSE_PLATE,
        hasVinCode ? null : constants.PHOTO_TYPE.VIN_CODE,
        damageCount > 0 ? null : constants.PHOTO_TYPE.DAMAGE
      ].filter(Boolean),
      photoEntries: buildVehiclePhotoEntries(vehicle, index)
    }
  })

  const currentVehicleIndex = getSafeCurrentVehicleIndex(cache, vehicles)
  const currentVehicle = vehicles[currentVehicleIndex] || null
  const mainVehicle = vehicles[0] || null
  const thirdVehicles = vehicles.slice(1)

  const photoCounts = vehicles.reduce((result, vehicle) => {
    if (vehicle.hasLicensePlate) {
      result.licensePlate += 1
    }
    if (vehicle.hasVinCode) {
      result.vinCode += 1
    }
    result.damage += vehicle.damageCount
    return result
  }, {
    licensePlate: 0,
    vinCode: 0,
    damage: 0
  })

  photoCounts.total = photoCounts.licensePlate + photoCounts.vinCode + photoCounts.damage

  return {
    vehicles,
    count: vehicles.length,
    mainVehicle,
    thirdVehicles,
    thirdVehicleCount: thirdVehicles.length,
    currentVehicleIndex,
    currentVehicle,
    currentVehicleType: currentVehicle ? currentVehicle.type : constants.VEHICLE_TYPE.TARGET,
    photoCounts,
    photoEntries: vehicles.flatMap((vehicle) => vehicle.photoEntries),
    completedVehicleCount: vehicles.filter((vehicle) => vehicle.isCoreComplete).length,
    hasIncompleteVehicles: vehicles.some((vehicle) => vehicle.isStarted && !vehicle.isCoreComplete),
    hasPreviewIncompleteVehicles: vehicles.some((vehicle) => vehicle.isStarted && !vehicle.isPreviewProgressComplete),
    canAddThirdVehicle: thirdVehicles.length < constants.LIMITS.MAX_THIRD_VEHICLES,
    progress: {
      step1: getMainVehicleProgress(mainVehicle),
      step2: getThirdVehicleProgress(thirdVehicles)
    }
  }
}

function getDocumentSummary(cache) {
  const documents = getDocuments(cache)

  return {
    documents,
    count: documents.length,
    hasDocuments: documents.length > 0,
    remainingCount: Math.max(constants.LIMITS.MAX_DOCUMENTS - documents.length, 0),
    photoEntries: documents.map((document, index) => ({
      id: `document-${index}`,
      url: document.compressedPath,
      vehicle: null,
      type: 'document',
      damage: null,
      docIndex: index,
      label: `单证资料 ${index + 1}`,
      captureMode: document.captureMode || 'manual'
    }))
  }
}

function getRetakeContext(cache, vehicles) {
  if (!cache || !cache.retakeMode || cache.retakeMode.enabled !== true) {
    return null
  }

  const { vehicleIndex, photoType, damageIndex } = cache.retakeMode
  const vehicle = vehicles[vehicleIndex] || null

  if (!vehicle) {
    return null
  }

  if (photoType === constants.PHOTO_TYPE.DAMAGE) {
    const damages = Array.isArray(vehicle.damages) ? vehicle.damages : []
    if (!Number.isInteger(damageIndex) || !damages[damageIndex]) {
      return null
    }
  }

  return {
    vehicleIndex,
    vehicle,
    vehicleType: vehicle.type,
    photoType,
    damageIndex: photoType === constants.PHOTO_TYPE.DAMAGE ? damageIndex : null,
    currentStep: photoType
  }
}

function hasRetakeContext(cache) {
  return !!getRetakeContext(cache, getVehicleSummary(cache).vehicles)
}

function getCurrentFlowContext(cache) {
  const vehicleSummary = getVehicleSummary(cache)
  const retakeContext = getRetakeContext(cache, vehicleSummary.vehicles)
  const currentStep = retakeContext ? retakeContext.currentStep : getSafeCurrentStep(cache)
  const currentVehicleIndex = retakeContext
    ? retakeContext.vehicleIndex
    : vehicleSummary.currentVehicleIndex
  const currentVehicle = retakeContext
    ? retakeContext.vehicle
    : vehicleSummary.currentVehicle
  const workflowState = typeof (cache && cache.workflowState) === 'string'
    ? cache.workflowState
    : cache && cache.workflowState && cache.workflowState.current
      ? cache.workflowState.current
      : 'IDLE'

  return {
    hasCache: !!cache,
    hasVehicles: vehicleSummary.count > 0,
    currentStep,
    currentVehicleIndex,
    currentVehicle,
    currentVehicleType: currentVehicle ? currentVehicle.type : constants.VEHICLE_TYPE.TARGET,
    damageCount: currentVehicle ? currentVehicle.damageCount : 0,
    fromPreview: !!(cache && cache.fromPreview),
    workflowState,
    hasRetakeContext: !!retakeContext,
    retakeContext,
    guideTip: constants.GUIDE_TIPS[currentStep] || ''
  }
}

function getCacheSummary(cache) {
  const vehicleSummary = getVehicleSummary(cache)
  const documentSummary = getDocumentSummary(cache)
  const flowContext = getCurrentFlowContext(cache)
  const shouldSuggestBackToEditReasons = []

  if (flowContext.hasRetakeContext) {
    shouldSuggestBackToEditReasons.push('retake_context')
  }

  if (vehicleSummary.hasIncompleteVehicles) {
    shouldSuggestBackToEditReasons.push('incomplete_vehicle')
  }

  if (flowContext.hasCache && flowContext.workflowState !== 'LOCAL_COMPLETED') {
    shouldSuggestBackToEditReasons.push('workflow_not_completed')
  }

  const photoCounts = {
    ...vehicleSummary.photoCounts,
    document: documentSummary.count
  }
  photoCounts.total = photoCounts.licensePlate + photoCounts.vinCode + photoCounts.damage + photoCounts.document

  return {
    hasCache: !!cache,
    vehicles: vehicleSummary.vehicles,
    documents: documentSummary.documents,
    vehicleCount: vehicleSummary.count,
    documentCount: documentSummary.count,
    photoCounts,
    totalPhotos: photoCounts.total,
    allPhotos: vehicleSummary.photoEntries.concat(documentSummary.photoEntries),
    progress: {
      ...vehicleSummary.progress,
      step3: documentSummary.hasDocuments
    },
    canAddThirdVehicle: vehicleSummary.canAddThirdVehicle,
    hasRetakeContext: flowContext.hasRetakeContext,
    shouldSuggestBackToEdit: shouldSuggestBackToEditReasons.length > 0,
    shouldSuggestBackToEditReasons,
    vehicleSummary,
    documentSummary,
    flowContext
  }
}

module.exports = {
  getCacheSummary,
  getVehicleSummary,
  getDocumentSummary,
  getCurrentFlowContext,
  hasRetakeContext
}
