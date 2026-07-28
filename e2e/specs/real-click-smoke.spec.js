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
  installCurrentPageCameraMock
} = require('../support/automator')
const {
  SHOOT_STEP,
  createPhoto,
  createVehicle,
  createCache
} = require('../support/fixtures')
const vehicleDocuments = require('../../packageD/utils/documents')
const constants = require('../../packageD/utils/constants')

function withPreviewWorkflow(cache) {
  return {
    ...cache,
    workflowState: {
      current: 'PREVIEWING',
      updatedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  }
}

function createVehicleDocument(docType, docSide, pathKey) {
  return {
    id: `${docType}_${docSide}_${pathKey}`,
    docType,
    docSide,
    label: vehicleDocuments.getVehicleDocumentLabel(docType, docSide),
    sourceType: 'album',
    tempFilePath: `wxfile://tmp/${pathKey}-original.jpg`,
    compressedPath: `wxfile://tmp/${pathKey}.jpg`,
    size: 1024,
    compressedSize: 512,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

function createPreviewCache({
  vehicleCount = 1,
  damageCounts = [1],
  currentStep = SHOOT_STEP.DAMAGE,
  documentsByVehicle = [],
  documentSelectionsByVehicle = []
} = {}) {
  const vehicles = Array.from({ length: vehicleCount }, (_, index) => createVehicle(index, {
    vehicleRoleName: index === 0 ? '标的车' : '三者车',
    licenseNo: index === 0 ? '京A12345' : `京B1234${index}`,
    displayName: index === 0 ? '标的车 京A12345' : `三者车 京B1234${index}`,
    licensePlate: createPhoto({ compressedPath: `wxfile://tmp/real-click-plate-${index}.jpg` }),
    vinCode: createPhoto({ compressedPath: `wxfile://tmp/real-click-vin-${index}.jpg` }),
    damages: Array.from({ length: damageCounts[index] || 0 }, (_, damageIndex) => createPhoto({
      compressedPath: `wxfile://tmp/real-click-damage-${index}-${damageIndex}.jpg`
    })),
    documents: documentsByVehicle[index] || [],
    documentSelections: {
      ...vehicleDocuments.getDefaultDocumentSelections(),
      ...(documentSelectionsByVehicle[index] || {})
    }
  }))

  return withPreviewWorkflow(createCache({
    schemaVersion: 2,
    vehicles,
    scenePhotos: {
      scene45: createPhoto({ compressedPath: 'wxfile://tmp/real-click-scene45.jpg' }),
      supplements: []
    },
    documents: [],
    currentStep,
    currentVehicleIndex: 0,
    currentDamageCount: vehicles[0] && Array.isArray(vehicles[0].damages)
      ? vehicles[0].damages.length
      : 0,
    retakeMode: {
      enabled: false,
      vehicleIndex: null,
      photoType: null,
      damageIndex: null
    },
    fromPreview: false
  }))
}

function getPreviewModeFlag(mode) {
  return {
    moduleTwo: 'isModuleTwoPreview',
    moduleThree: 'isModuleThreePreview',
    final: 'isFinalPreview'
  }[mode] || ''
}

async function runAutomatorCommand(label, action, attempts = 2, retryDelayMs = 1000) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await wait(retryDelayMs)
      }
    }
  }

  throw new Error(`${label}失败: ${lastError && lastError.message ? lastError.message : lastError}`)
}

async function waitForPagePath(miniProgram, pathPart, timeoutMs = 10000) {
  return waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    return current.path && current.path.includes(pathPart) ? current : null
  }, timeoutMs, 200)
}

async function waitForPreviewMode(miniProgram, mode, timeoutMs = 10000) {
  const modeFlag = getPreviewModeFlag(mode)

  return waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    if (!current.path || !current.path.includes('packageD/pages/preview/preview')) {
      return null
    }

    const data = await current.data()
    return !modeFlag || data[modeFlag] ? current : null
  }, timeoutMs, 200)
}

async function openPreviewWithCache(miniProgram, cache, mode) {
  await runAutomatorCommand('写入预览缓存', () => seedCache(miniProgram, cache))
  await runAutomatorCommand('打开预览页', () => miniProgram.reLaunch(`/packageD/pages/preview/preview?mode=${mode}`))
  return waitForPreviewMode(miniProgram, mode)
}

async function tapRequired(page, selector, label) {
  const element = await waitForCondition(async () => {
    const current = await page.$(selector)
    return current || null
  }, 5000, 200)

  await element.tap()
  await wait(500)
  return element
}

async function tapElementByText(page, selector, textPattern, label) {
  const target = await waitForCondition(async () => {
    const elements = await page.$$(selector)
    for (const element of elements) {
      const text = await element.text()
      if (textPattern.test(text || '')) {
        return element
      }
    }

    return null
  }, 5000, 200)

  if (!target) {
    throw new Error(`找不到可点击元素: ${label} (${selector})`)
  }

  await target.tap()
  await wait(500)
  return target
}

async function tapChildRequired(page, parentSelector, childSelector, label) {
  const child = await waitForCondition(async () => {
    const parent = await page.$(parentSelector)
    if (!parent) return null
    return parent.$(childSelector)
  }, 5000, 200)

  await child.tap()
  await wait(500)
  return child
}

async function tapCaptureAndConfirm(miniProgram, cameraPhotoPath) {
  const cameraPage = await waitForPagePath(miniProgram, 'packageD/pages/camera/camera')
  let data = await waitForCondition(async () => {
    const data = await cameraPage.data()
    return data.currentStep === SHOOT_STEP.DAMAGE && data.cameraMounted ? data : null
  }, 10000, 200)

  if (data.showCaptureGuideModal) {
    await tapRequired(cameraPage, '.guide-primary-btn', '拍摄指引确认按钮')
    data = await waitForCondition(async () => {
      const current = await cameraPage.data()
      return current.cameraMounted && !current.showCaptureGuideModal ? current : null
    }, 5000, 200)
  }

  expect(data.showCaptureGuideModal).toBe(false)
  expect(await installCurrentPageCameraMock(miniProgram, cameraPhotoPath)).toBe(true)

  await tapRequired(cameraPage, '.capture-btn', '相机拍照按钮')
  await waitForCondition(async () => {
    const data = await cameraPage.data()
    return data.showConfirmModal && data.pendingPhoto ? data : null
  }, 5000, 200)

  await tapRequired(cameraPage, '.btn-confirm', '确认使用照片按钮')
}

async function expectNoRenderedAddDamageEntry(page) {
  const candidates = await page.$$('.photo-item[data-vehicle="0"]')

  for (const candidate of candidates) {
    const text = await candidate.text()
    expect(text).not.toMatch(/添加车损|拍摄车损/)
  }
}

describe('真实点击 smoke：关键页面入口和回流', () => {
  let miniProgram

  beforeAll(async () => {
    miniProgram = await launchMiniProgram()
  })

  beforeEach(async () => {
    await runAutomatorCommand('重置到首页', () => miniProgram.reLaunch('/packageD/pages/index/index'), 3, 3000)
    await wait(500)
    await runAutomatorCommand('清理 e2e 状态', () => clearE2EState(miniProgram))
  })

  afterEach(async () => {
    await wait(1000)
  })

  afterAll(async () => {
    await closeMiniProgram(miniProgram)
    miniProgram = null
  })

  test('模块三证件入口真实点击：入口先开自定义面板，槽位内才弹拍照/相册 actionSheet', async () => {
    const cache = createPreviewCache({
      currentStep: 'moduleThree',
      documentSelectionsByVehicle: [{
        [vehicleDocuments.DOCUMENT_TYPES.DRIVER_LICENSE]: vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC
      }]
    })
    await installWxMediaMocks(miniProgram, 'success', {
      actionSheetTapIndex: 1,
      mediaPaths: ['wxfile://tmp/real-click-driver-front.jpg'],
      uniqueCompressedPath: true
    })

    const page = await openPreviewWithCache(miniProgram, cache, 'moduleThree')
    await tapRequired(
      page,
      '.doc-package-tile[data-doc-type="driver_license"]',
      '模块三驾驶证入口'
    )

    let data = await page.data()
    let mediaState = await getWxMediaState(miniProgram)
    let currentCache = await readCache(miniProgram)
    expect(data.showDrivingLicensePanel).toBe(true)
    expect(data.activeDrivingLicenseDocType).toBe(vehicleDocuments.DOCUMENT_TYPES.DRIVER_LICENSE)
    expect(data.activeDrivingLicenseVehicleIndex).toBe(0)
    expect(mediaState.showActionSheetCalls).toBe(0)
    expect(currentCache.vehicles[0].documentSelections.driver_license).toBe(vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC)

    await tapRequired(page, '.license-mode-tab[data-mode="physical"]', '证件面板实物证件 tab')
    data = await page.data()
    mediaState = await getWxMediaState(miniProgram)
    currentCache = await readCache(miniProgram)
    expect(data.drivingLicenseMode).toBe(vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL)
    expect(mediaState.showActionSheetCalls).toBe(0)
    expect(currentCache.vehicles[0].documentSelections.driver_license).toBe(vehicleDocuments.DOCUMENT_SELECTIONS.ELECTRONIC)

    const beforeActionSheetCalls = mediaState.showActionSheetCalls
    await tapRequired(
      page,
      '.license-upload-slot[data-doc-type="driver_license"][data-side="front_page"]',
      '驾驶证实物正页槽位'
    )

    mediaState = await waitForCondition(async () => {
      const state = await getWxMediaState(miniProgram)
      return state.showActionSheetCalls > beforeActionSheetCalls && state.chooseMediaCalls > 0 ? state : null
    }, 5000, 200)
    expect(mediaState.showActionSheetCalls).toBe(beforeActionSheetCalls + 1)

    await waitForCondition(async () => {
      const nextData = await page.data()
      return nextData.vehicles[0].vehicleDocumentPreview.displayItems.some((item) => (
        item.docType === vehicleDocuments.DOCUMENT_TYPES.DRIVER_LICENSE
        && item.docSide === vehicleDocuments.DOCUMENT_SIDES.FRONT_PAGE
        && item.type === 'document'
      ))
    }, 5000, 200)

    await tapRequired(page, '.license-panel-close', '关闭证件面板')
    data = await page.data()
    currentCache = await readCache(miniProgram)
    expect(data.showDrivingLicensePanel).toBe(false)
    expect(data.isModuleThreePreview).toBe(true)
    expect(data.isFinalPreview).toBe(false)
    expect(currentCache.vehicles[0].documentSelections.driver_license).toBe(vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL)
  })

  test('模块二车损补拍入口真实点击：从模块二预览进车损拍摄，完成本车后回到 moduleTwo', async () => {
    await installWxMediaMocks(miniProgram, 'success', { uniqueCompressedPath: true })
    let page = await openPreviewWithCache(miniProgram, createPreviewCache({
      currentStep: SHOOT_STEP.DAMAGE,
      damageCounts: [1]
    }), 'moduleTwo')

    await tapElementByText(
      page,
      '.photo-item[data-vehicle="0"]',
      /添加车损|拍摄车损/,
      '模块二车损补拍 + 入口'
    )

    page = await waitForPagePath(miniProgram, 'packageD/pages/camera/camera')
    let data = await page.data()
    let cache = await readCache(miniProgram)
    expect(data.currentStep).toBe(SHOOT_STEP.DAMAGE)
    expect(cache.currentStep).toBe(SHOOT_STEP.DAMAGE)
    expect(cache.previewReturnMode).toBe('moduleTwo')

    await tapCaptureAndConfirm(miniProgram, 'wxfile://tmp/real-click-module-two-damage-original.jpg')

    data = await waitForCondition(async () => {
      const current = await page.data()
      return current.currentStep === SHOOT_STEP.DAMAGE
        && !current.showConfirmModal
        && current.damageCount === 2
        ? current
        : null
    }, 10000, 200)
    cache = await readCache(miniProgram)
    expect(data.currentStep).toBe(SHOOT_STEP.DAMAGE)
    expect(cache.vehicles[0].damages).toHaveLength(2)

    await tapRequired(page, '.finish-btn', '完成本车拍摄按钮')
    data = await waitForCondition(async () => {
      const current = await page.data()
      return current.showDamageCompleteModal ? current : null
    }, 5000, 200)
    expect(data.damageCompleteModalTitle).toBe('车损照片较少')

    await tapChildRequired(page, 'confirm-modal', '.modal-btn-confirm', '车损较少软确认按钮')

    page = await waitForPreviewMode(miniProgram, 'moduleTwo')
    data = await page.data()
    cache = await readCache(miniProgram)
    expect(data.isModuleTwoPreview).toBe(true)
    expect(data.isFinalPreview).toBe(false)
    expect(cache.vehicles[0].damages).toHaveLength(2)
  })

  test('最终预览车损删空后真实点击补拍入口，补拍后回到 final', async () => {
    await installWxMediaMocks(miniProgram, 'success', {
      modalConfirm: true,
      uniqueCompressedPath: true
    })
    let page = await openPreviewWithCache(miniProgram, createPreviewCache({
      currentStep: 'preview',
      damageCounts: [1],
      documentsByVehicle: [[
        createVehicleDocument('driver_license', 'electronic', 'real-click-driver-electronic'),
        createVehicleDocument('driving_license', 'front_page', 'real-click-driving-front'),
        createVehicleDocument('driving_license', 'back_page', 'real-click-driving-back')
      ]],
      documentSelectionsByVehicle: [{
        driver_license: 'electronic',
        driving_license: 'physical'
      }]
    }), 'final')

    await tapRequired(
      page,
      '.photo-item[data-type="damage"][data-vehicle="0"][data-damage="0"]',
      '最终预览车损图片'
    )
    await waitForCondition(async () => {
      const data = await page.data()
      return data.showPreview && data.currentPhoto && data.currentPhoto.type === 'damage' ? data : null
    }, 5000, 200)

    await tapRequired(page, '.preview-btn.danger', '全屏预览删除按钮')
    await waitForCondition(async () => {
      const cache = await readCache(miniProgram)
      return cache.vehicles[0].damages.length === 0 ? cache : null
    }, 5000, 200)

    let data = await page.data()
    expect(data.isFinalPreview).toBe(true)
    expect(data.vehicles[0].damages).toHaveLength(0)

    await tapElementByText(
      page,
      '.photo-item[data-vehicle="0"]',
      /拍摄车损|添加车损/,
      '最终预览删空后的车损补拍 + 入口'
    )

    page = await waitForPagePath(miniProgram, 'packageD/pages/camera/camera')
    data = await page.data()
    let cache = await readCache(miniProgram)
    expect(data.currentStep).toBe(SHOOT_STEP.DAMAGE)
    expect(cache.previewReturnMode).toBe('final')

    await tapCaptureAndConfirm(miniProgram, 'wxfile://tmp/real-click-final-damage-original.jpg')

    page = await waitForPreviewMode(miniProgram, 'final')
    data = await page.data()
    cache = await readCache(miniProgram)
    expect(data.isFinalPreview).toBe(true)
    expect(data.isModuleTwoPreview).toBe(false)
    expect(cache.vehicles[0].damages).toHaveLength(1)
  })

  test('车损达到 10 张时真实渲染不再出现继续新增入口', async () => {
    const page = await openPreviewWithCache(miniProgram, createPreviewCache({
      currentStep: SHOOT_STEP.DAMAGE,
      damageCounts: [constants.LIMITS.MAX_DAMAGES]
    }), 'moduleTwo')
    const data = await page.data()

    expect(data.vehicles[0].damages).toHaveLength(constants.LIMITS.MAX_DAMAGES)
    await expectNoRenderedAddDamageEntry(page)
  })

  test('E2E-RESTORE-EXIT-001 恢复闭环二次进入：同 ticket 普通预览缓存不得回到无出口预览页', async () => {
    const previewLoopCache = createPreviewCache({
      currentStep: SHOOT_STEP.PREVIEW,
      damageCounts: [1]
    })
    previewLoopCache.auxPhoto = {
      enabled: true,
      ticket: 'mock-2'
    }
    previewLoopCache.workflowState = {
      current: 'PREVIEWING',
      updatedAt: new Date().toISOString()
    }

    await runAutomatorCommand('写入普通预览态缓存', () => seedCache(miniProgram, previewLoopCache))
    const indexPage = await runAutomatorCommand(
      '重新进入同 ticket 首页',
      () => miniProgram.reLaunch('/packageD/pages/index/index?ticket=mock-2&reportNo=MOCK_REGIST_NO')
    )
    await wait(500)

    await tapRequired(indexPage, '.start-button', '首页开始采集按钮')

    const current = await waitForCondition(async () => {
      const page = await miniProgram.currentPage()
      const path = page.path || ''
      return /packageD\/pages\/(preview|camera|complete)\//.test(path) ? page : null
    }, 10000, 200)
    const path = current.path || ''
    const data = await current.data().catch(() => ({}))
    const isExplicitPreviewMode = !!(
      data.isModuleOnePreview
      || data.isModuleTwoPreview
      || data.isModuleThreePreview
      || data.isFinalPreview
    )

    expect(
      !path.includes('packageD/pages/preview/preview')
      || isExplicitPreviewMode
      || data.showUploadOverlay
    ).toBe(true)
  })

  test('模块三 E+F 状态真实点击副页 + 可补齐，完成态保持已完成', async () => {
    await installWxMediaMocks(miniProgram, 'success', {
      actionSheetTapIndex: 1,
      mediaPaths: ['wxfile://tmp/real-click-driver-back.jpg'],
      uniqueCompressedPath: true
    })
    const page = await openPreviewWithCache(miniProgram, createPreviewCache({
      currentStep: 'moduleThree',
      documentsByVehicle: [[
        createVehicleDocument('driver_license', 'electronic', 'real-click-ef-driver-electronic'),
        createVehicleDocument('driver_license', 'front_page', 'real-click-ef-driver-front')
      ]],
      documentSelectionsByVehicle: [{
        driver_license: 'physical'
      }]
    }), 'moduleThree')
    let data = await page.data()
    const driverGroup = data.vehicles[0].vehicleDocumentPreview.groups.find((group) => (
      group.docType === vehicleDocuments.DOCUMENT_TYPES.DRIVER_LICENSE
    ))
    expect(driverGroup.isComplete).toBe(true)

    await tapRequired(
      page,
      '.doc-package-tile[data-doc-type="driver_license"][data-doc-side="back_page"]',
      'E+F 状态下驾驶证副页 + 入口'
    )

    data = await page.data()
    let mediaState = await getWxMediaState(miniProgram)
    expect(data.showDrivingLicensePanel).toBe(true)
    expect(data.drivingLicenseMode).toBe(vehicleDocuments.DOCUMENT_SELECTIONS.PHYSICAL)
    expect(mediaState.showActionSheetCalls).toBe(0)

    const beforeActionSheetCalls = mediaState.showActionSheetCalls
    await tapRequired(
      page,
      '.license-upload-slot[data-doc-type="driver_license"][data-side="back_page"]',
      '驾驶证实物副页槽位'
    )
    await waitForCondition(async () => {
      const state = await getWxMediaState(miniProgram)
      return state.showActionSheetCalls > beforeActionSheetCalls && state.chooseMediaCalls > 0 ? state : null
    }, 5000, 200)

    data = await waitForCondition(async () => {
      const nextData = await page.data()
      const labels = nextData.vehicles[0].vehicleDocumentPreview.displayItems
        .filter((item) => item.docType === vehicleDocuments.DOCUMENT_TYPES.DRIVER_LICENSE)
        .map((item) => item.label)
      return labels.includes('驾驶证-副页') ? nextData : null
    }, 5000, 200)
    const finalDriverItems = data.vehicles[0].vehicleDocumentPreview.displayItems
      .filter((item) => item.docType === vehicleDocuments.DOCUMENT_TYPES.DRIVER_LICENSE)
    const finalDriverGroup = data.vehicles[0].vehicleDocumentPreview.groups.find((group) => (
      group.docType === vehicleDocuments.DOCUMENT_TYPES.DRIVER_LICENSE
    ))

    expect(finalDriverGroup.isComplete).toBe(true)
    expect(finalDriverItems).toHaveLength(3)
    expect(finalDriverItems.every((item) => item.type === 'document')).toBe(true)
  })
})
