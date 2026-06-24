const {
  launchMiniProgram,
  closeMiniProgram,
  wait,
  waitForCondition,
  seedCache,
  readCache,
  installWxMediaMocks,
  installAuxUploadMocks,
  saveRetakenDamageForE2E
} = require('../support/automator')
const { createPhoto } = require('../support/fixtures')
const {
  createScenario,
  collectAllPhotoPaths,
  assertNoDuplicatePhotoPaths
} = require('../support/scenario-builder')
const cacheSelectors = require('../../packageD/utils/cache-selectors')
const uploadState = require('../../packageD/utils/upload-state')

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

function createUploadItem(vehicleId, photoType, maxCount = 1) {
  return {
    uploadItemId: `${vehicleId}_${photoType}`,
    photoType,
    maxCount,
    uploadedCount: 0
  }
}

function attachSubmitUploadRules(cache, ticket) {
  cache.auxPhoto = {
    ticket,
    ticketStatus: 'OPENED'
  }

  ;(cache.vehicles || []).forEach((vehicle, index) => {
    const vehicleId = `MOCK_LOSS_VEHICLE_${100001 + index}`
    vehicle.vehicleId = vehicleId
    vehicle.uploadItems = [
      createUploadItem(vehicleId, 'LICENSE_PLATE'),
      createUploadItem(vehicleId, 'VIN'),
      createUploadItem(vehicleId, 'DAMAGE', 5),
      createUploadItem(vehicleId, 'DRIVING_LICENSE_FRONT'),
      createUploadItem(vehicleId, 'DRIVING_LICENSE_BACK'),
      createUploadItem(vehicleId, 'DRIVING_LICENSE_ELECTRONIC')
    ]
  })

  return cache
}

async function waitForCompletePage(miniProgram) {
  const page = await waitForCondition(async () => {
    const current = await miniProgram.currentPage()
    return current.path && current.path.includes('complete') ? current : null
  }, 10000)
  await wait(500)
  return page
}

async function waitForUploadReady(miniProgram) {
  const startedAt = Date.now()
  let lastSnapshot = null

  while (Date.now() - startedAt < 45000) {
    const current = await miniProgram.currentPage()
    if (!current.path || !current.path.includes('preview')) {
      lastSnapshot = { page: current.path || '' }
      await wait(300)
      continue
    }

    const data = await current.data()
    const cache = await readCache(miniProgram)
    const session = cache && cache.uploadSession
    const activeItem = session && Array.isArray(session.items)
      ? session.items.find((item) => item.status === uploadState.UPLOAD_ITEM_STATUS.UPLOADING)
        || session.items.find((item) => item.status === uploadState.UPLOAD_ITEM_STATUS.FAILED)
        || session.items.find((item) => item.status === uploadState.UPLOAD_ITEM_STATUS.PENDING)
      : null
    lastSnapshot = {
      page: current.path || '',
      phase: session && session.phase,
      uploaded: session && session.uploaded,
      total: session && session.total,
      overlayPrimaryVisible: data.uploadOverlayPrimaryVisible,
      overlayPrimaryText: data.uploadOverlayPrimaryText,
      activeItem: activeItem && {
        id: activeItem.id,
        status: activeItem.status,
        attempts: activeItem.attempts,
        lastErrorCode: activeItem.lastErrorCode,
        lastErrorMessage: activeItem.lastErrorMessage
      }
    }

    if (data.uploadOverlayPrimaryVisible && session && session.phase === uploadState.UPLOAD_PHASE.READY) {
      return current
    }

    if (session && session.phase === uploadState.UPLOAD_PHASE.FAILED) {
      throw new Error(`upload failed before ready: ${JSON.stringify(lastSnapshot)}`)
    }

    await wait(300)
  }

  throw new Error(`upload did not reach ready: ${JSON.stringify(lastSnapshot)}`)
}

async function completeReadyUpload(miniProgram) {
  const page = await waitForUploadReady(miniProgram)
  await page.callMethod('onUploadOverlayPrimaryTap')
  return waitForCompletePage(miniProgram)
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

async function skipAlbumSaveIfPrompted(page) {
  await wait(300)
  const data = await page.data()

  if (data.modalType === 'albumSaveConfirm') {
    await page.callMethod('onModalCancel')
    await wait(300)
  }
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

describe('P0 提交一致性 e2e', () => {
  let miniProgram

  beforeAll(async () => {
    miniProgram = await launchMiniProgram()
    await installAuxUploadMocks(miniProgram)
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
    attachSubmitUploadRules(scenario, 'mock-2')
    await seedCache(miniProgram, scenario)

    const page = await miniProgram.reLaunch('/packageD/pages/preview/preview')
    await wait(800)

    await page.callMethod('onSubmit')
    expect((await page.data()).modalType).toBe('thirdVehicle')
    await page.callMethod('onModalConfirm')
    await skipAlbumSaveIfPrompted(page)

    const completePage = await completeReadyUpload(miniProgram)
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
    attachSubmitUploadRules(scenario, 'mock-3')

    await seedCache(miniProgram, scenario)
    await installWxMediaMocks(miniProgram, 'success')

    let page = await miniProgram.reLaunch('/packageD/pages/preview/preview')
    await wait(800)

    await deleteDamage(page, 0, 2)
    page = await retakeDamage(page, miniProgram, 1, 4, 'p0-submit-retake-b-4')

    await page.callMethod('onSubmit')
    await skipAlbumSaveIfPrompted(page)
    const completePage = await completeReadyUpload(miniProgram)
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
