const envConfig = require('./utils/env-config')
const qualityConfig = require('./utils/quality-config')

const REPORT_NO_STORAGE_KEY = 'selfcam_report_no'
const AUX_TICKET_STORAGE_KEY = 'selfcam_aux_ticket'

function sanitizeReportNo(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, 64)
}

function saveReportNo(reportNo) {
  if (!reportNo || typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
    return
  }

  try {
    wx.setStorageSync(REPORT_NO_STORAGE_KEY, reportNo)
  } catch (error) {
    // 报案号缓存失败不阻断小程序启动，后续仅影响后台错误日志关联。
  }
}

function sanitizeTicket(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().slice(0, 256)
}

function saveTicket(ticket) {
  if (!ticket || typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') {
    return
  }

  try {
    wx.setStorageSync(AUX_TICKET_STORAGE_KEY, ticket)
  } catch (error) {
    // ticket 缓存失败不阻断小程序启动，后续会按无 ticket 链路处理。
  }
}

App({
  onLaunch(options = {}) {
    const runtimeFlags = envConfig.getRuntimeFlags()
    const reportNo = sanitizeReportNo(options.query && options.query.reportNo)
    const ticket = sanitizeTicket(options.query && options.query.ticket)

    this.globalData.runtimeFlags = runtimeFlags
    this.globalData.envVersion = runtimeFlags.envVersion
    this.globalData.reportNo = reportNo
    this.globalData.ticket = ticket
    saveReportNo(reportNo)
    saveTicket(ticket)

    qualityConfig.initQualityConfig({
      envVersion: runtimeFlags.envVersion
    }).catch((error) => {
      console.warn('[quality-config] init failed:', error?.message || error)
    })

    if (runtimeFlags.enableVerboseConsole) {
      console.log('[app] launch', runtimeFlags.envVersion)
    }
  },

  globalData: {
    reportNo: '',
    ticket: ''
  }
})
