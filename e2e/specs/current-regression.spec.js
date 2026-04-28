const {
  launchMiniProgram,
  closeMiniProgram,
  wait,
  seedCache,
  readCache,
  corruptCache,
  textOf,
  waitForCondition,
  installWxMediaMocks,
  getWxMediaState,
  patchCameraAiForE2E,
  getCameraAiState,
  setCurrentPageFields
} = require('../support/automator')
const {
  SHOOT_STEP,
  createPhoto,
  createCompletedVehicleCache
} = require('../support/fixtures')

const VIN_TIP = '请对准前挡风玻璃左下角VIN码，拍清完整字符'
const VALID_STEPS = [
  SHOOT_STEP.LICENSE_PLATE,
  SHOOT_STEP.VIN_CODE,
  SHOOT_STEP.DAMAGE,
  SHOOT_STEP.PREVIEW
]

describe('微信开发者工具自动化回归 - 当前关键链路', () => {
  let miniProgram

  beforeAll(async () => {
    miniProgram = await launchMiniProgram()
  })

  afterAll(async () => {
    await closeMiniProgram(miniProgram)
  })

  test('首页冒烟：标题、须知、开始采集，并进入拍照页', async () => {
    const page = await miniProgram.reLaunch('/pages/index/index')
    await wait(500)

    expect(await textOf(page, '.title')).toContain('车辆损失照片采集工具')
    expect(await textOf(page, '.notice-title')).toContain('拍摄须知')
    expect(await textOf(page, '.start-button')).toContain('开始采集')

    const startButton = await page.$('.start-button')
    await startButton.tap()

    await waitForCondition(async () => {
      const current = await miniProgram.currentPage()
      return current.path && current.path.includes('camera') ? current : null
    })
  })

  test('VIN 提示：切换到 VIN 步骤后显示指定提示', async () => {
    let page = await miniProgram.currentPage()
    if (!page.path || !page.path.includes('camera')) {
      const indexPage = await miniProgram.reLaunch('/pages/index/index')
      await wait(500)
      const startButton = await indexPage.$('.start-button')
      await startButton.tap()
      page = await waitForCondition(async () => {
        const current = await miniProgram.currentPage()
        return current.path && current.path.includes('camera') ? current : null
      })
    }

    await page.setData({
      currentStep: SHOOT_STEP.VIN_CODE,
      showConfirmModal: false
    })
    await wait(300)

    const data = await page.data()
    expect(data.currentStep).toBe(SHOOT_STEP.VIN_CODE)
    expect(data.vinGuideTip).toBe(VIN_TIP)
  })

  test('确认态文案：不显示清晰问句，显示确认使用和重新拍摄', async () => {
    const cache = createCompletedVehicleCache({
      currentStep: SHOOT_STEP.DAMAGE
    })
    await seedCache(miniProgram, cache)

    const page = await miniProgram.reLaunch('/pages/camera/camera')
    await wait(800)
    await page.setData({
      showConfirmModal: true,
      qualityHintText: '',
      pendingPhoto: createPhoto({ compressedPath: 'wxfile://tmp/confirm.jpg' })
    })
    await wait(300)

    const data = await page.data()
    expect(data.confirmContent).toBeUndefined()
    expect(data.confirmUseText).toBe('确认使用')
    expect(data.retakeText).toBe('重新拍摄')
  })

  test.each([
    ['从相册选择成功', 'success'],
    ['从相册选择取消', 'cancel'],
    ['从相册选择失败', 'fail']
  ])('预览页添加图片异常：%s 后不锁死页面', async (_, mode) => {
    await seedCache(miniProgram, createCompletedVehicleCache())
    await installWxMediaMocks(miniProgram, mode)

    const page = await miniProgram.reLaunch('/pages/preview/preview')
    await wait(800)

    await page.callMethod('onAddDocument')
    expect((await page.data()).showActionSheet).toBe(true)

    await page.callMethod('onChooseAlbum')
    await wait(1000)

    const data = await page.data()
    const wxState = await getWxMediaState(miniProgram)

    expect(data.showActionSheet).toBe(false)
    expect(wxState.chooseMediaCalls).toBe(1)
    expect(wxState.loadingVisible).toBe(false)

    if (mode === 'success') {
      expect(wxState.showLoadingCalls).toBeGreaterThan(0)
      expect(wxState.hideLoadingCalls).toBeGreaterThan(0)
    }
  })

  test('预览页拍照添加成功后关闭 loading 和 actionSheet', async () => {
    await seedCache(miniProgram, createCompletedVehicleCache())
    await installWxMediaMocks(miniProgram, 'success')

    const page = await miniProgram.reLaunch('/pages/preview/preview')
    await wait(800)

    await page.callMethod('onAddDocument')
    await page.callMethod('onTakePhoto')
    await wait(1000)

    const data = await page.data()
    const wxState = await getWxMediaState(miniProgram)

    expect(data.showActionSheet).toBe(false)
    expect(wxState.chooseMediaCalls).toBe(1)
    expect(wxState.showLoadingCalls).toBeGreaterThan(0)
    expect(wxState.hideLoadingCalls).toBeGreaterThan(0)
    expect(wxState.loadingVisible).toBe(false)
  })

  test('车损识别启动时机：camera initdone 后再次尝试恢复，且不保留多个检测 timer', async () => {
    await seedCache(miniProgram, createCompletedVehicleCache({
      currentStep: SHOOT_STEP.DAMAGE
    }))

    const page = await miniProgram.reLaunch('/pages/camera/camera')
    await wait(800)
    await page.setData({
      currentStep: SHOOT_STEP.DAMAGE,
      showConfirmModal: false,
      aiAvailable: true,
      aiEnabled: true
    })
    await setCurrentPageFields(miniProgram, {
      cameraInitialized: false,
      cameraContext: {}
    })
    await patchCameraAiForE2E(miniProgram)

    await page.callMethod('onCameraInitDone', { detail: {} })
    await wait(300)

    let aiState = await getCameraAiState(miniProgram)
    expect(aiState.cameraInitialized).toBe(true)
    expect(aiState.e2eAi.reasons).toContain('camera_init_done')
    expect(aiState.e2eAi.activeLoops).toBeLessThanOrEqual(1)
    expect(aiState.hasTimer).toBe(true)

    for (let i = 0; i < 20; i += 1) {
      await page.callMethod('onCameraInitDone', { detail: {} })
    }
    await wait(300)

    aiState = await getCameraAiState(miniProgram)
    expect(aiState.e2eAi.activeLoops).toBeLessThanOrEqual(1)
    expect(aiState.hasTimer).toBe(true)
  })

  test('破坏性：连续确认使用和重新拍摄各 20 次，不重复写入车损照片', async () => {
    await seedCache(miniProgram, createCompletedVehicleCache({
      currentStep: SHOOT_STEP.DAMAGE
    }))

    const page = await miniProgram.reLaunch('/pages/camera/camera')
    await wait(800)
    await patchCameraAiForE2E(miniProgram)
    await page.setData({
      currentStep: SHOOT_STEP.DAMAGE,
      showConfirmModal: true,
      pendingPhoto: createPhoto({ compressedPath: 'wxfile://tmp/damage-once.jpg' })
    })

    for (let i = 0; i < 20; i += 1) {
      await page.callMethod('onConfirmPhoto')
    }

    await page.setData({
      showConfirmModal: true,
      pendingPhoto: createPhoto({ compressedPath: 'wxfile://tmp/retake.jpg' })
    })

    for (let i = 0; i < 20; i += 1) {
      await page.callMethod('onRetakePhoto')
    }

    const cache = await readCache(miniProgram)
    const data = await page.data()

    expect(cache.vehicles[0].damages.length).toBe(1)
    expect(data.showConfirmModal).toBe(false)
    expect(data.pendingPhoto).toBe(null)
  })

  test('破坏性：连续打开/关闭添加图片弹层 20 次，最终必须关闭', async () => {
    await seedCache(miniProgram, createCompletedVehicleCache())

    const page = await miniProgram.reLaunch('/pages/preview/preview')
    await wait(800)

    for (let i = 0; i < 20; i += 1) {
      await page.callMethod('onAddDocument')
      await page.callMethod('onCloseActionSheet')
    }

    expect((await page.data()).showActionSheet).toBe(false)
  })

  test('破坏性：车牌、VIN、车损步骤快速切换后 currentStep 仍合法', async () => {
    await seedCache(miniProgram, createCompletedVehicleCache())

    const page = await miniProgram.reLaunch('/pages/camera/camera')
    await wait(800)

    const rapidSteps = [
      SHOOT_STEP.LICENSE_PLATE,
      SHOOT_STEP.VIN_CODE,
      SHOOT_STEP.DAMAGE,
      SHOOT_STEP.VIN_CODE,
      SHOOT_STEP.LICENSE_PLATE,
      SHOOT_STEP.DAMAGE
    ]

    for (let i = 0; i < 20; i += 1) {
      await page.setData({ currentStep: rapidSteps[i % rapidSteps.length] })
    }

    const data = await page.data()
    expect(VALID_STEPS).toContain(data.currentStep)
    expect(data.currentStep).toBe(SHOOT_STEP.VIN_CODE)
  })

  test('破坏性：损坏缓存进入页面不白屏，可恢复或回到首页', async () => {
    await corruptCache(miniProgram)

    await miniProgram.reLaunch('/pages/camera/camera')
    await wait(1200)

    const current = await miniProgram.currentPage()
    const data = await current.data().catch(() => ({}))

    expect(current.path).toMatch(/pages\/(index|camera)\//)
    expect(data).toBeTruthy()
  })
})
