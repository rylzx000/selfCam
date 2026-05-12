/**
 * 帧处理工具
 */

const DEFAULT_VIRTUAL_WIDTH = 400
const DEFAULT_VIRTUAL_HEIGHT = 300
const DEFAULT_ASPECT_TOLERANCE = 0.015

function getPositiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function roundNumber(value) {
  return Number(value.toFixed(4))
}

function createVirtualCameraMapping(options = {}) {
  const sourceWidth = getPositiveNumber(options.sourceWidth, DEFAULT_VIRTUAL_WIDTH)
  const sourceHeight = getPositiveNumber(options.sourceHeight, DEFAULT_VIRTUAL_HEIGHT)
  const targetWidth = getPositiveNumber(options.targetWidth, DEFAULT_VIRTUAL_WIDTH)
  const targetHeight = getPositiveNumber(options.targetHeight, DEFAULT_VIRTUAL_HEIGHT)
  const aspectTolerance = Number.isFinite(options.aspectTolerance)
    ? Math.max(options.aspectTolerance, 0)
    : DEFAULT_ASPECT_TOLERANCE
  const sourceAspect = sourceWidth / sourceHeight
  const targetAspect = targetWidth / targetHeight
  const aspectDelta = Math.abs(sourceAspect - targetAspect) / Math.max(targetAspect, 0.0001)

  if (aspectDelta <= aspectTolerance) {
    return {
      mappingMode: 'legacy',
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      frameAspect: roundNumber(sourceAspect),
      targetAspect: roundNumber(targetAspect),
      scaleX: targetWidth / sourceWidth,
      scaleY: targetHeight / sourceHeight,
      scale: targetWidth / sourceWidth,
      offsetX: 0,
      offsetY: 0
    }
  }

  if (sourceAspect < targetAspect) {
    const scale = targetHeight / sourceHeight

    return {
      mappingMode: 'heightFitPad',
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      frameAspect: roundNumber(sourceAspect),
      targetAspect: roundNumber(targetAspect),
      scaleX: scale,
      scaleY: scale,
      scale,
      offsetX: (targetWidth - sourceWidth * scale) / 2,
      offsetY: 0
    }
  }

  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)

  return {
    mappingMode: 'aspectFillCrop',
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    frameAspect: roundNumber(sourceAspect),
    targetAspect: roundNumber(targetAspect),
    scaleX: scale,
    scaleY: scale,
    scale,
    offsetX: (targetWidth - sourceWidth * scale) / 2,
    offsetY: (targetHeight - sourceHeight * scale) / 2
  }
}

function mapDetectionToVirtualCamera(detection, mappingOptions = null) {
  if (!detection) {
    return null
  }

  const mapping = mappingOptions && mappingOptions.mappingMode
    ? mappingOptions
    : createVirtualCameraMapping({
      sourceWidth: detection.originalWidth,
      sourceHeight: detection.originalHeight,
      targetWidth: mappingOptions?.targetWidth || DEFAULT_VIRTUAL_WIDTH,
      targetHeight: mappingOptions?.targetHeight || DEFAULT_VIRTUAL_HEIGHT
    })
  const scaleX = mapping.scaleX || mapping.scale || 1
  const scaleY = mapping.scaleY || mapping.scale || 1
  const offsetX = mapping.offsetX || 0
  const offsetY = mapping.offsetY || 0
  const centerX = detection.centerX * scaleX + offsetX
  const centerY = detection.centerY * scaleY + offsetY
  const width = detection.width * scaleX
  const height = detection.height * scaleY
  const x1 = Number.isFinite(detection.x1)
    ? detection.x1 * scaleX + offsetX
    : centerX - width / 2
  const y1 = Number.isFinite(detection.y1)
    ? detection.y1 * scaleY + offsetY
    : centerY - height / 2
  const x2 = Number.isFinite(detection.x2)
    ? detection.x2 * scaleX + offsetX
    : centerX + width / 2
  const y2 = Number.isFinite(detection.y2)
    ? detection.y2 * scaleY + offsetY
    : centerY + height / 2

  return {
    ...detection,
    centerX,
    centerY,
    width,
    height,
    x1,
    y1,
    x2,
    y2,
    frameMapping: mapping
  }
}

class PlateFrameUtils {
  constructor(options = {}) {
    this.minConsecutiveFrames = options.minConsecutiveFrames || 6
    this.minAreaRatio = options.minAreaRatio || 0.7
    this.maxAreaRatio = options.maxAreaRatio || 1.2
    this.centerOffsetThreshold = options.centerOffsetThreshold || 0.15
    this.consecutiveCount = 0
  }

  isInCaptureBox(result, boxConfig, canvasWidth, canvasHeight, frameMapping = null) {
    if (!result || !boxConfig || !canvasWidth || !canvasHeight) {
      return { inBox: false }
    }

    const mappedResult = mapDetectionToVirtualCamera(result, frameMapping || {
      targetWidth: canvasWidth,
      targetHeight: canvasHeight
    })
    const { x1, y1, x2, y2, width: plateWidth, height: plateHeight } = mappedResult
    const { x: boxX, y: boxY, width: boxWidth, height: boxHeight } = boxConfig

    const canvasPlateX1 = x1
    const canvasPlateY1 = y1
    const canvasPlateX2 = x2
    const canvasPlateY2 = y2
    const canvasPlateWidth = plateWidth
    const canvasPlateHeight = plateHeight

    const boxX2 = boxX + boxWidth
    const boxY2 = boxY + boxHeight

    const plateCenterX = (canvasPlateX1 + canvasPlateX2) / 2
    const plateCenterY = (canvasPlateY1 + canvasPlateY2) / 2
    const centerInBox = plateCenterX >= boxX && plateCenterX <= boxX2 && plateCenterY >= boxY && plateCenterY <= boxY2

    const boxCenterX = (boxX + boxX2) / 2
    const boxCenterY = (boxY + boxY2) / 2
    const offsetX = Math.abs(plateCenterX - boxCenterX) / boxWidth
    const offsetY = Math.abs(plateCenterY - boxCenterY) / boxHeight
    const centerAligned = offsetX <= this.centerOffsetThreshold && offsetY <= this.centerOffsetThreshold

    const plateArea = canvasPlateWidth * canvasPlateHeight
    const boxArea = boxWidth * boxHeight
    const areaRatio = plateArea / boxArea
    const areaInRange = areaRatio >= this.minAreaRatio && areaRatio <= this.maxAreaRatio
    let failReason = ''

    if (!centerInBox) {
      failReason = 'center_outside_box'
    } else if (!centerAligned) {
      if (offsetX > this.centerOffsetThreshold && offsetY > this.centerOffsetThreshold) {
        failReason = 'center_offset_xy'
      } else if (offsetX > this.centerOffsetThreshold) {
        failReason = 'center_offset_x'
      } else {
        failReason = 'center_offset_y'
      }
    } else if (areaRatio < this.minAreaRatio) {
      failReason = 'area_too_small'
    } else if (areaRatio > this.maxAreaRatio) {
      failReason = 'area_too_large'
    }

    return {
      inBox: centerInBox && centerAligned && areaInRange,
      centerInBox,
      centerAligned,
      areaInRange,
      areaRatio,
      centerOffsetX: offsetX,
      centerOffsetY: offsetY,
      minAreaRatio: this.minAreaRatio,
      maxAreaRatio: this.maxAreaRatio,
      centerOffsetThreshold: this.centerOffsetThreshold,
      failReason,
      mappedBox: {
        x1: canvasPlateX1,
        y1: canvasPlateY1,
        x2: canvasPlateX2,
        y2: canvasPlateY2,
        centerX: plateCenterX,
        centerY: plateCenterY,
        width: canvasPlateWidth,
        height: canvasPlateHeight
      },
      frameMapping: mappedResult.frameMapping
    }
  }

  checkFrameStatus(result, boxConfig, canvasWidth, canvasHeight, frameMapping = null) {
    const boxStatus = this.isInCaptureBox(result, boxConfig, canvasWidth, canvasHeight, frameMapping)

    if (boxStatus.inBox) {
      this.consecutiveCount += 1
    } else if (this.consecutiveCount > 0) {
      this.consecutiveCount = Math.max(0, this.consecutiveCount - 1)
    }

    return {
      consecutiveMet: this.consecutiveCount >= this.minConsecutiveFrames,
      inBox: boxStatus.inBox,
      centerInBox: boxStatus.centerInBox,
      centerAligned: boxStatus.centerAligned,
      areaInRange: boxStatus.areaInRange,
      areaRatio: boxStatus.areaRatio,
      minAreaRatio: boxStatus.minAreaRatio,
      maxAreaRatio: boxStatus.maxAreaRatio,
      centerOffsetThreshold: boxStatus.centerOffsetThreshold,
      centerOffsetX: boxStatus.centerOffsetX,
      centerOffsetY: boxStatus.centerOffsetY,
      failReason: boxStatus.failReason,
      consecutiveCount: this.consecutiveCount,
      mappedBox: boxStatus.mappedBox,
      frameMapping: boxStatus.frameMapping
    }
  }

  reset() {
    this.consecutiveCount = 0
  }
}

module.exports = {
  PlateFrameUtils,
  createVirtualCameraMapping,
  mapDetectionToVirtualCamera
}
