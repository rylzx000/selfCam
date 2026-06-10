const RESPONSIVE_UI_SCALE_THRESHOLD = 1.3

function getFiniteNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function toFixedNumber(value) {
  return Number(value.toFixed(2))
}

function px(value) {
  return `${toFixedNumber(value)}px`
}

function buildResponsiveStyle(enabled, declarations = []) {
  if (!enabled) {
    return ''
  }

  return declarations
    .map(([name, value]) => `${name}: ${px(value)};`)
    .join(' ')
}

function normalizeLandscapeWindow(info = {}, fallbackWidth = 844, fallbackHeight = 390) {
  const rawWindowWidth = getFiniteNumber(info.windowWidth, fallbackWidth)
  const rawWindowHeight = getFiniteNumber(info.windowHeight, fallbackHeight)
  const windowWidth = Math.max(rawWindowWidth, rawWindowHeight)
  const windowHeight = Math.min(rawWindowWidth, rawWindowHeight)
  const safeArea = info.safeArea || {}
  const safeAreaWidth = getFiniteNumber(safeArea.right - safeArea.left, windowWidth)
  const safeAreaHeight = getFiniteNumber(safeArea.bottom - safeArea.top, windowHeight)

  return {
    rawWindowWidth,
    rawWindowHeight,
    windowWidth,
    windowHeight,
    safeAreaWidth,
    safeAreaHeight,
    pixelRatio: getFiniteNumber(info.pixelRatio, 0)
  }
}

function isOpenHarmonyInfo(info = {}) {
  const platform = String(info.platform || '').toLowerCase()
  const system = String(info.system || '').toLowerCase()
  return platform === 'ohos' || system.includes('openharmony')
}

function resolveResponsiveUiScale(options = {}) {
  const layoutScale = getFiniteNumber(options.layoutScale, 0)
  const windowWidth = getFiniteNumber(options.windowWidth, 0)
  const windowHeight = getFiniteNumber(options.windowHeight, 0)
  const threshold = Number.isFinite(options.threshold)
    ? options.threshold
    : RESPONSIVE_UI_SCALE_THRESHOLD
  const info = options.info || {}
  const isLandscape = windowWidth > windowHeight
  const highResolution = layoutScale >= threshold
  const ohosLandscape = isLandscape && isOpenHarmonyInfo(info)
  const needsResponsiveUiScale = highResolution || ohosLandscape

  return {
    needsResponsiveUiScale,
    uiScale: needsResponsiveUiScale ? layoutScale : 0,
    uiScaleReason: highResolution ? 'highResolution' : (ohosLandscape ? 'ohosLandscape' : 'default')
  }
}

module.exports = {
  RESPONSIVE_UI_SCALE_THRESHOLD,
  buildResponsiveStyle,
  getFiniteNumber,
  normalizeLandscapeWindow,
  resolveResponsiveUiScale,
  toFixedNumber
}
