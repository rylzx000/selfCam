jest.mock('../utils/quality-config', () => ({
  getQualityConfig: jest.fn()
}))

const qualityConfig = require('../utils/quality-config')
const { cloneQualityConfigDefaults } = require('../utils/quality-config-default')
const photoQuality = require('../utils/photo-quality')

function createConfig(overrides = {}) {
  const defaults = cloneQualityConfigDefaults()
  const enabledDefaults = {
    enabled: true,
    showUserHint: true,
    saveQualityMeta: true,
    blurEnabled: true,
    exposureEnabled: true,
    brightnessEnabled: true,
    nearFarEnabled: false
  }

  return {
    ...defaults,
    ...enabledDefaults,
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

  test('builds the expected hint text for quality risks', () => {
    const result = {
      level: 'bad',
      suggestRetake: true,
      reasons: [
        photoQuality.PHOTO_QUALITY_REASONS.BLUR,
        photoQuality.PHOTO_QUALITY_REASONS.DARK
      ],
      metrics: {},
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'config-1'
    }

    expect(photoQuality.buildQualityHintText(result)).toBe('照片可能存在模糊、偏暗问题，建议重拍')
  })

  test('builds the expected complete summary text for quality risks', () => {
    const summary = {
      totalPhotos: 6,
      analyzedCount: 5,
      riskCount: 2,
      suggestRetakeCount: 2,
      riskReasons: [
        photoQuality.PHOTO_QUALITY_REASONS.BLUR,
        photoQuality.PHOTO_QUALITY_REASONS.DARK
      ],
      riskPhotos: []
    }

    expect(photoQuality.buildCompleteQualitySummaryText(summary)).toBe('有 2 张照片可能存在模糊或偏暗问题，建议返回修改')
  })

  test('does not build complete summary hint when showUserHint is false', () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      showUserHint: false
    }))

    const summary = {
      totalPhotos: 3,
      analyzedCount: 3,
      riskCount: 1,
      suggestRetakeCount: 1,
      riskReasons: [photoQuality.PHOTO_QUALITY_REASONS.OVEREXPOSED],
      riskPhotos: []
    }

    expect(photoQuality.buildCompleteQualitySummaryText(summary)).toBe('')
  })

  test('does not show hint text when showUserHint is false', () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      showUserHint: false
    }))

    const result = {
      level: 'warn',
      suggestRetake: true,
      reasons: [photoQuality.PHOTO_QUALITY_REASONS.BLUR],
      metrics: {},
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'config-1'
    }

    expect(photoQuality.shouldShowQualityHint(result)).toBe(false)
    expect(photoQuality.buildQualityHintText(result)).toBe('')
  })

  test('does not persist quality meta when saveQualityMeta is false', () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      saveQualityMeta: false
    }))

    const result = {
      level: 'warn',
      suggestRetake: true,
      reasons: [photoQuality.PHOTO_QUALITY_REASONS.DARK],
      metrics: {
        brightness: 0.2
      },
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'config-1'
    }
    const photo = {
      compressedPath: '/photo.jpg',
      captureMode: 'manual'
    }

    expect(photoQuality.buildPersistedQualityMeta(result)).toBeNull()
    expect(photoQuality.attachPhotoQualityMeta(photo, result)).toEqual(photo)
  })

  test('keeps disabled flow unchanged for hint and persisted meta', async () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      enabled: false
    }))

    const result = await photoQuality.analyzePhotoQuality(createSolidImage(12, 12, 120))
    const photo = {
      compressedPath: '/photo.jpg',
      captureMode: 'manual'
    }

    expect(photoQuality.buildQualityHintText(result)).toBe('')
    expect(photoQuality.buildPersistedQualityMeta(result)).toBeNull()
    expect(photoQuality.attachPhotoQualityMeta(photo, result)).toBe(photo)
  })

  test('does not block photo persistence when analyze result is analyze_failed', () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      saveQualityMeta: true
    }))

    const result = {
      level: 'warn',
      suggestRetake: false,
      reasons: [photoQuality.PHOTO_QUALITY_REASONS.ANALYZE_FAILED],
      metrics: {},
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'config-2'
    }
    const photo = {
      compressedPath: '/photo.jpg',
      captureMode: 'manual'
    }

    const nextPhoto = photoQuality.attachPhotoQualityMeta(photo, result)

    expect(photoQuality.buildQualityHintText(result)).toBe('')
    expect(nextPhoto).toEqual(expect.objectContaining({
      compressedPath: '/photo.jpg',
      quality: expect.objectContaining({
        level: 'warn',
        suggestRetake: false,
        reasons: [photoQuality.PHOTO_QUALITY_REASONS.ANALYZE_FAILED]
      })
    }))
  })

  test('keeps persisted quality meta structure stable on photo objects', () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      saveQualityMeta: true
    }))

    const result = {
      level: 'bad',
      suggestRetake: true,
      reasons: [
        photoQuality.PHOTO_QUALITY_REASONS.BLUR,
        photoQuality.PHOTO_QUALITY_REASONS.OVEREXPOSED
      ],
      metrics: {
        brightness: 0.91,
        darkRatio: 0,
        brightRatio: 0.84,
        blurScore: 0.12,
        contrast: 0.08,
        sampledWidth: 320,
        sampledHeight: 180
      },
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'config-3'
    }
    const photo = {
      compressedPath: '/photo.jpg',
      captureMode: 'manual'
    }

    const nextPhoto = photoQuality.attachPhotoQualityMeta(photo, result)

    expect(nextPhoto.quality).toEqual({
      level: 'bad',
      suggestRetake: true,
      reasons: [
        photoQuality.PHOTO_QUALITY_REASONS.BLUR,
        photoQuality.PHOTO_QUALITY_REASONS.OVEREXPOSED
      ],
      metrics: {
        brightness: 0.91,
        darkRatio: 0,
        brightRatio: 0.84,
        blurScore: 0.12,
        contrast: 0.08,
        sampledWidth: 320,
        sampledHeight: 180
      },
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'config-3'
    })
  })

  test('remains compatible when legacy photo objects have no quality field', () => {
    qualityConfig.getQualityConfig.mockReturnValue(createConfig({
      saveQualityMeta: true
    }))

    const result = {
      level: 'warn',
      suggestRetake: true,
      reasons: [photoQuality.PHOTO_QUALITY_REASONS.DARK],
      metrics: {
        brightness: 0.18,
        darkRatio: 0.78
      },
      analyzedAt: '2026-04-26T00:00:00.000Z',
      configVersion: 'config-legacy'
    }
    const legacyPhoto = {
      compressedPath: '/legacy.jpg',
      captureMode: 'manual'
    }

    const nextPhoto = photoQuality.attachPhotoQualityMeta(legacyPhoto, result)

    expect(nextPhoto.quality).toEqual(expect.objectContaining({
      level: 'warn',
      suggestRetake: true,
      reasons: [photoQuality.PHOTO_QUALITY_REASONS.DARK]
    }))
  })
})
