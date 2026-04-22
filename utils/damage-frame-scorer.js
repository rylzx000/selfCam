class DamageFrameScorer {
  constructor(options = {}) {
    this.config = {
      centerThreshold: options.centerThreshold || 0.28,
      exposureQualityFloor: options.exposureQualityFloor || 0.32,
      maxCandidates: options.maxCandidates || 6,
      maxAgeMs: options.maxAgeMs || 1600
    }

    this.reset()
  }

  reset() {
    this.candidates = []
  }

  addCandidate(params = {}) {
    const {
      previewPath = '',
      timestamp = Date.now(),
      detection = null,
      motion = {},
      phaseState = {},
      track = {}
    } = params

    if (!previewPath || !detection) {
      return null
    }

    this.prune(timestamp)

    const confidenceScore = this.normalizeConfidence(detection.confidence)
    const centerScore = this.scoreCenter(motion.centerOffset || 0)
    const stabilityScore = this.clamp(motion.stability || 0, 0, 1)
    const qualityScore = this.clamp(motion.trackQuality || 0, 0, 1)
    const exposureScore = this.scoreExposure(confidenceScore, qualityScore, track.clipped)
    const penalty = this.computePenalty({
      confidenceScore,
      motion,
      track
    })

    const totalScore = this.clamp(
      confidenceScore * 0.3 +
      centerScore * 0.25 +
      stabilityScore * 0.25 +
      qualityScore * 0.2 -
      penalty,
      0,
      1
    )

    const candidate = {
      previewPath,
      timestamp,
      confidence: detection.confidence,
      score: totalScore,
      phase: phaseState.phase || '',
      trackQuality: motion.trackQuality || 0,
      stability: motion.stability || 0,
      box: detection,
      breakdown: {
        confidenceScore,
        centerScore,
        stabilityScore,
        qualityScore,
        exposureScore,
        penalty
      }
    }

    const existingIndex = this.candidates.findIndex((item) => item.previewPath === previewPath)
    if (existingIndex >= 0) {
      this.candidates.splice(existingIndex, 1, candidate)
    } else {
      this.candidates.push(candidate)
    }

    this.candidates.sort((left, right) => right.score - left.score)
    if (this.candidates.length > this.config.maxCandidates) {
      this.candidates.length = this.config.maxCandidates
    }

    return candidate
  }

  prune(timestamp = Date.now()) {
    this.candidates = this.candidates.filter((candidate) => timestamp - candidate.timestamp <= this.config.maxAgeMs)
  }

  getBestCandidate(timestamp = Date.now()) {
    this.prune(timestamp)
    return this.candidates.length ? this.candidates[0] : null
  }

  scoreCenter(centerOffset) {
    return this.clamp(1 - centerOffset / Math.max(this.config.centerThreshold, 0.01), 0, 1)
  }

  scoreExposure(confidenceScore, trackQuality, clipped) {
    const baseScore = confidenceScore * 0.6 + trackQuality * 0.4
    const clippedPenalty = clipped ? 0.18 : 0
    return this.clamp(baseScore - clippedPenalty, this.config.exposureQualityFloor, 1)
  }

  computePenalty(params = {}) {
    const {
      confidenceScore = 0,
      motion = {},
      track = {}
    } = params

    let penalty = 0
    if (track.clipped) {
      penalty += 0.18
    }
    if ((motion.centerOffset || 1) > this.config.centerThreshold) {
      penalty += 0.1
    }
    if ((motion.trackQuality || 0) < 0.3) {
      penalty += 0.08
    }
    if ((motion.stability || 0) < 0.45) {
      penalty += 0.08
    }
    if (confidenceScore < 0.45) {
      penalty += 0.04
    }
    return this.clamp(penalty, 0, 0.45)
  }

  normalizeConfidence(confidenceText = '') {
    const confidenceValue = parseFloat(String(confidenceText).replace('%', ''))
    return this.clamp(Number.isFinite(confidenceValue) ? confidenceValue / 100 : 0, 0, 1)
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
  }
}

module.exports = DamageFrameScorer
