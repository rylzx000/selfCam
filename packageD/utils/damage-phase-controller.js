class DamagePhaseController {
  constructor(options = {}) {
    this.config = {
      seekMinDetectedFrames: options.seekMinDetectedFrames || 2,
      seekQualityThreshold: options.seekQualityThreshold || 0.22,
      seekCenterThreshold: options.seekCenterThreshold || 0.42,
      minAreaRatio: options.minAreaRatio || 0.5,
      maxAreaRatio: options.maxAreaRatio || 1,
      holdMinDwellMs: options.holdMinDwellMs || 240,
      holdStableFrames: options.holdStableFrames || 2,
      holdQualityThreshold: options.holdQualityThreshold || 0.28,
      holdStabilityThreshold: options.holdStabilityThreshold || 0.42,
      holdCenterThreshold: options.holdCenterThreshold || 0.34,
      holdAreaGraceFrames: options.holdAreaGraceFrames || 2,
      lostGraceMs: options.lostGraceMs || 600,
      lostResetMs: options.lostResetMs || 1200,
      lowQualityThreshold: options.lowQualityThreshold || 0.18
    }

    this.reset()
  }

  setAreaRatioRange(minAreaRatio, maxAreaRatio) {
    if (Number.isFinite(minAreaRatio)) {
      this.config.minAreaRatio = Math.max(0, minAreaRatio)
    }
    if (Number.isFinite(maxAreaRatio)) {
      this.config.maxAreaRatio = Math.max(0, maxAreaRatio)
    }
    if (this.config.maxAreaRatio < this.config.minAreaRatio) {
      this.config.maxAreaRatio = this.config.minAreaRatio
    }
  }

  reset() {
    this.phase = 'SEEK'
    this.phaseEnteredAt = 0
    this.detectedFrames = 0
    this.holdStableCount = 0
    this.holdAreaMissCount = 0
    this.lowQualitySince = 0
    this.captureReady = false
  }

  update(params = {}) {
    const { motion = {}, timestamp = Date.now() } = params

    if (!this.phaseEnteredAt) {
      this.phaseEnteredAt = timestamp
    }

    const trackHealthy = !!motion.hasTrack && (motion.trackQuality || 0) >= this.config.lowQualityThreshold
    if (!trackHealthy) {
      return this.handleTrackLoss(motion, timestamp)
    }

    this.lowQualitySince = 0

    if (this.phase === 'SEEK') {
      return this.updateSeekPhase(motion, timestamp)
    }
    if (this.phase === 'HOLD') {
      return this.updateHoldPhase(motion, timestamp)
    }

    return this.buildState(motion, {
      phase: 'SHOOT',
      statusText: '已稳定，即将拍摄',
      captureReady: true,
      finalReason: 'stable_hold'
    }, timestamp)
  }

  handleTrackLoss(motion, timestamp) {
    if (!this.lowQualitySince) {
      this.lowQualitySince = timestamp
    }

    const gapMs = timestamp - this.lowQualitySince
    if (this.phase === 'HOLD' && gapMs < this.config.lostGraceMs) {
      return this.buildState(motion, {
        phase: 'HOLD',
        statusText: '请保持稳定',
        captureReady: false
      }, timestamp)
    }

    if (gapMs >= this.config.lostResetMs) {
      this.reset()
      this.phaseEnteredAt = timestamp
      return this.buildState(motion, {
        phase: 'SEEK',
        statusText: '请对准车损处',
        resetTriggered: true
      }, timestamp)
    }

    this.phase = 'SEEK'
    this.phaseEnteredAt = timestamp
    this.detectedFrames = 0
    this.holdStableCount = 0
    this.holdAreaMissCount = 0

    return this.buildState(motion, {
      phase: 'SEEK',
      statusText: '请对准车损处',
      awaitingRecovery: gapMs >= this.config.lostGraceMs
    }, timestamp)
  }

  updateSeekPhase(motion, timestamp) {
    const areaRatio = motion.areaRatio || 0
    const centerOffset = Number.isFinite(motion.centerOffset) ? motion.centerOffset : 1
    const areaReady = areaRatio >= this.config.minAreaRatio && areaRatio <= this.config.maxAreaRatio
    const goodDetection = !!motion.hasTrack &&
      areaReady &&
      (motion.trackQuality || 0) >= this.config.seekQualityThreshold &&
      centerOffset <= this.config.seekCenterThreshold

    this.detectedFrames = goodDetection ? this.detectedFrames + 1 : 0

    if (this.detectedFrames >= this.config.seekMinDetectedFrames) {
      this.phase = 'HOLD'
      this.phaseEnteredAt = timestamp
      this.holdStableCount = 0
      this.holdAreaMissCount = 0
      return this.buildState(motion, {
        phase: 'HOLD',
        statusText: '请保持稳定'
      }, timestamp)
    }

    return this.buildState(motion, {
      phase: 'SEEK',
      statusText: this.detectedFrames > 0 ? '已识别到车损' : '请对准车损处'
    }, timestamp)
  }

  updateHoldPhase(motion, timestamp) {
    const areaRatio = motion.areaRatio || 0
    const centerOffset = Number.isFinite(motion.centerOffset) ? motion.centerOffset : 1
    const areaReady = areaRatio >= this.config.minAreaRatio && areaRatio <= this.config.maxAreaRatio
    const stableEnough = !!motion.hasTrack &&
      areaReady &&
      (motion.trackQuality || 0) >= this.config.holdQualityThreshold &&
      (motion.stability || 0) >= this.config.holdStabilityThreshold &&
      centerOffset <= this.config.holdCenterThreshold

    this.holdStableCount = stableEnough ? this.holdStableCount + 1 : 0

    if (!areaReady) {
      this.holdAreaMissCount += 1
      if (this.holdAreaMissCount <= this.config.holdAreaGraceFrames) {
        return this.buildState(motion, {
          phase: 'HOLD'
        }, timestamp)
      }

      this.phase = 'SEEK'
      this.phaseEnteredAt = timestamp
      this.detectedFrames = 0
      this.holdStableCount = 0
      this.holdAreaMissCount = 0
      return this.buildState(motion, {
        phase: 'SEEK',
        statusText: '请对准车损处'
      }, timestamp)
    }
    this.holdAreaMissCount = 0

    const lostCenter = centerOffset > Math.max(this.config.holdCenterThreshold * 1.35, this.config.seekCenterThreshold)
    if (lostCenter) {
      this.phase = 'SEEK'
      this.phaseEnteredAt = timestamp
      this.detectedFrames = motion.hasTrack ? 1 : 0
      this.holdStableCount = 0
      this.holdAreaMissCount = 0
      return this.buildState(motion, {
        phase: 'SEEK',
        statusText: motion.hasTrack ? '已识别到车损' : '请对准车损处'
      }, timestamp)
    }

    const dwellReady = timestamp - this.phaseEnteredAt >= this.config.holdMinDwellMs
    if (stableEnough && dwellReady && this.holdStableCount >= this.config.holdStableFrames) {
      this.phase = 'SHOOT'
      this.phaseEnteredAt = timestamp
      this.captureReady = true
      return this.buildState(motion, {
        phase: 'SHOOT',
        statusText: '已稳定，即将拍摄',
        captureReady: true,
        finalReason: 'stable_hold'
      }, timestamp)
    }

    return this.buildState(motion, {
      phase: 'HOLD',
      statusText: '请保持稳定'
    }, timestamp)
  }

  buildState(motion, overrides = {}, timestamp = Date.now()) {
    const phase = overrides.phase || this.phase
    return {
      phase,
      statusText: overrides.statusText || '',
      captureReady: !!overrides.captureReady,
      awaitingRecovery: !!overrides.awaitingRecovery,
      detectedFrames: this.detectedFrames,
      holdStableCount: this.holdStableCount,
      finalReason: overrides.finalReason || '',
      resetTriggered: !!overrides.resetTriggered,
      phaseDwellMs: this.phaseEnteredAt ? timestamp - this.phaseEnteredAt : 0
    }
  }
}

module.exports = DamagePhaseController
