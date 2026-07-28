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
  createScenario,
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

function damagePaths(cache, vehicleIndex) {
  return cache.vehicles[vehicleIndex].damages.map((photo) => photo.compressedPath)
}

function documentPaths(cache, vehicleIndex) {
  return cache.vehicles[vehicleIndex].documents.map((photo) => photo.compressedPath)
}

function buildRetakePhoto(pathKey) {
  return createPhoto({
    tempFilePath: `wxfile://tmp/${pathKey}-original.jpg`,
    compressedPath: `wxfile://tmp/${pathKey}.jpg`,
    captureTrigger: 'p0_multi_vehicle_retake'
  })
}

async function returnToPreview(miniProgram) {
  await wait(500)
  let current = await miniProgram.currentPage()

  if (!current.path || !current.path.includes('preview')) {
    current = await miniProgram.reLaunch('/packageD/pages/preview/preview?mode=moduleTwo')
    await wait(800)
  }

  return current
}

async function openPreviewPage(miniProgram) {
  const scenario = createScenario({
    vehicleCount: 2,
    damageCountPerVehicle: 5,
    documentCountPerVehicle: 2
  })
  await seedCache(miniProgram, scenario)
  await installWxMediaMocks(miniProgram, 'success')
  const page = await miniProgram.reLaunch('/packageD/pages/preview/preview?mode=moduleTwo')
  await wait(800)
  return page
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

  await saveRetakenDamageForE2E(miniProgram, vehicleIndex, damageIndex, buildRetakePhoto(newPathKey))
  const newPath = `wxfile://tmp/${newPathKey}.jpg`
  await waitForCondition(async () => {
    const cache = await readCache(miniProgram)
    const paths = collectAllPhotoPaths(cache)
    const retakeCleared = !cache.retakeMode || cache.retakeMode.enabled === false
    return retakeCleared && paths.includes(newPath) ? cache : null
  }, 8000)

  return returnToPreview(miniProgram)
}

describe('P0 多车满图乱序 e2e', () => {
  let miniProgram

  beforeAll(async () => {
    miniProgram = await launchMiniProgram()
  })

  afterAll(async () => {
    await closeMiniProgram(miniProgram)
  })

  test('[P0-08] 两辆车都拍满，删除 A 车图片，B 车图片和统计完全不变', async () => {
    const page = await openPreviewPage(miniProgram)
    const before = cloneCacheSnapshot(await readCache(miniProgram))
    const deletedPath = before.vehicles[0].damages[1].compressedPath
    const beforeSummary = cacheSelectors.getCacheSummary(before)

    await deleteDamage(page, 0, 1)

    const cache = await readCache(miniProgram)
    const summary = cacheSelectors.getCacheSummary(cache)

    expect(cache.vehicles[0].damages).toHaveLength(4)
    expect(collectAllPhotoPaths(cache)).not.toContain(deletedPath)
    expect(damagePaths(cache, 1)).toEqual(damagePaths(before, 1))
    expect(documentPaths(cache, 1)).toEqual(documentPaths(before, 1))
    expect(summary.vehicles[1].damageCount).toBe(beforeSummary.vehicles[1].damageCount)
    expect(summary.vehicles[1].vehicleDocumentCount).toBe(beforeSummary.vehicles[1].vehicleDocumentCount)
    expect(summary.photoCounts.damage).toBe(beforeSummary.photoCounts.damage - 1)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })

  test('[P0-09] 两辆车都拍满，重拍 B 车图片，A 车图片和统计完全不变', async () => {
    let page = await openPreviewPage(miniProgram)
    const before = cloneCacheSnapshot(await readCache(miniProgram))
    const oldBPath = before.vehicles[1].damages[3].compressedPath
    const beforeSummary = cacheSelectors.getCacheSummary(before)

    page = await retakeDamage(page, miniProgram, 1, 3, 'p0-retake-b-damage-3')
    const cache = await readCache(miniProgram)
    const summary = cacheSelectors.getCacheSummary(cache)

    expect(damagePaths(cache, 0)).toEqual(damagePaths(before, 0))
    expect(documentPaths(cache, 0)).toEqual(documentPaths(before, 0))
    expect(documentPaths(cache, 1)).toEqual(documentPaths(before, 1))
    expect(damagePaths(cache, 1)[3]).toBe('wxfile://tmp/p0-retake-b-damage-3.jpg')
    expect(collectAllPhotoPaths(cache)).not.toContain(oldBPath)
    expect(collectAllPhotoPaths(cache)).toContain('wxfile://tmp/p0-retake-b-damage-3.jpg')
    expect(summary.photoCounts).toEqual(beforeSummary.photoCounts)
    expect((await page.data()).vehicles[0].damages).toHaveLength(5)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })
})
