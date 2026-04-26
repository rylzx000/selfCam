const qualityConfig = require('./quality-config')
const { cloneQualityConfigDefaults } = require('./quality-config-default')

const PHOTO_QUALITY_REASONS = {
  BLUR: 'blur',
  DARK: 'dark',
  OVEREXPOSED: 'overexposed',
  TOO_NEAR: 'too_near',
  TOO_FAR: 'too_far',
  LOW_CONFIDENCE: 'low_confidence',
  DISABLED: 'disabled',
  ANALYZE_FAILED: 'analyze_failed'
}

const DEFAULT_ANALYSIS_THRESHOLDS = {
  darkPixelLuma: 0.2,
  brightPixelLuma: 0.92,
  blurContrastFloor: 0.005,
  brightRatioWarn: 0.72,
  darkRatioWarn: 0.72,
  nearCoverageMin: 0.12,
  nearCoverageMax: 0.82
}

function clonePlainData(value) {
  return JSON.parse(JSON.stringify(value))
}

function getNowProvider(options = {}) {
  if (typeof options.now === 'function') {
    return options.now
  }

  if (typeof options.now === 'number' && Number.isFinite(options.now)) {
    return () => options.now
  }

  return () => Date.now()
}

function clamp(value, minValue, maxValue) {
  return Math.min(Math.max(value, minValue), maxValue)
}

function roundMetric(value, digits = 4) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Number(value.toFixed(digits))
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function mergePhotoQualityConfig(inputConfig = {}) {
  const defaults = cloneQualityConfigDefaults()
  const config = isPlainObject(inputConfig) ? inputConfig : {}

  return {
    ...defaults,
    ...config,
    thresholds: {
      ...defaults.thresholds,
      ...(isPlainObject(config.thresholds) ? config.thresholds : {})
    },
    processing: {
      ...defaults.processing,
      ...(isPlainObject(config.processing) ? config.processing : {})
    }
  }
}

function resolvePhotoQualityConfig(options = {}) {
  if (options.config) {
    return mergePhotoQualityConfig(options.config)
  }

  try {
    return mergePhotoQualityConfig(qualityConfig.getQualityConfig())
  } catch (error) {
    return cloneQualityConfigDefaults()
  }
}

function createEmptyMetrics() {
  return {
    brightness: 0,
    darkRatio: 0,
    brightRatio: 0,
    blurScore: 0,
    contrast: 0,
    sampledWidth: 0,
    sampledHeight: 0
  }
}

function createBaseResult(config, options = {}) {
  const now = getNowProvider(options)()

  return {
    level: 'good',
    suggestRetake: false,
    reasons: [],
    metrics: createEmptyMetrics(),
    configVersion: config.configVersion,
    analyzedAt: new Date(now).toISOString(),
    behavior: {
      showUserHint: !!config.showUserHint,
      saveQualityMeta: !!config.saveQualityMeta
    }
  }
}

function createSafeResult(reason, config, options = {}, extras = {}) {
  const result = createBaseResult(config, options)
  result.level = 'warn'
  result.reasons = [reason]

  if (extras.metrics) {
    result.metrics = {
      ...result.metrics,
      ...extras.metrics
    }
  }

  if (extras.error) {
    result.error = extras.error
  }

  return result
}

function createDisabledResult(config, options = {}) {
  const result = createBaseResult(config, options)
  result.level = 'good'
  result.reasons = [PHOTO_QUALITY_REASONS.DISABLED]
  result.suggestRetake = false
  return result
}

function createExecutionGuard(config, options = {}) {
  const now = getNowProvider(options)
  const startedAt = now()
  const timeoutMs = Math.max(
    100,
    Math.round(toFiniteNumber(config.processing && config.processing.timeoutMs) || cloneQualityConfigDefaults().processing.timeoutMs)
  )
  const deadline = startedAt + timeoutMs
  let counter = 0

  return {
    tick() {
      counter += 1
      if (counter % 2048 !== 0) {
        return
      }

      if (now() > deadline) {
        const error = new Error('photo quality analyze timeout')
        error.code = 'PHOTO_QUALITY_TIMEOUT'
        throw error
      }
    }
  }
}

function validatePixelInput(input) {
  if (!isPlainObject(input)) {
    throw new Error('photo quality input must be an object')
  }

  const width = Math.round(toFiniteNumber(input.width) || 0)
  const height = Math.round(toFiniteNumber(input.height) || 0)
  const data = input.data

  if (width <= 0 || height <= 0) {
    throw new Error('photo quality input width/height is invalid')
  }

  if (!data || typeof data.length !== 'number') {
    throw new Error('photo quality input data is invalid')
  }

  const expectedLength = width * height * 4
  if (data.length < expectedLength) {
    throw new Error('photo quality input data length is insufficient')
  }

  return {
    width,
    height,
    data
  }
}

function resolveSampleSize(width, height, maxEdge) {
  if (width <= maxEdge && height <= maxEdge) {
    return {
      width,
      height,
      scale: 1
    }
  }

  const scale = maxEdge / Math.max(width, height)

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  }
}

function buildSampledLumaMap(pixelInput, config, options = {}) {
  const source = validatePixelInput(pixelInput)
  const maxEdge = Math.max(
    64,
    Math.round(toFiniteNumber(config.processing && config.processing.maxEdge) || cloneQualityConfigDefaults().processing.maxEdge)
  )
  const sampleSize = resolveSampleSize(source.width, source.height, maxEdge)
  const sampledWidth = sampleSize.width
  const sampledHeight = sampleSize.height
  const luma = new Float32Array(sampledWidth * sampledHeight)
  const guard = createExecutionGuard(config, options)
  const thresholds = {
    ...DEFAULT_ANALYSIS_THRESHOLDS,
    ...(isPlainObject(options.analysisThresholds) ? options.analysisThresholds : {})
  }

  let sum = 0
  let sumSquares = 0
  let darkCount = 0
  let brightCount = 0

  for (let y = 0; y < sampledHeight; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor(((y + 0.5) * source.height) / sampledHeight))

    for (let x = 0; x < sampledWidth; x += 1) {
      guard.tick()
      const sourceX = Math.min(source.width - 1, Math.floor(((x + 0.5) * source.width) / sampledWidth))
      const sourceIndex = (sourceY * source.width + sourceX) * 4
      const r = source.data[sourceIndex] || 0
      const g = source.data[sourceIndex + 1] || 0
      const b = source.data[sourceIndex + 2] || 0
      const value = clamp((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1)
      const targetIndex = y * sampledWidth + x

      luma[targetIndex] = value
      sum += value
      sumSquares += value * value

      if (value <= thresholds.darkPixelLuma) {
        darkCount += 1
      }

      if (value >= thresholds.brightPixelLuma) {
        brightCount += 1
      }
    }
  }

  const pixelCount = sampledWidth * sampledHeight
  const brightness = pixelCount > 0 ? sum / pixelCount : 0
  const variance = pixelCount > 0 ? Math.max(sumSquares / pixelCount - brightness * brightness, 0) : 0

  return {
    sampledWidth,
    sampledHeight,
    luma,
    brightness,
    contrast: Math.sqrt(variance),
    darkRatio: pixelCount > 0 ? darkCount / pixelCount : 0,
    brightRatio: pixelCount > 0 ? brightCount / pixelCount : 0
  }
}

function computeBlurScore(lumaMap, options = {}) {
  const width = lumaMap.sampledWidth
  const height = lumaMap.sampledHeight

  if (width < 2 || height < 2) {
    return 0
  }

  const guard = createExecutionGuard(options.config || cloneQualityConfigDefaults(), options)
  let edgeDiffTotal = 0
  let edgeCount = 0

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      guard.tick()
      const index = y * width + x
      const center = lumaMap.luma[index]
      const right = lumaMap.luma[index + 1]
      const down = lumaMap.luma[index + width]

      edgeDiffTotal += Math.abs(center - right)
      edgeDiffTotal += Math.abs(center - down)
      edgeCount += 2
    }
  }

  if (edgeCount === 0) {
    return 0
  }

  const edgeDensity = edgeDiffTotal / edgeCount
  return clamp(edgeDensity * 2.5, 0, 1)
}

function computeQualityMetrics(pixelInput, config, options = {}) {
  const mergedConfig = mergePhotoQualityConfig(config)
  const lumaMap = buildSampledLumaMap(pixelInput, mergedConfig, options)
  const blurScore = computeBlurScore(lumaMap, {
    ...options,
    config: mergedConfig
  })

  return {
    brightness: roundMetric(lumaMap.brightness),
    darkRatio: roundMetric(lumaMap.darkRatio),
    brightRatio: roundMetric(lumaMap.brightRatio),
    blurScore: roundMetric(blurScore),
    contrast: roundMetric(lumaMap.contrast),
    sampledWidth: lumaMap.sampledWidth,
    sampledHeight: lumaMap.sampledHeight
  }
}

function detectNearFarReason(config, options = {}) {
  if (!config.nearFarEnabled) {
    return null
  }

  const subjectCoverage = toFiniteNumber(options.subjectCoverage)
  if (subjectCoverage === null) {
    return null
  }

  const thresholds = {
    ...DEFAULT_ANALYSIS_THRESHOLDS,
    ...(isPlainObject(options.analysisThresholds) ? options.analysisThresholds : {})
  }

  if (subjectCoverage >= thresholds.nearCoverageMax) {
    return PHOTO_QUALITY_REASONS.TOO_NEAR
  }

  if (subjectCoverage <= thresholds.nearCoverageMin) {
    return PHOTO_QUALITY_REASONS.TOO_FAR
  }

  return null
}

function classifyQualityIssues(metrics, config, options = {}) {
  const reasons = []
  const thresholds = {
    ...DEFAULT_ANALYSIS_THRESHOLDS,
    ...(isPlainObject(options.analysisThresholds) ? options.analysisThresholds : {})
  }

  if (config.blurEnabled && metrics.contrast >= thresholds.blurContrastFloor && metrics.blurScore < config.thresholds.blur) {
    reasons.push(PHOTO_QUALITY_REASONS.BLUR)
  }

  if (
    config.brightnessEnabled &&
    (metrics.brightness < config.thresholds.dark || metrics.darkRatio >= thresholds.darkRatioWarn)
  ) {
    reasons.push(PHOTO_QUALITY_REASONS.DARK)
  }

  if (
    config.exposureEnabled &&
    (metrics.brightness > config.thresholds.bright || metrics.brightRatio >= thresholds.brightRatioWarn)
  ) {
    reasons.push(PHOTO_QUALITY_REASONS.OVEREXPOSED)
  }

  const nearFarReason = detectNearFarReason(config, options)
  if (nearFarReason) {
    reasons.push(nearFarReason)
  }

  return reasons
}

function determineQualityLevel(reasons) {
  const qualityReasons = reasons.filter((reason) => (
    reason === PHOTO_QUALITY_REASONS.BLUR ||
    reason === PHOTO_QUALITY_REASONS.DARK ||
    reason === PHOTO_QUALITY_REASONS.OVEREXPOSED ||
    reason === PHOTO_QUALITY_REASONS.TOO_NEAR ||
    reason === PHOTO_QUALITY_REASONS.TOO_FAR
  ))

  if (qualityReasons.length >= 2) {
    return 'bad'
  }

  if (qualityReasons.length === 1) {
    return 'warn'
  }

  if (reasons.length > 0) {
    return 'warn'
  }

  return 'good'
}

function analyzePhotoQualityPixels(input, options = {}) {
  const config = resolvePhotoQualityConfig(options)

  if (!config.enabled) {
    return createDisabledResult(config, options)
  }

  try {
    const metrics = computeQualityMetrics(input, config, options)
    const reasons = classifyQualityIssues(metrics, config, options)
    const result = createBaseResult(config, options)

    result.metrics = metrics
    result.reasons = reasons
    result.level = determineQualityLevel(reasons)
    result.suggestRetake = reasons.length > 0

    return result
  } catch (error) {
    return createSafeResult(PHOTO_QUALITY_REASONS.ANALYZE_FAILED, config, options, {
      error: {
        message: error.message || String(error)
      }
    })
  }
}

function getWxRef(options = {}) {
  if (options.wx) {
    return options.wx
  }

  if (typeof wx !== 'undefined') {
    return wx
  }

  return null
}

function loadPhotoPixelsFromFile(filePath, options = {}) {
  if (typeof options.pixelLoader === 'function') {
    return Promise.resolve(options.pixelLoader(filePath, options))
  }

  const wxRef = getWxRef(options)
  if (!wxRef || typeof wxRef.createOffscreenCanvas !== 'function') {
    return Promise.reject(new Error('photo quality file loader is unavailable'))
  }

  const maxEdge = Math.max(64, Math.round(toFiniteNumber(options.maxEdge) || cloneQualityConfigDefaults().processing.maxEdge))

  return new Promise((resolve, reject) => {
    try {
      const canvas = wxRef.createOffscreenCanvas({
        type: '2d',
        width: 1,
        height: 1
      })
      const ctx = canvas.getContext('2d')
      const image = canvas.createImage()

      image.onload = () => {
        try {
          const sourceWidth = Math.max(1, image.width || 1)
          const sourceHeight = Math.max(1, image.height || 1)
          const sampleSize = resolveSampleSize(sourceWidth, sourceHeight, maxEdge)

          canvas.width = sampleSize.width
          canvas.height = sampleSize.height
          ctx.clearRect(0, 0, sampleSize.width, sampleSize.height)
          ctx.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, sampleSize.width, sampleSize.height)

          const imageData = ctx.getImageData(0, 0, sampleSize.width, sampleSize.height)

          resolve({
            width: sampleSize.width,
            height: sampleSize.height,
            data: imageData.data
          })
        } catch (error) {
          reject(error)
        }
      }

      image.onerror = (error) => {
        reject(error instanceof Error ? error : new Error('photo quality image load failed'))
      }

      image.src = filePath
    } catch (error) {
      reject(error)
    }
  })
}

async function analyzePhotoQuality(input, options = {}) {
  const config = resolvePhotoQualityConfig(options)

  if (!config.enabled) {
    return createDisabledResult(config, options)
  }

  try {
    if (isPlainObject(input) && typeof input.filePath === 'string' && input.filePath.trim()) {
      const pixelInput = await loadPhotoPixelsFromFile(input.filePath, {
        ...options,
        maxEdge: config.processing.maxEdge
      })

      return analyzePhotoQualityPixels(pixelInput, {
        ...options,
        config
      })
    }

    return analyzePhotoQualityPixels(input, {
      ...options,
      config
    })
  } catch (error) {
    return createSafeResult(PHOTO_QUALITY_REASONS.ANALYZE_FAILED, config, options, {
      error: {
        message: error.message || String(error)
      }
    })
  }
}

module.exports = {
  PHOTO_QUALITY_REASONS,
  analyzePhotoQuality,
  analyzePhotoQualityPixels,
  buildSampledLumaMap,
  classifyQualityIssues,
  computeBlurScore,
  computeQualityMetrics,
  createBaseResult,
  detectNearFarReason,
  determineQualityLevel,
  loadPhotoPixelsFromFile,
  resolvePhotoQualityConfig,
  resolveSampleSize,
  validatePixelInput
}
