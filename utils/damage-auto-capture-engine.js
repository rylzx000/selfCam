const DamageTracker = require('./damage-tracker')
const DamageMotionEstimator = require('./damage-motion-estimator')
const DamagePhaseController = require('./damage-phase-controller')
const DamageFrameScorer = require('./damage-frame-scorer')

class DamageAutoCaptureEngine {
  constructor(options = {}) {
    const config = options.config || {}
    this.config = {
      detectorEveryNFrames: config.detectorEveryNFrames || 3,
      tracker: config.tracker || {},
      motion: config.motion || {},
      phase: config.phase || {},
      scorer: config.scorer || {}
    }

    this.tracker = new DamageTracker(this.config.tracker)
    this.motionEstimator = new DamageMotionEstimator(this.config.motion)
    this.phaseController = new DamagePhaseController(this.config.phase)
    this.frameScorer = new DamageFrameScorer(this.config.scorer)
    this.previewFrameCount = 0
  }

  reset() {
    this.previewFrameCount = 0
    this.tracker.reset()
    this.motionEstimator.reset()
    this.phaseController.reset()
    this.frameScorer.reset()
  }

  shouldRunDetector() {
    this.previewFrameCount += 1
    return this.previewFrameCount === 1 || this.previewFrameCount % Math.max(this.config.detectorEveryNFrames, 1) === 0
  }

  update(frame = {}) {
    const {
      detection = null,
      previewPath = '',
      timestamp = Date.now(),
      captureBox,
      canvasWidth = 400,
      canvasHeight = 300
    } = frame

    const trackingState = this.tracker.update({
      detection: detection
        ? { ...detection, previewPath: previewPath || detection.previewPath || '' }
        : null,
      captureBox,
      canvasWidth,
      canvasHeight,
      timestamp
    })
    const motionState = this.motionEstimator.update(trackingState, timestamp)
    const phaseState = this.phaseController.update({
      motion: motionState,
      timestamp
    })

    if (phaseState.resetTriggered) {
      this.frameScorer.reset()
    }

    if ((phaseState.phase === 'HOLD' || phaseState.phase === 'SHOOT') && detection && previewPath) {
      this.frameScorer.addCandidate({
        previewPath,
        timestamp,
        detection,
        motion: motionState,
        phaseState,
        track: trackingState
      })
    }

    const bestCandidate = this.frameScorer.getBestCandidate(timestamp)
    const captureReady = !!phaseState.captureReady && !!bestCandidate

    return {
      detected: !!(detection || trackingState.hasTrack),
      hasTrack: !!trackingState.hasTrack,
      statusText: captureReady ? '已稳定，即将拍摄' : phaseState.statusText,
      phase: phaseState.phase,
      captureReady,
      awaitingRecovery: !!phaseState.awaitingRecovery,
      detectedFrames: phaseState.detectedFrames || 0,
      holdStableCount: phaseState.holdStableCount || 0,
      debug: {
        trackQuality: motionState.trackQuality || 0,
        stability: motionState.stability || 0,
        centerOffset: motionState.centerOffset || 0,
        areaRatio: motionState.areaRatio || 0
      },
      aiDetection: {
        detected: !!(detection || bestCandidate),
        score: detection ? detection.confidence : (bestCandidate ? bestCandidate.confidence : ''),
        stableFrames: phaseState.holdStableCount || phaseState.detectedFrames || 0,
        box: detection || (bestCandidate ? bestCandidate.box : null),
        selectedFramePath: bestCandidate ? bestCandidate.previewPath : '',
        selectedFrameScore: bestCandidate ? bestCandidate.score : 0,
        finalReason: captureReady ? (phaseState.finalReason || 'stable_hold') : ''
      }
    }
  }
}

module.exports = DamageAutoCaptureEngine
