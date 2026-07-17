/**
 * 常量定义
 */

const SHOOT_STEP = {
  SCENE_45: 'scene45',
  SCENE_SUPPLEMENT: 'sceneSupplement',
  LICENSE_PLATE: 'licensePlate',
  VIN_CODE: 'vinCode',
  DAMAGE: 'damage',
  MODULE_ONE_PREVIEW: 'moduleOnePreview',
  MODULE_THREE: 'moduleThree',
  FINAL_PREVIEW: 'finalPreview',
  PREVIEW: 'preview'
}

const SHOOT_SEQUENCE = [
  SHOOT_STEP.SCENE_45,
  SHOOT_STEP.LICENSE_PLATE,
  SHOOT_STEP.VIN_CODE,
  SHOOT_STEP.DAMAGE
]

const PHOTO_TYPE = {
  SCENE_45: 'scene45',
  SCENE_SUPPLEMENT: 'sceneSupplement',
  LICENSE_PLATE: 'licensePlate',
  VIN_CODE: 'vinCode',
  DAMAGE: 'damage'
}

const CAPTURE_RETURN_STRATEGY = {
  CONTINUE_MODULE_ONE: 'continueModuleOne',
  CONTINUE_DAMAGE: 'continueDamage',
  RETURN_PREVIEW: 'returnPreview'
}

const CAPTURE_PREVIEW_SOURCE = {
  MODULE_ONE: 'moduleOneCapture',
  MODULE_TWO: 'moduleTwoCapture'
}

const SCENE_PHOTO_TYPE = {
  SCENE_45: 'scene45',
  SUPPLEMENT: 'sceneSupplement'
}

const VEHICLE_TYPE = {
  TARGET: '标的车',
  THIRD_1: '三者车1',
  THIRD_2: '三者车2'
}

const LIMITS = {
  MAX_SCENE_45: 1,
  MAX_SCENE_SUPPLEMENTS: 3,
  MAX_DAMAGES: 10,
  MAX_THIRD_VEHICLES: 2,
  MAX_DOCUMENTS: 10,
  MAX_TOTAL_PHOTOS: 50
}

const GUIDE_TIPS = {
  [SHOOT_STEP.SCENE_45]: '请拍摄车辆整体45度现场照片',
  [SHOOT_STEP.SCENE_SUPPLEMENT]: '请拍摄其他现场环境照片',
  [SHOOT_STEP.LICENSE_PLATE]: '将车牌号放入框内',
  [SHOOT_STEP.VIN_CODE]: 'VIN码位于驾驶舱挡风玻璃角落',
  [SHOOT_STEP.DAMAGE]: '请对准车损处'
}

const MODAL_TEXTS = {
  ASK_THIRD_VEHICLE: {
    title: '',
    content: '是否有其他三者车？',
    confirmText: '是',
    cancelText: '否'
  },
  ASK_DOCUMENT: {
    title: '',
    content: '是否还有其他资料照片需要提交？如事故证明、银行卡等？',
    confirmText: '是',
    cancelText: '否'
  }
}

const COLORS = {
  PRIMARY: '#4CAF50',
  PRIMARY_DARK: '#388E3C',
  PRIMARY_LIGHT: '#81C784',
  TEXT_PRIMARY: '#212121',
  TEXT_SECONDARY: '#757575',
  TEXT_HINT: '#9E9E9E',
  WHITE: '#FFFFFF',
  BACKGROUND: '#FAFAFA',
  CARD: '#FFFFFF',
  BORDER: '#EEEEEE',
  DANGER: '#D32F2F',
  WARNING: '#FF9800'
}

module.exports = {
  SHOOT_STEP,
  SHOOT_SEQUENCE,
  PHOTO_TYPE,
  CAPTURE_RETURN_STRATEGY,
  CAPTURE_PREVIEW_SOURCE,
  SCENE_PHOTO_TYPE,
  VEHICLE_TYPE,
  LIMITS,
  GUIDE_TIPS,
  MODAL_TEXTS,
  COLORS
}
