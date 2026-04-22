class DamageMotionEstimator {
  constructor(options = {}) {
    this.config = {
      qualityAlpha: options.qualityAlpha || 0.42,
      centerAlpha: options.centerAlpha || 0.36,
      stabilityWindow: options.stabilityWindow || 3,
      stabilityAreaVarianceRef: options.stabilityAreaVarianceRef || 0.0036,
      stabilityCenterVarianceRef: options.stabilityCenterVarianceRef || 0.003
    }

    this.reset()
  }

  reset() {
    this.lastTimestamp = 0
    this.smoothedQuality = 0
    this.smoothedCenterOffset = 1
    this.history = []
  }

  update(trackState = {}, timestamp = Date.now()) {
    const hasTrack = !!trackState.hasTrack
    const dtMs = this.lastTimestamp ? Math.max(timestamp - this.lastTimestamp, 16) : 16
    const dtSeconds = dtMs / 1000
    const rawQuality = hasTrack
      ? (trackState.trackQuality || 0)
      : Math.max(0, this.smoothedQuality - dtSeconds * 0.22)
    const rawCenterOffset = hasTrack
      ? (trackState.centerOffset || 0)
      : Math.min(1, this.smoothedCenterOffset + dtSeconds * 0.3)

    this.smoothedQuality = this.ema(this.smoothedQuality, rawQuality, this.config.qualityAlpha)
    this.smoothedCenterOffset = this.ema(this.smoothedCenterOffset, rawCenterOffset, this.config.centerAlpha)
    this.lastTimestamp = timestamp

    this.pushHistory({
      areaRatio: trackState.areaRatio || 0,
      centerOffset: this.smoothedCenterOffset,
      trackQuality: this.smoothedQuality,
      hasTrack
    })

    return {
      hasTrack,
      trackQuality: this.smoothedQuality,
      centerOffset: this.smoothedCenterOffset,
      stability: this.computeStability(),
      areaRatio: trackState.areaRatio || 0,
      clipped: !!trackState.clipped,
      anchorAgeMs: trackState.anchorAgeMs || Number.MAX_SAFE_INTEGER,
      anchorStreak: trackState.anchorStreak || 0,
      anchored: !!trackState.anchored,
      guidePoint: trackState.box
        ? { x: trackState.box.centerX, y: trackState.box.centerY }
        : null
    }
  }

  pushHistory(entry) {
    this.history.push(entry)
    if (this.history.length > this.config.stabilityWindow) {
      this.history.shift()
    }
  }

  computeStability() {
    if (!this.history.length) {
      return 0
    }

    const areaValues = this.history.map((item) => item.areaRatio)
    const centerValues = this.history.map((item) => item.centerOffset)
    const qualityValues = this.history.map((item) => item.trackQuality)
    const trackedRatio = this.history.reduce((sum, item) => sum + (item.hasTrack ? 1 : 0), 0) / this.history.length
    const areaVariance = this.getVariance(areaValues)
    const centerVariance = this.getVariance(centerValues)
    const qualityMean = qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length
    const areaScore = this.clamp(1 - areaVariance / Math.max(this.config.stabilityAreaVarianceRef, 0.0001), 0, 1)
    const centerScore = this.clamp(1 - centerVariance / Math.max(this.config.stabilityCenterVarianceRef, 0.0001), 0, 1)

    return this.clamp(
      qualityMean * 0.45 +
      trackedRatio * 0.25 +
      areaScore * 0.15 +
      centerScore * 0.15,
      0,
      1
    )
  }

  getVariance(values = []) {
    if (!values.length) {
      return 0
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
  }

  ema(previousValue, nextValue, alpha) {
    if (!Number.isFinite(previousValue) || previousValue === 0) {
      return nextValue
    }
    return previousValue + (nextValue - previousValue) * alpha
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
  }
}

module.exports = DamageMotionEstimator
