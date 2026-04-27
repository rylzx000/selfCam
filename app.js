const envConfig = require('./utils/env-config')
const qualityConfig = require('./utils/quality-config')

App({
  onLaunch() {
    const runtimeFlags = envConfig.getRuntimeFlags()

    this.globalData.runtimeFlags = runtimeFlags
    this.globalData.envVersion = runtimeFlags.envVersion

    qualityConfig.initQualityConfig({
      envVersion: runtimeFlags.envVersion
    }).catch((error) => {
      console.warn('[quality-config] init failed:', error?.message || error)
    })

    if (runtimeFlags.enableVerboseConsole) {
      console.log('[app] launch', runtimeFlags.envVersion)
    }
  },

  globalData: {}
})
