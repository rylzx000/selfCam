class YOLOProcessUtils {
  static letterboxToDetectInput(imagePath, targetSize = 640) {
    return new Promise((resolve, reject) => {
      const canvas = wx.createOffscreenCanvas({
        type: '2d',
        width: targetSize,
        height: targetSize
      })
      const ctx = canvas.getContext('2d')
      const img = canvas.createImage()

      img.onload = () => {
        const ow = img.width
        const oh = img.height
        const scale = Math.min(targetSize / oh, targetSize / ow)
        const nw = Math.round(ow * scale)
        const nh = Math.round(oh * scale)
        const left = Math.floor((targetSize - nw) / 2)
        const top = Math.floor((targetSize - nh) / 2)

        ctx.fillStyle = 'rgb(114,114,114)'
        ctx.fillRect(0, 0, targetSize, targetSize)
        ctx.drawImage(img, 0, 0, ow, oh, left, top, nw, nh)

        const { data } = ctx.getImageData(0, 0, targetSize, targetSize)
        const hw = targetSize * targetSize
        const input = new Float32Array(3 * hw)

        let r = 0
        let g = hw
        let b = hw * 2
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          input[r + j] = data[i] / 255
          input[g + j] = data[i + 1] / 255
          input[b + j] = data[i + 2] / 255
        }

        resolve({
          input,
          meta: { ow, oh, scale, left, top, targetSize },
          originalWidth: ow,
          originalHeight: oh
        })
      }

      img.onerror = reject
      img.src = imagePath
    })
  }

  static iou(a, b) {
    const x1 = Math.max(a.x1, b.x1)
    const y1 = Math.max(a.y1, b.y1)
    const x2 = Math.min(a.x2, b.x2)
    const y2 = Math.min(a.y2, b.y2)
    const w = Math.max(0, x2 - x1)
    const h = Math.max(0, y2 - y1)
    const inter = w * h
    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1)
    const areaB = (b.x2 - b.x1) * (b.y2 - b.y1)
    const uni = areaA + areaB - inter
    return inter / (uni || 1e-9)
  }

  static nms(boxes, iouTh) {
    const result = []
    const list = boxes.slice()

    while (list.length) {
      const first = list.shift()
      result.push(first)

      for (let i = list.length - 1; i >= 0; i--) {
        if (this.iou(first, list[i]) >= iouTh) {
          list.splice(i, 1)
        }
      }
    }

    return result
  }

  static restoreBox(box, meta) {
    const { left, top, scale } = meta
    const fixX = (value) => (value - left) / scale
    const fixY = (value) => (value - top) / scale

    return {
      ...box,
      x1: fixX(box.x1),
      x2: fixX(box.x2),
      y1: fixY(box.y1),
      y2: fixY(box.y2)
    }
  }
}

module.exports = YOLOProcessUtils
