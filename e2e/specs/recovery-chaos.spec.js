const {
  launchMiniProgram,
  closeMiniProgram,
  wait,
  waitForCondition,
  seedCache,
  readCache,
  installWxMediaMocks,
  saveRetakenDamageForE2E
} = require('../support/automator')
const { createPhoto } = require('../support/fixtures')
const {
  createFullDamageScenario,
  cloneCacheSnapshot,
  collectAllPhotoPaths,
  assertNoDuplicatePhotoPaths
} = require('../support/scenario-builder')
const cacheSelectors = require('../../packageD/utils/cache-selectors')

function eventDataset(dataset) {
  return {
    currentTarget: { dataset }
  }
}

function buildPhoto(pathKey, trigger = 'p0_recovery') {
  return createPhoto({
    tempFilePath: `wxfile://tmp/${pathKey}-original.jpg`,
    compressedPath: `wxfile://tmp/${pathKey}.jpg`,
    captureTrigger: trigger
  })
}

async function returnToPreview(miniProgram) {
  await wait(500)
  let current = await miniProgram.currentPage()

  if (!current.path || !current.path.includes('preview')) {
    current = await miniProgram.reLaunch('/packageD/pages/preview/preview')
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

  await saveRetakenDamageForE2E(
    miniProgram,
    vehicleIndex,
    damageIndex,
    buildPhoto(newPathKey, 'p0_recovery_retake')
  )
  const newPath = `wxfile://tmp/${newPathKey}.jpg`
  await waitForCondition(async () => {
    const cache = await readCache(miniProgram)
    const paths = collectAllPhotoPaths(cache)
    const retakeCleared = !cache.retakeMode || cache.retakeMode.enabled === false
    return retakeCleared && paths.includes(newPath) ? cache : null
  }, 8000)

  return returnToPreview(miniProgram)
}

describe('P0 恢复与乱序操作 e2e', () => {
  let miniProgram

  beforeAll(async () => {
    miniProgram = await launchMiniProgram()
  })

  afterAll(async () => {
    await closeMiniProgram(miniProgram)
  })

  test('[P0-11] 删除/重拍后退出重进，cache 和页面统计仍然一致', async () => {
    const scenario = createFullDamageScenario({ vehicleCount: 1 })
    const deletedPath = scenario.vehicles[0].damages[0].compressedPath
    const oldRetakePath = scenario.vehicles[0].damages[3].compressedPath
    const retakePath = 'wxfile://tmp/p0-recovery-retake-2.jpg'

    await seedCache(miniProgram, scenario)
    await installWxMediaMocks(miniProgram, 'success')

    let page = await miniProgram.reLaunch('/packageD/pages/preview/preview')
    await wait(800)

    await deleteDamage(page, 0, 0)
    page = await retakeDamage(page, miniProgram, 0, 2, 'p0-recovery-retake-2')

    const beforeReentry = cloneCacheSnapshot(await readCache(miniProgram))
    const beforePaths = collectAllPhotoPaths(beforeReentry)

    page = await miniProgram.reLaunch('/packageD/pages/preview/preview')
    await wait(900)

    const cache = await readCache(miniProgram)
    const summary = cacheSelectors.getCacheSummary(cache)
    const data = await page.data()
    const paths = collectAllPhotoPaths(cache)

    expect(paths).toEqual(beforePaths)
    expect(paths).not.toContain(deletedPath)
    expect(paths).not.toContain(oldRetakePath)
    expect(paths).toContain(retakePath)
    expect(cache.vehicles[0].damages).toHaveLength(4)
    expect(data.totalPhotoCount).toBe(summary.totalPhotos)
    expect(data.vehicles[0].damages).toHaveLength(cache.vehicles[0].damages.length)
    expect(summary.photoCounts.damage).toBe(4)
    expect(summary.flowContext.workflowState).toBe('PREVIEWING')
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })
})
