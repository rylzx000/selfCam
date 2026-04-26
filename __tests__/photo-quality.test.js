jest.mock('../utils/quality-config', () => ({
  getQualityConfig: jest.fn()
}))

const qualityConfig = require('../utils/quality-config')
const { cloneQualityConfigDefaults } = require('../utils/quality-config-default')
const photoQuality = require('../utils/photo-quality')

function createConfig(overrides = {}) {
  const defaults = cloneQualityConfigDefaults()

  return {
    ...defaults,
    ...overrides,
    thresholds: {
      ...defaults.thresholds,
      ...(overrides.thresholds || {})
    },
    processing: {
      ...defaults.processing,
      ...(overrides.processing || {})
    }
  }
}

function createImage(width, height, pixelFactory) {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const value = pixelFactory(x, y)
      const gray = Array.isArray(value) ? value[0] : value

      data[index] = gray
      data[index + 1] = Array.isArray(value) ? value[1] : gray
      data[index + 2] = Array.isArray(value) ? value[2] : gray
      data[index + 3] = 255
    }
  }

  return { width, height, data }
}

function createSolidImage(width, height, value) {
  return createImage(width, height, () => value)
}

function createCheckerboardImage(width, height, darkValue, lightValue, cellSize = 2) {
  return createImage(width, height, (x, y) => {
    const checker = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0
    return checker ? darkValue : lightValue
  })
}

function blurImage(image, passes = 1) {
  let source = image

  for (let passIndex = 0; passIndex < passes; passIndex += 1) {
    const nextData = new Uint8ClampedArray(source.data.length)

    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        let sum = 0
        let count = 0

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = Math.min(source.width - 1, Math.max(0, x + offsetX))
            const sampleY = Math.min(source.height - 1, Math.max(0, y + offsetY))
            const sampleIndex = (sampleY * source.width + sampleX) * 4

            sum += source.data[sampleIndex]
            count += 1
          }
        }

        const gray = Math.round(sum / Math.max(count, 1))
        const index = (y * source.width + x) * 4

        nextData[index] = gray
        nextData[index + 1] = gray
        nextData[index + 2] = gray
        nextData[index + 3] = 255
      }
    }

    source = {
      width: source.width,
      height: source.height,
      data: nextData
    }
  }

  return source
}

describe('photo quality analyzer', () => {
  beforeEach(() => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig())
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('returns disabled result when quality.enabled is false', async () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      enabled: false
    }))

    const result = await photoQuality.analyzePhotoQuality(createSolidImage(12, 12, 120))

    expect(result.reasons).toEqual([photoQuality.PHOTO_QUALITY_REASONS.DISABLED])
    expect(result.suggestRetake).toBe(false)
    expect(result.level).toBe('good')
    expect(result.metrics).toEqual(expect.objectContaining({
      brightness: 0,
      blurScore: 0,
      sampledWidth: 0,
      sampledHeight: 0
    }))
  })

  test('returns good for a normal brightness clear image', async () => {
    const result = await photoQuality.analyzePhotoQuality(
      createCheckerboardImage(24, 24, 40, 200, 2)
    )

    expect(result.level).toBe('good')
    expect(result.suggestRetake).toBe(false)
    expect(result.reasons).toEqual([])
    expect(result.metrics.brightness).toBeGreaterThan(0.3)
    expect(result.metrics.blurScore).toBeGreaterThan(0.35)
  })

  test('returns dark reason for a dark image', async () => {
    const result = await photoQuality.analyzePhotoQuality(
      createSolidImage(20, 20, 45)
    )

    expect(result.reasons).toContain(photoQuality.PHOTO_QUALITY_REASONS.DARK)
    expect(result.suggestRetake).toBe(true)
  })

  test('returns overexposed reason for a bright image', async () => {
    const result = await photoQuality.analyzePhotoQuality(
      createSolidImage(20, 20, 245)
    )

    expect(result.reasons).toContain(photoQuality.PHOTO_QUALITY_REASONS.OVEREXPOSED)
    expect(result.suggestRetake).toBe(true)
  })

  test('returns blur reason for a low sharpness image', async () => {
    const sharpImage = createCheckerboardImage(32, 32, 35, 210, 2)
    const blurredImage = blurImage(sharpImage, 3)

    const result = await photoQuality.analyzePhotoQuality(blurredImage)

    expect(result.reasons).toContain(photoQuality.PHOTO_QUALITY_REASONS.BLUR)
    expect(result.metrics.blurScore).toBeLessThan(0.35)
  })

  test('accumulates multiple reasons when several problems exist together', async () => {
    const darkPattern = createCheckerboardImage(32, 32, 0, 110, 2)
    const blurredDarkPattern = blurImage(darkPattern, 4)

    const result = await photoQuality.analyzePhotoQuality(blurredDarkPattern)

    expect(result.reasons).toEqual(expect.arrayContaining([
      photoQuality.PHOTO_QUALITY_REASONS.BLUR,
      photoQuality.PHOTO_QUALITY_REASONS.DARK
    ]))
    expect(result.level).toBe('bad')
  })

  test('does not trigger disabled sub checks when blur detection is turned off', async () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      blurEnabled: false
    }))

    const sharpImage = createCheckerboardImage(32, 32, 35, 210, 2)
    const blurredImage = blurImage(sharpImage, 3)
    const result = await photoQuality.analyzePhotoQuality(blurredImage)

    expect(result.reasons).not.toContain(photoQuality.PHOTO_QUALITY_REASONS.BLUR)
  })

  test('uses configured thresholds when classifying brightness', async () => {
    const borderlineImage = createSolidImage(20, 20, 90)

    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      thresholds: {
        dark: 0.4
      }
    }))
    const stricterResult = await photoQuality.analyzePhotoQuality(borderlineImage)

    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      thresholds: {
        dark: 0.3
      }
    }))
    const looserResult = await photoQuality.analyzePhotoQuality(borderlineImage)

    expect(stricterResult.reasons).toContain(photoQuality.PHOTO_QUALITY_REASONS.DARK)
    expect(looserResult.reasons).not.toContain(photoQuality.PHOTO_QUALITY_REASONS.DARK)
  })

  test('returns a safe analyze_failed result for invalid input', async () => {
    const result = await photoQuality.analyzePhotoQuality({
      width: 10,
      height: 10,
      data: [1, 2, 3]
    })

    expect(result.reasons).toEqual([photoQuality.PHOTO_QUALITY_REASONS.ANALYZE_FAILED])
    expect(result.suggestRetake).toBe(false)
    expect(result.error).toEqual(expect.objectContaining({
      message: expect.any(String)
    }))
  })

  test('keeps output structure stable', async () => {
    const result = await photoQuality.analyzePhotoQuality(
      createCheckerboardImage(24, 24, 40, 200, 2)
    )

    expect(result).toEqual(expect.objectContaining({
      level: expect.any(String),
      suggestRetake: expect.any(Boolean),
      reasons: expect.any(Array),
      metrics: expect.objectContaining({
        brightness: expect.any(Number),
        darkRatio: expect.any(Number),
        brightRatio: expect.any(Number),
        blurScore: expect.any(Number),
        contrast: expect.any(Number),
        sampledWidth: expect.any(Number),
        sampledHeight: expect.any(Number)
      }),
      configVersion: expect.any(String),
      analyzedAt: expect.any(String),
      behavior: expect.objectContaining({
        showUserHint: expect.any(Boolean),
        saveQualityMeta: expect.any(Boolean)
      })
    }))
  })

  test('supports the reserved near/far reason structure with lightweight hints', async () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      nearFarEnabled: true
    }))

    const result = await photoQuality.analyzePhotoQuality(
      createCheckerboardImage(24, 24, 40, 200, 2),
      {
        subjectCoverage: 0.9
      }
    )

    expect(result.reasons).toContain(photoQuality.PHOTO_QUALITY_REASONS.TOO_NEAR)
    expect(result.suggestRetake).toBe(true)
  })
})
