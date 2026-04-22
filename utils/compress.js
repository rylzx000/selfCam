/**
 * 图片压缩工具
 */

const MAX_FILE_SIZE = 300 * 1024 // 300KB
const MIN_QUALITY = 20
const MAX_QUALITY = 80

/**
 * 压缩图片
 * @param {string} tempFilePath 临时文件路径
 * @returns {Promise<{tempFilePath: string, fileSize: number}>}
 */
function compressImage(tempFilePath) {
  return new Promise((resolve, reject) => {
    doCompress(tempFilePath, MAX_QUALITY, resolve, reject)
  })
}

/**
 * 递归压缩
 */
function doCompress(tempFilePath, quality, resolve, reject) {
  wx.compressImage({
    src: tempFilePath,
    quality: quality,
    success: (res) => {
      // 检查文件大小
      wx.getFileInfo({
        filePath: res.tempFilePath,
        success: (fileInfo) => {
          console.log(`压缩后大小: ${fileInfo.size}B, 质量: ${quality}%`)
          
          if (fileInfo.size <= MAX_FILE_SIZE) {
            // 压缩成功
            resolve({
              tempFilePath: tempFilePath,        // 原始路径（仅供参考，不建议使用）
              compressedPath: res.tempFilePath,  // 压缩后路径（请使用此字段）
              fileSize: fileInfo.size
            })
          } else if (quality > MIN_QUALITY) {
            // 继续压缩
            doCompress(tempFilePath, quality - 10, resolve, reject)
          } else {
            // 已达最低质量，返回当前结果
            resolve({
              tempFilePath: tempFilePath,        // 原始路径（仅供参考，不建议使用）
              compressedPath: res.tempFilePath,  // 压缩后路径（请使用此字段）
              fileSize: fileInfo.size
            })
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    },
    fail: (err) => {
      reject(err)
    }
  })
}

/**
 * 批量压缩图片
 * @param {Array<string>} filePaths 文件路径数组
 * @param {function} onProgress 进度回调
 * @returns {Promise<Array>}
 */
function compressImages(filePaths, onProgress) {
  return new Promise((resolve, reject) => {
    const results = []
    let index = 0
    
    function compressNext() {
      if (index >= filePaths.length) {
        resolve(results)
        return
      }
      
      compressImage(filePaths[index])
        .then((result) => {
          results.push(result)
          index++
          if (onProgress) {
            onProgress(index, filePaths.length)
          }
          compressNext()
        })
        .catch(reject)
    }
    
    compressNext()
  })
}

module.exports = {
  MAX_FILE_SIZE,
  compressImage,
  compressImages
}
