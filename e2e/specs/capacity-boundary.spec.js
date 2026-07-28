const {
  launchMiniProgram,
  closeMiniProgram,
  wait,
  waitForCondition,
  seedCache,
  readCache,
  installWxMediaMocks,
  getWxMediaState,
  installCurrentPageCameraMock,
  getCameraMockState,
  createCameraRuntimeErrorCollector
} = require('../support/automator')
const {
  createFullDamageScenario,
  createNearLimitScenario,
  collectAllPhotoPaths,
  assertNoDuplicatePhotoPaths
} = require('../support/scenario-builder')
const { SHOOT_STEP, createPhoto } = require('../support/fixtures')
const cacheSelectors = require('../../packageD/utils/cache-selectors')

function hasCapacityToast(state) {
  return (state.toastTitles || []).some((title) => title.includes('50') && title.includes('删除'))
}

describe('P0 容量边界 e2e', () => {
  let miniProgram

  beforeAll(async () => {
    miniProgram = await launchMiniProgram()
  })

  afterAll(async () => {
    await closeMiniProgram(miniProgram)
  })

  test('[P0-01] 单车 10 张车损满图进入 preview 后统计正确', async () => {
    const scenario = createFullDamageScenario({ vehicleCount: 1, damageCountPerVehicle: 10 })
    await seedCache(miniProgram, scenario)

    const page = await miniProgram.reLaunch('/packageD/pages/preview/preview?mode=moduleTwo')
    await wait(800)

    const cache = await readCache(miniProgram)
    const data = await page.data()
    const summary = cacheSelectors.getCacheSummary(cache)

    expect(data.vehicles).toHaveLength(1)
    expect(data.vehicles[0].licensePlate.status).toBe('completed')
    expect(data.vehicles[0].vinCode.status).toBe('completed')
    expect(data.vehicles[0].damages).toHaveLength(10)
    expect(data.totalPhotoCount).toBe(12)
    expect(summary.totalPhotos).toBe(12)
    expect(summary.photoCounts.damage).toBe(10)
    expect(collectAllPhotoPaths(cache)).toHaveLength(12)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })

  test('[P0-06] 达到 50 张总图片后不允许继续新增，并给出明确提示', async () => {
    const scenario = createNearLimitScenario({ totalPhotoCount: 50 })
    await seedCache(miniProgram, scenario)
    await installWxMediaMocks(miniProgram, 'success', { uniqueCompressedPath: true })

    const page = await miniProgram.reLaunch('/packageD/pages/preview/preview?mode=moduleTwo')
    await wait(800)

    await page.callMethod('onAddDocument')
    await page.callMethod('onChooseAlbum')
    await wait(500)

    const cache = await readCache(miniProgram)
    const wxState = await getWxMediaState(miniProgram)

    expect(collectAllPhotoPaths(cache)).toHaveLength(50)
    expect(wxState.chooseMediaCalls).toBe(0)
    expect(hasCapacityToast(wxState)).toBe(true)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })

  test('[P0-07] 50 张删除 1 张后释放容量，允许继续新增', async () => {
    const scenario = createNearLimitScenario({ totalPhotoCount: 50 })
    const deletedPath = scenario.documents[0].compressedPath
    await seedCache(miniProgram, scenario)
    await installWxMediaMocks(miniProgram, 'success', { uniqueCompressedPath: true })

    const page = await miniProgram.reLaunch('/packageD/pages/preview/preview?mode=moduleTwo')
    await wait(800)

    await page.callMethod('onDeleteDocument', {
      currentTarget: {
        dataset: { index: 0 }
      }
    })
    await wait(300)

    const afterDelete = await readCache(miniProgram)
    expect(collectAllPhotoPaths(afterDelete)).toHaveLength(49)
    expect(collectAllPhotoPaths(afterDelete)).not.toContain(deletedPath)

    await page.callMethod('onAddDocument')
    await page.callMethod('onChooseAlbum')
    await wait(800)

    const afterAdd = await readCache(miniProgram)
    const wxState = await getWxMediaState(miniProgram)
    const paths = collectAllPhotoPaths(afterAdd)

    expect(paths).toHaveLength(50)
    expect(paths).not.toContain(deletedPath)
    expect(paths.some((path) => path.startsWith('wxfile://tmp/e2e-compressed-'))).toBe(true)
    expect(wxState.chooseMediaCalls).toBe(1)
    expect(() => assertNoDuplicatePhotoPaths(afterAdd)).not.toThrow()
  })

  test('[P0-08] aux photo rejects the eleventh damage photo and advances after confirmation', async () => {
    const scenario = createFullDamageScenario({ vehicleCount: 2, damageCountPerVehicle: [10, 0] })
    const extraDamagePath = 'wxfile://tmp/p0-aux-overflow-damage-11.jpg'
    scenario.auxPhoto = {
      enabled: true,
      ticket: 'mock-2'
    }
    scenario.currentVehicleIndex = 0
    scenario.currentStep = SHOOT_STEP.DAMAGE
    scenario.currentDamageCount = scenario.vehicles[0].damages.length
    scenario.workflowState = {
      current: 'CAPTURING',
      updatedAt: new Date().toISOString()
    }
    await seedCache(miniProgram, scenario)
    await installWxMediaMocks(miniProgram, 'success', { uniqueCompressedPath: true })
    const runtimeErrors = createCameraRuntimeErrorCollector(miniProgram)

    try {
      const page = await miniProgram.reLaunch('/packageD/pages/camera/camera')
    await wait(800)
    await page.setData({
      currentStep: SHOOT_STEP.DAMAGE,
      showConfirmModal: true,
      pendingPhoto: createPhoto({
        tempFilePath: 'wxfile://tmp/p0-aux-overflow-damage-11-original.jpg',
        compressedPath: extraDamagePath,
        captureTrigger: 'p0_aux_overflow'
      }),
      damageCount: 10
    })

    await page.callMethod('onConfirmPhoto')
    await wait(300)

    const beforeAdvanceCache = await readCache(miniProgram)
    const beforeAdvanceData = await page.data()
    const beforeAdvancePaths = collectAllPhotoPaths(beforeAdvanceCache)
    const cameraDuringModal = await page.$$('camera')

    expect(beforeAdvanceCache.vehicles[0].damages).toHaveLength(10)
    expect(beforeAdvanceCache.currentVehicleIndex).toBe(0)
    expect(beforeAdvanceCache.currentStep).toBe(SHOOT_STEP.DAMAGE)
    expect(beforeAdvancePaths).not.toContain(extraDamagePath)
    expect(beforeAdvanceData.showConfirmModal).toBe(false)
    expect(beforeAdvanceData.pendingPhoto).toBe(null)
    expect(beforeAdvanceData.showDamageCompleteModal).toBe(true)
    expect(beforeAdvanceData.cameraMounted).toBe(false)
    expect(cameraDuringModal).toHaveLength(0)
    expect(beforeAdvanceData.damageCompleteConfirmText).toBe('下一辆车')

    await page.callMethod('onDamageCompleteModalConfirm')

    const data = await waitForCondition(async () => {
      const current = await page.data()
      if (
        current.currentStep === SHOOT_STEP.DAMAGE
        && current.showDamageCompleteModal === false
        && current.cameraMounted === true
      ) {
        return current
      }
      return null
    }, 2500)

    const cache = await readCache(miniProgram)
    let wxState = await getWxMediaState(miniProgram)
    const paths = collectAllPhotoPaths(cache)
    const cameraAfterAdvance = await page.$$('camera')

    expect(cache.vehicles[0].damages).toHaveLength(10)
    expect(cache.currentVehicleIndex).toBe(1)
    expect(cache.currentStep).toBe(SHOOT_STEP.DAMAGE)
    expect(cache.currentDamageCount).toBe(0)
    expect(paths).not.toContain(extraDamagePath)
    expect(data.currentStep).toBe(SHOOT_STEP.DAMAGE)
    expect(data.damageCount).toBe(0)
    expect(data.showConfirmModal).toBe(false)
    expect(data.showDamageCompleteModal).toBe(false)
    expect(data.cameraMounted).toBe(true)
    expect(data.pendingPhoto).toBe(null)
    expect(cameraAfterAdvance.length).toBeLessThanOrEqual(1)
    expect(wxState.showModalCalls).toBe(0)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()

    const beforeSecondVehicleCompress = wxState.compressImageCalls
    expect(await installCurrentPageCameraMock(miniProgram, 'wxfile://tmp/p0-second-vehicle-damage-original.jpg')).toBe(true)

    await page.callMethod('onCapture')
    wxState = await waitForCondition(async () => {
      const current = await getWxMediaState(miniProgram)
      return current.compressImageCalls > beforeSecondVehicleCompress ? current : null
    }, 2500)

    const cameraMockState = await getCameraMockState(miniProgram)
    const afterSecondCaptureData = await page.data()
    expect(cameraMockState.takePhotoCalls).toBe(1)
    expect(wxState.compressImageCalls).toBe(beforeSecondVehicleCompress + 1)
    expect(afterSecondCaptureData.showConfirmModal).toBe(true)
    expect(afterSecondCaptureData.pendingPhoto).toEqual(expect.objectContaining({
      compressedPath: expect.stringContaining('wxfile://tmp/e2e-compressed-')
    }))
    runtimeErrors.assertClean('P0-08 camera runtime')
    } finally {
      runtimeErrors.detach()
    }
  })
})
