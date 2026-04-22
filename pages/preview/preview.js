const storage = require('../../utils/storage')
const constants = require('../../utils/constants')
const compress = require('../../utils/compress')

Page({
  data: {
    vehicles: [],
    documents: [],
    totalPhotoCount: 0,
    progress: {
      step1: 0,  // 标的车: 0未开始, 1进行中, 2已完成
      step2: 0,  // 三者车
      step3: false  // 单证资料
    },
    canAddThirdVehicle: false,
    // 全屏预览
    showPreview: false,
    allPhotos: [],
    previewIndex: 0,
    currentPhoto: null,
    actionsVisible: true,
    // 选择方式弹框
    showActionSheet: false,
    // 弹框
    showModal: false,
    modalContent: '',
    modalConfirmText: '',
    modalCancelText: '',
    modalType: '',
    // 滚动定位
    scrollToView: '',
    highlightDocument: false
  },

  isLeaving: false,  // 是否正在离开页面

  onLoad() {
    this.isLeaving = false
    this.loadData()
  },

  onShow() {
    // 重置离开标记（每次显示页面时都要重置）
    this.isLeaving = false
    
    const cache = storage.loadCache()
    
    // 清除 fromPreview 标记
    if (cache && cache.fromPreview) {
      cache.fromPreview = false
      storage.saveCache(cache)
    }
    
    this.loadData()
  },

  loadData() {
    const cache = storage.loadCache()
    if (!cache) {
      this.isLeaving = true
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

    // 构建照片数组
    const allPhotos = []
    let totalPhotoCount = 0

    cache.vehicles.forEach((vehicle, vIndex) => {
      if (vehicle.licensePlate.status === 'completed') {
        allPhotos.push({
          id: `${vIndex}-licensePlate`,
          url: vehicle.licensePlate.compressedPath,
          vehicle: vIndex,
          type: 'licensePlate',
          damage: null,
          label: `${vehicle.type} - 车牌`,
          captureMode: vehicle.licensePlate.captureMode || 'manual'
        })
        totalPhotoCount++
      }
      if (vehicle.vinCode.status === 'completed') {
        allPhotos.push({
          id: `${vIndex}-vinCode`,
          url: vehicle.vinCode.compressedPath,
          vehicle: vIndex,
          type: 'vinCode',
          damage: null,
          label: `${vehicle.type} - VIN码`,
          captureMode: vehicle.vinCode.captureMode || 'manual'
        })
        totalPhotoCount++
      }
      if (vehicle.damages) {
        vehicle.damages.forEach((d, dIndex) => {
          allPhotos.push({
            id: `${vIndex}-damage-${dIndex}`,
            url: d.compressedPath,
            vehicle: vIndex,
            type: 'damage',
            damage: dIndex,
            label: `${vehicle.type} - 车损${dIndex + 1}`,
            captureMode: d.captureMode || 'manual'
          })
          totalPhotoCount++
        })
      }
    })

    // 计算进度
    const progress = {
      step1: 0,
      step2: 0,
      step3: false
    }
    
    // 标的车进度
    const mainVehicle = cache.vehicles[0]
    if (mainVehicle) {
      const hasLicense = mainVehicle.licensePlate.status === 'completed'
      const hasVin = mainVehicle.vinCode.status === 'completed'
      const hasDamage = mainVehicle.damages && mainVehicle.damages.length > 0
      const damageFull = mainVehicle.damages && mainVehicle.damages.length >= constants.LIMITS.MAX_DAMAGES
      
      if (hasLicense && hasVin && damageFull) {
        progress.step1 = 2  // 已完成
      } else if (hasLicense || hasVin || hasDamage) {
        progress.step1 = 1  // 进行中
      }
    }
    
    // 三者车进度
    const thirdVehicles = cache.vehicles.slice(1)
    if (thirdVehicles.length > 0) {
      let allThirdComplete = true
      let anyThirdStarted = false
      
      for (const v of thirdVehicles) {
        const hasLicense = v.licensePlate.status === 'completed'
        const hasVin = v.vinCode.status === 'completed'
        const damageFull = v.damages && v.damages.length >= constants.LIMITS.MAX_DAMAGES
        
        if (hasLicense || hasVin || (v.damages && v.damages.length > 0)) {
          anyThirdStarted = true
        }
        if (!hasLicense || !hasVin || !damageFull) {
          allThirdComplete = false
        }
      }
      
      if (allThirdComplete) {
        progress.step2 = 2
      } else if (anyThirdStarted) {
        progress.step2 = 1
      }
    }
    
    // 单证资料进度
    const documents = cache.documents || []
    if (documents.length > 0) {
      progress.step3 = true
    }

    // 是否可以添加三者车
    const canAddThirdVehicle = storage.getThirdVehicleCount(cache.vehicles) < constants.LIMITS.MAX_THIRD_VEHICLES

    // 添加单证资料到照片数组
    documents.forEach((doc, docIndex) => {
      allPhotos.push({
        id: `document-${docIndex}`,
        url: doc.compressedPath,
        vehicle: null,
        type: 'document',
        damage: null,
        docIndex: docIndex,
        label: `单证资料 ${docIndex + 1}`
      })
      totalPhotoCount++
    })

    this.setData({
      vehicles: cache.vehicles,
      documents,
      allPhotos,
      totalPhotoCount,
      progress,
      canAddThirdVehicle
    })
  },

  // 点击照片，进入全屏预览
  onPreview(e) {
    const { vehicle, type, damage } = e.currentTarget.dataset
    const targetId = damage !== undefined ? `${vehicle}-${type}-${damage}` : `${vehicle}-${type}`
    
    const index = this.data.allPhotos.findIndex(p => p.id === targetId)
    if (index >= 0) {
      this.setData({
        showPreview: true,
        previewIndex: index,
        currentPhoto: this.data.allPhotos[index],
        actionsVisible: true
      })
    }
  },

  // swiper切换
  onSwiperChange(e) {
    const index = e.detail.current
    this.setData({
      previewIndex: index,
      currentPhoto: this.data.allPhotos[index]
    })
  },

  // 点击图片切换操作栏
  onToggleActions() {
    this.setData({
      actionsVisible: !this.data.actionsVisible
    })
  },

  // 关闭预览
  onClosePreview() {
    this.setData({ showPreview: false })
  },

  // 补拍
  onSupplement(e) {
    const { vehicle, type } = e.currentTarget.dataset
    const cache = storage.loadCache()
    cache.currentVehicleIndex = vehicle
    cache.currentStep = type === 'licensePlate' ? constants.SHOOT_STEP.LICENSE_PLATE : constants.SHOOT_STEP.VIN_CODE
    cache.fromPreview = true
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  // 添加车损
  onAddDamage(e) {
    const { vehicle } = e.currentTarget.dataset
    const cache = storage.loadCache()
    cache.currentVehicleIndex = vehicle
    cache.currentStep = constants.SHOOT_STEP.DAMAGE
    cache.fromPreview = true
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  // 重拍
  onRetake() {
    const photo = this.data.currentPhoto
    if (!photo) return

    const cache = storage.loadCache()
    cache.currentVehicleIndex = photo.vehicle
    cache.currentStep = photo.type === 'licensePlate' ? constants.SHOOT_STEP.LICENSE_PLATE 
                     : photo.type === 'vinCode' ? constants.SHOOT_STEP.VIN_CODE 
                     : constants.SHOOT_STEP.DAMAGE
    cache.retakeMode = {
      enabled: true,
      vehicleIndex: photo.vehicle,
      photoType: photo.type,
      damageIndex: photo.damage
    }
    cache.fromPreview = true
    storage.saveCache(cache)
    this.isLeaving = true
    wx.navigateTo({ url: '/pages/camera/camera' })
  },

  // 删除
  onDelete() {
    const photo = this.data.currentPhoto
    if (!photo) return

    wx.showModal({
      title: '',
      content: '确定删除该照片？',
      success: (res) => {
        if (res.confirm) {
          storage.deletePhoto(photo.vehicle, photo.type, photo.damage)
          this.setData({ showPreview: false })
          this.loadData()
        }
      }
    })
  },

  // 添加三者车（底部按钮点击）
  onAddThirdVehicle() {
    this.addThirdVehicle()
  },

  // 提交
  onSubmit() {
    const cache = storage.loadCache()
    const thirdCount = storage.getThirdVehicleCount(cache.vehicles)
    
    // 如果还可以添加三者车，询问是否添加
    if (thirdCount < constants.LIMITS.MAX_THIRD_VEHICLES) {
      this.setData({
        showModal: true,
        modalContent: '是否有其他三者车？',
        modalConfirmText: '是',
        modalCancelText: '否，下一步',
        modalType: 'thirdVehicle'
      })
    } else {
      // 已达三者车上限，询问单证
      this.askDocument()
    }
  },

  // 询问单证资料
  askDocument() {
    this.setData({
      showModal: true,
      modalContent: '是否有单证资料需提交？如事故证明、银行卡等',
      modalConfirmText: '是',
      modalCancelText: '否，提交',
      modalType: 'document'
    })
  },

  onModalConfirm() {
    this.setData({ showModal: false })
    if (this.data.modalType === 'thirdVehicle') {
      this.addThirdVehicle()
    } else if (this.data.modalType === 'document') {
      // 滚动到单证区域并高亮
      this.scrollToDocument()
    }
  },

  onModalCancel() {
    this.setData({ showModal: false })
    if (this.data.modalType === 'thirdVehicle') {
      // 继续询问单证
      setTimeout(() => {
        this.askDocument()
      }, 150)
    } else if (this.data.modalType === 'document') {
      this.submitComplete()
    }
  },

  // 滚动到单证区域
  scrollToDocument() {
    this.setData({
      scrollToView: 'document-section',
      highlightDocument: true
    })
    
    // 3秒后取消高亮
    setTimeout(() => {
      this.setData({ highlightDocument: false })
    }, 3000)
  },

  // 完成提交
  submitComplete() {
    this.isLeaving = true
    wx.redirectTo({ url: '/pages/complete/complete' })
  },

  // 添加三者车（从弹窗确认调用）
  addThirdVehicle() {
    const cache = storage.loadCache()
    const newIndex = cache.vehicles.length
    if (newIndex <= constants.LIMITS.MAX_THIRD_VEHICLES) {
      const newVehicle = storage.createVehicle(newIndex)
      cache.vehicles.push(newVehicle)
      cache.currentVehicleIndex = newIndex
      cache.currentStep = constants.SHOOT_STEP.LICENSE_PLATE
      cache.fromPreview = true
      storage.saveCache(cache)
      
      this.isLeaving = true
      // 使用 navigateTo 跳转，保留页面栈
      wx.navigateTo({ 
        url: '/pages/camera/camera',
        fail: () => {
          // 如果 navigateTo 失败（页面栈满），使用 redirectTo
          wx.redirectTo({ 
            url: '/pages/camera/camera',
            fail: () => {
              wx.reLaunch({ url: '/pages/camera/camera' })
            }
          })
        }
      })
    }
  },

  onDeleteVehicle(e) {
    const { vehicleIndex } = e.currentTarget.dataset
    const vehicle = this.data.vehicles[vehicleIndex]
    const photoCount = (vehicle.licensePlate.status === 'completed' ? 1 : 0) +
                       (vehicle.vinCode.status === 'completed' ? 1 : 0) +
                       (vehicle.damages ? vehicle.damages.length : 0)
    
    wx.showModal({
      title: '删除确认',
      content: `确定删除「${vehicle.type}」及其 ${photoCount} 张照片？`,
      confirmText: '删除',
      confirmColor: '#D32F2F',
      success: (res) => {
        if (res.confirm) {
          storage.deleteVehicle(vehicleIndex)
          this.loadData()
        }
      }
    })
  },

  // ========== 单证资料相关方法 ==========
  
  // 添加单证资料
  onAddDocument() {
    this.setData({ showActionSheet: true })
  },

  // 关闭选择方式弹框
  onCloseActionSheet() {
    this.setData({ showActionSheet: false })
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // 拍照添加单证
  onTakePhoto() {
    this.setData({ showActionSheet: false })
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: async (res) => {
        wx.showLoading({ title: '处理中...' })
        try {
          const photo = await compress.compressImage(res.tempFiles[0].tempFilePath)
          photo.source = 'camera'
          
          const cache = storage.loadCache()
          if (!cache.documents) cache.documents = []
          cache.documents.push(photo)
          storage.saveCache(cache)
          
          this.loadData()
          wx.hideLoading()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: '处理失败', icon: 'none' })
        }
      }
    })
  },

  // 从相册选择单证
  onChooseAlbum() {
    this.setData({ showActionSheet: false })
    
    const cache = storage.loadCache()
    const currentCount = (cache.documents || []).length
    const remaining = constants.LIMITS.MAX_DOCUMENTS - currentCount
    
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album'],
      success: async (res) => {
        wx.showLoading({ title: '处理中...' })
        try {
          if (!cache.documents) cache.documents = []
          for (const file of res.tempFiles) {
            const photo = await compress.compressImage(file.tempFilePath)
            photo.source = 'album'
            cache.documents.push(photo)
          }
          storage.saveCache(cache)
          
          this.loadData()
          wx.hideLoading()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: '处理失败', icon: 'none' })
        }
      }
    })
  },

  // 预览单证照片
  onPreviewDocument(e) {
    const { index } = e.currentTarget.dataset
    const urls = this.data.documents.map(d => d.compressedPath)
    const current = this.data.documents[index].compressedPath
    
    wx.previewImage({ urls, current })
  },

  // 删除单证照片
  onDeleteDocument(e) {
    const { index } = e.currentTarget.dataset
    
    wx.showModal({
      title: '',
      content: '确定删除这张照片？',
      confirmText: '删除',
      confirmColor: '#D32F2F',
      success: (res) => {
        if (res.confirm) {
          storage.deleteDocument(index)
          this.loadData()
        }
      }
    })
  }
})
