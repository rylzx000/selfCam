class DamageTracker {
  constructor(options = {}) {
    this.config = {
      anchorBlendAlpha: options.anchorBlendAlpha || 0.42,
      velocityDamping: options.velocityDamping || 0.82,
      predictionDecay: options.predictionDecay || 0.88,
      qualityDecayPerSecond: options.qualityDecayPerSecond || 0.22,
      maxPredictionMs: options.maxPredictionMs || 1400,
      edgePaddingRatio: options.edgePaddingRatio || 0.04,
      minTrackQuality: options.minTrackQuality || 0.18
    }

    this.reset()
  }

  reset() {
    this.trackBox = null
    this.velocity = { x: 0, y: 0, areaRatio: 0 }
    this.trackQuality = 0
    this.lastTimestamp = 0
    this.lastDetectionAt = 0
    this.anchorStreak = 0
  }

  update(params = {}) {
    const {
      detection = null,
      captureBox = null,
      canvasWidth = 400,
      canvasHeight = 300,
      timestamp = Date.now()
    } = params

    const detectionBox = detection
      ? this.toCanvasBox(detection, captureBox, canvasWidth, canvasHeight)
      : null
    const previousBox = this.trackBox
    const dtMs = this.lastTimestamp ? Math.max(timestamp - this.lastTimestamp, 16) : 16
    const dtSeconds = dtMs / 1000
    let anchored = false

    if (!previousBox && detectionBox) {
      this.trackBox = { ...detectionBox }
      this.velocity = { x: 0, y: 0, areaRatio: 0 }
      this.trackQuality = 0.92
      this.lastDetectionAt = timestamp
      this.anchorStreak = 1
      anchored = true
    } else if (detectionBox) {
      const predictedBox = previousBox
        ? this.predictBox(previousBox, dtSeconds, canvasWidth, canvasHeight)
        : detectionBox
      const agreement = this.measureAgreement(predictedBox, detectionBox)
      const blendAlpha = this.getBlendAlpha(agreement)
      const mergedBox = this.blendBoxes(predictedBox, detectionBox, blendAlpha)

      if (previousBox) {
        this.velocity = this.estimateVelocity(previousBox, mergedBox, dtSeconds)
      }

      this.trackBox = mergedBox
      this.trackQuality = this.applyBoxPenalty(
        mergedBox,
        this.mix(this.trackQuality || 0.5, 0.58 + agreement * 0.42, 0.5),
        canvasWidth,
        canvasHeight
      )
      this.lastDetectionAt = timestamp
      this.anchorStreak += 1
      anchored = true
    } else if (previousBox) {
      const predictedBox = this.predictBox(previousBox, dtSeconds, canvasWidth, canvasHeight)
      const timeSinceDetection = this.lastDetectionAt ? timestamp - this.lastDetectionAt : Number.MAX_SAFE_INTEGER
      const decay = this.config.qualityDecayPerSecond * dtSeconds

      this.trackBox = predictedBox
      this.velocity = {
        x: this.velocity.x * this.config.velocityDamping,
        y: this.velocity.y * this.config.velocityDamping,
        areaRatio: this.velocity.areaRatio * this.config.predictionDecay
      }
      this.trackQuality = Math.max(0, this.trackQuality - decay)
      this.anchorStreak = 0

      if (timeSinceDetection > this.config.maxPredictionMs) {
        this.trackQuality = 0
      }
    } else {
      this.trackQuality = 0
      this.anchorStreak = 0
    }

    this.lastTimestamp = timestamp

    const hasTrack = !!this.trackBox && this.trackQuality >= this.config.minTrackQuality
    if (!hasTrack) {
      return {
        hasTrack: false,
        anchored,
        trackQuality: this.trackQuality,
        anchorAgeMs: this.lastDetectionAt ? timestamp - this.lastDetectionAt : Number.MAX_SAFE_INTEGER,
        anchorStreak: this.anchorStreak,
        box: null,
        areaRatio: 0,
        scale: 0,
        centerOffset: 1,
        centerOffsetX: 1,
        centerOffsetY: 1,
        clipped: false,
        previewPath: detection?.previewPath || '',
        detection
      }
    }

    return {
      hasTrack: true,
      anchored,
      trackQuality: this.trackQuality,
      anchorAgeMs: this.lastDetectionAt ? timestamp - this.lastDetectionAt : 0,
      anchorStreak: this.anchorStreak,
      box: { ...this.trackBox },
      areaRatio: this.trackBox.areaRatio,
      scale: Math.sqrt(Math.max(this.trackBox.areaRatio, 0)),
      centerOffset: this.trackBox.centerOffset,
      centerOffsetX: this.trackBox.offsetX,
      centerOffsetY: this.trackBox.offsetY,
      clipped: this.trackBox.clipped,
      previewPath: detection?.previewPath || '',
      detection
    }
  }

  toCanvasBox(detection, captureBox, canvasWidth, canvasHeight) {
    const scaleX = canvasWidth / Math.max(detection.originalWidth || canvasWidth, 1)
    const scaleY = canvasHeight / Math.max(detection.originalHeight || canvasHeight, 1)
    const width = detection.width * scaleX
    const height = detection.height * scaleY
    const centerX = detection.centerX * scaleX
    const centerY = detection.centerY * scaleY
    const left = centerX - width / 2
    const top = centerY - height / 2
    const area = Math.max(width * height, 0)
    const captureArea = captureBox ? Math.max(captureBox.width * captureBox.height, 1) : 1
    const areaRatio = area / captureArea
    const boxCenterX = captureBox ? captureBox.x + captureBox.width / 2 : canvasWidth / 2
    const boxCenterY = captureBox ? captureBox.y + captureBox.height / 2 : canvasHeight / 2
    const offsetX = captureBox ? Math.abs(centerX - boxCenterX) / Math.max(captureBox.width, 1) : 0
    const offsetY = captureBox ? Math.abs(centerY - boxCenterY) / Math.max(captureBox.height, 1) : 0
    const clipped = this.isClipped(left, top, width, height, canvasWidth, canvasHeight)

    return {
      centerX,
      centerY,
      width,
      height,
      areaRatio,
      offsetX,
      offsetY,
      centerOffset: Math.sqrt(offsetX * offsetX + offsetY * offsetY),
      clipped,
      previewPath: detection.previewPath || '',
      confidence: detection.confidence || '',
      x1: left,
      y1: top,
      x2: left + width,
      y2: top + height
    }
  }

  predictBox(box, dtSeconds, canvasWidth, canvasHeight) {
    const nextAreaRatio = Math.max(0.0001, box.areaRatio + this.velocity.areaRatio * dtSeconds)
    const currentAreaRatio = Math.max(box.areaRatio, 0.0001)
    const scaleFactor = Math.sqrt(nextAreaRatio / currentAreaRatio)
    const nextWidth = this.clamp(box.width * scaleFactor, 12, canvasWidth * 0.98)
    const nextHeight = this.clamp(box.height * scaleFactor, 12, canvasHeight * 0.98)
    const nextCenterX = this.clamp(box.centerX + this.velocity.x * dtSeconds, nextWidth / 2, canvasWidth - nextWidth / 2)
    const nextCenterY = this.clamp(box.centerY + this.velocity.y * dtSeconds, nextHeight / 2, canvasHeight - nextHeight / 2)

    return {
      ...box,
      centerX: nextCenterX,
      centerY: nextCenterY,
      width: nextWidth,
      height: nextHeight,
      areaRatio: nextAreaRatio,
      x1: nextCenterX - nextWidth / 2,
      y1: nextCenterY - nextHeight / 2,
      x2: nextCenterX + nextWidth / 2,
      y2: nextCenterY + nextHeight / 2,
      clipped: this.isClipped(nextCenterX - nextWidth / 2, nextCenterY - nextHeight / 2, nextWidth, nextHeight, canvasWidth, canvasHeight)
    }
  }

  blendBoxes(baseBox, anchorBox, alpha) {
    const mixed = {
      centerX: this.mix(baseBox.centerX, anchorBox.centerX, alpha),
      centerY: this.mix(baseBox.centerY, anchorBox.centerY, alpha),
      width: this.mix(baseBox.width, anchorBox.width, alpha),
      height: this.mix(baseBox.height, anchorBox.height, alpha),
      areaRatio: this.mix(baseBox.areaRatio, anchorBox.areaRatio, alpha),
      offsetX: this.mix(baseBox.offsetX || 0, anchorBox.offsetX || 0, alpha),
      offsetY: this.mix(baseBox.offsetY || 0, anchorBox.offsetY || 0, alpha),
      centerOffset: this.mix(baseBox.centerOffset || 0, anchorBox.centerOffset || 0, alpha),
      clipped: !!anchorBox.clipped,
      previewPath: anchorBox.previewPath,
      confidence: anchorBox.confidence
    }

    mixed.x1 = mixed.centerX - mixed.width / 2
    mixed.y1 = mixed.centerY - mixed.height / 2
    mixed.x2 = mixed.centerX + mixed.width / 2
    mixed.y2 = mixed.centerY + mixed.height / 2
    return mixed
  }

  estimateVelocity(prevBox, nextBox, dtSeconds) {
    return {
      x: (nextBox.centerX - prevBox.centerX) / Math.max(dtSeconds, 0.016),
      y: (nextBox.centerY - prevBox.centerY) / Math.max(dtSeconds, 0.016),
      areaRatio: (nextBox.areaRatio - prevBox.areaRatio) / Math.max(dtSeconds, 0.016)
    }
  }

  measureAgreement(boxA, boxB) {
    const iou = this.calculateIoU(boxA, boxB)
    const centerDistance = Math.sqrt(
      Math.pow(boxA.centerX - boxB.centerX, 2) + Math.pow(boxA.centerY - boxB.centerY, 2)
    )
    const centerScore = Math.max(0, 1 - centerDistance / Math.max(boxA.width, boxA.height, boxB.width, boxB.height, 1))
    const areaScore = Math.max(0, 1 - Math.abs(boxA.areaRatio - boxB.areaRatio) / Math.max(boxB.areaRatio, 0.01))
    return this.clamp(iou * 0.52 + centerScore * 0.28 + areaScore * 0.2, 0, 1)
  }

  calculateIoU(boxA, boxB) {
    const x1 = Math.max(boxA.x1, boxB.x1)
    const y1 = Math.max(boxA.y1, boxB.y1)
    const x2 = Math.min(boxA.x2, boxB.x2)
    const y2 = Math.min(boxA.y2, boxB.y2)
    const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
    const areaA = Math.max(0, boxA.width * boxA.height)
    const areaB = Math.max(0, boxB.width * boxB.height)
    const unionArea = areaA + areaB - intersectionArea
    return unionArea > 0 ? intersectionArea / unionArea : 0
  }

  applyBoxPenalty(box, quality, canvasWidth, canvasHeight) {
    const penalty = box.clipped ? 0.18 : 0
    return this.clamp(quality - penalty, 0, 1)
  }

  getBlendAlpha(agreement) {
    return this.clamp(this.config.anchorBlendAlpha + agreement * 0.24, 0.28, 0.78)
  }

  isClipped(left, top, width, height, canvasWidth, canvasHeight) {
    const paddingX = canvasWidth * this.config.edgePaddingRatio
    const paddingY = canvasHeight * this.config.edgePaddingRatio
    return (
      left <= paddingX ||
      top <= paddingY ||
      left + width >= canvasWidth - paddingX ||
      top + height >= canvasHeight - paddingY
    )
  }

  mix(fromValue, toValue, alpha) {
    return fromValue + (toValue - fromValue) * alpha
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
  }
}

module.exports = DamageTracker
