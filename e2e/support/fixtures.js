const STORAGE_KEY = 'car_damage_photos_cache'

const SHOOT_STEP = {
  LICENSE_PLATE: 'licensePlate',
  VIN_CODE: 'vinCode',
  DAMAGE: 'damage',
  PREVIEW: 'preview'
}

function nowIso() {
  return new Date().toISOString()
}

function createPhoto(overrides = {}) {
  return {
    status: 'completed',
    tempFilePath: 'wxfile://tmp/original.jpg',
    compressedPath: 'wxfile://tmp/compressed.jpg',
    fileSize: 1234,
    captureMode: 'manual',
    captureTrigger: 'e2e',
    ...overrides
  }
}

function createVehicle(index = 0, overrides = {}) {
  return {
    id: `vehicle_e2e_${index}`,
    type: index === 0 ? '标的车' : `三者车${index}`,
    licensePlate: { status: 'pending' },
    vinCode: { status: 'pending' },
    damages: [],
    ...overrides
  }
}

function createCache(overrides = {}) {
  const timestamp = nowIso()

  return {
    schemaVersion: 1,
    vehicles: [],
    documents: [],
    currentStep: SHOOT_STEP.LICENSE_PLATE,
    currentVehicleIndex: 0,
    currentDamageCount: 0,
    retakeMode: {
      enabled: false,
      vehicleIndex: null,
      photoType: null,
      damageIndex: null
    },
    workflowState: {
      current: 'IDLE',
      updatedAt: timestamp
    },
    fromPreview: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  }
}

function createCompletedVehicleCache(overrides = {}) {
  const vehicle = createVehicle(0, {
    licensePlate: createPhoto({ recognizedText: '', isManualInput: true }),
    vinCode: createPhoto({ recognizedText: '', isManualInput: true }),
    damages: overrides.damages || []
  })

  return createCache({
    vehicles: [vehicle],
    currentStep: SHOOT_STEP.DAMAGE,
    workflowState: {
      current: 'CAPTURING',
      updatedAt: nowIso()
    },
    ...overrides
  })
}

module.exports = {
  STORAGE_KEY,
  SHOOT_STEP,
  createPhoto,
  createVehicle,
  createCache,
  createCompletedVehicleCache
}
