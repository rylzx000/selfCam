const constants = require('./constants')

const CACHE_SCHEMA_VERSION = 1

const WORKFLOW_STATES = [
  'IDLE',
  'CAPTURING',
  'CONFIRMING',
  'PREVIEWING',
  'RETAKING',
  'DOCUMENTING',
  'LOCAL_COMPLETED'
]

const TRANSIENT_CONTEXT_MAX_AGE_MS = 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidIsoString(value) {
  if (!isNonEmptyString(value)) {
    return false
  }

  return Number.isFinite(new Date(value).getTime())
}

function isInteger(value) {
  return typeof value === 'number' && Number.isInteger(value)
}

function buildVehicleId(index) {
  return `vehicle_${Date.now()}_${index}`
}

function buildPendingPhotoSlot() {
  return {
    status: 'pending'
  }
}

function buildRetakeMode() {
  return {
    enabled: false,
    vehicleIndex: null,
    photoType: null,
    damageIndex: null
  }
}

function buildWorkflowState(currentOrUpdatedAt = nowIso(), maybeUpdatedAt) {
  if (WORKFLOW_STATES.indexOf(currentOrUpdatedAt) >= 0) {
    return {
      current: currentOrUpdatedAt,
      updatedAt: maybeUpdatedAt || nowIso()
    }
  }

  return {
    current: 'IDLE',
    updatedAt: currentOrUpdatedAt || nowIso()
  }
}

function getVehicleType(index) {
  if (index === 0) {
    return constants.VEHICLE_TYPE.TARGET
  }

  return `三者车${index}`
}

function createVehicle(index = 0) {
  return {
    id: buildVehicleId(index),
    type: getVehicleType(index),
    licensePlate: buildPendingPhotoSlot(),
    vinCode: buildPendingPhotoSlot(),
    damages: []
  }
}

function createCache() {
  const timestamp = nowIso()

  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    vehicles: [],
    documents: [],
    currentStep: constants.SHOOT_STEP.LICENSE_PLATE,
    currentVehicleIndex: 0,
    currentDamageCount: 0,
    retakeMode: buildRetakeMode(),
    workflowState: buildWorkflowState(timestamp),
    fromPreview: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function normalizePhotoMeta(photo = {}, meta = {}) {
  return {
    ...photo,
    captureMode: meta.captureMode || photo.captureMode || 'manual',
    captureTrigger: meta.captureTrigger || photo.captureTrigger || 'manual_button',
    aiDetection: isPlainObject(meta.aiDetection)
      ? meta.aiDetection
      : isPlainObject(photo.aiDetection)
        ? photo.aiDetection
        : null
  }
}

function sanitizeTimestamp(value, fallbackValue, tracker, issueCode) {
  if (isValidIsoString(value)) {
    return value
  }

  markIssue(tracker, issueCode)
  return fallbackValue
}

function sanitizePhotoStep(step) {
  return [
    constants.PHOTO_TYPE.LICENSE_PLATE,
    constants.PHOTO_TYPE.VIN_CODE,
    constants.PHOTO_TYPE.DAMAGE
  ].indexOf(step) >= 0
}

function isValidCurrentStep(step) {
  return [
    constants.SHOOT_STEP.LICENSE_PLATE,
    constants.SHOOT_STEP.VIN_CODE,
    constants.SHOOT_STEP.DAMAGE,
    constants.SHOOT_STEP.PREVIEW
  ].indexOf(step) >= 0
}

function markIssue(tracker, issueCode) {
  if (!tracker || !issueCode) {
    return
  }

  if (tracker.issues.indexOf(issueCode) < 0) {
    tracker.issues.push(issueCode)
  }

  tracker.changed = true
}

function createTracker() {
  return {
    changed: false,
    issues: []
  }
}

function parseTimestamp(value) {
  if (!isNonEmptyString(value)) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function cloneCache(cache) {
  if (!isPlainObject(cache)) {
    return createCache()
  }

  try {
    return JSON.parse(JSON.stringify(cache))
  } catch (error) {
    return createCache()
  }
}

function getWorkflowStateValue(cache) {
  if (!cache) {
    return 'IDLE'
  }

  if (typeof cache.workflowState === 'string') {
    return WORKFLOW_STATES.indexOf(cache.workflowState) >= 0
      ? cache.workflowState
      : 'IDLE'
  }

  return isPlainObject(cache.workflowState) && WORKFLOW_STATES.indexOf(cache.workflowState.current) >= 0
    ? cache.workflowState.current
    : 'IDLE'
}

function isShootStep(step) {
  return [
    constants.SHOOT_STEP.LICENSE_PLATE,
    constants.SHOOT_STEP.VIN_CODE,
    constants.SHOOT_STEP.DAMAGE
  ].indexOf(step) >= 0
}

function hasVehicles(cache) {
  return !!cache && Array.isArray(cache.vehicles) && cache.vehicles.length > 0
}

function hasDocuments(cache) {
  return !!cache && Array.isArray(cache.documents) && cache.documents.length > 0
}

function hasRecoveryData(cache) {
  return hasVehicles(cache) || hasDocuments(cache)
}

function getLatestContextTimestamp(cache) {
  if (!cache) {
    return 0
  }

  const cacheUpdatedAt = parseTimestamp(cache.updatedAt)
  const workflowUpdatedAt = parseTimestamp(cache.workflowState && cache.workflowState.updatedAt)

  return Math.max(cacheUpdatedAt, workflowUpdatedAt) || parseTimestamp(cache.createdAt)
}

function isContextFresh(cache, maxAgeMs = TRANSIENT_CONTEXT_MAX_AGE_MS) {
  const contextTimestamp = getLatestContextTimestamp(cache)

  if (!contextTimestamp) {
    return false
  }

  return (Date.now() - contextTimestamp) <= maxAgeMs
}

function setWorkflowState(cache, nextState, updatedAt = nowIso()) {
  cache.workflowState = buildWorkflowState(nextState, updatedAt)
  return cache
}

function clearRetakeContextInPlace(cache) {
  cache.retakeMode = buildRetakeMode()
  return cache
}

function clearPreviewFlagsInPlace(cache) {
  cache.fromPreview = false
  return cache
}

function alignMidContext(cache) {
  cache.currentVehicleIndex = sanitizeCurrentVehicleIndex(cache.currentVehicleIndex, cache.vehicles, null)
  cache.currentDamageCount = sanitizeCurrentDamageCount(
    cache.currentDamageCount,
    cache.vehicles[cache.currentVehicleIndex] || null,
    null
  )
  return cache
}

function moveToIdleState(cache) {
  clearRetakeContextInPlace(cache)
  clearPreviewFlagsInPlace(cache)
  cache.currentVehicleIndex = 0
  cache.currentDamageCount = 0
  cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
  setWorkflowState(cache, 'IDLE')
  return cache
}

function moveToPreviewState(cache, workflowState = 'PREVIEWING') {
  clearRetakeContextInPlace(cache)
  clearPreviewFlagsInPlace(cache)
  alignMidContext(cache)
  cache.currentStep = constants.SHOOT_STEP.PREVIEW
  setWorkflowState(cache, workflowState)
  return cache
}

function moveToCapturingState(cache) {
  clearRetakeContextInPlace(cache)
  clearPreviewFlagsInPlace(cache)
  alignMidContext(cache)

  const currentVehicle = cache.vehicles[cache.currentVehicleIndex] || null
  cache.currentStep = isShootStep(cache.currentStep)
    ? cache.currentStep
    : inferStepFromVehicle(currentVehicle)
  setWorkflowState(cache, 'CAPTURING')
  return cache
}

function areCachesEqual(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch (error) {
    return false
  }
}

function sanitizeCaptureSlot(slot, tracker, issueCode) {
  if (!isPlainObject(slot)) {
    markIssue(tracker, issueCode)
    return buildPendingPhotoSlot()
  }

  const hasCompressedPath = isNonEmptyString(slot.compressedPath)
  if (hasCompressedPath) {
    if (slot.status !== 'completed') {
      markIssue(tracker, issueCode)
    }

    return {
      ...normalizePhotoMeta(slot),
      status: 'completed'
    }
  }

  if (slot.status !== 'pending') {
    markIssue(tracker, issueCode)
  }

  return buildPendingPhotoSlot()
}

function sanitizeAttachment(record, tracker, issueCode) {
  if (!isPlainObject(record) || !isNonEmptyString(record.compressedPath)) {
    markIssue(tracker, issueCode)
    return null
  }

  return normalizePhotoMeta(record)
}

function sanitizeVehicle(vehicle, index, tracker) {
  if (!isPlainObject(vehicle)) {
    markIssue(tracker, 'vehicle_invalid')
    return null
  }

  const damages = Array.isArray(vehicle.damages)
    ? vehicle.damages
      .map((item) => sanitizeAttachment(item, tracker, 'vehicle_damage_invalid'))
      .filter(Boolean)
    : []

  if (!Array.isArray(vehicle.damages)) {
    markIssue(tracker, 'vehicle_damages_invalid')
  }

  if (!isNonEmptyString(vehicle.id)) {
    markIssue(tracker, 'vehicle_id_invalid')
  }

  if (!isNonEmptyString(vehicle.type)) {
    markIssue(tracker, 'vehicle_type_invalid')
  }

  return {
    ...vehicle,
    id: isNonEmptyString(vehicle.id) ? vehicle.id : buildVehicleId(index),
    type: isNonEmptyString(vehicle.type) ? vehicle.type : getVehicleType(index),
    licensePlate: sanitizeCaptureSlot(vehicle.licensePlate, tracker, 'vehicle_license_invalid'),
    vinCode: sanitizeCaptureSlot(vehicle.vinCode, tracker, 'vehicle_vin_invalid'),
    damages
  }
}

function inferStepFromVehicle(vehicle) {
  if (!vehicle || vehicle.licensePlate.status !== 'completed') {
    return constants.SHOOT_STEP.LICENSE_PLATE
  }

  if (vehicle.vinCode.status !== 'completed') {
    return constants.SHOOT_STEP.VIN_CODE
  }

  return constants.SHOOT_STEP.DAMAGE
}

function sanitizeWorkflowState(workflowState, updatedAt, tracker) {
  if (typeof workflowState === 'string') {
    if (WORKFLOW_STATES.indexOf(workflowState) >= 0) {
      markIssue(tracker, 'workflow_state_legacy_string')
      return {
        current: workflowState,
        updatedAt
      }
    }

    markIssue(tracker, 'workflow_state_invalid')
    return buildWorkflowState(updatedAt)
  }

  if (!isPlainObject(workflowState)) {
    markIssue(tracker, 'workflow_state_invalid')
    return buildWorkflowState(updatedAt)
  }

  const nextState = WORKFLOW_STATES.indexOf(workflowState.current) >= 0
    ? workflowState.current
    : 'IDLE'
  const nextUpdatedAt = isValidIsoString(workflowState.updatedAt)
    ? workflowState.updatedAt
    : updatedAt

  if (workflowState.current !== nextState || workflowState.updatedAt !== nextUpdatedAt) {
    markIssue(tracker, 'workflow_state_invalid')
  }

  return {
    current: nextState,
    updatedAt: nextUpdatedAt
  }
}

function sanitizeRetakeMode(retakeMode, vehicles, tracker) {
  if (!isPlainObject(retakeMode)) {
    markIssue(tracker, 'retake_mode_invalid')
    return buildRetakeMode()
  }

  const enabled = retakeMode.enabled === true

  if (!enabled) {
    if (retakeMode.enabled !== false) {
      markIssue(tracker, 'retake_mode_invalid')
    }

    return buildRetakeMode()
  }

  const vehicleIndex = isInteger(retakeMode.vehicleIndex) ? retakeMode.vehicleIndex : null
  const photoType = sanitizePhotoStep(retakeMode.photoType) ? retakeMode.photoType : null

  if (vehicleIndex === null || !vehicles[vehicleIndex] || !photoType) {
    markIssue(tracker, 'retake_mode_invalid')
    return buildRetakeMode()
  }

  if (photoType === constants.PHOTO_TYPE.DAMAGE) {
    const damageIndex = isInteger(retakeMode.damageIndex) ? retakeMode.damageIndex : null
    if (damageIndex === null || !vehicles[vehicleIndex].damages[damageIndex]) {
      markIssue(tracker, 'retake_mode_invalid')
      return buildRetakeMode()
    }

    return {
      enabled: true,
      vehicleIndex,
      photoType,
      damageIndex
    }
  }

  return {
    enabled: true,
    vehicleIndex,
    photoType,
    damageIndex: null
  }
}

function sanitizeCurrentVehicleIndex(currentVehicleIndex, vehicles, tracker) {
  if (vehicles.length === 0) {
    if (currentVehicleIndex !== 0) {
      markIssue(tracker, 'current_vehicle_index_invalid')
    }

    return 0
  }

  if (!isInteger(currentVehicleIndex)) {
    markIssue(tracker, 'current_vehicle_index_invalid')
    return 0
  }

  if (currentVehicleIndex < 0) {
    markIssue(tracker, 'current_vehicle_index_invalid')
    return 0
  }

  if (currentVehicleIndex >= vehicles.length) {
    markIssue(tracker, 'current_vehicle_index_invalid')
    return vehicles.length - 1
  }

  return currentVehicleIndex
}

function sanitizeCurrentStep(currentStep, currentVehicle, retakeMode, tracker) {
  if (retakeMode.enabled) {
    if (currentStep !== retakeMode.photoType) {
      markIssue(tracker, 'current_step_aligned_to_retake')
    }

    return retakeMode.photoType
  }

  if (isValidCurrentStep(currentStep)) {
    return currentStep
  }

  markIssue(tracker, 'current_step_invalid')
  return inferStepFromVehicle(currentVehicle)
}

function sanitizeCurrentDamageCount(currentDamageCount, currentVehicle, tracker) {
  const safeDamageCount = currentVehicle && Array.isArray(currentVehicle.damages)
    ? currentVehicle.damages.length
    : 0

  if (!isInteger(currentDamageCount) || currentDamageCount < 0 || currentDamageCount !== safeDamageCount) {
    markIssue(tracker, 'current_damage_count_invalid')
    return safeDamageCount
  }

  return currentDamageCount
}

function clearRetakeContext(cache) {
  const nextCache = cloneCache(cache)
  clearRetakeContextInPlace(nextCache)
  return sanitizeCache(nextCache)
}

function clearPreviewFlags(cache) {
  const nextCache = cloneCache(cache)
  clearPreviewFlagsInPlace(nextCache)
  return sanitizeCache(nextCache)
}

function clearCompletionContext(cache) {
  const nextCache = cloneCache(cache)

  if (hasVehicles(nextCache)) {
    moveToPreviewState(nextCache)
  } else {
    moveToIdleState(nextCache)
  }

  return sanitizeCache(nextCache)
}

function clearTransientContext(cache) {
  const nextCache = cloneCache(cache)
  const workflowState = getWorkflowStateValue(nextCache)

  if (!hasRecoveryData(nextCache)) {
    moveToIdleState(nextCache)
    return sanitizeCache(nextCache)
  }

  if (workflowState === 'LOCAL_COMPLETED' || nextCache.currentStep === constants.SHOOT_STEP.PREVIEW) {
    moveToPreviewState(nextCache)
    return sanitizeCache(nextCache)
  }

  if (hasVehicles(nextCache) && isShootStep(nextCache.currentStep)) {
    moveToCapturingState(nextCache)
    return sanitizeCache(nextCache)
  }

  moveToPreviewState(nextCache)
  return sanitizeCache(nextCache)
}

function resolveSafeResumeCache(cache) {
  const repaired = repairCache(cache)
  const baseCache = repaired.cache
  const nextCache = cloneCache(baseCache)
  const reasons = repaired.fatal
    ? ['fatal_cache_reset']
    : []

  const workflowState = getWorkflowStateValue(nextCache)
  const freshContext = isContextFresh(nextCache)

  if (!hasRecoveryData(nextCache)) {
    moveToIdleState(nextCache)
    if (reasons.indexOf('missing_recovery_context') < 0) {
      reasons.push('missing_recovery_context')
    }
  } else if (workflowState === 'LOCAL_COMPLETED' && !freshContext) {
    moveToPreviewState(nextCache)
    reasons.push('stale_completion_context')
  } else if (nextCache.retakeMode && nextCache.retakeMode.enabled && !freshContext) {
    moveToPreviewState(nextCache)
    reasons.push('stale_retake_context')
  } else if (nextCache.retakeMode && nextCache.retakeMode.enabled) {
    nextCache.currentVehicleIndex = nextCache.retakeMode.vehicleIndex
    alignMidContext(nextCache)
    nextCache.currentStep = nextCache.retakeMode.photoType
    setWorkflowState(nextCache, 'RETAKING', nextCache.workflowState && nextCache.workflowState.updatedAt)
  } else if (nextCache.fromPreview && !freshContext) {
    if (isShootStep(nextCache.currentStep) && hasVehicles(nextCache)) {
      moveToCapturingState(nextCache)
    } else {
      moveToPreviewState(nextCache)
    }
    reasons.push('stale_preview_flag')
  } else if (workflowState === 'DOCUMENTING' && !freshContext) {
    moveToPreviewState(nextCache)
    reasons.push('stale_document_context')
  } else if (workflowState === 'RETAKING' && !(nextCache.retakeMode && nextCache.retakeMode.enabled)) {
    moveToPreviewState(nextCache)
    reasons.push('retake_state_without_context')
  } else if (workflowState === 'CONFIRMING') {
    if (isShootStep(nextCache.currentStep) && hasVehicles(nextCache)) {
      moveToCapturingState(nextCache)
    } else {
      moveToPreviewState(nextCache)
    }
    reasons.push('confirming_state_cleared')
  } else if (workflowState === 'LOCAL_COMPLETED') {
    clearRetakeContextInPlace(nextCache)
    clearPreviewFlagsInPlace(nextCache)
    alignMidContext(nextCache)
    nextCache.currentStep = constants.SHOOT_STEP.PREVIEW
  } else if (workflowState === 'PREVIEWING' || nextCache.currentStep === constants.SHOOT_STEP.PREVIEW) {
    clearRetakeContextInPlace(nextCache)
    clearPreviewFlagsInPlace(nextCache)
    alignMidContext(nextCache)
    nextCache.currentStep = constants.SHOOT_STEP.PREVIEW
    setWorkflowState(nextCache, 'PREVIEWING', nextCache.workflowState && nextCache.workflowState.updatedAt)
  } else if (workflowState === 'DOCUMENTING' && hasDocuments(nextCache) && freshContext) {
    clearRetakeContextInPlace(nextCache)
    clearPreviewFlagsInPlace(nextCache)
    alignMidContext(nextCache)
  } else if (hasVehicles(nextCache) && isShootStep(nextCache.currentStep)) {
    clearRetakeContextInPlace(nextCache)
    clearPreviewFlagsInPlace(nextCache)
    alignMidContext(nextCache)
    setWorkflowState(nextCache, 'CAPTURING', nextCache.workflowState && nextCache.workflowState.updatedAt)
  } else {
    moveToPreviewState(nextCache)
    reasons.push('fallback_to_preview')
  }

  const safeCache = sanitizeCache(nextCache)

  return {
    cache: safeCache,
    changed: reasons.length > 0 || !areCachesEqual(baseCache, safeCache),
    reasons
  }
}

function getSafeResumeCache(cache) {
  return resolveSafeResumeCache(cache).cache
}

function migrateCache(oldCache) {
  if (!isPlainObject(oldCache)) {
    return createCache()
  }

  const migrated = {
    ...oldCache
  }

  const rawVersion = Number(oldCache.schemaVersion)
  const sourceVersion = Number.isFinite(rawVersion) ? rawVersion : 0

  if (sourceVersion < 1) {
    if (typeof oldCache.workflowState === 'string') {
      migrated.workflowState = {
        current: oldCache.workflowState,
        updatedAt: oldCache.updatedAt || nowIso()
      }
    }

    if (!isPlainObject(oldCache.retakeMode)) {
      migrated.retakeMode = buildRetakeMode()
    }
  }

  migrated.schemaVersion = CACHE_SCHEMA_VERSION
  return migrated
}

function sanitizeCache(cache) {
  const repair = repairCache(cache)
  return repair.cache
}

function validateCache(cache) {
  if (!isPlainObject(cache)) {
    return {
      valid: false,
      fatal: true,
      issues: ['cache_not_object']
    }
  }

  const issues = []

  if (cache.schemaVersion !== CACHE_SCHEMA_VERSION) {
    issues.push('schema_version_invalid')
  }

  if (!Array.isArray(cache.vehicles)) {
    issues.push('vehicles_invalid')
  }

  if (Array.isArray(cache.vehicles) && cache.vehicles.some((vehicle) => !isPlainObject(vehicle))) {
    issues.push('vehicles_invalid')
  }

  if (!Array.isArray(cache.documents)) {
    issues.push('documents_invalid')
  }

  if (Array.isArray(cache.documents) && cache.documents.some((document) => !isPlainObject(document))) {
    issues.push('documents_invalid')
  }

  if (!isValidCurrentStep(cache.currentStep)) {
    issues.push('current_step_invalid')
  }

  if (!isInteger(cache.currentVehicleIndex) || cache.currentVehicleIndex < 0) {
    issues.push('current_vehicle_index_invalid')
  }

  if (Array.isArray(cache.vehicles) && cache.vehicles.length > 0 && cache.currentVehicleIndex >= cache.vehicles.length) {
    issues.push('current_vehicle_index_invalid')
  }

  if (!isInteger(cache.currentDamageCount) || cache.currentDamageCount < 0) {
    issues.push('current_damage_count_invalid')
  }

  if (!isValidIsoString(cache.createdAt)) {
    issues.push('created_at_invalid')
  }

  if (!isValidIsoString(cache.updatedAt)) {
    issues.push('updated_at_invalid')
  }

  if (!isPlainObject(cache.retakeMode) || typeof cache.retakeMode.enabled !== 'boolean') {
    issues.push('retake_mode_invalid')
  } else if (cache.retakeMode.enabled) {
    if (!isInteger(cache.retakeMode.vehicleIndex) || !Array.isArray(cache.vehicles) || !cache.vehicles[cache.retakeMode.vehicleIndex]) {
      issues.push('retake_mode_invalid')
    }

    if (!sanitizePhotoStep(cache.retakeMode.photoType)) {
      issues.push('retake_mode_invalid')
    }

    if (
      cache.retakeMode.photoType === constants.PHOTO_TYPE.DAMAGE
      && (!isInteger(cache.retakeMode.damageIndex)
        || !cache.vehicles[cache.retakeMode.vehicleIndex]
        || !cache.vehicles[cache.retakeMode.vehicleIndex].damages
        || !cache.vehicles[cache.retakeMode.vehicleIndex].damages[cache.retakeMode.damageIndex])
    ) {
      issues.push('retake_mode_invalid')
    }
  }

  if (
    !isPlainObject(cache.workflowState)
    || WORKFLOW_STATES.indexOf(cache.workflowState.current) < 0
    || !isValidIsoString(cache.workflowState.updatedAt)
  ) {
    issues.push('workflow_state_invalid')
  }

  return {
    valid: issues.length === 0,
    fatal: false,
    issues
  }
}

function repairCache(cache) {
  if (!isPlainObject(cache)) {
    return {
      cache: createCache(),
      changed: true,
      fatal: true,
      issues: ['cache_not_object']
    }
  }

  const tracker = createTracker()
  const migrated = migrateCache(cache)

  if (Number(cache.schemaVersion) !== CACHE_SCHEMA_VERSION) {
    markIssue(tracker, 'schema_version_migrated')
  }

  const fallbackCache = createCache()
  const createdAt = sanitizeTimestamp(migrated.createdAt, fallbackCache.createdAt, tracker, 'created_at_invalid')
  const updatedAt = sanitizeTimestamp(
    migrated.updatedAt,
    isValidIsoString(createdAt) ? createdAt : fallbackCache.updatedAt,
    tracker,
    'updated_at_invalid'
  )

  const vehicles = Array.isArray(migrated.vehicles)
    ? migrated.vehicles
      .map((item, index) => sanitizeVehicle(item, index, tracker))
      .filter(Boolean)
    : []

  if (!Array.isArray(migrated.vehicles)) {
    markIssue(tracker, 'vehicles_invalid')
  }

  const documents = Array.isArray(migrated.documents)
    ? migrated.documents
      .map((item) => sanitizeAttachment(item, tracker, 'document_invalid'))
      .filter(Boolean)
    : []

  if (!Array.isArray(migrated.documents)) {
    markIssue(tracker, 'documents_invalid')
  }

  let currentVehicleIndex = sanitizeCurrentVehicleIndex(migrated.currentVehicleIndex, vehicles, tracker)
  let retakeMode = sanitizeRetakeMode(migrated.retakeMode, vehicles, tracker)

  if (retakeMode.enabled && currentVehicleIndex !== retakeMode.vehicleIndex) {
    markIssue(tracker, 'current_vehicle_index_aligned_to_retake')
    currentVehicleIndex = retakeMode.vehicleIndex
  }

  const currentVehicle = vehicles[currentVehicleIndex] || null
  const currentStep = sanitizeCurrentStep(migrated.currentStep, currentVehicle, retakeMode, tracker)
  const currentDamageCount = sanitizeCurrentDamageCount(migrated.currentDamageCount, currentVehicle, tracker)
  const workflowState = sanitizeWorkflowState(migrated.workflowState, updatedAt, tracker)
  const fromPreview = typeof migrated.fromPreview === 'boolean' ? migrated.fromPreview : false

  if (typeof migrated.fromPreview !== 'boolean') {
    markIssue(tracker, 'from_preview_invalid')
  }

  const repairedCache = {
    ...migrated,
    schemaVersion: CACHE_SCHEMA_VERSION,
    vehicles,
    documents,
    currentStep,
    currentVehicleIndex,
    currentDamageCount,
    retakeMode,
    workflowState,
    fromPreview,
    createdAt,
    updatedAt
  }

  const finalValidation = validateCache(repairedCache)

  if (!finalValidation.valid) {
    return {
      cache: createCache(),
      changed: true,
      fatal: true,
      issues: tracker.issues.concat(finalValidation.issues)
    }
  }

  return {
    cache: repairedCache,
    changed: tracker.changed,
    fatal: false,
    issues: tracker.issues
  }
}

module.exports = {
  CACHE_SCHEMA_VERSION,
  TRANSIENT_CONTEXT_MAX_AGE_MS,
  createCache,
  createVehicle,
  getVehicleType,
  normalizePhotoMeta,
  validateCache,
  sanitizeCache,
  migrateCache,
  repairCache,
  clearRetakeContext,
  clearPreviewFlags,
  clearCompletionContext,
  clearTransientContext,
  getSafeResumeCache,
  resolveSafeResumeCache
}
