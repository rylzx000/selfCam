/**
 * AI 自动拍照配置
 */

const PLATE_MODEL_PATH = `${wx.env.USER_DATA_PATH}/plate.onnx`
const DAMAGE_MODEL_PATH = `${wx.env.USER_DATA_PATH}/damage.onnx`
const MODEL_HOST = 'http://192.168.100.100:8000'
const PLATE_MODEL_URL = `${MODEL_HOST}/plate.onnx`
const DAMAGE_MODEL_URL = `${MODEL_HOST}/damage.onnx`
const DEBUG_LOG_HOST = MODEL_HOST.replace(/:\d+$/, ':8101')

const DEBUG_LOG = {
  enabled: true,
  uploadUrl: `${DEBUG_LOG_HOST}/capture-log`,
  batchSize: 20,
  maxEntries: 400,
  maxPendingEntries: 120,
  uploadThrottleMs: 1500,
  requestTimeoutMs: 2500
}

const AUTO_CAPTURE = {
  DETECT_INTERVAL: 650,
  COOLDOWN_MS: 2500,
  LOW_QUALITY: 'low',
  PLATE: {
    detectInterval: 800,
    minConsecutiveFrames: 3,
    minAreaRatio: 0.35,
    maxAreaRatio: 1.5,
    scoreThreshold: 0.7,
    iouThreshold: 0.5,
    targetSize: 640,
    inputName: 'input',
    outputName: 'output'
  },
  DAMAGE: {
    minConsecutiveFrames: 3,
    minAreaRatio: 0.5,
    maxAreaRatio: 1,
    centerOffsetThreshold: 0.24,
    scoreThreshold: 0.3,
    iouThreshold: 0.2,
    targetSize: 640,
    inputName: 'images',
    outputName: 'output0'
  },
  DAMAGE_FLOW: {
    previewInterval: 280,
    detectorEveryNFrames: 3,
    tracker: {
      anchorBlendAlpha: 0.42,
      velocityDamping: 0.82,
      predictionDecay: 0.88,
      qualityDecayPerSecond: 0.22,
      maxPredictionMs: 1400,
      edgePaddingRatio: 0.04,
      minTrackQuality: 0.18
    },
    motion: {
      qualityAlpha: 0.42,
      centerAlpha: 0.36,
      stabilityWindow: 3,
      stabilityAreaVarianceRef: 0.0036,
      stabilityCenterVarianceRef: 0.003
    },
    phase: {
      seekMinDetectedFrames: 2,
      seekQualityThreshold: 0.22,
      seekCenterThreshold: 0.34,
      minAreaRatio: 0.5,
      maxAreaRatio: 1,
      holdMinDwellMs: 240,
      holdStableFrames: 2,
      holdQualityThreshold: 0.28,
      holdStabilityThreshold: 0.42,
      holdCenterThreshold: 0.26,
      lostGraceMs: 600,
      lostResetMs: 1200,
      lowQualityThreshold: 0.18
    },
    scorer: {
      centerThreshold: 0.28,
      exposureQualityFloor: 0.32,
      maxCandidates: 6,
      maxAgeMs: 1600
    }
  },
  STATUS_TEXT: {
    idle: '',
    loading: 'AI 初始化中…',
    scanningPlate: '正在识别车牌…',
    scanningDamage: '正在识别车损…',
    detected: '已识别到目标',
    stabilizing: '请保持稳定',
    locked: '已稳定，即将拍摄',
    flowFinished: '正在自动拍照…',
    cooldown: '已自动拍照',
    moveToBox: '请对准车损处',
    adjustTarget: '请调整目标位置',
    fallback: '未稳定识别到目标，可手动拍照',
    unavailable: 'AI 不可用，请手动拍照'
  }
}

module.exports = {
  PLATE_MODEL_PATH,
  DAMAGE_MODEL_PATH,
  PLATE_MODEL_URL,
  DAMAGE_MODEL_URL,
  AUTO_CAPTURE,
  DEBUG_LOG
}
