const QUALITY_CONFIG_CACHE_KEY = 'selfcam_quality_config_cache_v1'
const QUALITY_CONFIG_CACHE_SCHEMA_VERSION = 1

const DEFAULT_QUALITY_CONFIG = {
  enabled: true,
  showUserHint: true,
  saveQualityMeta: false,
  blurEnabled: true,
  exposureEnabled: true,
  brightnessEnabled: true,
  nearFarEnabled: false,
  thresholds: {
    blur: 0.35,
    dark: 0.28,
    bright: 0.88
  },
  processing: {
    maxEdge: 960,
    timeoutMs: 1200
  },
  configVersion: 'default-2026-04-24',
  expiresInSeconds: 1800
}

const DEFAULT_QUALITY_CONFIG_SOURCE = {
  type: 'auto',
  remoteBaseUrl: '',
  remotePath: '/selfcam/quality-config.json',
  requestTimeoutMs: 3000,
  mockModulePath: '../mock/quality-config.mock.json'
}

function clonePlainData(value) {
  return JSON.parse(JSON.stringify(value))
}

function cloneQualityConfigDefaults() {
  return clonePlainData(DEFAULT_QUALITY_CONFIG)
}

function cloneQualityConfigSource() {
  return clonePlainData(DEFAULT_QUALITY_CONFIG_SOURCE)
}

module.exports = {
  QUALITY_CONFIG_CACHE_KEY,
  QUALITY_CONFIG_CACHE_SCHEMA_VERSION,
  DEFAULT_QUALITY_CONFIG,
  DEFAULT_QUALITY_CONFIG_SOURCE,
  cloneQualityConfigDefaults,
  cloneQualityConfigSource
}
