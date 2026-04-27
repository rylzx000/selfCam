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

const ACTIONABLE_QUALITY_REASONS = {
  blur: true,
  dark: true,
  overexposed: true,
  too_near: true,
  too_far: true
}

const QUALITY_REASON_HINT_TEXT = {
  blur: '照片可能偏模糊，建议重拍',
  dark: '照片可能偏暗，建议重拍',
  overexposed: '照片可能反光或过亮，建议重拍',
  too_near: '照片可能距离过近，建议重拍',
  too_far: '照片可能距离过远，建议重拍'
}

const QUALITY_REASON_HINT_LABEL = {
  blur: '模糊',
  dark: '偏暗',
  overexposed: '过亮',
  too_near: '距离过近',
  too_far: '距离过远'
}

const PERSISTED_QUALITY_LEVELS = {
  good: true,
  warn: true,
  bad: true
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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
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

function cloneMetricsForPersist(metrics) {
  if (!isPlainObject(metrics)) {
    return createEmptyMetrics()
  }

  return {
    brightness: roundMetric(toFiniteNumber(metrics.brightness) || 0),
    darkRatio: roundMetric(toFiniteNumber(metrics.darkRatio) || 0),
    brightRatio: roundMetric(toFiniteNumber(metrics.brightRatio) || 0),
    blurScore: roundMetric(toFiniteNumber(metrics.blurScore) || 0),
    contrast: roundMetric(toFiniteNumber(metrics.contrast) || 0),
    sampledWidth: Math.max(0, Math.round(toFiniteNumber(metrics.sampledWidth) || 0)),
    sampledHeight: Math.max(0, Math.round(toFiniteNumber(metrics.sampledHeight) || 0))
  }
}

function getActionableQualityReasons(result) {
  if (!isPlainObject(result) || !Array.isArray(result.reasons)) {
    return []
  }

  const dedupedReasons = []

  result.reasons.forEach((reason) => {
    if (!ACTIONABLE_QUALITY_REASONS[reason]) {
      return
    }

    if (dedupedReasons.indexOf(reason) >= 0) {
      return
    }

    dedupedReasons.push(reason)
  })

  return dedupedReasons
}

function shouldShowQualityHint(result, options = {}) {
  const config = resolvePhotoQualityConfig(options)

  if (!config.enabled || !config.showUserHint) {
    return false
  }

  if (!isPlainObject(result) || !result.suggestRetake) {
    return false
  }

  return getActionableQualityReasons(result).length > 0
}

function buildQualityHintText(result, options = {}) {
  if (!shouldShowQualityHint(result, options)) {
    return ''
  }

  const actionableReasons = getActionableQualityReasons(result)

  if (actionableReasons.length === 1) {
    return QUALITY_REASON_HINT_TEXT[actionableReasons[0]] || ''
  }

  const labels = actionableReasons
    .map((reason) => QUALITY_REASON_HINT_LABEL[reason])
    .filter(Boolean)

  if (labels.length === 0) {
    return ''
  }

  return `照片可能存在${labels.join('、')}问题，建议重拍`
}

function buildCompleteQualitySummaryText(summary, options = {}) {
  const config = resolvePhotoQualityConfig(options)

  if (!config.enabled || !config.showUserHint) {
    return ''
  }

  if (!isPlainObject(summary)) {
    return ''
  }

  const riskCount = Math.max(0, Math.round(toFiniteNumber(summary.riskCount) || 0))
  if (riskCount <= 0) {
    return ''
  }

  const riskReasons = Array.isArray(summary.riskReasons)
    ? summary.riskReasons.filter((reason) => ACTIONABLE_QUALITY_REASONS[reason])
    : []
  const labels = riskReasons
    .slice(0, 2)
    .map((reason) => QUALITY_REASON_HINT_LABEL[reason])
    .filter(Boolean)

  if (labels.length === 0) {
    return `有 ${riskCount} 张照片建议重拍，可返回修改`
  }

  if (labels.length === 1) {
    return `有 ${riskCount} 张照片可能存在${labels[0]}问题，建议返回修改`
  }

  return `有 ${riskCount} 张照片可能存在${labels[0]}或${labels[1]}问题，建议返回修改`
}

function buildPersistedQualityMeta(result, options = {}) {
  const config = resolvePhotoQualityConfig(options)

  if (!config.enabled || !config.saveQualityMeta) {
    return null
  }

  if (!isPlainObject(result)) {
    return null
  }

  if (Array.isArray(result.reasons) && result.reasons.indexOf(PHOTO_QUALITY_REASONS.DISABLED) >= 0) {
    return null
  }

  const level = PERSISTED_QUALITY_LEVELS[result.level] ? result.level : 'warn'
  const reasons = Array.isArray(result.reasons)
    ? result.reasons.filter((item) => typeof item === 'string' && item.trim())
    : []

  return {
    level,
    suggestRetake: !!result.suggestRetake,
    reasons,
    metrics: cloneMetricsForPersist(result.metrics),
    analyzedAt: isNonEmptyString(result.analyzedAt) ? result.analyzedAt : new Date().toISOString(),
    configVersion: isNonEmptyString(result.configVersion) ? result.configVersion : config.configVersion
  }
}

function attachPhotoQualityMeta(photo, result, options = {}) {
  if (!isPlainObject(photo)) {
    return photo
  }

  const qualityMeta = buildPersistedQualityMeta(result, options)

  if (!qualityMeta) {
    if (!Object.prototype.hasOwnProperty.call(photo, 'quality')) {
      return photo
    }

    const nextPhoto = { ...photo }
    delete nextPhoto.quality
    return nextPhoto
  }

  return {
    ...photo,
    quality: qualityMeta
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
  attachPhotoQualityMeta,
  analyzePhotoQuality,
  analyzePhotoQualityPixels,
  buildCompleteQualitySummaryText,
  buildPersistedQualityMeta,
  buildQualityHintText,
  buildSampledLumaMap,
  classifyQualityIssues,
  computeBlurScore,
  computeQualityMetrics,
  createBaseResult,
  detectNearFarReason,
  determineQualityLevel,
  getActionableQualityReasons,
  loadPhotoPixelsFromFile,
  resolvePhotoQualityConfig,
  resolveSampleSize,
  shouldShowQualityHint,
  validatePixelInput
}
