const SAVE_FAIL_TEXT = '\u7167\u7247\u672a\u4fdd\u5b58\u5230\u76f8\u518c\uff0c\u4e0d\u5f71\u54cd\u62cd\u6444'

function getConfirmedPhotoPath(photo = {}) {
  return photo.compressedPath || photo.tempFilePath || photo.originalPath || photo.filePath || ''
}

function showSaveFailToast() {
  if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
    wx.showToast({ title: SAVE_FAIL_TEXT, icon: 'none' })
  }
}

function isAlbumPermissionDenied(err) {
  const message = (err && (err.errMsg || err.message || String(err))) || ''
  return /auth deny|authorize no response|permission denied|user deny|scope\.writePhotosAlbum/i.test(message)
}

function buildFailedResult(reason, err) {
  return {
    saved: false,
    reason,
    err
  }
}

function saveImageToPhotosAlbum(filePath) {
  return new Promise((resolve) => {
    if (!filePath) {
      const err = new Error('ALBUM_SAVE_PATH_MISSING')
      console.warn('[album] save skipped: missing filePath')
      showSaveFailToast()
      resolve(buildFailedResult('missing_path', err))
      return
    }

    if (typeof wx === 'undefined' || typeof wx.saveImageToPhotosAlbum !== 'function') {
      const err = new Error('WX_SAVE_IMAGE_TO_PHOTOS_ALBUM_UNAVAILABLE')
      console.warn('[album] save failed: api unavailable', err)
      showSaveFailToast()
      resolve(buildFailedResult('api_unavailable', err))
      return
    }

    try {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: () => {
          console.log('[album] saveImageToPhotosAlbum success:', filePath)
          resolve({
            saved: true,
            filePath
          })
        },
        fail: (err) => {
          console.warn('[album] saveImageToPhotosAlbum failed:', filePath, err)
          if (isAlbumPermissionDenied(err)) {
            resolve(buildFailedResult('permission_denied', err))
            return
          }

          showSaveFailToast()
          resolve(buildFailedResult('save_failed', err))
        }
      })
    } catch (err) {
      console.warn('[album] saveImageToPhotosAlbum exception:', err)
      if (!isAlbumPermissionDenied(err)) {
        showSaveFailToast()
      }
      resolve(buildFailedResult(isAlbumPermissionDenied(err) ? 'permission_denied' : 'exception', err))
    }
  })
}

function saveConfirmedPhotoToAlbum(photo) {
  return saveImageToPhotosAlbum(getConfirmedPhotoPath(photo))
}

module.exports = {
  SAVE_FAIL_TEXT,
  getConfirmedPhotoPath,
  saveImageToPhotosAlbum,
  saveConfirmedPhotoToAlbum
}
