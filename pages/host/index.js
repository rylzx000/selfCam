const SELF_CAM_INDEX_URL = '/packageD/pages/index/index'

function buildUrl(params = {}) {
  const query = Object.keys(params)
    .filter((key) => params[key])
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')

  return query ? `${SELF_CAM_INDEX_URL}?${query}` : SELF_CAM_INDEX_URL
}

Page({
  openLocalCapture() {
    wx.navigateTo({
      url: buildUrl()
    })
  },

  openMockAuxCapture() {
    wx.navigateTo({
      url: buildUrl({
        ticket: 'mock-2',
        reportNo: 'MOCK_REGIST_NO'
      })
    })
  }
})
