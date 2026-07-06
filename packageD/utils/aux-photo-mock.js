const PHOTO_TYPES = {
  LICENSE_PLATE: 'LICENSE_PLATE',
  VIN: 'VIN',
  DAMAGE: 'DAMAGE',
  DRIVER_LICENSE_FRONT: 'DRIVER_LICENSE_FRONT',
  DRIVER_LICENSE_BACK: 'DRIVER_LICENSE_BACK',
  DRIVER_LICENSE_ELECTRONIC: 'DRIVER_LICENSE_ELECTRONIC',
  DRIVING_LICENSE_FRONT: 'DRIVING_LICENSE_FRONT',
  DRIVING_LICENSE_BACK: 'DRIVING_LICENSE_BACK',
  DRIVING_LICENSE_ELECTRONIC: 'DRIVING_LICENSE_ELECTRONIC'
}

const MOCK_VEHICLES = [
  {
    vehicleId: 'MOCK_LOSS_VEHICLE_100001',
    vehicleRole: 'INSURED',
    vehicleRoleName: '标的车',
    licenseNo: '京A12345',
    plateColor: 'blue',
    energyType: 'FUEL'
  },
  {
    vehicleId: 'MOCK_LOSS_VEHICLE_100002',
    vehicleRole: 'THIRD_PARTY',
    vehicleRoleName: '三者车',
    licenseNo: '京B12345',
    plateColor: 'blue',
    energyType: 'FUEL'
  },
  {
    vehicleId: 'MOCK_LOSS_VEHICLE_100003',
    vehicleRole: 'THIRD_PARTY',
    vehicleRoleName: '三者车',
    licenseNo: '京AD12345',
    plateColor: 'green',
    energyType: 'ELECTRIC'
  }
]

function isMockTicket(ticket) {
  return typeof ticket === 'string' && /^mock(?:-|$)/i.test(ticket.trim())
}

function getMockVehicleCount(ticket) {
  const normalized = typeof ticket === 'string' ? ticket.trim().toLowerCase() : ''
  const match = normalized.match(/^mock-(\d)$/)
  if (!match) {
    return 1
  }

  return Math.max(1, Math.min(Number(match[1]), MOCK_VEHICLES.length))
}

function buildUploadItem(vehicleId, photoType, photoName, maxCount, required = false) {
  return {
    uploadItemId: `${vehicleId}_${photoType}`,
    photoType,
    photoName,
    required,
    maxCount,
    uploadedCount: 0
  }
}

function buildMockVehicle(baseVehicle) {
  const { vehicleId } = baseVehicle

  return {
    ...baseVehicle,
    uploadItems: [
      buildUploadItem(vehicleId, PHOTO_TYPES.LICENSE_PLATE, '车牌', 1, false),
      buildUploadItem(vehicleId, PHOTO_TYPES.VIN, 'VIN', 1, false),
      buildUploadItem(vehicleId, PHOTO_TYPES.DAMAGE, '车损', 10, true),
      buildUploadItem(vehicleId, PHOTO_TYPES.DRIVER_LICENSE_FRONT, '驾驶证正页', 1, false),
      buildUploadItem(vehicleId, PHOTO_TYPES.DRIVER_LICENSE_BACK, '驾驶证副页', 1, false),
      buildUploadItem(vehicleId, PHOTO_TYPES.DRIVER_LICENSE_ELECTRONIC, '电子驾驶证', 1, false),
      buildUploadItem(vehicleId, PHOTO_TYPES.DRIVING_LICENSE_FRONT, '行驶证正页', 1, false),
      buildUploadItem(vehicleId, PHOTO_TYPES.DRIVING_LICENSE_BACK, '行驶证副页', 1, false),
      buildUploadItem(vehicleId, PHOTO_TYPES.DRIVING_LICENSE_ELECTRONIC, '电子行驶证', 1, false)
    ]
  }
}

function buildMockInitResponse(ticket) {
  const vehicleCount = getMockVehicleCount(ticket)

  return {
    success: true,
    code: '0000',
    message: '初始化成功',
    data: {
      ticket,
      ticketStatus: 'OPENED',
      registNo: 'MOCK_REGIST_NO',
      expireTime: '2099-12-31 23:59:59',
      vehicles: MOCK_VEHICLES.slice(0, vehicleCount).map(buildMockVehicle)
    }
  }
}

module.exports = {
  PHOTO_TYPES,
  isMockTicket,
  buildMockInitResponse
}
