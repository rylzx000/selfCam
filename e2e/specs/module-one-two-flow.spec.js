const {
  launchMiniProgram,
  closeMiniProgram,
  wait,
  seedCache,
  readCache,
  clearE2EState,
  waitForCondition,
  installWxMediaMocks,
  getWxMediaState,
  callCurrentPageMethodAsync
} = require('../support/automator')
const {
  STORAGE_KEY,
  SHOOT_STEP,
  createPhoto,
  createVehicle,
  createCache
} = require('../support/fixtures')
const fs = require('fs')

function withWorkflowState(cache, current) {
  return {
    ...cache,
    workflowState: {
      current,
      updatedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  }
}

function eventDataset(dataset) {
  return {
    currentTarget: { dataset }
  }
}

function createModuleOneReadyCache({ vehicleCount = 1, damageCounts = [] } = {}) {
  const vehicles = Array.from({ length: vehicleCount }, (_, index) => createVehicle(index, {
    vehicleRoleName: index === 0 ? '标的车' : '三者车',
    licenseNo: index === 0 ? '京A12345' : `京B1234${index}`,
    displayName: index === 0 ? '标的车 京A12345' : `三者车 京B1234${index}`,
    licensePlate: createPhoto({ compressedPath: `wxfile://tmp/e2e-plate-${index}.jpg` }),
    vinCode: createPhoto({ compressedPath: `wxfile://tmp/e2e-vin-${index}.jpg` }),
    damages: Array.from({ length: damageCounts[index] || 0 }, (_, damageIndex) => createPhoto({
      compressedPath: `wxfile://tmp/e2e-damage-${index}-${damageIndex}.jpg`
    }))
  }))

  return createCache({
    vehicles,
    scenePhotos: {
      scene45: createPhoto({ compressedPath: 'wxfile://tmp/e2e-scene-45.jpg' }),
      supplements: []
    },
    currentStep: SHOOT_STEP.MODULE_ONE_PREVIEW,
    currentVehicleIndex: vehicleCount - 1,
    currentDamageCount: 0,
    workflowState: {
      current: 'PREVIEWING',
      updatedAt: new Date().toISOString()
    }
  })
}

function createDocument(docType, docSide, vehicleIndex, pathSuffix) {
  return {
    id: `${docType}_${docSide}_${vehicleIndex}_${pathSuffix}`,
    docType,
    docSide,
    label: docType === 'driver_license'
      ? (docSide === 'electronic' ? '驾驶证' : docSide === 'front_page' ? '驾驶证-正页' : '驾驶证-副页')
      : (docSide === 'electronic' ? '行驶证' : docSide === 'front_page' ? '行驶证-正页' : '行驶证-副页'),
    sourceType: 'camera',
    tempFilePath: `wxfile://tmp/e2e-${pathSuffix}.jpg`,
    compressedPath: `wxfile://tmp/e2e-${pathSuffix}-compressed.jpg`,
    size: 1024,
    compressedSize: 512,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

function createModuleThreeCache({ vehicleCount = 1, damageCounts = [], documentsByVehicle = [] } = {}) {
  const cache = createModuleOneReadyCache({ vehicleCount, damageCounts })
  cache.currentStep = 'moduleThree'
  cache.vehicles = cache.vehicles.map((vehicle, index) => ({
    ...vehicle,
    documentSelections: {
      driver_license: 'physical',
      driving_license: 'physical',
      ...(vehicle.documentSelections || {})
    },
    documents: documentsByVehicle[index] || []
  }))
  return cache
}

function createModuleOneVinCache({ vehicleCount = 1, currentVehicleIndex = 0 } = {}) {
  const vehicles = Array.from({ length: vehicleCount }, (_, index) => createVehicle(index, {
    vehicleRoleName: index === 0 ? '标的车' : '三者车',
    licenseNo: index === 0 ? '京A12345' : `京B1234${index}`,
    displayName: index === 0 ? '标的车 京A12345' : `三者车 京B1234${index}`,
    licensePlate: createPhoto({ compressedPath: `wxfile://tmp/e2e-plate-${index}.jpg` }),
    vinCode: index < currentVehicleIndex
      ? createPhoto({ compressedPath: `wxfile://tmp/e2e-vin-${index}.jpg` })
      : { status: 'pending' },
    damages: []
  }))

  return createCache({
    vehicles,
    scenePhotos: {
      scene45: createPhoto({ compressedPath: 'wxfile://tmp/e2e-scene-45.jpg' }),
      supplements: []
    },
    currentStep: SHOOT_STEP.VIN_CODE,
    currentVehicleIndex,
    currentDamageCount: 0
  })
}

async function waitForPagePath(miniProgram, pathPart, timeoutMs = 10000) {
  return waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    return current.path && current.path.includes(pathPart) ? current : null
  }, timeoutMs, 200)
}

function getPreviewModeFlag(mode) {
  return {
    moduleOne: 'isModuleOnePreview',
    moduleTwo: 'isModuleTwoPreview',
    moduleThree: 'isModuleThreePreview',
    final: 'isFinalPreview'
  }[mode] || ''
}

async function waitForPreviewMode(miniProgram, mode, timeoutMs = 10000) {
  const modeFlag = getPreviewModeFlag(mode)
  return waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    if (!current.path || !current.path.includes('packageD/pages/preview/preview')) {
      return null
    }

    if (!modeFlag) {
      return current
    }

    const data = await current.data()
    return data && data[modeFlag] ? current : null
  }, timeoutMs, 200)
}

async function callCurrentPageMethod(miniProgram, methodName, ...args) {
  const called = await callCurrentPageMethodAsync(miniProgram, methodName, ...args)
  expect(called).toBe(true)
  await wait(600)
}

async function selectVehicleDocument(miniProgram, vehicle, docType, tapIndex = 0) {
  await installWxMediaMocks(miniProgram, 'success', {
    actionSheetTapIndex: tapIndex,
    uniqueCompressedPath: true
  })
  await callCurrentPageMethod(miniProgram, 'onOpenDrivingLicensePanel', eventDataset({
    vehicle,
    docType
  }))
  const mediaState = await getWxMediaState(miniProgram)
  expect(mediaState.showActionSheetCalls).toBeGreaterThanOrEqual(1)
}

async function uploadActiveDocumentSlot(miniProgram, side, docType, path) {
  await installWxMediaMocks(miniProgram, 'success', {
    actionSheetTapIndex: 0,
    mediaPaths: [path],
    uniqueCompressedPath: true
  })
  await callCurrentPageMethod(miniProgram, 'onTapDrivingLicenseSlot', eventDataset({
    side,
    docType,
    uploaded: false,
    uploadable: true
  }))
}

async function getCurrentPageStack(miniProgram) {
  return miniProgram.evaluate(function () {
    return typeof getCurrentPages === 'function'
      ? getCurrentPages().map(function (page) {
        return {
          route: page.route,
          isFinalPreview: !!(page.data && page.data.isFinalPreview),
          isModuleThreePreview: !!(page.data && page.data.isModuleThreePreview),
          currentStep: page.data && page.data.currentStep
        }
      })
      : []
  })
}

async function openCameraWithCache(miniProgram, cache) {
  await seedCache(miniProgram, withWorkflowState(cache, 'CAPTURING'))
  await miniProgram.reLaunch('/packageD/pages/camera/camera')
  return waitForPagePath(miniProgram, 'packageD/pages/camera/camera')
}

async function openPreviewWithCache(miniProgram, cache, mode) {
  await seedCache(miniProgram, cache)
  await miniProgram.reLaunch(`/packageD/pages/preview/preview?mode=${mode}`)
  return waitForPreviewMode(miniProgram, mode)
}

async function waitForDamageStateAfterModuleOneHandoff(miniProgram) {
  await waitForCondition(async () => {
    const cache = await readCache(miniProgram)
    return cache
      && cache.currentStep === SHOOT_STEP.DAMAGE
      && cache.workflowState
      && cache.workflowState.current === 'CAPTURING'
      ? cache
      : null
  }, 10000, 200)
}

async function confirmModuleOneHandoffForE2E(miniProgram) {
  await miniProgram.evaluate(function (payload) {
    const raw = wx.getStorageSync(payload.key)
    const cache = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!cache) return false

    const firstVehicle = cache.vehicles && cache.vehicles[0]
    cache.currentVehicleIndex = 0
    cache.currentStep = payload.damageStep
    cache.currentDamageCount = firstVehicle && Array.isArray(firstVehicle.damages)
      ? firstVehicle.damages.length
      : 0
    cache.fromPreview = false
    cache.workflowState = {
      current: 'CAPTURING',
      updatedAt: new Date().toISOString()
    }
    cache.updatedAt = new Date().toISOString()
    wx.setStorageSync(payload.key, JSON.stringify(cache))
    return true
  }, {
    key: STORAGE_KEY,
    damageStep: SHOOT_STEP.DAMAGE
  })
  await wait(300)
}

async function confirmPendingPhoto(page, miniProgram, step, path) {
  await page.setData({
    currentStep: step,
    showConfirmModal: true,
    pendingPhoto: createPhoto({ compressedPath: path })
  })
  await callCurrentPageMethod(miniProgram, 'onConfirmPhoto')
}

describe('模块一、模块二流程自动化验证', () => {
  let miniProgram

  beforeEach(async () => {
    miniProgram = await launchMiniProgram()
    await clearE2EState(miniProgram)
  })

  afterEach(async () => {
    await closeMiniProgram(miniProgram)
    miniProgram = null
  })

  test('单车：最后车架号后进入模块一预览，再确认进入模块二车损预览', async () => {
    let page = await openCameraWithCache(miniProgram, createModuleOneVinCache())

    await confirmPendingPhoto(page, miniProgram, SHOOT_STEP.VIN_CODE, 'wxfile://tmp/e2e-single-vin.jpg')

    page = await waitForPreviewMode(miniProgram, 'moduleOne')
    let data = await page.data()
    let cache = await readCache(miniProgram)

    expect(page.path).toContain('packageD/pages/preview/preview')
    expect(data.isModuleOnePreview).toBe(true)
    expect(cache.currentStep).not.toBe(SHOOT_STEP.DAMAGE)

    await callCurrentPageMethod(miniProgram, 'onEnterDamageFromModuleOne')
    expect((await page.data()).showModuleOneHandoff).toBe(true)
    await confirmModuleOneHandoffForE2E(miniProgram)

    await waitForDamageStateAfterModuleOneHandoff(miniProgram)
    cache = await readCache(miniProgram)
    expect(cache.currentStep).toBe(SHOOT_STEP.DAMAGE)
    expect(cache.currentStep).not.toBe(SHOOT_STEP.LICENSE_PLATE)
    expect(cache.currentStep).not.toBe(SHOOT_STEP.VIN_CODE)
  })

  test('多车：最后一辆车架号后进模块一预览，模块二逐车车损后进预览', async () => {
    let page = await openCameraWithCache(miniProgram, createModuleOneVinCache({
      vehicleCount: 2,
      currentVehicleIndex: 1
    }))

    await confirmPendingPhoto(page, miniProgram, SHOOT_STEP.VIN_CODE, 'wxfile://tmp/e2e-second-vin.jpg')

    page = await waitForPreviewMode(miniProgram, 'moduleOne')
    let data = await page.data()
    let cache = await readCache(miniProgram)
    expect(data.isModuleOnePreview).toBe(true)
    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).not.toBe(SHOOT_STEP.DAMAGE)

    await callCurrentPageMethod(miniProgram, 'onEnterDamageFromModuleOne')
    await confirmModuleOneHandoffForE2E(miniProgram)

    await waitForDamageStateAfterModuleOneHandoff(miniProgram)
    page = await openCameraWithCache(miniProgram, await readCache(miniProgram))
    data = await page.data()
    expect(data.currentStep).toBe(SHOOT_STEP.DAMAGE)

    await confirmPendingPhoto(page, miniProgram, SHOOT_STEP.DAMAGE, 'wxfile://tmp/e2e-first-damage.jpg')
    await callCurrentPageMethod(miniProgram, 'onFinishDamage')
    expect((await page.data()).showDamageCompleteModal).toBe(true)

    await callCurrentPageMethod(miniProgram, 'onDamageCompleteModalConfirm')
    page = await waitForPagePath(miniProgram, 'packageD/pages/camera/camera')
    data = await page.data()
    cache = await readCache(miniProgram)
    expect(data.currentStep).toBe(SHOOT_STEP.DAMAGE)
    expect(cache.currentVehicleIndex).toBe(1)

    await confirmPendingPhoto(page, miniProgram, SHOOT_STEP.DAMAGE, 'wxfile://tmp/e2e-second-damage.jpg')
    await callCurrentPageMethod(miniProgram, 'onFinishDamage')

    page = await waitForPreviewMode(miniProgram, 'moduleTwo')
    data = await page.data()
    expect(data.isModuleTwoPreview).toBe(true)
    expect(data.allPhotos).toHaveLength(2)
    expect(data.allPhotos.every((photo) => photo.type === 'damage')).toBe(true)
  })

  test('模块二支持 0 张车损结束并进入只含车损的预览', async () => {
    let page = await openCameraWithCache(miniProgram, {
      ...createModuleOneReadyCache({ vehicleCount: 1, damageCounts: [0] }),
      currentStep: SHOOT_STEP.DAMAGE,
      currentVehicleIndex: 0,
      currentDamageCount: 0
    })

    await callCurrentPageMethod(miniProgram, 'onFinishDamage')
    page = await waitForPreviewMode(miniProgram, 'moduleTwo')
    let data = await page.data()
    expect(data.isModuleTwoPreview).toBe(true)
    expect(data.allPhotos).toHaveLength(0)
    expect(data.vehicles[0].damages).toHaveLength(0)
  })

  test('模块二预览只展示车损和每车一个补拍入口', async () => {
    let page = await openPreviewWithCache(miniProgram, {
      ...createModuleOneReadyCache({ vehicleCount: 2, damageCounts: [1, 2] }),
      currentStep: SHOOT_STEP.DAMAGE
    }, 'moduleTwo')
    let data = await page.data()

    expect(data.isModuleTwoPreview).toBe(true)
    expect(data.allPhotos).toHaveLength(3)
    expect(data.allPhotos.every((photo) => photo.type === 'damage')).toBe(true)
    expect(data.allPhotos.some((photo) => (
      photo.type === 'licensePlate' || photo.type === 'vinCode' || photo.type === 'vehicleDocument'
    ))).toBe(false)
    expect(data.vehicles).toHaveLength(2)
    expect(data.vehicles.map((vehicle) => vehicle.damages.length)).toEqual([1, 2])

    const wxml = fs.readFileSync('packageD/pages/preview/preview.wxml', 'utf8')
    const addDamageBlocks = wxml.match(/bindtap="onAddDamage"/g) || []
    expect(addDamageBlocks).toHaveLength(1)
    expect(wxml).toContain("wx:if=\"{{(isModuleTwoPreview || (item.licensePlate.status === 'completed' && item.vinCode.status === 'completed')) && (!item.damages || item.damages.length < 10)}}\"")
  })

  test('模块一补拍现场补充照片后返回 moduleOne 预览页', async () => {
    let page = await openPreviewWithCache(miniProgram, createModuleOneReadyCache(), 'moduleOne')
    let data = await page.data()
    const moduleOneAddSlots = data.moduleOneSummary.sceneSlots.filter((slot) => !slot.completed)
    expect(moduleOneAddSlots).toHaveLength(1)

    await callCurrentPageMethod(miniProgram, 'onTapModuleOneSceneSlot', eventDataset({
      sceneType: 'sceneSupplement',
      supplementIndex: 0,
      completed: false
    }))

    page = await waitForPagePath(miniProgram, 'packageD/pages/camera/camera')
    await confirmPendingPhoto(page, miniProgram, SHOOT_STEP.SCENE_SUPPLEMENT, 'wxfile://tmp/e2e-scene-supplement.jpg')

    page = await waitForPreviewMode(miniProgram, 'moduleOne')
    expect((await page.data()).isModuleOnePreview).toBe(true)
  })

  test('模块二补拍车损后返回 moduleTwo 预览页', async () => {
    let page = await openPreviewWithCache(miniProgram, {
      ...createModuleOneReadyCache({ damageCounts: [1] }),
      currentStep: SHOOT_STEP.DAMAGE
    }, 'moduleTwo')
    await callCurrentPageMethod(miniProgram, 'onAddDamage', eventDataset({ vehicle: 0 }))

    page = await waitForPagePath(miniProgram, 'packageD/pages/camera/camera')
    await confirmPendingPhoto(page, miniProgram, SHOOT_STEP.DAMAGE, 'wxfile://tmp/e2e-damage-supplement.jpg')

    page = await waitForPreviewMode(miniProgram, 'moduleTwo')
    expect((await page.data()).isModuleTwoPreview).toBe(true)
  })

  test('模块二预览先弹层确认，再进入模块三证件信息页', async () => {
    let page = await openPreviewWithCache(miniProgram, {
      ...createModuleOneReadyCache({ damageCounts: [1] }),
      currentStep: SHOOT_STEP.DAMAGE
    }, 'moduleTwo')

    await callCurrentPageMethod(miniProgram, 'onEnterDocumentsFromModuleTwo')
    let data = await page.data()
    expect(data.isModuleTwoPreview).toBe(true)
    expect(data.showModuleOneHandoff).toBe(true)
    expect(data.moduleHandoffConfirmText).toBe('进入证件信息')
    expect(data.moduleHandoffTarget).toBe('moduleThree')

    await callCurrentPageMethod(miniProgram, 'onCloseModuleOneHandoff')
    expect((await page.data()).isModuleTwoPreview).toBe(true)

    await callCurrentPageMethod(miniProgram, 'onEnterDocumentsFromModuleTwo')
    await callCurrentPageMethod(miniProgram, 'onConfirmModuleOneHandoff')

    page = await waitForPreviewMode(miniProgram, 'moduleThree')
    data = await page.data()
    expect(data.isModuleThreePreview).toBe(true)
    expect(data.isFinalPreview).toBe(false)
  })

  test('单车：模块三采集电子驾驶证和实物行驶证后进入最终总预览', async () => {
    let page = await openPreviewWithCache(miniProgram, createModuleThreeCache({
      damageCounts: [1]
    }), 'moduleThree')

    let data = await page.data()
    expect(data.isModuleThreePreview).toBe(true)
    expect(data.pageTitle).toBe('证件信息')
    expect(data.vehicles).toHaveLength(1)
    expect(data.vehicles[0].vehicleDocumentPreview.displayItems.map((item) => item.label)).toEqual(['驾驶证', '行驶证'])

    await selectVehicleDocument(miniProgram, 0, 'driver_license', 0)
    await uploadActiveDocumentSlot(miniProgram, 'electronic', 'driver_license', 'wxfile://tmp/e2e-driver-electronic.jpg')
    data = await page.data()
    expect(data.vehicles[0].vehicleDocumentPreview.displayItems
      .filter((item) => item.docType === 'driver_license')
      .map((item) => item.label)).toEqual(['驾驶证'])

    await selectVehicleDocument(miniProgram, 0, 'driving_license', 1)
    await uploadActiveDocumentSlot(miniProgram, 'front_page', 'driving_license', 'wxfile://tmp/e2e-driving-front.jpg')
    await uploadActiveDocumentSlot(miniProgram, 'back_page', 'driving_license', 'wxfile://tmp/e2e-driving-back.jpg')
    data = await page.data()
    expect(data.vehicles[0].vehicleDocumentPreview.displayItems
      .filter((item) => item.docType === 'driving_license')
      .map((item) => item.label)).toEqual(['行驶证-正页', '行驶证-副页'])

    await callCurrentPageMethod(miniProgram, 'onPreview', eventDataset({
      vehicle: 0,
      type: 'vehicleDocument',
      docType: 'driver_license',
      docSide: 'electronic'
    }))
    expect((await page.data()).showPreview).toBe(true)
    await callCurrentPageMethod(miniProgram, 'onClosePreview')

    await callCurrentPageMethod(miniProgram, 'onEnterFinalFromModuleThree')
    data = await page.data()
    expect(data.showModuleOneHandoff).toBe(true)
    expect(data.moduleHandoffConfirmText).toBe('进入最终总预览')

    await callCurrentPageMethod(miniProgram, 'onConfirmModuleOneHandoff')
    page = await waitForPreviewMode(miniProgram, 'final')
    data = await page.data()
    expect(data.isFinalPreview).toBe(true)
    expect(data.pageTitle).toBe('最终总预览')
    expect(data.moduleOneSummary.scenePhotoCount).toBeGreaterThanOrEqual(1)
    expect(data.allPhotos.some((photo) => photo.type === 'damage')).toBe(true)
    expect(data.allPhotos.some((photo) => (
      photo.type === 'vehicleDocument'
      && photo.docType === 'driver_license'
      && photo.docSide === 'electronic'
    ))).toBe(true)
    expect(data.allPhotos.some((photo) => (
      photo.type === 'vehicleDocument'
      && photo.docType === 'driving_license'
      && photo.docSide === 'back_page'
    ))).toBe(true)
  })

  test('多车：模块三按车辆展示证件入口，最终页按车辆保留证件内容', async () => {
    const cache = createModuleThreeCache({
      vehicleCount: 2,
      damageCounts: [1, 1],
      documentsByVehicle: [
        [
          createDocument('driver_license', 'electronic', 0, 'driver-0-electronic'),
          createDocument('driving_license', 'front_page', 0, 'driving-0-front'),
          createDocument('driving_license', 'back_page', 0, 'driving-0-back')
        ],
        [
          createDocument('driver_license', 'front_page', 1, 'driver-1-front'),
          createDocument('driver_license', 'back_page', 1, 'driver-1-back'),
          createDocument('driving_license', 'electronic', 1, 'driving-1-electronic')
        ]
      ]
    })
    cache.vehicles[0].documentSelections = {
      driver_license: 'electronic',
      driving_license: 'physical'
    }
    cache.vehicles[1].documentSelections = {
      driver_license: 'physical',
      driving_license: 'electronic'
    }

    let page = await openPreviewWithCache(miniProgram, cache, 'moduleThree')
    let data = await page.data()
    expect(data.isModuleThreePreview).toBe(true)
    expect(data.vehicles).toHaveLength(2)
    expect(data.vehicles[0].vehicleDocumentPreview.displayItems.map((item) => item.label)).toEqual([
      '驾驶证',
      '行驶证-正页',
      '行驶证-副页'
    ])
    expect(data.vehicles[1].vehicleDocumentPreview.displayItems.map((item) => item.label)).toEqual([
      '驾驶证-正页',
      '驾驶证-副页',
      '行驶证'
    ])

    await callCurrentPageMethod(miniProgram, 'onEnterFinalFromModuleThree')
    await callCurrentPageMethod(miniProgram, 'onConfirmModuleOneHandoff')

    page = await waitForPreviewMode(miniProgram, 'final')
    data = await page.data()
    expect(data.isFinalPreview).toBe(true)
    expect(data.vehicles).toHaveLength(2)
    expect(data.allPhotos.filter((photo) => photo.type === 'damage')).toHaveLength(2)
    expect(data.allPhotos.filter((photo) => photo.type === 'vehicleDocument')).toHaveLength(6)
  })

  test('缺失证件仍可进入最终页，最终提交前提示但不硬拦截', async () => {
    let page = await openPreviewWithCache(miniProgram, createModuleThreeCache({
      vehicleCount: 3,
      damageCounts: [1, 1, 1]
    }), 'moduleThree')

    await installWxMediaMocks(miniProgram)
    await callCurrentPageMethod(miniProgram, 'onEnterFinalFromModuleThree')
    let data = await page.data()
    const mediaState = await getWxMediaState(miniProgram)
    expect(data.showModuleOneHandoff).toBe(true)
    expect(mediaState.toastTitles.some((title) => title.includes('仍有车辆证件信息未采集完整'))).toBe(true)

    await callCurrentPageMethod(miniProgram, 'onConfirmModuleOneHandoff')
    page = await waitForPreviewMode(miniProgram, 'final')
    data = await page.data()
    expect(data.isFinalPreview).toBe(true)

    await callCurrentPageMethod(miniProgram, 'onSubmit')
    data = await page.data()
    expect(data.showModal).toBe(true)
    expect(data.modalType).toBe('drivingLicenseRisk')
    expect(data.modalContent).toContain('建议补充驾驶证和行驶证')
  })

  test('最终页补拍车损返回 final，模块三补拍证件返回 moduleThree', async () => {
    let page = await openPreviewWithCache(miniProgram, createModuleThreeCache({
      damageCounts: [1]
    }), 'moduleThree')

    await selectVehicleDocument(miniProgram, 0, 'driver_license', 0)
    await uploadActiveDocumentSlot(miniProgram, 'electronic', 'driver_license', 'wxfile://tmp/e2e-module-three-driver.jpg')
    page = await waitForPreviewMode(miniProgram, 'moduleThree')
    expect((await page.data()).isModuleThreePreview).toBe(true)

    await callCurrentPageMethod(miniProgram, 'onEnterFinalFromModuleThree')
    await callCurrentPageMethod(miniProgram, 'onConfirmModuleOneHandoff')
    page = await waitForPreviewMode(miniProgram, 'final')
    expect((await page.data()).isFinalPreview).toBe(true)

    await callCurrentPageMethod(miniProgram, 'onAddDamage', eventDataset({ vehicle: 0 }))
    page = await waitForPagePath(miniProgram, 'packageD/pages/camera/camera')
    await confirmPendingPhoto(page, miniProgram, SHOOT_STEP.DAMAGE, 'wxfile://tmp/e2e-final-damage.jpg')

    const cache = await readCache(miniProgram)
    const pageStack = await getCurrentPageStack(miniProgram)
    expect(cache.previewReturnMode).toBe('final')
    expect(cache.vehicles[0].damages).toHaveLength(2)
    expect(pageStack.some((item) => (
      item.route === 'packageD/pages/preview/preview'
      && item.isFinalPreview
    ))).toBe(true)
  })
})
