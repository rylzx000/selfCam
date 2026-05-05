const {
  launchMiniProgram,
  closeMiniProgram,
  wait,
  seedCache,
  readCache,
  installWxMediaMocks,
  getWxMediaState
} = require('../support/automator')
const {
  createFullDamageScenario,
  createNearLimitScenario,
  collectAllPhotoPaths,
  assertNoDuplicatePhotoPaths
} = require('../support/scenario-builder')
const cacheSelectors = require('../../utils/cache-selectors')

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

  test('[P0-01] 单车满图进入 preview 后统计正确', async () => {
    const scenario = createFullDamageScenario({ vehicleCount: 1, damageCountPerVehicle: 5 })
    await seedCache(miniProgram, scenario)

    const page = await miniProgram.reLaunch('/pages/preview/preview')
    await wait(800)

    const cache = await readCache(miniProgram)
    const data = await page.data()
    const summary = cacheSelectors.getCacheSummary(cache)

    expect(data.vehicles).toHaveLength(1)
    expect(data.vehicles[0].licensePlate.status).toBe('completed')
    expect(data.vehicles[0].vinCode.status).toBe('completed')
    expect(data.vehicles[0].damages).toHaveLength(5)
    expect(data.totalPhotoCount).toBe(7)
    expect(summary.totalPhotos).toBe(7)
    expect(summary.photoCounts.damage).toBe(5)
    expect(collectAllPhotoPaths(cache)).toHaveLength(7)
    expect(() => assertNoDuplicatePhotoPaths(cache)).not.toThrow()
  })

  test('[P0-06] 达到 50 张总图片后不允许继续新增，并给出明确提示', async () => {
    const scenario = createNearLimitScenario({ totalPhotoCount: 50 })
    await seedCache(miniProgram, scenario)
    await installWxMediaMocks(miniProgram, 'success', { uniqueCompressedPath: true })

    const page = await miniProgram.reLaunch('/pages/preview/preview')
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

    const page = await miniProgram.reLaunch('/pages/preview/preview')
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
})
