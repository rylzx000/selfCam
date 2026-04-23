const fs = wx.getFileSystemManager()
const YOLOProcessUtils = require('./yolo-process-utils')

class PlateDetector {
  constructor(options = {}) {
    this.modelUrl = options.modelUrl
    this.modelPath = options.modelPath || `${wx.env.USER_DATA_PATH}/plate.onnx`
    this.scoreThreshold = options.scoreThreshold || 0.7
    this.iouThreshold = options.iouThreshold || 0.5
    this.targetSize = options.targetSize || 640
    this.inputName = options.inputName || 'input'
    this.outputName = options.outputName || 'output'

    this.session = null
    this.isLoaded = false
  }

  async load() {
    try {
      console.log('[AI:model:plate] load start')
      await this.downloadModel()
      await this.loadSession()
      this.isLoaded = true
      console.log('[AI:model:plate] load success')
      return true
    } catch (error) {
      console.error('Load model failed:', error)
      throw error
    }
  }

  async downloadModel() {
    try {
      fs.accessSync(this.modelPath)
      console.log('[AI:model:plate] cache hit', this.modelPath)
    } catch (error) {
      if (!this.modelUrl) {
        throw new Error('Plate model URL is required when local cache is missing')
      }

      console.log('[AI:model:plate] cache miss, downloading from:', this.modelUrl)

      await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: this.modelUrl,
          success: (res) => {
            if (res.statusCode === 200) {
              fs.copyFileSync(res.tempFilePath, this.modelPath)
              console.log('[AI:model:plate] download success', this.modelPath)
              resolve()
            } else {
              reject(new Error(`Download failed with status: ${res.statusCode}`))
            }
          },
          fail: reject
        })
      })
    }
  }

  async loadSession() {
    console.log('[AI:model:plate] loadSession start', this.modelPath)
    this.session = wx.createInferenceSession({
      model: this.modelPath,
      precisionLevel: 1
    })

    await new Promise((resolve, reject) => {
      this.session.onLoad(resolve)
      this.session.onError(reject)
    })

    console.log('[AI:model:plate] session loaded')
  }

  async detect(imagePath) {
    if (!this.isLoaded) {
      throw new Error('Model not loaded, please call load() first')
    }

    const { input, meta, originalWidth, originalHeight } = await YOLOProcessUtils.letterboxToDetectInput(imagePath, this.targetSize)

    const res = await this.session.run({
      [this.inputName]: {
        type: 'float32',
        data: input.buffer,
        shape: [1, 3, this.targetSize, this.targetSize]
      }
    })

    const out = res[this.outputName]
    if (!out) {
      console.error('Output not found. Available keys:', Object.keys(res))
      return null
    }

    const data = new Float32Array(out.data)
    const [, count, channels] = out.shape

    const boxes = []
    for (let i = 0; i < count; i++) {
      const base = i * channels
      const obj = data[base + 4]
      if (obj <= this.scoreThreshold) continue

      const p13 = data[base + 13] * obj
      const p14 = data[base + 14] * obj
      const x = data[base + 0]
      const y = data[base + 1]
      const w = data[base + 2]
      const h = data[base + 3]

      boxes.push({
        x1: x - w / 2,
        y1: y - h / 2,
        x2: x + w / 2,
        y2: y + h / 2,
        score: Math.max(p13, p14)
      })
    }

    boxes.sort((a, b) => b.score - a.score)
    const kept = YOLOProcessUtils.nms(boxes, this.iouThreshold)
    const restored = kept.map((box) => YOLOProcessUtils.restoreBox(box, meta))

    if (!restored.length) return null

    const best = restored[0]
    const centerX = Math.round((best.x1 + best.x2) / 2)
    const centerY = Math.round((best.y1 + best.y2) / 2)

    return {
      confidence: `${(best.score * 100).toFixed(2)}%`,
      x1: Math.round(best.x1),
      y1: Math.round(best.y1),
      x2: Math.round(best.x2),
      y2: Math.round(best.y2),
      width: Math.round(best.x2 - best.x1),
      height: Math.round(best.y2 - best.y1),
      centerX,
      centerY,
      originalWidth,
      originalHeight
    }
  }

  destroy() {
    if (this.session) {
      this.session.destroy()
      this.session = null
    }
    this.isLoaded = false
  }

  isModelLoaded() {
    return this.isLoaded
  }
}

module.exports = PlateDetector
