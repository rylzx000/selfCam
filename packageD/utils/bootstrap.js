const envConfig = require('./env-config')
const qualityConfig = require('./quality-config')

const REPORT_NO_STORAGE_KEY = 'selfcam_report_no'
const AUX_TICKET_STORAGE_KEY = 'selfcam_aux_ticket'

let qualityConfigInitPromise = null

const context = {
  ticket: '',
  reportNo: '',
  runtimeFlags: null,
  envVersion: ''
}

function sanitizeString(value, maxLength) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, maxLength)
}

function readStorageString(key, maxLength) {
  if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') {
    return ''
  }

  try {
    const value = wx.getStorageSync(key)
    return sanitizeString(value, maxLength)
  } catch (error) {
    return ''
  }
}

function writeStorageString(key, value) {
  if (!value || typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
    return
  }

  try {
    wx.setStorageSync(key, value)
  } catch (error) {
    // Storage failures should not block the capture flow.
  }
}

function extractQuery(launchOptions = {}) {
  return launchOptions && launchOptions.query && typeof launchOptions.query === 'object'
    ? launchOptions.query
    : {}
}

function syncToHostApp() {
  if (typeof getApp !== 'function') {
    return
  }

  try {
    const app = getApp({ allowDefault: true })
    if (!app.globalData || typeof app.globalData !== 'object') {
      app.globalData = {}
    }

    app.globalData.selfCam = {
      ...(app.globalData.selfCam && typeof app.globalData.selfCam === 'object' ? app.globalData.selfCam : {}),
      ticket: context.ticket,
      reportNo: context.reportNo,
      runtimeFlags: context.runtimeFlags,
      envVersion: context.envVersion
    }
  } catch (error) {
    // In isolated-package or test environments getApp may be unavailable.
  }
}

function initQualityConfig(runtimeFlags) {
  if (!qualityConfigInitPromise) {
    qualityConfigInitPromise = qualityConfig.initQualityConfig({
      envVersion: runtimeFlags.envVersion
    }).catch((error) => {
      console.warn('[quality-config] init failed:', error?.message || error)
    })
  }

  return qualityConfigInitPromise
}

function bootstrap(launchOptions = {}) {
  const query = extractQuery(launchOptions)
  const runtimeFlags = envConfig.getRuntimeFlags()
  const reportNo = sanitizeString(query.reportNo, 64)
  const ticket = sanitizeString(query.ticket, 256)

  context.runtimeFlags = runtimeFlags
  context.envVersion = runtimeFlags.envVersion
  context.reportNo = reportNo
  context.ticket = ticket

  writeStorageString(REPORT_NO_STORAGE_KEY, reportNo)
  writeStorageString(AUX_TICKET_STORAGE_KEY, ticket)
  syncToHostApp()
  initQualityConfig(runtimeFlags)

  if (runtimeFlags.enableVerboseConsole) {
    console.log('[bootstrap] launch', runtimeFlags.envVersion)
  }

  return {
    ...context
  }
}

function getTicket() {
  return context.ticket
}

function getReportNo() {
  return context.reportNo || readStorageString(REPORT_NO_STORAGE_KEY, 64)
}

function getRuntimeFlags() {
  return context.runtimeFlags || (typeof envConfig.getRuntimeFlags === 'function'
    ? envConfig.getRuntimeFlags()
    : null)
}

function resetForTest() {
  qualityConfigInitPromise = null
  context.ticket = ''
  context.reportNo = ''
  context.runtimeFlags = null
  context.envVersion = ''
}

module.exports = {
  REPORT_NO_STORAGE_KEY,
  AUX_TICKET_STORAGE_KEY,
  bootstrap,
  getTicket,
  getReportNo,
  getRuntimeFlags,
  resetForTest
}
