const fs = wx.getFileSystemManager()
const YOLOProcessUtils = require('./yolo-process-utils')

class DamageDetector {
  constructor(options = {}) {
    this.modelUrl = options.modelUrl
    this.modelPath = options.modelPath || `${wx.env.USER_DATA_PATH}/damage.onnx`
    this.scoreThreshold = options.scoreThreshold || 0.2
    this.iouThreshold = options.iouThreshold || 0.1
    this.targetSize = options.targetSize || 640
    this.inputName = options.inputName || 'images'
    this.outputName = options.outputName || 'output0'

    this.session = null
    this.isLoaded = false
  }

  async load() {
    try {
      console.log('[AI:model:damage] load start')
      await this.downloadModel()
      await this.loadSession()
      this.isLoaded = true
      console.log('[AI:model:damage] load success')
      return true
    } catch (error) {
      console.error('Load model failed:', error)
      throw error
    }
  }

  async downloadModel() {
    try {
      fs.accessSync(this.modelPath)
      console.log('[AI:model:damage] cache hit', this.modelPath)
    } catch (error) {
      if (!this.modelUrl) {
        throw new Error('Damage model URL is required when local cache is missing')
      }

      console.log('[AI:model:damage] cache miss, downloading from:', this.modelUrl)

      await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: this.modelUrl,
          success: (res) => {
            if (res.statusCode === 200) {
              fs.copyFileSync(res.tempFilePath, this.modelPath)
              console.log('[AI:model:damage] download success', this.modelPath)
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
    console.log('[AI:model:damage] loadSession start', this.modelPath)
    this.session = wx.createInferenceSession({
      model: this.modelPath,
      precisionLevel: 1
    })

    await new Promise((resolve, reject) => {
      this.session.onLoad(resolve)
      this.session.onError(reject)
    })

    console.log('[AI:model:damage] session loaded')
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
    const [, numClasses, numBoxes] = out.shape

    const boxes = []
    for (let i = 0; i < numBoxes; i++) {
      let maxScore = 0
      for (let c = 4; c < numClasses; c++) {
        const classScore = data[c * numBoxes + i]
        if (classScore > maxScore) {
          maxScore = classScore
        }
      }

      if (maxScore <= this.scoreThreshold) continue

      const x = data[i]
      const y = data[numBoxes + i]
      const w = data[2 * numBoxes + i]
      const h = data[3 * numBoxes + i]

      boxes.push({
        x1: x - w / 2,
        y1: y - h / 2,
        x2: x + w / 2,
        y2: y + h / 2,
        score: maxScore
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

module.exports = DamageDetector
