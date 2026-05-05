const {
  launchMiniProgram,
  closeMiniProgram,
  wait,
  waitForCondition,
  seedCache,
  readCache,
  installWxMediaMocks,
  callCurrentPageMethodAsync
} = require('../support/automator')
const { createPhoto } = require('../support/fixtures')
const {
  createScenario,
  collectAllPhotoPaths,
  assertNoDuplicatePhotoPaths
} = require('../support/scenario-builder')
const cacheSelectors = require('../../utils/cache-selectors')

function eventDataset(dataset) {
  return {
    currentTarget: { dataset }
  }
}

function buildRetakePhoto(pathKey) {
  return createPhoto({
    tempFilePath: `wxfile://tmp/${pathKey}-original.jpg`,
    compressedPath: `wxfile://tmp/${pathKey}.jpg`,
    captureTrigger: 'p0_submit_retake'
  })
}

async function waitForCompletePage(miniProgram) {
  const page = await waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    return current.path && current.path.includes('complete') ? current : null
  }, 10000)
  await wait(500)
  return page
}

async function returnToPreview(miniProgram) {
  await wait(500)
  let current = await miniProgram.currentPage()

  if (!current.path || !current.path.includes('preview')) {
    current = await miniProgram.reLaunch('/pages/preview/preview')
    await wait(800)
  }

  return current
}

async function deleteDamage(page, vehicleIndex, damageIndex) {
  await page.callMethod('onPreview', eventDataset({
    vehicle: vehicleIndex,
    type: 'damage',
    damage: damageIndex
  }))
  await wait(100)
  await page.callMethod('onDelete')
  await wait(300)
}

async function retakeDamage(page, miniProgram, vehicleIndex, damageIndex, newPathKey) {
  await page.callMethod('onPreview', eventDataset({
    vehicle: vehicleIndex,
    type: 'damage',
    damage: damageIndex
  }))
  await wait(100)
  await page.callMethod('onRetake')

  const cameraPage = await waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    return current.path && current.path.includes('camera') ? current : null
  }, 8000)

  await callCurrentPageMethodAsync(miniProgram, 'savePhoto', buildRetakePhoto(newPathKey))
  const newPath = `wxfile://tmp/${newPathKey}.jpg`
  await waitForCondition(async () => {
    const cache = await readCache(miniProgram)
    const paths = collectAllPhotoPaths(cache)
    const retakeCleared = !cache.retakeMode || cache.retakeMode.enabled === false
    return retakeCleared && paths.includes(newPath) ? cache : null
  }, 8000)

  return returnToPreview(miniProgram)
}

describe('P0 提交一致性 e2e', () => {
  let miniProgram

  beforeAll(async () => {
    miniProgram = await launchMiniProgram()
  })

  afterAll(async () => {
    await closeMiniProgram(miniProgram)
  })

  test('[P0-10] 多车满图 + 单证补齐后进入 complete，车辆数、车损数、单证数正确', async () => {
    const scenario = createScenario({
      vehicleCount: 2,
      damageCountPerVehicle: 5,
      documentCountPerVehicle: 2
    })
    await seedCache(miniProgram, scenario)

    const page = await miniProgram.reLaunch('/pages/preview/preview')
    await wait(800)

    await page.callMethod('onSubmit')
    expect((await page.data()).modalType).toBe('thirdVehicle')
    await page.callMethod('onModalConfirm')

    const completePage = await waitForCompletePage(miniProgram)
    const completeData = await completePage.data()
    const cache = await readCache(miniProgram)
    const summary = cacheSelectors.getCacheSummary(cache)

    expect(completeData.vehicleCount).toBe(2)
    expect(completeData.damagePhotoCount).toBe(10)
    expect(completeData.documentPhotoCount).toBe(4)
    expect(summary.vehicleCount).toBe(2)
    expect(summary.damagePhotoCount).toBe(10)
    expect(summary.documentPhotoCount).toBe(4)
    expect(summary.flowContext.workflowState).toBe('LOCAL_COMPLETED')
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })

  test('[P0-12] 删除/重拍后提交，旧图不出现在最终 cache/payload 中', async () => {
    const scenario = createScenario({
      vehicleCount: 3,
      damageCountPerVehicle: 5,
      documentCountPerVehicle: 2
    })
    const deletedPath = scenario.vehicles[0].damages[2].compressedPath
    const oldRetakePath = scenario.vehicles[1].damages[4].compressedPath
    const newRetakePath = 'wxfile://tmp/p0-submit-retake-b-4.jpg'

    await seedCache(miniProgram, scenario)
    await installWxMediaMocks(miniProgram, 'success')

    let page = await miniProgram.reLaunch('/pages/preview/preview')
    await wait(800)

    await deleteDamage(page, 0, 2)
    page = await retakeDamage(page, miniProgram, 1, 4, 'p0-submit-retake-b-4')

    await page.callMethod('onSubmit')
    const completePage = await waitForCompletePage(miniProgram)
    const completeData = await completePage.data()
    const cache = await readCache(miniProgram)
    const summary = cacheSelectors.getCacheSummary(cache)
    const finalPaths = collectAllPhotoPaths(cache)
    const payloadPaths = summary.allPhotos.map((photo) => photo.url)

    expect(completeData.vehicleCount).toBe(3)
    expect(completeData.damagePhotoCount).toBe(14)
    expect(completeData.documentPhotoCount).toBe(6)
    expect(finalPaths).not.toContain(deletedPath)
    expect(finalPaths).not.toContain(oldRetakePath)
    expect(finalPaths).toContain(newRetakePath)
    expect(payloadPaths).not.toContain(deletedPath)
    expect(payloadPaths).not.toContain(oldRetakePath)
    expect(payloadPaths).toContain(newRetakePath)
    expect(summary.flowContext.workflowState).toBe('LOCAL_COMPLETED')
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })
})
