const qualityConfig = require('./utils/quality-config')

App({
  onLaunch() {
    qualityConfig.initQualityConfig().catch((error) => {
      console.warn('[quality-config] init failed:', error?.message || error)
    })

    console.log('app launch')
  },

  globalData: {}
})
