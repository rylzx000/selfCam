const envConfig = require('./env-config')
const runtimeLogger = require('./runtime-logger')

function getWx() {
  if (typeof wx === 'undefined') {
    return null
  }
  return wx
}

function getErrMsg(error) {
  if (!error) {
    return ''
  }
  return error.errMsg || error.message || String(error)
}

function safeForceWarn(scope, event, payload) {
  try {
    const logger = runtimeLogger.forceWarn || runtimeLogger.warn
    if (typeof logger === 'function') {
      logger(scope, event, payload)
    }
  } catch (error) {
    // 模型缓存清理日志失败不影响主流程
  }
}

function safeForceError(scope, event, payload) {
  try {
    const logger = runtimeLogger.forceError || runtimeLogger.error
    if (typeof logger === 'function') {
      logger(scope, event, payload)
    }
  } catch (error) {
    // 模型缓存清理日志失败不影响主流程
  }
}

function getAiModelCachePaths() {
  const aiConfig = envConfig.getAiConfig()
  return {
    plateModelPath: aiConfig.plateModelPath || '',
    damageModelPath: aiConfig.damageModelPath || '',
    appEnv: aiConfig.appEnv || '',
    wxEnvVersion: aiConfig.wxEnvVersion || '',
    plateModelUrl: aiConfig.plateModelUrl || '',
    damageModelUrl: aiConfig.damageModelUrl || ''
  }
}

function buildResult(modelName, path) {
  return {
    modelName,
    path: path || '',
    deleted: false,
    reason: '',
    errMsg: ''
  }
}

function deleteModelFile(fs, modelName, path) {
  const result = buildResult(modelName, path)

  if (!path) {
    result.reason = 'path_empty'
    return result
  }

  if (!fs || typeof fs.unlinkSync !== 'function') {
    result.reason = 'fs_unavailable'
    result.errMsg = 'wx file system manager is not available'
    return result
  }

  try {
    if (typeof fs.accessSync === 'function') {
      fs.accessSync(path)
    }
  } catch (error) {
    result.reason = 'not_found'
    return result
  }

  try {
    fs.unlinkSync(path)
    result.deleted = true
    result.reason = 'deleted'
  } catch (error) {
    const errMsg = getErrMsg(error)
    if (/not\s*found|no such file|not exist/i.test(errMsg)) {
      result.reason = 'not_found'
      return result
    }
    result.reason = 'delete_failed'
    result.errMsg = errMsg
  }

  return result
}

function getFileSystemManager() {
  const wxRef = getWx()
  if (!wxRef || typeof wxRef.getFileSystemManager !== 'function') {
    return null
  }

  try {
    return wxRef.getFileSystemManager()
  } catch (error) {
    return null
  }
}

function clearAiModelCache() {
  let cachePaths

  try {
    cachePaths = getAiModelCachePaths()
  } catch (error) {
    const result = {
      ok: true,
      appEnv: '',
      wxEnvVersion: '',
      results: [
        {
          modelName: 'config',
          path: '',
          deleted: false,
          reason: 'config_failed',
          errMsg: getErrMsg(error)
        }
      ]
    }
    safeForceError('ai_model', 'cache_clear_failed', result)
    return result
  }

  safeForceWarn('ai_model', 'cache_clear_start', cachePaths)

  const fs = getFileSystemManager()
  const result = {
    ok: true,
    appEnv: cachePaths.appEnv,
    wxEnvVersion: cachePaths.wxEnvVersion,
    results: [
      deleteModelFile(fs, 'plate', cachePaths.plateModelPath),
      deleteModelFile(fs, 'damage', cachePaths.damageModelPath)
    ]
  }

  result.results.forEach((item) => {
    if (item.errMsg) {
      safeForceError('ai_model', 'cache_clear_failed', {
        appEnv: result.appEnv,
        wxEnvVersion: result.wxEnvVersion,
        ...item
      })
    }
  })

  safeForceWarn('ai_model', 'cache_clear_done', result)
  return result
}

function clearLegacyAiModelCache() {
  const wxRef = getWx()
  const userDataPath = wxRef?.env?.USER_DATA_PATH || ''
  const fs = getFileSystemManager()
  const result = {
    ok: true,
    userDataPath,
    results: []
  }

  if (!userDataPath || !fs || typeof fs.readdirSync !== 'function' || typeof fs.unlinkSync !== 'function') {
    result.ok = false
    return result
  }

  try {
    const files = fs.readdirSync(userDataPath) || []
    files.forEach((fileName) => {
      if (!/^(plate|damage).*\.onnx$/i.test(fileName)) {
        return
      }

      const path = `${userDataPath}/${fileName}`
      const normalizedFileName = fileName.toLowerCase()
      result.results.push(deleteModelFile(fs, normalizedFileName.startsWith('plate') ? 'plate' : 'damage', path))
    })
  } catch (error) {
    result.ok = false
    result.errMsg = getErrMsg(error)
  }

  return result
}

module.exports = {
  getAiModelCachePaths,
  clearAiModelCache,
  clearLegacyAiModelCache
}
