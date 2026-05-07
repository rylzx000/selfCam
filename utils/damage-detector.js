const fs = wx.getFileSystemManager()
const YOLOProcessUtils = require('./yolo-process-utils')
const envConfig = require('./env-config')
const runtimeLogger = require('./runtime-logger')

const MODEL_NAME = 'damage'

function getErrMsg(error) {
  if (!error) {
    return ''
  }
  return error.errMsg || error.message || String(error)
}

function createModelError(message, payload = {}) {
  const error = new Error(message)
  Object.assign(error, payload)
  return error
}

function logModel(level, event, payload = {}) {
  const data = {
    modelName: MODEL_NAME,
    ...payload
  }

  try {
    if (level === 'info') {
      if (event === 'cache_hit') {
        runtimeLogger.info('ai_model', 'cache_hit', data)
        return
      }
      if (event === 'download_start') {
        runtimeLogger.info('ai_model', 'download_start', data)
        return
      }
      if (event === 'download_success') {
        runtimeLogger.info('ai_model', 'download_success', data)
        return
      }
      if (event === 'session_load_start') {
        runtimeLogger.info('ai_model', 'session_load_start', data)
        return
      }
      if (event === 'session_load_success') {
        runtimeLogger.info('ai_model', 'session_load_success', data)
        return
      }
    }

    if (level === 'error') {
      const reportError = runtimeLogger.forceError || runtimeLogger.error
      if (event === 'download_status_failed') {
        reportError('ai_model', 'download_status_failed', data)
        return
      }
      if (event === 'download_failed') {
        reportError('ai_model', 'download_failed', data)
        return
      }
      if (event === 'cache_copy_failed') {
        reportError('ai_model', 'cache_copy_failed', data)
        return
      }
      if (event === 'session_load_failed') {
        reportError('ai_model', 'session_load_failed', data)
        return
      }
    }

    const logger = runtimeLogger[level] || runtimeLogger.info
    logger('ai_model', event, data)
  } catch (error) {
    // AI 日志失败不影响模型加载主流程
  }
}

class DamageDetector {
  constructor(options = {}) {
    const aiConfig = options.aiConfig || envConfig.getAiConfig()
    this.modelUrl = options.modelUrl || aiConfig.damageModelUrl
    this.modelPath = options.modelPath || aiConfig.damageModelPath
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
    logModel('info', 'download_start', {
      modelUrl: this.modelUrl,
      modelPath: this.modelPath
    })

    try {
      fs.accessSync(this.modelPath)
      console.log('[AI:model:damage] cache hit', this.modelPath)
      logModel('info', 'cache_hit', {
        modelPath: this.modelPath
      })
    } catch (error) {
      if (!this.modelUrl) {
        const modelError = createModelError('Damage model URL is required when local cache is missing', {
          stage: 'download_config',
          modelName: MODEL_NAME,
          modelUrl: this.modelUrl,
          modelPath: this.modelPath
        })
        logModel('error', 'download_failed', {
          stage: modelError.stage,
          modelUrl: modelError.modelUrl,
          modelPath: modelError.modelPath,
          errMsg: modelError.message
        })
        throw modelError
      }

      console.log('[AI:model:damage] cache miss, downloading from:', this.modelUrl)

      await new Promise((resolve, reject) => {
        try {
          wx.downloadFile({
            url: this.modelUrl,
            success: (res) => {
              if (res.statusCode !== 200) {
                const modelError = createModelError(`Download failed with status: ${res.statusCode}`, {
                  stage: 'download_status',
                  modelName: MODEL_NAME,
                  statusCode: res.statusCode,
                  modelUrl: this.modelUrl,
                  errMsg: res.errMsg || ''
                })
                logModel('error', 'download_status_failed', {
                  stage: modelError.stage,
                  statusCode: modelError.statusCode,
                  modelUrl: modelError.modelUrl,
                  errMsg: modelError.errMsg
                })
                reject(modelError)
                return
              }

              try {
                fs.copyFileSync(res.tempFilePath, this.modelPath)
              } catch (copyError) {
                const modelError = createModelError('Damage model cache copy failed', {
                  stage: 'cache_copy',
                  modelName: MODEL_NAME,
                  modelUrl: this.modelUrl,
                  modelPath: this.modelPath,
                  tempFilePath: res.tempFilePath || '',
                  errMsg: getErrMsg(copyError)
                })
                logModel('error', 'cache_copy_failed', {
                  stage: modelError.stage,
                  modelUrl: modelError.modelUrl,
                  modelPath: modelError.modelPath,
                  tempFilePath: modelError.tempFilePath,
                  errMsg: modelError.errMsg
                })
                reject(modelError)
                return
              }

              console.log('[AI:model:damage] download success', this.modelPath)
              logModel('info', 'download_success', {
                statusCode: res.statusCode,
                modelUrl: this.modelUrl,
                modelPath: this.modelPath
              })
              resolve()
            },
            fail: (err) => {
              const modelError = createModelError('Damage model download failed', {
                stage: 'download',
                modelName: MODEL_NAME,
                modelUrl: this.modelUrl,
                errMsg: getErrMsg(err)
              })
              logModel('error', 'download_failed', {
                stage: modelError.stage,
                modelUrl: modelError.modelUrl,
                errMsg: modelError.errMsg
              })
              reject(modelError)
            }
          })
        } catch (downloadError) {
          const modelError = createModelError('Damage model download failed', {
            stage: 'download',
            modelName: MODEL_NAME,
            modelUrl: this.modelUrl,
            errMsg: getErrMsg(downloadError)
          })
          logModel('error', 'download_failed', {
            stage: modelError.stage,
            modelUrl: modelError.modelUrl,
            errMsg: modelError.errMsg
          })
          reject(modelError)
        }
      })
    }
  }

  async loadSession() {
    console.log('[AI:model:damage] loadSession start', this.modelPath)
    logModel('info', 'session_load_start', {
      modelPath: this.modelPath
    })

    try {
      this.session = wx.createInferenceSession({
        model: this.modelPath,
        precisionLevel: 1
      })

      await new Promise((resolve, reject) => {
        this.session.onLoad(() => {
          logModel('info', 'session_load_success', {
            modelPath: this.modelPath
          })
          resolve()
        })
        this.session.onError((err) => {
          const modelError = createModelError('Damage inference session load failed', {
            stage: 'inference_session',
            modelName: MODEL_NAME,
            modelPath: this.modelPath,
            errMsg: getErrMsg(err)
          })
          logModel('error', 'session_load_failed', {
            stage: modelError.stage,
            modelPath: modelError.modelPath,
            errMsg: modelError.errMsg
          })
          reject(modelError)
        })
      })
    } catch (error) {
      if (error?.stage === 'inference_session') {
        throw error
      }

      const modelError = createModelError('Damage inference session load failed', {
        stage: 'inference_session',
        modelName: MODEL_NAME,
        modelPath: this.modelPath,
        errMsg: getErrMsg(error)
      })
      logModel('error', 'session_load_failed', {
        stage: modelError.stage,
        modelPath: modelError.modelPath,
        errMsg: modelError.errMsg
      })
      throw modelError
    }

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
    const width = Math.round(best.x2 - best.x1)
    const height = Math.round(best.y2 - best.y1)
    const imageArea = originalWidth > 0 && originalHeight > 0
      ? originalWidth * originalHeight
      : 0
    const imageAreaRatio = imageArea > 0
      ? Math.max(width * height, 0) / imageArea
      : 0

    return {
      confidence: `${(best.score * 100).toFixed(2)}%`,
      x1: Math.round(best.x1),
      y1: Math.round(best.y1),
      x2: Math.round(best.x2),
      y2: Math.round(best.y2),
      width,
      height,
      centerX,
      centerY,
      imageAreaRatio,
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
