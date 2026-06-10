const DamagePhaseController = require('../packageD/utils/damage-phase-controller')
const DamageFrameScorer = require('../packageD/utils/damage-frame-scorer')
const DamageTracker = require('../packageD/utils/damage-tracker')
const DamageMotionEstimator = require('../packageD/utils/damage-motion-estimator')
const DamageAutoCaptureEngine = require('../packageD/utils/damage-auto-capture-engine')
const {
  PlateFrameUtils,
  createVirtualCameraMapping,
  mapDetectionToVirtualCamera
} = require('../packageD/utils/frame-utils')

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
    jest.dontMock('../packageD/utils/yolo-process-utils')
    jest.dontMock('../packageD/utils/env-config')
  })

  test('adds imageAreaRatio from detection box and original image area', async () => {
    jest.resetModules()
    global.wx = {
      getFileSystemManager: jest.fn(() => ({}))
    }
    jest.doMock('../packageD/utils/env-config', () => ({
      getAiConfig: jest.fn(() => ({
        damageModelUrl: 'https://example.com/damage.onnx',
        damageModelPath: '/tmp/damage.onnx'
      }))
    }))
    jest.doMock('../packageD/utils/yolo-process-utils', () => ({
      letterboxToDetectInput: jest.fn(() => Promise.resolve({
        input: new Float32Array(3 * 640 * 640),
        meta: { left: 0, top: 0, scale: 1 },
        originalWidth: 200,
        originalHeight: 100
      })),
      nms: jest.fn((boxes) => boxes),
      restoreBox: jest.fn((box) => box)
    }))
    const DamageDetector = require('../packageD/utils/damage-detector')
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

  test('maps non-4:3 camera frames through aspect-fill crop before measuring damage gates', () => {
    const tracker = new DamageTracker()
    const mapping = createVirtualCameraMapping({
      sourceWidth: 800,
      sourceHeight: 450,
      targetWidth: 400,
      targetHeight: 300
    })

    const state = tracker.update({
      detection: {
        width: 198,
        height: 198,
        centerX: 300,
        centerY: 225,
        originalWidth: 800,
        originalHeight: 450,
        confidence: '90%'
      },
      captureBox: {
        x: 134,
        y: 84,
        width: 132,
        height: 132
      },
      canvasWidth: 400,
      canvasHeight: 300,
      frameMapping: mapping,
      timestamp: 100
    })

    expect(mapping.mappingMode).toBe('aspectFillCrop')
    expect(state.box.centerX).toBeCloseTo(133.33, 1)
    expect(state.box.centerY).toBeCloseTo(150, 1)
    expect(state.box.width).toBeCloseTo(132, 1)
    expect(state.box.height).toBeCloseTo(132, 1)
    expect(state.imageAreaRatio).toBeCloseTo(132 * 132 / (400 * 300), 2)
  })
})

describe('Virtual camera geometry mapping', () => {
  test('keeps legacy stretch geometry unchanged for 4:3 frames', () => {
    const mapping = createVirtualCameraMapping({
      sourceWidth: 800,
      sourceHeight: 600,
      targetWidth: 400,
      targetHeight: 300
    })
    const mapped = mapDetectionToVirtualCamera({
      width: 200,
      height: 100,
      centerX: 400,
      centerY: 300,
      originalWidth: 800,
      originalHeight: 600
    }, mapping)

    expect(mapping.mappingMode).toBe('legacy')
    expect(mapped.centerX).toBe(200)
    expect(mapped.centerY).toBe(150)
    expect(mapped.width).toBe(100)
    expect(mapped.height).toBe(50)
  })

  test('uses aspect-fill crop geometry for wide realtime frames', () => {
    const mapping = createVirtualCameraMapping({
      sourceWidth: 800,
      sourceHeight: 450,
      targetWidth: 400,
      targetHeight: 300
    })
    const mapped = mapDetectionToVirtualCamera({
      width: 210,
      height: 60,
      centerX: 400,
      centerY: 315,
      originalWidth: 800,
      originalHeight: 450
    }, mapping)

    expect(mapping.mappingMode).toBe('aspectFillCrop')
    expect(mapping.scale).toBeCloseTo(2 / 3)
    expect(mapping.offsetX).toBeCloseTo(-66.67, 1)
    expect(mapping.offsetY).toBeCloseTo(0)
    expect(mapped.centerX).toBeCloseTo(200)
    expect(mapped.centerY).toBeCloseTo(210)
    expect(mapped.width).toBeCloseTo(140)
    expect(mapped.height).toBeCloseTo(40)
  })

  test('maps square nova13 realtime frames by height fit without changing plate thresholds', () => {
    const checker = new PlateFrameUtils({
      minConsecutiveFrames: 1,
      minAreaRatio: 0.35,
      maxAreaRatio: 1.5,
      centerOffsetThreshold: 0.16
    })
    const mapping = createVirtualCameraMapping({
      sourceWidth: 480,
      sourceHeight: 480,
      targetWidth: 400,
      targetHeight: 300
    })

    const status = checker.checkFrameStatus({
      width: 188,
      height: 78,
      centerX: 242,
      centerY: 342,
      originalWidth: 480,
      originalHeight: 480,
      confidence: '90%'
    }, {
      x: 100,
      y: 176,
      width: 200,
      height: 68
    }, 400, 300, mapping)

    expect(mapping.mappingMode).toBe('heightFitPad')
    expect(mapping.scale).toBeCloseTo(0.625)
    expect(mapping.offsetX).toBeCloseTo(50)
    expect(mapping.offsetY).toBeCloseTo(0)
    expect(status.mappedBox.centerX).toBeCloseTo(201.25)
    expect(status.mappedBox.centerY).toBeCloseTo(213.75)
    expect(status.mappedBox.width).toBeCloseTo(117.5)
    expect(status.mappedBox.height).toBeCloseTo(48.75)
    expect(status.areaRatio).toBeGreaterThanOrEqual(0.35)
    expect(status.areaRatio).toBeLessThanOrEqual(1.5)
    expect(status.centerAligned).toBe(true)
    expect(status.inBox).toBe(true)
    expect(status.consecutiveMet).toBe(true)
  })

  test('lets a visually valid plate in a wide frame pass the original thresholds without changing threshold values', () => {
    const checker = new PlateFrameUtils({
      minConsecutiveFrames: 1,
      minAreaRatio: 0.35,
      maxAreaRatio: 1.5,
      centerOffsetThreshold: 0.16
    })
    const mapping = createVirtualCameraMapping({
      sourceWidth: 800,
      sourceHeight: 450,
      targetWidth: 400,
      targetHeight: 300
    })

    const status = checker.checkFrameStatus({
      width: 210,
      height: 60,
      centerX: 400,
      centerY: 315,
      originalWidth: 800,
      originalHeight: 450,
      confidence: '90%'
    }, {
      x: 100,
      y: 176,
      width: 200,
      height: 68
    }, 400, 300, mapping)

    expect(status.areaRatio).toBeGreaterThanOrEqual(0.35)
    expect(status.areaRatio).toBeLessThanOrEqual(1.5)
    expect(status.centerAligned).toBe(true)
    expect(status.inBox).toBe(true)
    expect(status.consecutiveMet).toBe(true)
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
