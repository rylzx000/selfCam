const DamagePhaseController = require('../utils/damage-phase-controller')
const DamageFrameScorer = require('../utils/damage-frame-scorer')

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
