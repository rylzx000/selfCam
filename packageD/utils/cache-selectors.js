const constants = require('./constants')
const vehicleDocuments = require('./documents')

const ACTIONABLE_QUALITY_REASONS = {
  blur: true,
  dark: true,
  overexposed: true,
  too_near: true,
  too_far: true
}

function getVehicles(cache) {
  return Array.isArray(cache && cache.vehicles) ? cache.vehicles : []
}

function getDocuments(cache) {
  return Array.isArray(cache && cache.documents) ? cache.documents : []
}

function getScenePhotos(cache) {
  const scenePhotos = cache && cache.scenePhotos
  return {
    scene45: scenePhotos && scenePhotos.scene45 ? scenePhotos.scene45 : { status: 'pending' },
    supplements: Array.isArray(scenePhotos && scenePhotos.supplements) ? scenePhotos.supplements : []
  }
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isAuxPhotoEnabled(cache) {
  return !!(cache && cache.auxPhoto && cache.auxPhoto.enabled === true)
}

function getVehicleDisplayName(vehicle, fallback = constants.VEHICLE_TYPE.TARGET) {
  if (isNonEmptyString(vehicle && vehicle.displayName)) {
    return vehicle.displayName
  }

  if (isNonEmptyString(vehicle && vehicle.type)) {
    return vehicle.type
  }

  return fallback
}

function getVehicleRoleName(vehicle, fallback = constants.VEHICLE_TYPE.TARGET) {
  if (isNonEmptyString(vehicle && vehicle.vehicleRoleName)) {
    return vehicle.vehicleRoleName
  }

  if (isNonEmptyString(vehicle && vehicle.type)) {
    return vehicle.type
  }

  return fallback
}

function getVehiclePlateNo(vehicle) {
  return isNonEmptyString(vehicle && vehicle.licenseNo)
    ? vehicle.licenseNo
    : '车牌待确认'
}

function getModuleOneVehicleTitle(vehicle = {}) {
  const roleName = isNonEmptyString(vehicle.vehicleRoleName)
    ? vehicle.vehicleRoleName
    : getVehicleDisplayName(vehicle)
  const normalizedDisplayName = isNonEmptyString(vehicle.displayName) ? vehicle.displayName.trim() : ''
  const displayPlateNo = normalizedDisplayName.indexOf(roleName) === 0
    ? normalizedDisplayName.slice(roleName.length).replace(/^[\s-]+/, '').trim()
    : ''
  const plateNo = isNonEmptyString(vehicle.licenseNo)
    ? vehicle.licenseNo
    : displayPlateNo || getVehiclePlateNo(vehicle)
  return `${roleName} - ${plateNo}`
}

function normalizePlateTheme(value) {
  const normalized = isNonEmptyString(value) ? value.trim().toLowerCase() : ''

  if (['green', 'electric', 'new_energy', 'new-energy'].indexOf(normalized) >= 0) {
    return 'electric'
  }

  if (['blue', 'oil', 'fuel'].indexOf(normalized) >= 0) {
    return 'oil'
  }

  return ''
}

function resolveVehiclePlateTheme(vehicle) {
  const plateColorTheme = normalizePlateTheme(vehicle && vehicle.plateColor)
  if (plateColorTheme) {
    return plateColorTheme
  }

  const energyTypeTheme = normalizePlateTheme(vehicle && vehicle.energyType)
  if (energyTypeTheme) {
    return energyTypeTheme
  }

  const licenseNo = isNonEmptyString(vehicle && vehicle.licenseNo)
    ? vehicle.licenseNo.replace(/\s+/g, '')
    : ''

  if (!licenseNo) {
    return 'unknown'
  }

  return licenseNo.length >= 8 ? 'electric' : 'oil'
}

function isCompletedPhoto(photo) {
  return !!photo && photo.status === 'completed' && !!photo.compressedPath
}

function hasStoredAttachment(record) {
  return !!record && isNonEmptyString(record.compressedPath)
}

function getPhotoFilePath(photo = {}) {
  return photo.compressedPath || photo.tempFilePath || photo.originalPath || photo.filePath || ''
}

function getPhotoSize(photo = {}) {
  if (Number.isFinite(photo.compressedSize)) return photo.compressedSize
  if (Number.isFinite(photo.fileSize)) return photo.fileSize
  if (Number.isFinite(photo.size)) return photo.size
  return ''
}

function getPhotoUpdatedAt(photo = {}) {
  return isNonEmptyString(photo.updatedAt)
    ? photo.updatedAt
    : isNonEmptyString(photo.createdAt)
      ? photo.createdAt
      : ''
}

function getAlbumPhotoIdentity(photo = {}) {
  if (isNonEmptyString(photo.localPhotoId)) {
    return photo.localPhotoId
  }

  return `legacy:${getPhotoFilePath(photo)}|${getPhotoSize(photo)}|${getPhotoUpdatedAt(photo)}`
}

function getAlbumSaveRecords(cache) {
  return isPlainObject(cache && cache.albumSaveRecords) ? cache.albumSaveRecords : {}
}

function getSavedAlbumPathMap(records) {
  return Object.keys(records).reduce((result, key) => {
    const record = records[key]
    if (record && record.status === 'saved' && isNonEmptyString(record.filePath)) {
      result[record.filePath] = true
    }
    return result
  }, {})
}

function isAlbumSource(photo = {}) {
  return photo.sourceType === 'album' || photo.source === 'album'
}

function isAlbumSaved(localPhotoId, filePath, records, savedPaths) {
  return !!(
    records[localPhotoId]
    && records[localPhotoId].status === 'saved'
  ) || !!savedPaths[filePath]
}

function pushAlbumCandidate(candidates, seenPaths, photo, meta, records, savedPaths) {
  const filePath = getPhotoFilePath(photo)
  if (!filePath || seenPaths[filePath] || isAlbumSource(photo)) {
    return
  }

  const localPhotoId = getAlbumPhotoIdentity(photo)
  if (isAlbumSaved(localPhotoId, filePath, records, savedPaths)) {
    return
  }

  seenPaths[filePath] = true
  candidates.push({
    ...meta,
    localPhotoId,
    filePath,
    photo
  })
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
    constants.SHOOT_STEP.SCENE_45,
    constants.SHOOT_STEP.SCENE_SUPPLEMENT,
    constants.SHOOT_STEP.LICENSE_PLATE,
    constants.SHOOT_STEP.VIN_CODE,
    constants.SHOOT_STEP.DAMAGE,
    constants.SHOOT_STEP.MODULE_ONE_PREVIEW,
    constants.SHOOT_STEP.MODULE_THREE,
    constants.SHOOT_STEP.FINAL_PREVIEW,
    constants.SHOOT_STEP.PREVIEW
  ].indexOf(currentStep) >= 0
    ? currentStep
    : constants.SHOOT_STEP.LICENSE_PLATE
}

function buildVehiclePhotoEntries(vehicle, vehicleIndex) {
  const photoEntries = []
  const vehicleDisplayName = getVehicleDisplayName(vehicle)

  if (isCompletedPhoto(vehicle.licensePlate)) {
    photoEntries.push({
      id: `${vehicleIndex}-licensePlate`,
      url: vehicle.licensePlate.compressedPath,
      vehicle: vehicleIndex,
      type: constants.PHOTO_TYPE.LICENSE_PLATE,
      damage: null,
      label: `${vehicleDisplayName} - 车牌`,
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
      label: `${vehicleDisplayName} - VIN码`,
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
      label: `${vehicleDisplayName} - 车损${damageIndex + 1}`,
      captureMode: damage.captureMode || 'manual'
    })
  })

  vehicleDocuments.getVehicleDocuments(vehicle).forEach((document, documentIndex) => {
    if (!hasStoredAttachment(document)) {
      return
    }

    photoEntries.push({
      id: `${vehicleIndex}-vehicleDocument-${document.docType}-${document.docSide}`,
      url: document.compressedPath,
      vehicle: vehicleIndex,
      type: 'vehicleDocument',
      damage: null,
      documentIndex,
      docType: document.docType,
      docSide: document.docSide,
      label: `${vehicleDisplayName} - ${document.label || '单证资料'}`
    })
  })

  return photoEntries
}

function buildScenePhotoEntries(cache) {
  const scenePhotos = getScenePhotos(cache)
  const entries = []

  if (isCompletedPhoto(scenePhotos.scene45)) {
    entries.push({
      id: 'scene-45',
      url: scenePhotos.scene45.compressedPath,
      vehicle: null,
      type: constants.PHOTO_TYPE.SCENE_45,
      damage: null,
      sceneType: constants.SCENE_PHOTO_TYPE.SCENE_45,
      sceneIndex: null,
      label: '整车45度现场照片',
      captureMode: scenePhotos.scene45.captureMode || 'manual'
    })
  }

  scenePhotos.supplements.forEach((photo, index) => {
    if (!isCompletedPhoto(photo)) {
      return
    }

    entries.push({
      id: `scene-supplement-${index}`,
      url: photo.compressedPath,
      vehicle: null,
      type: constants.PHOTO_TYPE.SCENE_SUPPLEMENT,
      damage: null,
      sceneType: constants.SCENE_PHOTO_TYPE.SUPPLEMENT,
      sceneIndex: index,
      label: `现场补充照片${index + 1}`,
      captureMode: photo.captureMode || 'manual'
    })
  })

  return entries
}

function getSceneSummary(cache) {
  const scenePhotos = getScenePhotos(cache)
  const scenePhotoEntries = buildScenePhotoEntries(cache)

  return {
    scene45: scenePhotos.scene45,
    supplements: scenePhotos.supplements,
    hasScene45: isCompletedPhoto(scenePhotos.scene45),
    supplementCount: scenePhotos.supplements.filter(isCompletedPhoto).length,
    remainingSupplementCount: Math.max(
      constants.LIMITS.MAX_SCENE_SUPPLEMENTS - scenePhotos.supplements.filter(isCompletedPhoto).length,
      0
    ),
    photoEntries: scenePhotoEntries,
    count: scenePhotoEntries.length
  }
}

function getModuleOneSummary(cache) {
  const sceneSummary = getSceneSummary(cache)
  const vehicleSummary = getVehicleSummary(cache)
  const sceneSlots = [
    {
      key: constants.SCENE_PHOTO_TYPE.SCENE_45,
      sceneType: constants.SCENE_PHOTO_TYPE.SCENE_45,
      label: '整车45度',
      completed: sceneSummary.hasScene45,
      photo: sceneSummary.hasScene45 ? sceneSummary.scene45 : null
    }
  ]

  sceneSummary.supplements.forEach((photo, index) => {
    if (!isCompletedPhoto(photo)) {
      return
    }

    sceneSlots.push({
      key: `${constants.SCENE_PHOTO_TYPE.SUPPLEMENT}:${index}`,
      sceneType: constants.SCENE_PHOTO_TYPE.SUPPLEMENT,
      supplementIndex: index,
      label: '现场照片（可选）',
      completed: true,
      photo
    })
  })

  for (
    let index = sceneSummary.supplements.length;
    index < constants.LIMITS.MAX_SCENE_SUPPLEMENTS;
    index += 1
  ) {
    sceneSlots.push({
      key: `${constants.SCENE_PHOTO_TYPE.SUPPLEMENT}:${index}`,
      sceneType: constants.SCENE_PHOTO_TYPE.SUPPLEMENT,
      supplementIndex: index,
      label: '现场照片（可选）',
      completed: false,
      photo: null
    })
  }

  return {
    sceneSlots,
    vehicles: vehicleSummary.vehicles.map((vehicle) => ({
      index: vehicle.index,
      id: vehicle.id,
      displayName: vehicle.displayName,
      moduleOneTitle: getModuleOneVehicleTitle(vehicle),
      vehicleRoleName: vehicle.vehicleRoleName,
      hasLicensePlate: vehicle.hasLicensePlate,
      hasVinCode: vehicle.hasVinCode,
      licensePlate: vehicle.licensePlate,
      vinCode: vehicle.vinCode
    })),
    hasScene45: sceneSummary.hasScene45,
    supplementCount: sceneSummary.supplementCount,
    remainingSupplementCount: sceneSummary.remainingSupplementCount,
    canAddSceneSupplement: sceneSummary.supplementCount < constants.LIMITS.MAX_SCENE_SUPPLEMENTS,
    scenePhotoCount: sceneSummary.count
  }
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
  const auxPhotoEnabled = isAuxPhotoEnabled(cache)
  const vehicles = getVehicles(cache).map((vehicle, index) => {
    const hasLicensePlate = isCompletedPhoto(vehicle.licensePlate)
    const hasVinCode = isCompletedPhoto(vehicle.vinCode)
    const damageCount = Array.isArray(vehicle.damages) ? vehicle.damages.length : 0
    const vehicleDocumentCount = vehicleDocuments.getVehicleDocuments(vehicle).filter(hasStoredAttachment).length
    const completedPhotoCount = (hasLicensePlate ? 1 : 0) + (hasVinCode ? 1 : 0) + damageCount
    const isStarted = completedPhotoCount > 0
    const isCoreComplete = hasLicensePlate && hasVinCode && damageCount > 0
    const isPreviewProgressComplete = hasLicensePlate
      && hasVinCode
      && damageCount >= constants.LIMITS.MAX_DAMAGES
    const vehicleRoleName = getVehicleRoleName(vehicle, index === 0 ? constants.VEHICLE_TYPE.TARGET : `三者车${index}`)
    const vehiclePlateNo = getVehiclePlateNo(vehicle)
    const vehiclePlateTheme = resolveVehiclePlateTheme(vehicle)
    const displayName = getVehicleDisplayName(vehicle, index === 0 ? constants.VEHICLE_TYPE.TARGET : `三者车${index}`)
    const normalizedVehicle = {
      ...vehicle,
      displayName,
      vehicleRoleName,
      vehiclePlateNo,
      vehiclePlateTheme
    }

    return {
      ...normalizedVehicle,
      index,
      isMainVehicle: index === 0,
      canDelete: !auxPhotoEnabled && index > 0,
      hasLicensePlate,
      hasVinCode,
      damageCount,
      vehicleDocumentCount,
      isDrivingLicenseComplete: vehicleDocuments.isDrivingLicenseComplete(vehicle),
      isVehicleDocumentComplete: vehicleDocuments.isAllVehicleDocumentsComplete(vehicle),
      completedPhotoCount,
      isStarted,
      isCoreComplete,
      isPreviewProgressComplete,
      missingPhotoTypes: [
        hasLicensePlate ? null : constants.PHOTO_TYPE.LICENSE_PLATE,
        hasVinCode ? null : constants.PHOTO_TYPE.VIN_CODE,
        damageCount > 0 ? null : constants.PHOTO_TYPE.DAMAGE
      ].filter(Boolean),
      photoEntries: buildVehiclePhotoEntries(normalizedVehicle, index)
    }
  })

  const currentVehicleIndex = getSafeCurrentVehicleIndex(cache, vehicles)
  const currentVehicle = vehicles[currentVehicleIndex] || null
  const mainVehicle = vehicles[0] || null
  const thirdVehicles = vehicles.slice(1)
  const hasNextVehicle = currentVehicleIndex < vehicles.length - 1

  const photoCounts = vehicles.reduce((result, vehicle) => {
    if (vehicle.hasLicensePlate) {
      result.licensePlate += 1
    }
    if (vehicle.hasVinCode) {
      result.vinCode += 1
    }
    result.damage += vehicle.damageCount
    result.document += vehicle.vehicleDocumentCount
    return result
  }, {
    licensePlate: 0,
    vinCode: 0,
    damage: 0,
    document: 0
  })

  photoCounts.total = photoCounts.licensePlate + photoCounts.vinCode + photoCounts.damage + photoCounts.document

  return {
    vehicles,
    count: vehicles.length,
    mainVehicle,
    thirdVehicles,
    thirdVehicleCount: thirdVehicles.length,
    currentVehicleIndex,
    currentVehicle,
    currentVehicleType: currentVehicle ? getVehicleDisplayName(currentVehicle) : constants.VEHICLE_TYPE.TARGET,
    auxPhotoEnabled,
    hasNextVehicle,
    nextVehicleIndex: hasNextVehicle ? currentVehicleIndex + 1 : null,
    currentVehicleRoleName: currentVehicle ? currentVehicle.vehicleRoleName : constants.VEHICLE_TYPE.TARGET,
    currentVehiclePlateNo: currentVehicle ? currentVehicle.vehiclePlateNo : '',
    currentVehiclePlateTheme: currentVehicle ? currentVehicle.vehiclePlateTheme : 'unknown',
    currentVehicleProgressText: vehicles.length > 1
      ? `${currentVehicleIndex + 1}/${vehicles.length} 辆`
      : '',
    finishDamageText: '完成本车拍摄',
    photoCounts,
    photoEntries: vehicles.flatMap((vehicle) => vehicle.photoEntries),
    completedVehicleCount: vehicles.filter((vehicle) => vehicle.isCoreComplete).length,
    hasIncompleteVehicles: vehicles.some((vehicle) => vehicle.isStarted && !vehicle.isCoreComplete),
    hasPreviewIncompleteVehicles: vehicles.some((vehicle) => vehicle.isStarted && !vehicle.isPreviewProgressComplete),
    canAddThirdVehicle: !auxPhotoEnabled && thirdVehicles.length < constants.LIMITS.MAX_THIRD_VEHICLES,
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

function normalizePhotoQualityForSummary(quality) {
  if (!isPlainObject(quality)) {
    return null
  }

  return {
    level: ['good', 'warn', 'bad'].indexOf(quality.level) >= 0 ? quality.level : 'warn',
    suggestRetake: quality.suggestRetake === true,
    reasons: Array.isArray(quality.reasons)
      ? quality.reasons.filter((item) => isNonEmptyString(item))
      : [],
    analyzedAt: isNonEmptyString(quality.analyzedAt) ? quality.analyzedAt : '',
    configVersion: isNonEmptyString(quality.configVersion) ? quality.configVersion : ''
  }
}

function getActionableQualityReasons(quality) {
  if (!quality || !Array.isArray(quality.reasons)) {
    return []
  }

  const dedupedReasons = []

  quality.reasons.forEach((reason) => {
    if (!ACTIONABLE_QUALITY_REASONS[reason]) {
      return
    }

    if (dedupedReasons.indexOf(reason) >= 0) {
      return
    }

    dedupedReasons.push(reason)
  })

  return dedupedReasons
}

function collectQualityPhotoRecords(cache) {
  const records = []
  let seqNo = 0

  buildScenePhotoEntries(cache).forEach((entry) => {
    const scenePhotos = getScenePhotos(cache)
    const photo = entry.sceneType === constants.SCENE_PHOTO_TYPE.SCENE_45
      ? scenePhotos.scene45
      : scenePhotos.supplements[entry.sceneIndex]

    if (!hasStoredAttachment(photo)) {
      return
    }

    seqNo += 1
    records.push({
      seqNo,
      vehicleIndex: null,
      photoType: entry.type,
      photoIndex: entry.sceneIndex,
      label: entry.label,
      photo
    })
  })

  getVehicles(cache).forEach((vehicle, vehicleIndex) => {
    const vehicleType = getVehicleDisplayName(vehicle)

    if (isCompletedPhoto(vehicle && vehicle.licensePlate)) {
      seqNo += 1
      records.push({
        seqNo,
        vehicleIndex,
        photoType: constants.PHOTO_TYPE.LICENSE_PLATE,
        photoIndex: null,
        label: `${vehicleType} - 车牌`,
        photo: vehicle.licensePlate
      })
    }

    if (isCompletedPhoto(vehicle && vehicle.vinCode)) {
      seqNo += 1
      records.push({
        seqNo,
        vehicleIndex,
        photoType: constants.PHOTO_TYPE.VIN_CODE,
        photoIndex: null,
        label: `${vehicleType} - VIN码`,
        photo: vehicle.vinCode
      })
    }

    const damages = Array.isArray(vehicle && vehicle.damages) ? vehicle.damages : []
    damages.forEach((damage, damageIndex) => {
      if (!hasStoredAttachment(damage)) {
        return
      }

      seqNo += 1
      records.push({
        seqNo,
        vehicleIndex,
        photoType: constants.PHOTO_TYPE.DAMAGE,
        photoIndex: damageIndex,
        label: `${vehicleType} - 车损${damageIndex + 1}`,
        photo: damage
      })
    })

    // 车辆级单证只参与照片清单和统计，不进入照片质量检测/重拍建议。
  })

  getDocuments(cache).forEach((document, documentIndex) => {
    if (!hasStoredAttachment(document)) {
      return
    }

    seqNo += 1
    records.push({
      seqNo,
      vehicleIndex: null,
      photoType: 'document',
      photoIndex: documentIndex,
      label: `单证资料 ${documentIndex + 1}`,
      photo: document
    })
  })

  return records
}

function getAlbumSaveCandidates(cache) {
  const candidates = []
  const seenPaths = {}
  const records = getAlbumSaveRecords(cache)
  const savedPaths = getSavedAlbumPathMap(records)

  const scenePhotos = getScenePhotos(cache)
  if (isCompletedPhoto(scenePhotos.scene45)) {
    pushAlbumCandidate(candidates, seenPaths, scenePhotos.scene45, {
      vehicleIndex: null,
      photoType: constants.PHOTO_TYPE.SCENE_45,
      photoIndex: null,
      label: '整车45度现场照片'
    }, records, savedPaths)
  }

  scenePhotos.supplements.forEach((photo, index) => {
    if (!hasStoredAttachment(photo)) {
      return
    }

    pushAlbumCandidate(candidates, seenPaths, photo, {
      vehicleIndex: null,
      photoType: constants.PHOTO_TYPE.SCENE_SUPPLEMENT,
      photoIndex: index,
      label: `现场补充照片${index + 1}`
    }, records, savedPaths)
  })

  getVehicles(cache).forEach((vehicle, vehicleIndex) => {
    const vehicleType = getVehicleDisplayName(vehicle)

    if (isCompletedPhoto(vehicle && vehicle.licensePlate)) {
      pushAlbumCandidate(candidates, seenPaths, vehicle.licensePlate, {
        vehicleIndex,
        photoType: constants.PHOTO_TYPE.LICENSE_PLATE,
        photoIndex: null,
        label: `${vehicleType} - 车牌`
      }, records, savedPaths)
    }

    if (isCompletedPhoto(vehicle && vehicle.vinCode)) {
      pushAlbumCandidate(candidates, seenPaths, vehicle.vinCode, {
        vehicleIndex,
        photoType: constants.PHOTO_TYPE.VIN_CODE,
        photoIndex: null,
        label: `${vehicleType} - VIN码`
      }, records, savedPaths)
    }

    const damages = Array.isArray(vehicle && vehicle.damages) ? vehicle.damages : []
    damages.forEach((damage, damageIndex) => {
      if (!hasStoredAttachment(damage)) {
        return
      }

      pushAlbumCandidate(candidates, seenPaths, damage, {
        vehicleIndex,
        photoType: constants.PHOTO_TYPE.DAMAGE,
        photoIndex: damageIndex,
        label: `${vehicleType} - 车损${damageIndex + 1}`
      }, records, savedPaths)
    })

    vehicleDocuments.getVehicleDocuments(vehicle).forEach((document, documentIndex) => {
      if (!hasStoredAttachment(document)) {
        return
      }

      pushAlbumCandidate(candidates, seenPaths, document, {
        vehicleIndex,
        photoType: 'vehicleDocument',
        photoIndex: documentIndex,
        docType: document.docType,
        docSide: document.docSide,
        label: `${vehicleType} - ${document.label || '单证资料'}`
      }, records, savedPaths)
    })
  })

  getDocuments(cache).forEach((document, documentIndex) => {
    if (!hasStoredAttachment(document)) {
      return
    }

    pushAlbumCandidate(candidates, seenPaths, document, {
      vehicleIndex: null,
      photoType: 'document',
      photoIndex: documentIndex,
      label: `单证资料 ${documentIndex + 1}`
    }, records, savedPaths)
  })

  return candidates
}

function getQualitySummary(cache) {
  const photoRecords = collectQualityPhotoRecords(cache)
  const riskPhotos = []
  const riskReasonCounts = {}
  let analyzedCount = 0
  let suggestRetakeCount = 0
  let failedCount = 0
  let disabledCount = 0
  let lowConfidenceCount = 0

  photoRecords.forEach((record) => {
    const quality = normalizePhotoQualityForSummary(record.photo && record.photo.quality)

    if (!quality) {
      return
    }

    if (quality.reasons.indexOf('disabled') >= 0) {
      disabledCount += 1
      return
    }

    analyzedCount += 1

    if (quality.reasons.indexOf('analyze_failed') >= 0) {
      failedCount += 1
      return
    }

    if (quality.reasons.indexOf('low_confidence') >= 0) {
      lowConfidenceCount += 1
    }

    const actionableReasons = getActionableQualityReasons(quality)
    if (!quality.suggestRetake || actionableReasons.length === 0) {
      return
    }

    suggestRetakeCount += 1
    actionableReasons.forEach((reason) => {
      riskReasonCounts[reason] = (riskReasonCounts[reason] || 0) + 1
    })

    riskPhotos.push({
      photoType: record.photoType,
      vehicleIndex: record.vehicleIndex,
      photoIndex: record.photoIndex,
      seqNo: record.seqNo,
      label: record.label,
      quality: {
        level: quality.level,
        reasons: quality.reasons.slice(),
        suggestRetake: quality.suggestRetake,
        analyzedAt: quality.analyzedAt,
        configVersion: quality.configVersion
      }
    })
  })

  const riskReasons = Object.keys(riskReasonCounts).sort((left, right) => {
    if (riskReasonCounts[right] !== riskReasonCounts[left]) {
      return riskReasonCounts[right] - riskReasonCounts[left]
    }

    return left.localeCompare(right)
  })

  return {
    totalPhotos: photoRecords.length,
    analyzedCount,
    riskCount: riskPhotos.length,
    suggestRetakeCount,
    riskReasons,
    riskReasonCounts,
    riskPhotos,
    failedCount,
    disabledCount,
    lowConfidenceCount,
    unanalyzedCount: Math.max(photoRecords.length - analyzedCount - disabledCount, 0)
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
    vehicleType: getVehicleDisplayName(vehicle),
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
  const auxPhotoEnabled = vehicleSummary.auxPhotoEnabled
  const hasNextVehicle = currentVehicleIndex < vehicleSummary.count - 1

  return {
    hasCache: !!cache,
    hasVehicles: vehicleSummary.count > 0,
    currentStep,
    currentVehicleIndex,
    currentVehicle,
    currentVehicleType: currentVehicle ? getVehicleDisplayName(currentVehicle) : constants.VEHICLE_TYPE.TARGET,
    auxPhotoEnabled,
    currentVehicleRoleName: currentVehicle ? currentVehicle.vehicleRoleName : constants.VEHICLE_TYPE.TARGET,
    currentVehiclePlateNo: currentVehicle ? currentVehicle.vehiclePlateNo : '',
    currentVehiclePlateTheme: currentVehicle ? currentVehicle.vehiclePlateTheme : 'unknown',
    currentVehicleProgressText: vehicleSummary.count > 1
      ? `${currentVehicleIndex + 1}/${vehicleSummary.count} 辆`
      : '',
    hasNextVehicle,
    nextVehicleIndex: hasNextVehicle ? currentVehicleIndex + 1 : null,
    finishDamageText: '完成本车拍摄',
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
  const sceneSummary = getSceneSummary(cache)
  const documentSummary = getDocumentSummary(cache)
  const flowContext = getCurrentFlowContext(cache)
  const qualitySummary = getQualitySummary(cache)
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
    scene: sceneSummary.count,
    ...vehicleSummary.photoCounts,
    document: (vehicleSummary.photoCounts.document || 0) + documentSummary.count
  }
  photoCounts.total = photoCounts.scene + photoCounts.licensePlate + photoCounts.vinCode + photoCounts.damage + photoCounts.document

  return {
    hasCache: !!cache,
    vehicles: vehicleSummary.vehicles,
    documents: documentSummary.documents,
    vehicleCount: vehicleSummary.count,
    scenePhotoCount: photoCounts.scene,
    damagePhotoCount: photoCounts.damage,
    documentCount: documentSummary.count,
    documentPhotoCount: photoCounts.document,
    photoCounts,
    totalPhotos: photoCounts.total,
    sceneSummary,
    moduleOneSummary: getModuleOneSummary(cache),
    allPhotos: sceneSummary.photoEntries.concat(vehicleSummary.photoEntries, documentSummary.photoEntries),
    albumSaveSummary: isPlainObject(cache && cache.albumSaveSummary)
      ? cache.albumSaveSummary
      : null,
    qualitySummary,
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
  getSceneSummary,
  getModuleOneSummary,
  getQualitySummary,
  getAlbumSaveCandidates,
  getCurrentFlowContext,
  hasRetakeContext
}
