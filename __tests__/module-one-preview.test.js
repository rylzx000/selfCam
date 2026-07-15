describe('module one preview flow', () => {
  let storage
  let constants
  let pageConfig
  let memoryStorage

  function createPageInstance(config) {
    return {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      isLeaving: false,
      setData(updates, callback) {
        this.data = {
          ...this.data,
          ...updates
        }
        if (typeof callback === 'function') {
          callback()
        }
      }
    }
  }

  function loadPreviewPageWithCache(cache, options = {}) {
    storage.saveCache(cache)

    pageConfig = null
    jest.isolateModules(() => {
      require('../packageD/pages/preview/preview')
    })

    const page = createPageInstance(pageConfig)
    page.onLoad(options)
    return page
  }

  function buildModuleOneCache({ withScene45 = false, withSceneSupplement = false, withSecondVehicle = false, supplementCount = 0 } = {}) {
    const cache = storage.initCache()
    const vehicle = storage.createVehicle(0)
    vehicle.vehicleRoleName = '标的车'
    vehicle.licenseNo = '京A12345'
    vehicle.displayName = '标的车 京A12345'
    vehicle.licensePlate = {
      status: 'completed',
      compressedPath: '/plate.jpg'
    }
    vehicle.vinCode = {
      status: 'completed',
      compressedPath: '/vin.jpg'
    }
    cache.vehicles.push(vehicle)
    if (withSecondVehicle) {
      const secondVehicle = storage.createVehicle(1)
      secondVehicle.vehicleRoleName = '三者车'
      secondVehicle.licenseNo = '京B12345'
      secondVehicle.displayName = '三者车 京B12345'
      secondVehicle.licensePlate = {
        status: 'completed',
        compressedPath: '/third-plate.jpg'
      }
      secondVehicle.vinCode = {
        status: 'completed',
        compressedPath: '/third-vin.jpg'
      }
      cache.vehicles.push(secondVehicle)
    }
    cache.currentStep = constants.SHOOT_STEP.MODULE_ONE_PREVIEW
    if (withScene45) {
      cache.scenePhotos.scene45 = {
        status: 'completed',
        compressedPath: '/scene-45.jpg'
      }
    }
    const sceneSupplementCount = withSceneSupplement ? Math.max(supplementCount, 1) : supplementCount
    for (let index = 0; index < sceneSupplementCount; index += 1) {
      cache.scenePhotos.supplements.push({
        status: 'completed',
        compressedPath: `/scene-supplement-${index + 1}.jpg`
      })
    }
    cache.sceneSupplementPromptShown = true
    return cache
  }

  beforeEach(() => {
    jest.resetModules()
    memoryStorage = {}

    jest.doMock('../packageD/utils/env-config', () => ({
      getAppEnvBadgeText: jest.fn(() => '')
    }))
    jest.doMock('../packageD/utils/runtime-logger', () => ({
      forceWarn: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getSessionId: jest.fn(() => 'test-session')
    }))
    jest.doMock('../packageD/utils/workflow-page', () => ({
      syncPageWorkflowState: jest.fn()
    }))
    jest.doMock('../packageD/utils/aux-photo-api', () => ({
      uploadPhoto: jest.fn()
    }))
    jest.doMock('../packageD/utils/album', () => ({
      savePhotosToAlbumBatch: jest.fn()
    }))
    jest.doMock('../packageD/utils/permission', () => ({
      ensureAlbumSavePermission: jest.fn()
    }))

    global.wx = {
      getStorageSync(key) {
        return memoryStorage[key]
      },
      setStorageSync(key, value) {
        memoryStorage[key] = value
      },
      removeStorageSync(key) {
        delete memoryStorage[key]
      },
      getSystemInfoSync: jest.fn(() => ({
        windowWidth: 844,
        windowHeight: 390,
        safeArea: { width: 844, height: 390 },
        pixelRatio: 2,
        platform: 'ios',
        system: 'iOS 17.0',
        model: 'iPhone 15'
      })),
      navigateTo: jest.fn(({ success } = {}) => {
        if (success) success()
      }),
      redirectTo: jest.fn(),
      reLaunch: jest.fn(),
      showToast: jest.fn(),
      showModal: jest.fn(),
      previewImage: jest.fn()
    }

    global.Page = jest.fn((config) => {
      pageConfig = config
    })

    storage = require('../packageD/utils/storage')
    constants = require('../packageD/utils/constants')
  })

  afterEach(() => {
    delete global.wx
    delete global.Page
    jest.dontMock('../packageD/utils/env-config')
    jest.dontMock('../packageD/utils/runtime-logger')
    jest.dontMock('../packageD/utils/workflow-page')
    jest.dontMock('../packageD/utils/aux-photo-api')
    jest.dontMock('../packageD/utils/album')
    jest.dontMock('../packageD/utils/permission')
  })

  test('loads module one preview mode with scene slots and vehicle identity summary', () => {
    const page = loadPreviewPageWithCache(buildModuleOneCache({ withScene45: true }), { mode: 'moduleOne' })

    expect(page.data.isModuleOnePreview).toBe(true)
    expect(page.data.pageTitle).toBe('现场环境及车辆信息')
    expect(page.data.moduleOneSummary.sceneSlots).toHaveLength(4)
    expect(page.data.moduleOneSummary.sceneSlots.map((slot) => slot.label)).toEqual([
      '整车45度',
      '现场照片（可选）',
      '现场照片（可选）',
      '现场照片（可选）'
    ])
    expect(page.data.moduleOneSummary.vehicles[0]).toEqual(expect.objectContaining({
      displayName: '标的车 京A12345',
      moduleOneTitle: '标的车 - 京A12345',
      hasLicensePlate: true,
      hasVinCode: true
    }))
  })

  test('module one preview markup uses check-only labels without denominator stats', () => {
    const wxml = require('fs').readFileSync('packageD/pages/preview/preview.wxml', 'utf8')
    const moduleOnePreviewMarkup = wxml.slice(
      wxml.indexOf('wx:if="{{isModuleOnePreview}}"'),
      wxml.indexOf('一、现场环境及车辆信息')
    )

    expect(moduleOnePreviewMarkup).toContain('环境照片')
    expect(moduleOnePreviewMarkup).toContain('车辆识别信息')
    expect(moduleOnePreviewMarkup).toContain('{{vehicleInfo.moduleOneTitle}}')
    expect(moduleOnePreviewMarkup).toContain('车牌号')
    expect(moduleOnePreviewMarkup).toContain('VIN码')
    expect(moduleOnePreviewMarkup).toContain('module-one-vehicles-scroll')
    expect(moduleOnePreviewMarkup).not.toContain('现场补充 {{moduleOneSummary.supplementCount}} / 2')
    expect(moduleOnePreviewMarkup).not.toContain('{{moduleOneSummary.vehicles.length}} 辆')
    expect(moduleOnePreviewMarkup).not.toContain('整车45度现场照片')
    expect(moduleOnePreviewMarkup).not.toContain('现场补充照片 1')
    expect(moduleOnePreviewMarkup).not.toContain('现场补充照片 2')
  })

  test('module one preview does not render legacy vehicle list', () => {
    const wxml = require('fs').readFileSync('packageD/pages/preview/preview.wxml', 'utf8')
    const legacyVehicleListMatch = wxml.match(/<view[^>]*class="vehicle-section"[^>]*wx:for="\{\{vehicles\}\}"[^>]*>/)

    expect(legacyVehicleListMatch).not.toBeNull()
    expect(legacyVehicleListMatch[0]).toContain('wx:if="{{!isModuleOnePreview && !isModuleThreePreview}}"')
  })

  test('module one vehicle identity is grouped per vehicle with two short slots', () => {
    const page = loadPreviewPageWithCache(
      buildModuleOneCache({ withScene45: true, withSecondVehicle: true }),
      { mode: 'moduleOne' }
    )

    expect(page.data.moduleOneSummary.vehicles.map((vehicle) => vehicle.moduleOneTitle)).toEqual([
      '标的车 - 京A12345',
      '三者车 - 京B12345'
    ])

    const wxml = require('fs').readFileSync('packageD/pages/preview/preview.wxml', 'utf8')
    expect(wxml).toContain('data-type="licensePlate"')
    expect(wxml).toContain('data-completed="{{vehicleInfo.hasLicensePlate}}"')
    expect(wxml).toContain('data-type="vinCode"')
    expect(wxml).toContain('data-completed="{{vehicleInfo.hasVinCode}}"')
    expect(wxml).not.toContain('标的车车牌')
    expect(wxml).not.toContain('三者车 VIN')
    expect(wxml).not.toContain('标的车 VIN')
  })

  test('opens completed module one vehicle identity photo in fullscreen preview', () => {
    const page = loadPreviewPageWithCache(buildModuleOneCache({ withScene45: true }), { mode: 'moduleOne' })

    page.onTapModuleOneVehicleSlot({
      currentTarget: {
        dataset: {
          vehicle: 0,
          type: 'licensePlate',
          completed: true
        }
      }
    })

    expect(page.data.showPreview).toBe(true)
    expect(page.data.currentPhoto).toEqual(expect.objectContaining({
      id: '0-licensePlate',
      type: constants.PHOTO_TYPE.LICENSE_PLATE,
      vehicle: 0,
      url: '/plate.jpg'
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
  })

  test('routes incomplete module one vehicle identity slot to camera retake flow', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.vehicles[0].licensePlate = { status: 'pending' }
    const page = loadPreviewPageWithCache(cache, { mode: 'moduleOne' })

    page.onTapModuleOneVehicleSlot({
      currentTarget: {
        dataset: {
          vehicle: 0,
          type: 'licensePlate',
          completed: false
        }
      }
    })

    const updatedCache = storage.loadCache()
    expect(updatedCache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(updatedCache.currentVehicleIndex).toBe(0)
    expect(updatedCache.fromPreview).toBe(true)
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('hides module one scene supplement button after three supplements', () => {
    const noSupplementPage = loadPreviewPageWithCache(buildModuleOneCache({ withScene45: true }), { mode: 'moduleOne' })
    expect(noSupplementPage.data.moduleOneSummary.canAddSceneSupplement).toBe(true)

    const oneSupplementPage = loadPreviewPageWithCache(
      buildModuleOneCache({ withScene45: true, supplementCount: 1 }),
      { mode: 'moduleOne' }
    )
    expect(oneSupplementPage.data.moduleOneSummary.canAddSceneSupplement).toBe(true)
    expect(oneSupplementPage.data.moduleOneSummary.sceneSlots).toHaveLength(4)
    expect(oneSupplementPage.data.moduleOneSummary.sceneSlots.filter((slot) => !slot.completed)).toHaveLength(2)

    const fullSupplementPage = loadPreviewPageWithCache(
      buildModuleOneCache({ withScene45: true, supplementCount: 3 }),
      { mode: 'moduleOne' }
    )
    expect(fullSupplementPage.data.moduleOneSummary.canAddSceneSupplement).toBe(false)

    const wxml = require('fs').readFileSync('packageD/pages/preview/preview.wxml', 'utf8')
    const supplementButtonMatch = wxml.match(/<view[^>]*bindtap="onTapModuleOneSceneSlot"[^>]*>补充现场照片<\/view>/)
    expect(supplementButtonMatch).not.toBeNull()
    expect(supplementButtonMatch[0]).toContain('wx:if="{{moduleOneSummary.canAddSceneSupplement}}"')
  })

  test('shows scene supplement prompt first time module one main flow is complete', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.sceneSupplementPromptShown = false
    const page = loadPreviewPageWithCache(cache, { mode: 'moduleOne' })

    expect(page.data.showModal).toBe(true)
    expect(page.data.modalType).toBe('sceneSupplementPrompt')
    expect(page.data.modalContent).toContain('是否补充其他现场环境或道路相关损失？')
    expect(page.data.modalContent).toContain('如护栏、灯杆、路牌、路面痕迹等')
    expect(page.data.modalConfirmText).toBe('去拍摄')
    expect(page.data.modalCancelText).toBe('没有了')
  })

  test('scene supplement prompt cancel writes one-time flag and stays on preview', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.sceneSupplementPromptShown = false
    const page = loadPreviewPageWithCache(cache, { mode: 'moduleOne' })

    page.onModalCancel()

    const updatedCache = storage.loadCache()
    expect(updatedCache.sceneSupplementPromptShown).toBe(true)
    expect(updatedCache.currentStep).not.toBe(constants.SHOOT_STEP.SCENE_SUPPLEMENT)
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
  })

  test('scene supplement prompt confirm writes flag and enters first supplement slot', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.sceneSupplementPromptShown = false
    const page = loadPreviewPageWithCache(cache, { mode: 'moduleOne' })

    page.onModalConfirm()

    const updatedCache = storage.loadCache()
    expect(updatedCache.sceneSupplementPromptShown).toBe(true)
    expect(updatedCache.currentStep).toBe(constants.SHOOT_STEP.SCENE_SUPPLEMENT)
    expect(updatedCache.sceneSupplementIndex).toBe(0)
    expect(updatedCache.fromPreview).toBe(true)
    expect(updatedCache.previewReturnMode).toBe('moduleOne')
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('does not show scene supplement prompt after returning from supplement capture', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.sceneSupplementPromptShown = true
    cache.fromPreview = true
    cache.currentStep = constants.SHOOT_STEP.MODULE_ONE_PREVIEW

    const page = loadPreviewPageWithCache(cache, { mode: 'moduleOne' })

    expect(page.data.showModal).toBe(false)
    expect(page.data.modalType).toBe('')
  })

  test('does not show scene supplement prompt when scene 45 is missing', () => {
    const cache = buildModuleOneCache({ withScene45: false })
    cache.sceneSupplementPromptShown = false

    const page = loadPreviewPageWithCache(cache, { mode: 'moduleOne' })

    expect(page.data.showModal).toBe(false)
    expect(page.data.modalType).toBe('')
  })

  test('uses explicit module one mode even when cache step has already advanced', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.currentStep = constants.SHOOT_STEP.DAMAGE

    const page = loadPreviewPageWithCache(cache, { mode: 'moduleOne' })

    expect(page.data.isModuleOnePreview).toBe(true)
    expect(page.data.pageTitle).toBe('现场环境及车辆信息')
    expect(page.data.moduleOneSummary.vehicles[0]).toEqual(expect.objectContaining({
      hasLicensePlate: true,
      hasVinCode: true
    }))
  })

  test('prompts before entering damage when scene 45 photo is missing', () => {
    const page = loadPreviewPageWithCache(buildModuleOneCache({ withScene45: false }), { mode: 'moduleOne' })

    page.onEnterDamageFromModuleOne()

    expect(page.data.showModal).toBe(true)
    expect(page.data.modalType).toBe('missingScene45')
    expect(page.data.modalContent).toBe('现场照片未采集，建议补拍，便于记录事故现场和车辆整体状态。你也可以继续进入车损照片拍摄。')
    expect(page.data.showModuleOneHandoff).toBe(false)
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
  })

  test('shows module one handoff overlay before routing into damage capture', () => {
    const page = loadPreviewPageWithCache(buildModuleOneCache({ withScene45: true }), { mode: 'moduleOne' })

    page.onEnterDamageFromModuleOne()

    expect(page.data.showModuleOneHandoff).toBe(true)
    expect(page.data.moduleOneHandoffTitle).toBe('现场环境及车辆信息已保存')
    expect(page.data.moduleOneHandoffNext).toBe('下一步：车损照片拍摄')

    page.onConfirmModuleOneHandoff()

    const cache = storage.loadCache()
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(cache.currentVehicleIndex).toBe(0)
    expect(cache.workflowState.current).toBe('CAPTURING')
    expect(global.wx.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('routes scene supplement slot back to camera and returns to module one preview', () => {
    const page = loadPreviewPageWithCache(buildModuleOneCache({ withScene45: true }), { mode: 'moduleOne' })

    page.onTapModuleOneSceneSlot({
      currentTarget: {
        dataset: {
          sceneType: constants.SCENE_PHOTO_TYPE.SUPPLEMENT,
          supplementIndex: 0,
          completed: false
        }
      }
    })

    const cache = storage.loadCache()
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.SCENE_SUPPLEMENT)
    expect(cache.sceneSupplementIndex).toBe(0)
    expect(cache.fromPreview).toBe(true)
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('blocks fourth scene supplement capture and keeps user on preview', () => {
    const page = loadPreviewPageWithCache(
      buildModuleOneCache({ withScene45: true, supplementCount: 3 }),
      { mode: 'moduleOne' }
    )

    page.onTapModuleOneSceneSlot({
      currentTarget: {
        dataset: {
          sceneType: constants.SCENE_PHOTO_TYPE.SUPPLEMENT,
          supplementIndex: 3,
          completed: false
        }
      }
    })

    expect(global.wx.showToast).toHaveBeenCalledWith({
      title: '现场补充照片最多3张',
      icon: 'none'
    })
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
  })

  test('opens completed scene photo in fullscreen preview instead of routing to camera', () => {
    const page = loadPreviewPageWithCache(
      buildModuleOneCache({ withScene45: true, withSceneSupplement: true }),
      { mode: 'moduleOne' }
    )

    page.onTapModuleOneSceneSlot({
      currentTarget: {
        dataset: {
          sceneType: constants.SCENE_PHOTO_TYPE.SCENE_45,
          completed: true
        }
      }
    })

    expect(page.data.showPreview).toBe(true)
    expect(page.data.currentPhoto).toEqual(expect.objectContaining({
      id: 'scene-45',
      type: constants.PHOTO_TYPE.SCENE_45,
      sceneType: constants.SCENE_PHOTO_TYPE.SCENE_45
    }))
    expect(global.wx.navigateTo).not.toHaveBeenCalled()
  })

  test('retakes completed scene supplement from fullscreen preview', () => {
    const page = loadPreviewPageWithCache(
      buildModuleOneCache({ withScene45: true, withSceneSupplement: true }),
      { mode: 'moduleOne' }
    )

    page.setData({
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === 'scene-supplement-0')
    })
    page.onRetake()

    const cache = storage.loadCache()
    expect(cache.currentStep).toBe(constants.SHOOT_STEP.SCENE_SUPPLEMENT)
    expect(cache.sceneSupplementIndex).toBe(0)
    expect(cache.fromPreview).toBe(true)
    expect(cache.previewReturnMode).toBe('moduleOne')
    expect(cache.retakeMode && cache.retakeMode.enabled).toBe(false)
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('final preview retakes completed scene photo with final return mode', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
    const page = loadPreviewPageWithCache(cache, { mode: 'final' })

    page.setData({
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === 'scene-45')
    })
    page.onRetake()

    const updatedCache = storage.loadCache()
    expect(updatedCache.currentStep).toBe(constants.SHOOT_STEP.SCENE_45)
    expect(updatedCache.fromPreview).toBe(true)
    expect(updatedCache.previewReturnMode).toBe('final')
    expect(updatedCache.retakeMode && updatedCache.retakeMode.enabled).toBe(false)
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('final preview retakes completed vehicle photo with final return mode', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
    const page = loadPreviewPageWithCache(cache, { mode: 'final' })

    page.setData({
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === '0-licensePlate')
    })
    page.onRetake()

    const updatedCache = storage.loadCache()
    expect(updatedCache.currentStep).toBe(constants.SHOOT_STEP.LICENSE_PLATE)
    expect(updatedCache.currentVehicleIndex).toBe(0)
    expect(updatedCache.fromPreview).toBe(true)
    expect(updatedCache.previewReturnMode).toBe('final')
    expect(updatedCache.retakeMode).toEqual(expect.objectContaining({
      enabled: true,
      vehicleIndex: 0,
      photoType: constants.PHOTO_TYPE.LICENSE_PLATE
    }))
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('deletes completed scene 45 photo from fullscreen preview', () => {
    const page = loadPreviewPageWithCache(buildModuleOneCache({ withScene45: true }), { mode: 'moduleOne' })
    page.setData({
      showPreview: true,
      currentPhoto: page.data.allPhotos.find((photo) => photo.id === 'scene-45')
    })
    global.wx.showModal.mockImplementationOnce(({ success }) => success({ confirm: true }))

    page.onDelete()

    const cache = storage.loadCache()
    expect(cache.scenePhotos.scene45).toEqual({ status: 'pending' })
    expect(page.data.showPreview).toBe(false)
  })

  test('keeps scene environment thumbnails visible on final preview', () => {
    const cache = buildModuleOneCache({ withScene45: true, withSceneSupplement: true })
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    const page = loadPreviewPageWithCache(
      cache,
      {}
    )

    expect(page.data.isModuleOnePreview).toBe(false)
    expect(page.data.moduleOneSummary.sceneSlots.filter((slot) => slot.completed)).toHaveLength(2)
    expect(page.data.moduleOneSummary.canAddSceneSupplement).toBe(true)
    expect(page.data.allPhotos.slice(0, 2).map((photo) => photo.id)).toEqual([
      'scene-45',
      'scene-supplement-0'
    ])

    const wxml = require('fs').readFileSync('packageD/pages/preview/preview.wxml', 'utf8')
    expect(wxml).not.toContain('wx:if="{{isFinalPreview && moduleOneSummary.scenePhotoCount > 0}}"')
    expect(wxml).toContain('wx:if="{{isFinalPreview}}" class="module-one-section final-group"')
    expect(wxml).toContain("{{item.completed ? '' : 'empty-thumb'}}")
    expect(wxml).toContain('现场补充 {{moduleOneSummary.supplementCount}} / 3')
    expect(wxml).toContain('现场环境')
  })

  test('final preview supports three completed scene supplement photos', () => {
    const cache = buildModuleOneCache({ withScene45: true, supplementCount: 3 })
    cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW

    const page = loadPreviewPageWithCache(cache, { mode: 'final' })

    expect(page.data.isFinalPreview).toBe(true)
    expect(page.data.moduleOneSummary.supplementCount).toBe(3)
    expect(page.data.moduleOneSummary.canAddSceneSupplement).toBe(false)
    expect(page.data.moduleOneSummary.sceneSlots.filter((slot) => slot.completed)).toHaveLength(4)
    expect(page.data.allPhotos.slice(0, 4).map((photo) => photo.id)).toEqual([
      'scene-45',
      'scene-supplement-0',
      'scene-supplement-1',
      'scene-supplement-2'
    ])
  })

  test('module three document area renders flat vehicle cards', () => {
    const page = loadPreviewPageWithCache(buildModuleOneCache({ withScene45: true, withSecondVehicle: true }), { mode: 'moduleThree' })

    expect(page.data.isModuleThreePreview).toBe(true)
    expect(page.data.vehicles.map((vehicle) => vehicle.vehicleDocumentPreview.displayItems.map((item) => item.label))).toEqual([
      ['驾驶证', '行驶证'],
      ['驾驶证', '行驶证']
    ])

    const wxml = require('fs').readFileSync('packageD/pages/preview/preview.wxml', 'utf8')
    expect(wxml).toContain('doc-package-list')
    expect(wxml).toContain('doc-package-card')
    expect(wxml).toContain('doc-package-vehicle')
    expect(wxml).toContain('doc-package-actions')
    expect(wxml).toContain('vehicleDocumentPreview.displayItems')
    expect(wxml).not.toContain('vehicleDocumentPreview.groups')
    expect(wxml).not.toContain('document-group-title')
  })

  test('final preview document area reuses flat vehicle card data', () => {
    const cache = buildModuleOneCache({ withScene45: true, withSecondVehicle: true })
    cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
    const page = loadPreviewPageWithCache(cache, { mode: 'final' })

    expect(page.data.isFinalPreview).toBe(true)
    expect(page.data.vehicles).toHaveLength(2)
    expect(page.data.vehicles[0].vehicleDocumentPreview.displayItems.map((item) => item.label)).toEqual(['驾驶证', '行驶证'])
    expect(page.data.vehicles[1].vehicleDocumentPreview.displayItems.map((item) => item.label)).toEqual(['驾驶证', '行驶证'])
  })

  test('loads module two preview mode with damage-only entry state', () => {
    const cache = buildModuleOneCache({ withScene45: true, withSceneSupplement: true })
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.vehicles[0].damages = [
      { status: 'completed', compressedPath: '/damage-1.jpg' }
    ]

    const page = loadPreviewPageWithCache(cache, { mode: 'moduleTwo' })

    expect(page.data.isModuleOnePreview).toBe(false)
    expect(page.data.isModuleTwoPreview).toBe(true)
    expect(page.data.pageTitle).toBe('车损照片预览')
    expect(page.data.pageSubtitle).toBe('请确认各车辆车损照片')
    expect(page.data.vehicles[0].damages).toHaveLength(1)
    expect(page.data.allPhotos).toEqual([
      expect.objectContaining({
        id: '0-damage-0',
        type: constants.PHOTO_TYPE.DAMAGE,
        url: '/damage-1.jpg'
      })
    ])

    const wxml = require('fs').readFileSync('packageD/pages/preview/preview.wxml', 'utf8')
    expect(wxml).not.toContain('wx:if="{{isFinalPreview && moduleOneSummary.scenePhotoCount > 0}}"')
    expect(wxml).toContain('wx:if="{{isFinalPreview}}" class="module-one-section final-group"')
    expect(wxml).toContain("{{item.completed ? '' : 'empty-thumb'}}")
    expect(wxml).toContain('wx:if="{{!isModuleTwoPreview && !isFinalPreview && item.licensePlate.status === \'completed\'}}"')
    expect(wxml).toContain('wx:if="{{!isModuleTwoPreview && !isFinalPreview && item.vinCode.status === \'completed\'}}"')
    expect(wxml).not.toContain('item.drivingLicensePreview.items.length > 0')
    expect(wxml).toContain('wx:if="{{isFinalPreview}}" class="bottom-bar"')
    expect(wxml).toContain('wx:if="{{isModuleTwoPreview}}" class="bottom-bar"')
    expect(wxml).toContain('请确认各车辆车损照片，可继续补拍。')
    expect(wxml).not.toContain('完整预览样式将在下一轮完善')
  })

  test('module two preview add damage does not require plate or VIN slots', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.vehicles[0].licensePlate = { status: 'pending' }
    cache.vehicles[0].vinCode = { status: 'pending' }

    const page = loadPreviewPageWithCache(cache, { mode: 'moduleTwo' })

    page.onAddDamage({
      currentTarget: {
        dataset: {
          vehicle: 0
        }
      }
    })

    const updatedCache = storage.loadCache()
    expect(updatedCache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(updatedCache.currentVehicleIndex).toBe(0)
    expect(updatedCache.fromPreview).toBe(true)
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })

  test('final preview supplement keeps camera return target on final summary', () => {
    const cache = buildModuleOneCache({ withScene45: true })
    cache.currentStep = constants.SHOOT_STEP.FINAL_PREVIEW
    const page = loadPreviewPageWithCache(cache, { mode: 'final' })

    page.onAddDamage({
      currentTarget: {
        dataset: {
          vehicle: 0
        }
      }
    })

    const updatedCache = storage.loadCache()
    expect(updatedCache.currentStep).toBe(constants.SHOOT_STEP.DAMAGE)
    expect(updatedCache.fromPreview).toBe(true)
    expect(updatedCache.previewReturnMode).toBe('final')
    expect(global.wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/packageD/pages/camera/camera'
    }))
  })
})
