const storage = require('./storage')
const constants = require('./constants')

const STATES = {
  IDLE: 'IDLE',
  CAPTURING: 'CAPTURING',
  CONFIRMING: 'CONFIRMING',
  PREVIEWING: 'PREVIEWING',
  RETAKING: 'RETAKING',
  DOCUMENTING: 'DOCUMENTING',
  LOCAL_COMPLETED: 'LOCAL_COMPLETED'
}

const STATE_VALUES = Object.keys(STATES).map((key) => STATES[key])
const STABLE_CHECKPOINT_STATES = [
  STATES.PREVIEWING
]
const NON_PERSISTED_STATES = [
  STATES.CONFIRMING
]

const ALLOWED_TRANSITIONS = {
  [STATES.IDLE]: [STATES.CAPTURING],
  [STATES.CAPTURING]: [
    STATES.CONFIRMING,
    STATES.PREVIEWING,
    STATES.RETAKING,
    STATES.IDLE
  ],
  [STATES.CONFIRMING]: [
    STATES.CAPTURING,
    STATES.PREVIEWING,
    STATES.RETAKING
  ],
  [STATES.PREVIEWING]: [
    STATES.CAPTURING,
    STATES.RETAKING,
    STATES.DOCUMENTING,
    STATES.LOCAL_COMPLETED,
    STATES.IDLE
  ],
  [STATES.RETAKING]: [
    STATES.PREVIEWING,
    STATES.CAPTURING,
    STATES.CONFIRMING
  ],
  [STATES.DOCUMENTING]: [
    STATES.PREVIEWING,
    STATES.LOCAL_COMPLETED,
    STATES.IDLE
  ],
  [STATES.LOCAL_COMPLETED]: [
    STATES.PREVIEWING,
    STATES.IDLE
  ]
}

function isKnownState(state) {
  return STATE_VALUES.indexOf(state) >= 0
}

function isStableCheckpointState(state) {
  return STABLE_CHECKPOINT_STATES.indexOf(state) >= 0
}

function shouldPersistState(state) {
  return NON_PERSISTED_STATES.indexOf(state) < 0
}

function parseTimestamp(value) {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getStoredState(cache) {
  if (!cache) {
    return ''
  }
  if (typeof cache.workflowState === 'string') {
    return cache.workflowState
  }
  return cache.workflowState && cache.workflowState.current
}

function hasActiveVehicle(cache) {
  return !!cache && Array.isArray(cache.vehicles) && cache.vehicles.length > 0
}

function isShootStep(step) {
  return [
    constants.SHOOT_STEP.LICENSE_PLATE,
    constants.SHOOT_STEP.VIN_CODE,
    constants.SHOOT_STEP.DAMAGE
  ].indexOf(step) >= 0
}

function isFreshCheckpoint(cache) {
  if (!cache || !cache.workflowState) {
    return false
  }

  const workflowUpdatedAt = parseTimestamp(cache.workflowState.updatedAt)
  const cacheUpdatedAt = parseTimestamp(cache.updatedAt)

  if (!workflowUpdatedAt || !cacheUpdatedAt) {
    return false
  }

  return Math.abs(cacheUpdatedAt - workflowUpdatedAt) <= 5000
}

function canRestoreAuxiliaryState(cache, storedState) {
  if (!isFreshCheckpoint(cache)) {
    return false
  }

  if (storedState === STATES.DOCUMENTING) {
    return Array.isArray(cache.documents) && cache.documents.length > 0
  }

  return false
}

function inferStateFromCache(cache) {
  if (!hasActiveVehicle(cache)) {
    return STATES.IDLE
  }

  if (cache.retakeMode && cache.retakeMode.enabled) {
    return STATES.RETAKING
  }

  const storedState = getStoredState(cache)
  const currentStep = cache.currentStep
  const leavingPreviewForCamera = !!cache.fromPreview && isShootStep(currentStep)

  if (leavingPreviewForCamera) {
    return STATES.CAPTURING
  }

  if (isStableCheckpointState(storedState)) {
    return storedState
  }

  if (canRestoreAuxiliaryState(cache, storedState)) {
    return storedState
  }

  if (currentStep === constants.SHOOT_STEP.PREVIEW) {
    return STATES.PREVIEWING
  }

  if (isShootStep(currentStep)) {
    return STATES.CAPTURING
  }

  if (storedState === STATES.RETAKING) {
    return STATES.RETAKING
  }

  return STATES.IDLE
}

function getCurrentState(cache) {
  const currentCache = cache || storage.loadCache()
  return inferStateFromCache(currentCache)
}

function canTransition(fromState, toState) {
  if (!isKnownState(fromState) || !isKnownState(toState)) {
    return false
  }
  if (fromState === toState) {
    return true
  }
  return (ALLOWED_TRANSITIONS[fromState] || []).indexOf(toState) >= 0
}

function safePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {}
  }

  try {
    return JSON.parse(JSON.stringify(payload))
  } catch (error) {
    return {}
  }
}

function logWorkflow(level, event, payload) {
  try {
    const runtimeLogger = require('./runtime-logger')
    runtimeLogger[level]('workflow', event, payload)
  } catch (error) {
    const logger = level === 'warn' ? console.warn : console.log
    logger('[workflow]', event, payload, error)
  }
}

function buildStoredWorkflowState(nextState) {
  return {
    current: nextState,
    updatedAt: new Date().toISOString()
  }
}

function transitionTo(nextState, payload = {}) {
  if (!isKnownState(nextState)) {
    const currentState = getCurrentState()
    logWorkflow('warn', 'unknown_state', {
      currentState,
      nextState,
      payload: safePayload(payload)
    })
    return {
      ok: false,
      state: currentState,
      previousState: currentState,
      reason: 'UNKNOWN_STATE'
    }
  }

  const cache = storage.loadCache()
  const currentState = inferStateFromCache(cache)

  if (!cache) {
    if (nextState !== STATES.IDLE) {
      logWorkflow('warn', 'missing_cache_transition', {
        currentState,
        nextState,
        payload: safePayload(payload)
      })
      return {
        ok: false,
        state: currentState,
        previousState: currentState,
        reason: 'MISSING_CACHE'
      }
    }

    return {
      ok: true,
      state: STATES.IDLE,
      previousState: currentState
    }
  }

  if (!canTransition(currentState, nextState)) {
    logWorkflow('warn', 'illegal_transition', {
      currentState,
      nextState,
      payload: safePayload(payload)
    })
    return {
      ok: false,
      state: currentState,
      previousState: currentState,
      reason: 'ILLEGAL_TRANSITION'
    }
  }

  if (shouldPersistState(nextState)) {
    cache.workflowState = buildStoredWorkflowState(nextState)
    storage.saveCache(cache)
  }

  logWorkflow('info', 'transition', {
    currentState,
    nextState,
    payload: safePayload(payload)
  })

  return {
    ok: true,
    state: nextState,
    previousState: currentState
  }
}

module.exports = {
  STATES,
  getCurrentState,
  transitionTo,
  canTransition,
  inferStateFromCache
}
