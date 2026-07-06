describe('aux-photo mapper', () => {
  let storage
  let mapper

  beforeEach(() => {
    jest.resetModules()
    storage = require('../packageD/utils/storage')
    mapper = require('../packageD/utils/aux-photo-mapper')
  })

  test('maps init response vehicles into backend-controlled cache', () => {
    const responseData = {
      ticket: 'AUX202605220001',
      ticketStatus: 'OPENED',
      registNo: 'R202605220001',
      expireTime: '2026-05-23 10:00:00',
      vehicles: [
        {
          vehicleId: 'LOSS_VEHICLE_100001',
          vehicleRole: 'INSURED',
          vehicleRoleName: '标的车',
          licenseNo: '京A12345',
          uploadItems: [
            { uploadItemId: 'V1_PLATE', photoType: 'LICENSE_PLATE', photoName: '车牌', maxCount: 1, uploadedCount: 0 },
            { uploadItemId: 'V1_VIN', photoType: 'VIN', photoName: 'VIN', maxCount: 1, uploadedCount: 0 },
            { uploadItemId: 'V1_DAMAGE', photoType: 'DAMAGE', photoName: '车损', maxCount: 10, uploadedCount: 0 },
            { uploadItemId: 'V1_LICENSE_FRONT', photoType: 'DRIVING_LICENSE_FRONT', photoName: '行驶证正页', maxCount: 1, uploadedCount: 0 },
            { uploadItemId: 'V1_LICENSE_BACK', photoType: 'DRIVING_LICENSE_BACK', photoName: '行驶证副页', maxCount: 1, uploadedCount: 0 },
            { uploadItemId: 'V1_LICENSE_ELECTRONIC', photoType: 'DRIVING_LICENSE_ELECTRONIC', photoName: '电子行驶证', maxCount: 1, uploadedCount: 0 }
          ]
        },
        {
          vehicleId: 'LOSS_VEHICLE_100002',
          vehicleRole: 'THIRD_PARTY',
          vehicleRoleName: '三者车',
          licenseNo: '京B12345',
          plateColor: 'blue',
          energyType: 'FUEL',
          uploadItems: [
            { uploadItemId: 'V2_PLATE', photoType: 'LICENSE_PLATE', photoName: '车牌', maxCount: 1, uploadedCount: 0 },
            { uploadItemId: 'V2_VIN', photoType: 'VIN', photoName: 'VIN', maxCount: 1, uploadedCount: 0 },
            { uploadItemId: 'V2_DAMAGE', photoType: 'DAMAGE', photoName: '车损', maxCount: 10, uploadedCount: 0 }
          ]
        }
      ]
    }

    const cache = mapper.buildCacheFromInit(responseData)

    expect(cache.auxPhoto).toEqual(expect.objectContaining({
      enabled: true,
      ticket: 'AUX202605220001',
      ticketStatus: 'OPENED',
      registNo: 'R202605220001',
      expireTime: '2026-05-23 10:00:00'
    }))
    expect(cache.currentStep).toBe('scene45')
    expect(cache.scenePhotos).toEqual({
      scene45: { status: 'pending' },
      supplements: []
    })
    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.vehicles).toHaveLength(2)
    expect(cache.vehicles[0]).toEqual(expect.objectContaining({
      id: 'LOSS_VEHICLE_100001',
      type: '标的车',
      backendVehicleId: 'LOSS_VEHICLE_100001',
      vehicleId: 'LOSS_VEHICLE_100001',
      vehicleRole: 'INSURED',
      vehicleRoleName: '标的车',
      licenseNo: '京A12345',
      displayName: '标的车 京A12345'
    }))
    expect(cache.vehicles[0].uploadItemsByPhotoType.DRIVING_LICENSE_ELECTRONIC.uploadItemId).toBe('V1_LICENSE_ELECTRONIC')
    expect(cache.vehicles[1]).toEqual(expect.objectContaining({
      id: 'LOSS_VEHICLE_100002',
      type: '三者车',
      licenseNo: '京B12345',
      plateColor: 'blue',
      energyType: 'FUEL',
      displayName: '三者车 京B12345'
    }))
    expect(storage.validateCache(cache).valid).toBe(true)
  })

  test('preserves backend case-level scene upload item metadata when provided', () => {
    const cache = mapper.buildCacheFromInit({
      ticket: 'AUX202605220004',
      caseUploadItems: [
        { uploadItemId: 'CASE_SCENE_45', photoType: 'SCENE_45', photoName: '整车45度现场照片', maxCount: 1 },
        { uploadItemId: 'CASE_SCENE_SUPPLEMENT', photoType: 'SCENE_SUPPLEMENT', photoName: '现场补充照片', maxCount: 2 }
      ],
      vehicles: [
        {
          vehicleId: 'LOSS_VEHICLE_100001',
          vehicleRoleName: '标的车',
          uploadItems: []
        }
      ]
    })

    expect(cache.caseUploadItems).toHaveLength(2)
    expect(cache.caseUploadItemsByPhotoType.SCENE_45.uploadItemId).toBe('CASE_SCENE_45')
    expect(cache.caseUploadItemsByPhotoType.SCENE_SUPPLEMENT.maxCount).toBe(2)
    expect(cache.currentStep).toBe('scene45')
  })

  test('uses display fallback when license number is empty', () => {
    const cache = mapper.buildCacheFromInit({
      ticket: 'AUX202605220002',
      vehicles: [
        {
          vehicleId: 'LOSS_VEHICLE_EMPTY_LICENSE',
          vehicleRole: 'INSURED',
          vehicleRoleName: '标的车',
          licenseNo: '',
          uploadItems: []
        }
      ]
    })

    expect(cache.vehicles[0].displayName).toBe('标的车 车牌待确认')
  })
  test('maps legacy status field to normalized ticketStatus', () => {
    const cache = mapper.buildCacheFromInit({
      ticket: 'AUX202605220003',
      status: ' expired ',
      vehicles: []
    })

    expect(cache.auxPhoto.ticketStatus).toBe('EXPIRED')
  })
})
