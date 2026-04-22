/**
 * 帧处理工具
 */

class PlateFrameUtils {
  constructor(options = {}) {
    this.minConsecutiveFrames = options.minConsecutiveFrames || 6
    this.minAreaRatio = options.minAreaRatio || 0.7
    this.maxAreaRatio = options.maxAreaRatio || 1.2
    this.centerOffsetThreshold = options.centerOffsetThreshold || 0.15
    this.consecutiveCount = 0
  }

  isInCaptureBox(result, boxConfig, canvasWidth, canvasHeight) {
    if (!result || !boxConfig || !canvasWidth || !canvasHeight) {
      return { inBox: false }
    }

    const { x1, y1, x2, y2, originalWidth, originalHeight, width: plateWidth, height: plateHeight } = result
    const { x: boxX, y: boxY, width: boxWidth, height: boxHeight } = boxConfig

    const scaleX = canvasWidth / originalWidth
    const scaleY = canvasHeight / originalHeight

    const canvasPlateX1 = x1 * scaleX
    const canvasPlateY1 = y1 * scaleY
    const canvasPlateX2 = x2 * scaleX
    const canvasPlateY2 = y2 * scaleY
    const canvasPlateWidth = plateWidth * scaleX
    const canvasPlateHeight = plateHeight * scaleY

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

    return {
      inBox: centerInBox && centerAligned && areaInRange,
      centerAligned,
      areaRatio
    }
  }

  checkFrameStatus(result, boxConfig, canvasWidth, canvasHeight) {
    const boxStatus = this.isInCaptureBox(result, boxConfig, canvasWidth, canvasHeight)

    if (boxStatus.inBox) {
      this.consecutiveCount += 1
    } else if (this.consecutiveCount > 0) {
      this.consecutiveCount = Math.max(0, this.consecutiveCount - 1)
    }

    return {
      consecutiveMet: this.consecutiveCount >= this.minConsecutiveFrames,
      inBox: boxStatus.inBox,
      centerAligned: boxStatus.centerAligned,
      areaRatio: boxStatus.areaRatio,
      consecutiveCount: this.consecutiveCount
    }
  }

  reset() {
    this.consecutiveCount = 0
  }
}

module.exports = {
  PlateFrameUtils
}
