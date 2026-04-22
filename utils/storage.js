/**
 * 存储工具函数
 */

const STORAGE_KEY = 'car_damage_photos_cache'

/**
 * 初始化缓存数据结构
 */
function initCache() {
  return {
    vehicles: [],
    documents: [],
    currentStep: 'licensePlate',
    currentVehicleIndex: 0,
    currentDamageCount: 0,
    retakeMode: {
      enabled: false,
      vehicleIndex: null,
      photoType: null,
      damageIndex: null
    },
    fromPreview: false,  // 是否从预览页跳转来
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

/**
 * 保存缓存
 */
function saveCache(data) {
  data.updatedAt = new Date().toISOString()
  wx.setStorageSync(STORAGE_KEY, JSON.stringify(data))
}

/**
 * 加载缓存
 */
function loadCache() {
  const data = wx.getStorageSync(STORAGE_KEY)
  return data ? JSON.parse(data) : null
}

/**
 * 清除缓存
 */
function clearCache() {
  wx.removeStorageSync(STORAGE_KEY)
}

/**
 * 获取或初始化缓存
 */
function getOrInitCache() {
  let cache = loadCache()
  if (!cache) {
    cache = initCache()
    saveCache(cache)
  }
  return cache
}

/**
 * 创建新车辆
 */
function createVehicle(index) {
  return {
    id: `vehicle_${Date.now()}`,
    type: index === 0 ? '标的车' : `三者车${index}`,
    licensePlate: {
      status: 'pending'
    },
    vinCode: {
      status: 'pending'
    },
    damages: []
  }
}

/**
 * 获取车辆类型名称
 */
function getVehicleType(index) {
  if (index === 0) return '标的车'
  return `三者车${index}`
}

/**
 * 获取三者车数量
 */
function getThirdVehicleCount(vehicles) {
  return vehicles.length - 1
}

/**
 * 判断是否需要询问三者车
 */
function shouldAskThirdVehicle(vehicles) {
  const thirdVehicleCount = getThirdVehicleCount(vehicles)
  return thirdVehicleCount < 2
}

/**
 * 判断车辆是否完整（有车牌、VIN、至少一张车损）
 */
function checkVehicleComplete(vehicle) {
  const hasLicensePlate = vehicle.licensePlate && vehicle.licensePlate.status === 'completed'
  const hasVinCode = vehicle.vinCode && vehicle.vinCode.status === 'completed'
  const hasDamage = vehicle.damages && vehicle.damages.length > 0
  
  return hasLicensePlate && hasVinCode && hasDamage
}

/**
 * 获取车辆缺失的照片类型
 */
function getMissingPhotos(vehicle) {
  const missing = []
  
  if (!vehicle.licensePlate || vehicle.licensePlate.status === 'pending') {
    missing.push('licensePlate')
  }
  if (!vehicle.vinCode || vehicle.vinCode.status === 'pending') {
    missing.push('vinCode')
  }
  
  return missing
}

/**
 * 进入重拍模式
 */
function enterRetakeMode(vehicleIndex, photoType, damageIndex = null) {
  const cache = loadCache()
  cache.retakeMode = {
    enabled: true,
    vehicleIndex,
    photoType,
    damageIndex
  }
  saveCache(cache)
}

/**
 * 保存重拍的照片
 */
function saveRetakenPhoto(newPhoto) {
  const cache = loadCache()
  const { vehicleIndex, photoType, damageIndex } = cache.retakeMode
  
  if (photoType === 'licensePlate') {
    cache.vehicles[vehicleIndex].licensePlate = {
      ...newPhoto,
      status: 'completed'
    }
  } else if (photoType === 'vinCode') {
    cache.vehicles[vehicleIndex].vinCode = {
      ...newPhoto,
      status: 'completed'
    }
  } else if (photoType === 'damage') {
    cache.vehicles[vehicleIndex].damages[damageIndex] = newPhoto
  }
  
  cache.retakeMode.enabled = false
  saveCache(cache)
}

/**
 * 规范化照片元信息
 */
function normalizePhotoMeta(photo = {}, meta = {}) {
  return {
    ...photo,
    captureMode: meta.captureMode || photo.captureMode || 'manual',
    captureTrigger: meta.captureTrigger || photo.captureTrigger || 'manual_button',
    aiDetection: meta.aiDetection || photo.aiDetection || null
  }
}

/**
 * 判断是否处于重拍模式
 */
function isRetakeMode() {
  const cache = loadCache()
  return cache && cache.retakeMode && cache.retakeMode.enabled
}

/**
 * 删除照片
 */
function deletePhoto(vehicleIndex, photoType, damageIndex = null) {
  const cache = loadCache()
  const vehicle = cache.vehicles[vehicleIndex]
  
  if (photoType === 'licensePlate') {
    vehicle.licensePlate = { status: 'pending' }
  } else if (photoType === 'vinCode') {
    vehicle.vinCode = { status: 'pending' }
  } else if (photoType === 'damage') {
    vehicle.damages.splice(damageIndex, 1)
  }
  
  saveCache(cache)
}

/**
 * 删除单证资料照片
 */
function deleteDocument(index) {
  const cache = loadCache()
  cache.documents.splice(index, 1)
  saveCache(cache)
}

/**
 * 删除车辆（仅限三者车）
 */
function deleteVehicle(vehicleIndex) {
  const cache = loadCache()
  if (vehicleIndex > 0 && vehicleIndex < cache.vehicles.length) {
    cache.vehicles.splice(vehicleIndex, 1)
    // 如果删除的是当前车辆，更新索引
    if (cache.currentVehicleIndex >= cache.vehicles.length) {
      cache.currentVehicleIndex = cache.vehicles.length - 1
    }
    saveCache(cache)
    return true
  }
  return false
}

module.exports = {
  STORAGE_KEY,
  initCache,
  saveCache,
  loadCache,
  clearCache,
  getOrInitCache,
  createVehicle,
  getVehicleType,
  getThirdVehicleCount,
  shouldAskThirdVehicle,
  checkVehicleComplete,
  getMissingPhotos,
  normalizePhotoMeta,
  enterRetakeMode,
  saveRetakenPhoto,
  isRetakeMode,
  deletePhoto,
  deleteDocument,
  deleteVehicle
}
