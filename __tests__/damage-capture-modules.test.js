const DamagePhaseController = require('../utils/damage-phase-controller')
const DamageFrameScorer = require('../utils/damage-frame-scorer')
const DamageTracker = require('../utils/damage-tracker')
const DamageMotionEstimator = require('../utils/damage-motion-estimator')
const DamageAutoCaptureEngine = require('../utils/damage-auto-capture-engine')

describe('DamagePhaseController', () => {
  const controllerOptions = {
    seekMinDetectedFrames: 2,
    holdMinDwellMs: 1,
    holdStableFrames: 2,
    lostGraceMs: 200,
    lostResetMs: 500
  }

  function motion(overrides = {}) {
    return {
      hasTrack: true,
      areaRatio: 0.62,
      trackQuality: 0.8,
      stability: 0.82,
      centerOffset: 0.08,
      ...overrides
    }
  }

  test('flows from seek to hold to shoot after stable detection', () => {
    const controller = new DamagePhaseController(controllerOptions)
    let timestamp = 0

    let state = controller.update({ motion: motion(), timestamp })
    expect(state.phase).toBe('SEEK')

    timestamp += 100
    state = controller.update({ motion: motion(), timestamp })
    expect(state.phase).toBe('HOLD')

    timestamp += 100
    state = controller.update({ motion: motion({ stability: 0.86 }), timestamp })
    expect(state.phase).toBe('HOLD')

    timestamp += 100
    state = controller.update({ motion: motion({ stability: 0.9 }), timestamp })
    expect(state.phase).toBe('SHOOT')
    expect(state.captureReady).toBe(true)
  })

  test('stays in seek when the damage target is too small', () => {
    const controller = new DamagePhaseController({
      ...controllerOptions,
      minAreaRatio: 0.5,
      maxAreaRatio: 1
    })
    let timestamp = 0

    let state = controller.update({
      motion: motion({ areaRatio: 0.05 }),
      timestamp
    })
    expect(state.phase).toBe('SEEK')

    timestamp += 100
    state = controller.update({
      motion: motion({ areaRatio: 0.06 }),
      timestamp
    })
    expect(state.phase).toBe('SEEK')
    expect(state.detectedFrames).toBe(0)
  })

  test('stays in seek when the damage target is too large', () => {
    const controller = new DamagePhaseController({
      ...controllerOptions,
      minAreaRatio: 0.5,
      maxAreaRatio: 1
    })
    let timestamp = 0

    let state = controller.update({
      motion: motion({ areaRatio: 1.2 }),
      timestamp
    })
    expect(state.phase).toBe('SEEK')

    timestamp += 100
    state = controller.update({
      motion: motion({ areaRatio: 1.15 }),
      timestamp
    })
    expect(state.phase).toBe('SEEK')
    expect(state.detectedFrames).toBe(0)
  })

  test('keeps hold briefly during short tracking loss and returns to seek after longer loss', () => {
    const controller = new DamagePhaseController(controllerOptions)
    let timestamp = 0

    controller.update({ motion: motion(), timestamp })
    timestamp += 100
    controller.update({ motion: motion(), timestamp })
    timestamp += 100
    let state = controller.update({ motion: motion(), timestamp })
    expect(state.phase).toBe('HOLD')

    timestamp += 150
    state = controller.update({
      motion: motion({ hasTrack: false, trackQuality: 0.05, stability: 0.1 }),
      timestamp
    })
    expect(state.phase).toBe('HOLD')

    timestamp += 200
    state = controller.update({
      motion: motion({ hasTrack: false, trackQuality: 0.05, stability: 0.1 }),
      timestamp
    })
    expect(state.phase).toBe('SEEK')
    expect(state.awaitingRecovery).toBe(true)
  })

  test('treats zero center offset as centered', () => {
    const controller = new DamagePhaseController({
      ...controllerOptions,
      seekMinDetectedFrames: 1
    })

    const state = controller.update({
      motion: motion({ centerOffset: 0 }),
      timestamp: 0
    })

    expect(state.phase).toBe('HOLD')
  })

  test('keeps hold during brief area misses', () => {
    const controller = new DamagePhaseController({
      ...controllerOptions,
      seekMinDetectedFrames: 1,
      holdAreaGraceFrames: 2,
      minAreaRatio: 0.5,
      maxAreaRatio: 1
    })
    let timestamp = 0

    let state = controller.update({
      motion: motion({ areaRatio: 0.62 }),
      timestamp
    })
    expect(state.phase).toBe('HOLD')

    timestamp += 100
    state = controller.update({
      motion: motion({ areaRatio: 0.2 }),
      timestamp
    })
    expect(state.phase).toBe('HOLD')

    timestamp += 100
    state = controller.update({
      motion: motion({ areaRatio: 0.2 }),
      timestamp
    })
    expect(state.phase).toBe('HOLD')

    timestamp += 100
    state = controller.update({
      motion: motion({ areaRatio: 0.2 }),
      timestamp
    })
    expect(state.phase).toBe('SEEK')
  })
})

describe('DamageFrameScorer', () => {
  test('prefers centered stable candidates over edge shaky candidates', () => {
    const scorer = new DamageFrameScorer({
      maxCandidates: 4
    })

    const strongCandidate = scorer.addCandidate({
      previewPath: 'strong.jpg',
      timestamp: 1000,
      detection: { confidence: '91.2%' },
      motion: {
        trackQuality: 0.88,
        stability: 0.9,
        centerOffset: 0.05
      },
      phaseState: {
        phase: 'HOLD'
      },
      track: {
        clipped: false
      }
    })

    const weakCandidate = scorer.addCandidate({
      previewPath: 'weak.jpg',
      timestamp: 1100,
      detection: { confidence: '67.5%' },
      motion: {
        trackQuality: 0.35,
        stability: 0.32,
        centerOffset: 0.34
      },
      phaseState: {
        phase: 'HOLD'
      },
      track: {
        clipped: true
      }
    })

    expect(strongCandidate.score).toBeGreaterThan(weakCandidate.score)
    expect(scorer.getBestCandidate(1200).previewPath).toBe('strong.jpg')
  })
})

describe('DamageDetector', () => {
  afterEach(() => {
    delete global.wx
    jest.resetModules()
    jest.dontMock('../utils/yolo-process-utils')
    jest.dontMock('../utils/env-config')
  })

  test('adds imageAreaRatio from detection box and original image area', async () => {
    jest.resetModules()
    global.wx = {
      getFileSystemManager: jest.fn(() => ({}))
    }
    jest.doMock('../utils/env-config', () => ({
      getAiConfig: jest.fn(() => ({
        damageModelUrl: 'https://example.com/damage.onnx',
        damageModelPath: '/tmp/damage.onnx'
      }))
    }))
    jest.doMock('../utils/yolo-process-utils', () => ({
      letterboxToDetectInput: jest.fn(() => Promise.resolve({
        input: new Float32Array(3 * 640 * 640),
        meta: { left: 0, top: 0, scale: 1 },
        originalWidth: 200,
        originalHeight: 100
      })),
      nms: jest.fn((boxes) => boxes),
      restoreBox: jest.fn((box) => box)
    }))
    const DamageDetector = require('../utils/damage-detector')
    const detector = new DamageDetector()
    detector.isLoaded = true
    detector.session = {
      run: jest.fn(() => Promise.resolve({
        output0: {
          shape: [1, 5, 1],
          data: new Float32Array([50, 50, 40, 20, 0.9])
        }
      }))
    }

    const result = await detector.detect('/tmp/damage.jpg')

    expect(result.width).toBe(40)
    expect(result.height).toBe(20)
    expect(result.imageAreaRatio).toBeCloseTo(0.04)
  })
})

describe('DamageTracker area ratios', () => {
  test('uses imageAreaRatio as areaRatio and keeps captureAreaRatio', () => {
    const tracker = new DamageTracker()
    const state = tracker.update({
      detection: {
        width: 120,
        height: 90,
        centerX: 200,
        centerY: 150,
        originalWidth: 400,
        originalHeight: 300,
        confidence: '90%'
      },
      captureBox: {
        x: 50,
        y: 30,
        width: 300,
        height: 240
      },
      canvasWidth: 400,
      canvasHeight: 300,
      timestamp: 100
    })

    expect(state.imageAreaRatio).toBeCloseTo(0.09)
    expect(state.captureAreaRatio).toBeCloseTo(0.15)
    expect(state.areaRatio).toBeCloseTo(state.imageAreaRatio)
  })
})

describe('DamageMotionEstimator', () => {
  test('uses current center offset on first tracked frame', () => {
    const estimator = new DamageMotionEstimator()

    const state = estimator.update({
      hasTrack: true,
      trackQuality: 0.9,
      centerOffset: 0.12,
      areaRatio: 0.1
    }, 100)

    expect(state.centerOffset).toBeCloseTo(0.12)
  })
})

describe('DamageAutoCaptureEngine area ratio thresholds', () => {
  test('runs detector every frame during hold phase', () => {
    const engine = new DamageAutoCaptureEngine({
      config: {
        detectorEveryNFrames: 4
      }
    })

    expect(engine.shouldRunDetector()).toBe(true)
    expect(engine.shouldRunDetector()).toBe(false)

    engine.phaseController.phase = 'HOLD'
    expect(engine.shouldRunDetector()).toBe(true)
  })

  test('converts capture-box thresholds to image-area thresholds', () => {
    const engine = new DamageAutoCaptureEngine({
      config: {
        phase: {
          minAreaRatio: 0.5,
          maxAreaRatio: 1
        }
      }
    })

    const range = engine.getEffectiveAreaRatioRange({
      x: 50,
      y: 30,
      width: 300,
      height: 240
    }, 400, 300)

    expect(range.captureBoxImageRatio).toBeCloseTo(0.6)
    expect(range.effectiveMinAreaRatio).toBeCloseTo(0.3)
    expect(range.effectiveMaxAreaRatio).toBeCloseTo(0.6)
  })

  test('accepts image areaRatio with equivalent converted thresholds', () => {
    const engine = new DamageAutoCaptureEngine({
      config: {
        detectorEveryNFrames: 1,
        motion: {
          centerAlpha: 1
        },
        phase: {
          seekMinDetectedFrames: 1,
          seekQualityThreshold: 0.22,
          seekCenterThreshold: 0.34,
          minAreaRatio: 0.5,
          maxAreaRatio: 1,
          holdMinDwellMs: 9999
        }
      }
    })

    const state = engine.update({
      detection: {
        width: 240,
        height: 180,
        centerX: 201,
        centerY: 150,
        originalWidth: 400,
        originalHeight: 300,
        confidence: '90%'
      },
      previewPath: '/tmp/damage.jpg',
      captureBox: {
        x: 50,
        y: 30,
        width: 300,
        height: 240
      },
      canvasWidth: 400,
      canvasHeight: 300,
      timestamp: 100
    })

    expect(state.debug.areaRatio).toBeCloseTo(0.36)
    expect(state.debug.imageAreaRatio).toBeCloseTo(0.36)
    expect(state.debug.captureAreaRatio).toBeCloseTo(0.6)
    expect(state.debug.effectiveMinAreaRatio).toBeCloseTo(0.3)
    expect(state.debug.effectiveMaxAreaRatio).toBeCloseTo(0.6)
    expect(state.phase).toBe('HOLD')
  })
})
