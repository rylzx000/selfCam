const CAMERA_SCOPE = 'scope.camera'
const ALBUM_SCOPE = 'scope.writePhotosAlbum'

const CAMERA_DENIED_MESSAGE = '\u9700\u8981\u5f00\u542f\u6444\u50cf\u5934\u6743\u9650\u540e\u624d\u80fd\u62cd\u6444\u8f66\u8f86\u7167\u7247'
const ALBUM_DENIED_MESSAGE = '需要开启相册保存权限后，才能将采集照片保存到手机相册'

function getAuthSetting() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.getSetting !== 'function') {
      resolve({})
      return
    }

    try {
      wx.getSetting({
        success: (res) => {
          resolve(res?.authSetting || {})
        },
        fail: (err) => {
          console.warn('[permission] getSetting failed:', err)
          resolve({})
        }
      })
    } catch (err) {
      console.warn('[permission] getSetting exception:', err)
      resolve({})
    }
  })
}

function authorizeScope(scope) {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.authorize !== 'function') {
      resolve(false)
      return
    }

    try {
      wx.authorize({
        scope,
        success: () => resolve(true),
        fail: (err) => {
          console.warn('[permission] authorize failed:', scope, err)
          resolve(false)
        }
      })
    } catch (err) {
      console.warn('[permission] authorize exception:', scope, err)
      resolve(false)
    }
  })
}

function confirmOpenCameraSetting() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.showModal !== 'function') {
      resolve(false)
      return
    }

    try {
      wx.showModal({
        title: '\u6444\u50cf\u5934\u6743\u9650',
        content: CAMERA_DENIED_MESSAGE,
        confirmText: '\u53bb\u8bbe\u7f6e',
        cancelText: '\u53d6\u6d88',
        success: (res) => resolve(!!res.confirm),
        fail: (err) => {
          console.warn('[permission] showModal failed:', err)
          resolve(false)
        }
      })
    } catch (err) {
      console.warn('[permission] showModal exception:', err)
      resolve(false)
    }
  })
}

function openCameraSetting() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.openSetting !== 'function') {
      resolve(false)
      return
    }

    try {
      wx.openSetting({
        success: (res) => resolve(res?.authSetting?.[CAMERA_SCOPE] === true),
        fail: (err) => {
          console.warn('[permission] openSetting failed:', err)
          resolve(false)
        }
      })
    } catch (err) {
      console.warn('[permission] openSetting exception:', err)
      resolve(false)
    }
  })
}

function confirmOpenAlbumSetting() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.showModal !== 'function') {
      resolve(false)
      return
    }

    try {
      wx.showModal({
        title: '相册权限',
        content: ALBUM_DENIED_MESSAGE,
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => resolve(!!res.confirm),
        fail: (err) => {
          console.warn('[permission] show album modal failed:', err)
          resolve(false)
        }
      })
    } catch (err) {
      console.warn('[permission] show album modal exception:', err)
      resolve(false)
    }
  })
}

function openAlbumSetting() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.openSetting !== 'function') {
      resolve(false)
      return
    }

    try {
      wx.openSetting({
        success: (res) => resolve(res?.authSetting?.[ALBUM_SCOPE] === true),
        fail: (err) => {
          console.warn('[permission] open album setting failed:', err)
          resolve(false)
        }
      })
    } catch (err) {
      console.warn('[permission] open album setting exception:', err)
      resolve(false)
    }
  })
}

async function ensureCameraPermission() {
  const authSetting = await getAuthSetting()
  if (authSetting[CAMERA_SCOPE] === true) {
    return true
  }

  if (authSetting[CAMERA_SCOPE] !== false && await authorizeScope(CAMERA_SCOPE)) {
    return true
  }

  if (!await confirmOpenCameraSetting()) {
    return false
  }

  return openCameraSetting()
}

async function ensureAlbumPermission() {
  const authSetting = await getAuthSetting()
  if (authSetting[ALBUM_SCOPE] === true) {
    return true
  }

  if (authSetting[ALBUM_SCOPE] === false) {
    console.warn('[permission] album permission denied')
    return false
  }

  return authorizeScope(ALBUM_SCOPE)
}

async function ensureAlbumSavePermission() {
  const authSetting = await getAuthSetting()
  if (authSetting[ALBUM_SCOPE] === true) {
    return true
  }

  if (authSetting[ALBUM_SCOPE] !== false && await authorizeScope(ALBUM_SCOPE)) {
    return true
  }

  if (!await confirmOpenAlbumSetting()) {
    return false
  }

  return openAlbumSetting()
}

async function ensureStartCapturePermissions() {
  const cameraGranted = await ensureCameraPermission()

  return {
    cameraGranted,
    albumGranted: false
  }
}

module.exports = {
  CAMERA_SCOPE,
  ALBUM_SCOPE,
  CAMERA_DENIED_MESSAGE,
  ALBUM_DENIED_MESSAGE,
  ensureCameraPermission,
  ensureAlbumPermission,
  ensureAlbumSavePermission,
  ensureStartCapturePermissions
}
