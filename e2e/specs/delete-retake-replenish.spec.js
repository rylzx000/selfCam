const {
  launchMiniProgram,
  closeMiniProgram,
  wait,
  waitForCondition,
  seedCache,
  readCache,
  installWxMediaMocks
} = require('../support/automator')
const { SHOOT_STEP, createPhoto } = require('../support/fixtures')
const {
  createFullDamageScenario,
  collectAllPhotoPaths,
  assertNoDuplicatePhotoPaths
} = require('../support/scenario-builder')

function eventDataset(dataset) {
  return {
    currentTarget: { dataset }
  }
}

function damagePaths(cache, vehicleIndex = 0) {
  return cache.vehicles[vehicleIndex].damages.map((photo) => photo.compressedPath)
}

function buildPhoto(pathKey) {
  return createPhoto({
    tempFilePath: `wxfile://tmp/${pathKey}-original.jpg`,
    compressedPath: `wxfile://tmp/${pathKey}.jpg`,
    captureTrigger: 'p0_delete_retake'
  })
}

async function openPreviewPage(miniProgram, scenario) {
  await seedCache(miniProgram, scenario)
  await installWxMediaMocks(miniProgram, 'success')
  const page = await miniProgram.reLaunch('/pages/preview/preview')
  await wait(800)
  return page
}

async function deleteDamage(page, miniProgram, vehicleIndex, damageIndex) {
  const before = await readCache(miniProgram)
  const oldPath = before.vehicles[vehicleIndex].damages[damageIndex].compressedPath

  await page.callMethod('onPreview', eventDataset({
    vehicle: vehicleIndex,
    type: 'damage',
    damage: damageIndex
  }))
  await wait(100)
  await page.callMethod('onDelete')
  await wait(300)

  return oldPath
}

async function addDamageFromPreview(page, miniProgram, vehicleIndex, newPathKey) {
  await page.callMethod('onAddDamage', eventDataset({ vehicle: vehicleIndex }))

  const cameraPage = await waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    return current.path && current.path.includes('camera') ? current : null
  }, 8000)

  await cameraPage.setData({
    currentStep: SHOOT_STEP.DAMAGE,
    showConfirmModal: true,
    pendingPhoto: buildPhoto(newPathKey)
  })
  await cameraPage.callMethod('onConfirmPhoto')

  const previewPage = await waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    return current.path && current.path.includes('preview') ? current : null
  }, 10000)
  await wait(500)
  return previewPage
}

async function addFiveDamagesFromEmpty(previewPage, miniProgram) {
  await previewPage.callMethod('onAddDamage', eventDataset({ vehicle: 0 }))

  const cameraPage = await waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    return current.path && current.path.includes('camera') ? current : null
  }, 8000)

  for (let index = 0; index < 5; index += 1) {
    await cameraPage.setData({
      currentStep: SHOOT_STEP.DAMAGE,
      showConfirmModal: true,
      pendingPhoto: buildPhoto(`p0-replenish-all-${index}`)
    })
    await cameraPage.callMethod('onConfirmPhoto')
    await wait(250)
  }

  const finalPreview = await waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    return current.path && current.path.includes('preview') ? current : null
  }, 10000)
  await wait(500)
  return finalPreview
}

describe('P0 删除、重拍、补拍 e2e', () => {
  let miniProgram

  beforeAll(async () => {
    miniProgram = await launchMiniProgram()
  })

  afterAll(async () => {
    await closeMiniProgram(miniProgram)
  })

  test('[P0-02] 单车满图后删除第一张车损，再补拍一张，最终数量恢复且旧图不存在', async () => {
    let page = await openPreviewPage(miniProgram, createFullDamageScenario({ vehicleCount: 1 }))
    const beforePaths = damagePaths(await readCache(miniProgram))
    const deletedPath = await deleteDamage(page, miniProgram, 0, 0)

    let cache = await readCache(miniProgram)
    expect(damagePaths(cache)).toEqual(beforePaths.slice(1))
    expect(collectAllPhotoPaths(cache)).not.toContain(deletedPath)

    page = await addDamageFromPreview(page, miniProgram, 0, 'p0-replenish-first')
    cache = await readCache(miniProgram)

    expect(damagePaths(cache)).toEqual(beforePaths.slice(1).concat('wxfile://tmp/p0-replenish-first.jpg'))
    expect(cache.vehicles[0].damages).toHaveLength(5)
    expect(collectAllPhotoPaths(cache)).not.toContain(deletedPath)
    expect((await page.data()).vehicles[0].damages).toHaveLength(5)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })

  test('[P0-03] 单车满图后删除中间车损，再补拍一张，图片顺序和索引正确', async () => {
    let page = await openPreviewPage(miniProgram, createFullDamageScenario({ vehicleCount: 1 }))
    const beforePaths = damagePaths(await readCache(miniProgram))
    const deletedPath = await deleteDamage(page, miniProgram, 0, 2)

    page = await addDamageFromPreview(page, miniProgram, 0, 'p0-replenish-middle')
    const cache = await readCache(miniProgram)
    const expectedPaths = [
      beforePaths[0],
      beforePaths[1],
      beforePaths[3],
      beforePaths[4],
      'wxfile://tmp/p0-replenish-middle.jpg'
    ]
    const data = await page.data()
    const damageEntries = data.allPhotos.filter((photo) => photo.vehicle === 0 && photo.type === 'damage')

    expect(damagePaths(cache)).toEqual(expectedPaths)
    expect(collectAllPhotoPaths(cache)).not.toContain(deletedPath)
    expect(damageEntries.map((photo) => photo.id)).toEqual([
      '0-damage-0',
      '0-damage-1',
      '0-damage-2',
      '0-damage-3',
      '0-damage-4'
    ])
    expect(damageEntries.map((photo) => photo.url)).toEqual(expectedPaths)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })

  test('[P0-04] 单车满图后删除最后一张车损，再补拍一张，不越界', async () => {
    let page = await openPreviewPage(miniProgram, createFullDamageScenario({ vehicleCount: 1 }))
    const beforePaths = damagePaths(await readCache(miniProgram))
    const deletedPath = await deleteDamage(page, miniProgram, 0, 4)

    page = await addDamageFromPreview(page, miniProgram, 0, 'p0-replenish-last')
    const cache = await readCache(miniProgram)
    const data = await page.data()

    expect(damagePaths(cache)).toEqual(beforePaths.slice(0, 4).concat('wxfile://tmp/p0-replenish-last.jpg'))
    expect(cache.vehicles[0].damages[4].compressedPath).toBe('wxfile://tmp/p0-replenish-last.jpg')
    expect(collectAllPhotoPaths(cache)).not.toContain(deletedPath)
    expect(data.totalPhotoCount).toBe(7)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })

  test('[P0-05] 单车满图后删除全部车损，再重新补满', async () => {
    let page = await openPreviewPage(miniProgram, createFullDamageScenario({ vehicleCount: 1 }))
    const deletedPaths = []

    for (let index = 0; index < 5; index += 1) {
      deletedPaths.push(await deleteDamage(page, miniProgram, 0, 0))
    }

    let cache = await readCache(miniProgram)
    expect(cache.vehicles[0].damages).toHaveLength(0)
    deletedPaths.forEach((path) => {
      expect(collectAllPhotoPaths(cache)).not.toContain(path)
    })

    page = await addFiveDamagesFromEmpty(page, miniProgram)
    cache = await readCache(miniProgram)

    expect(cache.vehicles[0].damages).toHaveLength(5)
    expect(damagePaths(cache)).toEqual([
      'wxfile://tmp/p0-replenish-all-0.jpg',
      'wxfile://tmp/p0-replenish-all-1.jpg',
      'wxfile://tmp/p0-replenish-all-2.jpg',
      'wxfile://tmp/p0-replenish-all-3.jpg',
      'wxfile://tmp/p0-replenish-all-4.jpg'
    ])
    deletedPaths.forEach((path) => {
      expect(collectAllPhotoPaths(cache)).not.toContain(path)
    })
    expect((await page.data()).totalPhotoCount).toBe(7)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })
})
