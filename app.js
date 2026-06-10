App({
  onLaunch(options = {}) {
    this.globalData.launchOptions = options
  },

  globalData: {
    launchOptions: null,
    selfCam: {}
  }
})
