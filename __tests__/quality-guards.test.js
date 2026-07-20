const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const previewBaseUrl = '/packageD/pages/preview/preview'
const allowedPreviewModes = new Set(['moduleOne', 'moduleTwo', 'moduleThree', 'final'])
const imageSizeLimitBytes = 500 * 1024

function normalizePath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/')
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function walkFiles(relativeRoot, predicate = () => true) {
  const root = path.join(repoRoot, relativeRoot)
  const result = []

  function visit(dir) {
    if (!fs.existsSync(dir)) return

    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(fullPath)
        return
      }

      if (entry.isFile() && predicate(fullPath)) {
        result.push(fullPath)
      }
    })
  }

  visit(root)
  return result
}

function walkEntries(relativeRoot) {
  const root = path.join(repoRoot, relativeRoot)
  const result = []

  function visit(dir) {
    if (!fs.existsSync(dir)) return

    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(dir, entry.name)
      const type = entry.isDirectory() ? 'directory' : 'file'

      result.push({ fullPath, type })

      if (entry.isDirectory()) {
        visit(fullPath)
      }
    })
  }

  visit(root)
  return result
}

function getLineContext(lines, lineIndex, radius = 5) {
  return lines
    .slice(Math.max(0, lineIndex - radius), Math.min(lines.length, lineIndex + radius + 1))
    .join('\n')
}

function getNearestMarkdownHeading(lines, lineIndex) {
  for (let index = lineIndex; index >= 0; index -= 1) {
    const line = lines[index].trim()

    if (/^#{1,6}\s+/.test(line)) {
      return line
    }
  }

  return ''
}

function isAllowedPreviewModeUrl(value) {
  const modeMatch = value.match(/[?&]mode=([^&'"`\s]+)/)
  return modeMatch && allowedPreviewModes.has(modeMatch[1])
}

const previewWithoutModeAllowlist = [
  {
    file: 'packageD/pages/index/index.js',
    value: previewBaseUrl,
    contextIncludes: 'const PREVIEW_PAGE_URL',
    reason: '首页恢复旧缓存或上传中断时复用基础预览地址，不是三阶段模块跳转入口。'
  },
  {
    file: 'packageD/pages/camera/camera.js',
    value: previewBaseUrl,
    contextIncludes: 'return step === constants.SHOOT_STEP.DAMAGE',
    reason: '相机页 `getPreviewPageUrl` 的旧流程兜底；显式三阶段模式已在上方分支返回带 mode 的地址。'
  },
  {
    file: 'packageD/pages/camera/camera.js',
    value: previewBaseUrl,
    contextIncludes: 'safe_resume_redirect_preview',
    reason: '相机页安全恢复旧 `PREVIEW` 状态的兼容兜底，不用于新三模块查看已拍或补拍返回。'
  },
  {
    file: 'packageD/pages/complete/complete.js',
    value: previewBaseUrl,
    contextIncludes: 'workflowState !== workflow.STATES.LOCAL_COMPLETED',
    reason: '完成页遇到非完成态缓存时回退到旧预览，属于完成页兼容恢复逻辑。'
  }
]

function isAllowedPreviewWithoutMode(hit) {
  return previewWithoutModeAllowlist.some((item) => (
    item.file === hit.file
    && item.value === hit.value
    && hit.context.includes(item.contextIncludes)
  ))
}

const previewVariableUseAllowlist = [
  {
    file: 'packageD/pages/index/index.js',
    pattern: /\breturn\s+PREVIEW_PAGE_URL\b/,
    contextIncludes: 'RESUMABLE_UPLOAD_PHASES[uploadSession.phase]',
    reason: '首页上传中断恢复入口沿用基础预览地址，不是新三模块流程入口。'
  },
  {
    file: 'packageD/pages/index/index.js',
    pattern: /\breturn\s+PREVIEW_PAGE_URL\b/,
    contextIncludes: 'currentState === workflow.STATES.PREVIEWING',
    reason: '首页恢复旧 PREVIEWING 缓存时沿用基础预览地址，不是新三模块流程入口。'
  }
]

function findNearestPreviewUrlAssignment(lines, lineIndex) {
  const start = Math.max(0, lineIndex - 80)
  const assignmentPattern = /\b(?:(?:const|let|var)\s+)?previewUrl\s*=/

  for (let index = lineIndex - 1; index >= start; index -= 1) {
    const line = lines[index]

    if (assignmentPattern.test(line)) {
      return {
        line: index + 1,
        code: line.trim(),
        allowed: /\bgetPreviewPageUrl\s*\(/.test(line)
      }
    }

    const boundaryMatch = line.match(/^\s*(?:async\s+)?([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/)
    const controlKeywords = new Set(['if', 'for', 'while', 'switch', 'catch', 'with'])

    if (/^\s*(?:async\s+)?function\b/.test(line) || (boundaryMatch && !controlKeywords.has(boundaryMatch[1]))) {
      break
    }
  }

  return null
}

function isAllowedPreviewVariableUse(hit, lines, lineIndex) {
  if (hit.codePattern === 'url: previewUrl') {
    const assignment = findNearestPreviewUrlAssignment(lines, lineIndex)
    hit.assignment = assignment
    return hit.file === 'packageD/pages/camera/camera.js'
      && assignment
      && assignment.allowed
  }

  return previewVariableUseAllowlist.some((item) => (
    item.file === hit.file
    && item.pattern.test(hit.snippet)
    && hit.context.includes(item.contextIncludes)
  ))
}

const overdueCopyRules = [
  {
    id: 'auto-capture-copy',
    pattern: /按引导使用自动拍照|稳定后自动拍照|稳定后自动拍摄|正在自动拍照|已自动拍照/,
    suggestion: '当前首页和三阶段主流程应表达为按引导手动拍摄或确认拍摄。'
  },
  {
    id: 'identity-card-current-item',
    pattern: /身份证/,
    suggestion: '当前证件采集项只应面向驾驶证和行驶证；若是明确“不采集身份证”或技术扩展背景，需白名单。'
  },
  {
    id: 'doc-name-with-12123',
    pattern: /12123\s*电子\s*(驾驶证|行驶证)/,
    suggestion: '用户可见证件叫法应改为“电子驾驶证”或“电子行驶证”，不要带 12123 前缀。'
  },
  {
    id: 'damage-count-five',
    pattern: /5\s*张车损|车损照片\s*x\s*\/\s*5|满\s*5\s*张/i,
    suggestion: '当前车损上限或完成目标不应写成 5 张；如需固定数量，应同步当前规则。'
  }
]

const overdueCopyAllowlist = [
  {
    file: 'PRDS/tech.md',
    ruleId: 'identity-card-current-item',
    contextIncludes: '后续可扩展驾驶证、身份证、银行卡等类型',
    reason: '技术文档描述通用单证结构的未来扩展，不是当前用户可见采集项。'
  },
  {
    file: 'PRDS/查勘采集助手三阶段采集流程说明.md',
    ruleId: 'identity-card-current-item',
    contextIncludes: '本轮不采集身份证',
    reason: '当前流程说明明确排除身份证采集，不会把身份证作为当前采集项。'
  },
  {
    file: 'PRDS/UI.md',
    ruleId: 'auto-capture-copy',
    sectionHeading: '### AI 状态',
    reason: 'UI 文档的 AI 状态枚举保留自动拍照状态文案，不属于主流程引导文案。'
  },
  {
    file: 'packageD/utils/ai-config.js',
    ruleId: 'auto-capture-copy',
    contextIncludes: 'flowFinished',
    reason: 'AI 状态配置是自动拍照专项状态枚举，不属于主流程误导引导文案。'
  },
  {
    file: 'packageD/utils/ai-config.js',
    ruleId: 'auto-capture-copy',
    contextIncludes: 'cooldown',
    reason: 'AI 状态配置是自动拍照专项状态枚举，不属于主流程误导引导文案。'
  }
]

function isAllowedOverdueCopy(hit) {
  if (
    hit.ruleId === 'auto-capture-copy'
    && (
      (hit.file === 'PRDS/UI.md' && hit.sectionHeading === '### AI 状态')
      || (hit.file === 'PRDS/PRD.md' && /AI|自动拍照|功能13/.test(hit.sectionHeading))
      || (hit.file === 'PRDS/tech.md' && /AI|自动拍照/.test(hit.sectionHeading))
      || (hit.file === 'packageD/utils/ai-config.js' && /\b(flowFinished|cooldown|STATUS_TEXT)\b/.test(hit.context))
    )
  ) {
    return true
  }

  if (
    hit.ruleId === 'identity-card-current-item'
    && /(不采集|不展示|不要求|不需要|无需).{0,12}身份证|身份证.{0,12}(不采集|不展示|不作为|不要求|不需要|无需)/.test(hit.context)
  ) {
    return true
  }

  return overdueCopyAllowlist.some((item) => (
    item.file === hit.file
    && item.ruleId === hit.ruleId
    && (!item.sectionHeading || item.sectionHeading === hit.sectionHeading)
    && (!item.contextIncludes || hit.context.includes(item.contextIncludes))
  ))
}

describe('轻量质量检测', () => {
  test('FLOW-MATRIX-GUARD 文档声称已覆盖的流程矩阵用例必须存在于 Jest 文件', () => {
    const matrixDoc = readText('docs/test-flow-route-matrix.md')
    const workflowTest = readText('__tests__/workflow-route-matrix.test.js')
    const coveredStatusPattern = /(已覆盖|已补充|本轮补充)/
    const manualOnlyStatusPattern = /(需真机|抽测|暂未覆盖|不覆盖)/
    const caseIdPattern = /\b[A-Z]+(?:-[A-Z0-9]+)*-\d{3}\b/g

    const requiredIds = matrixDoc
      .split(/\r?\n/)
      .filter((line) => line.includes('|'))
      .filter((line) => coveredStatusPattern.test(line) && !manualOnlyStatusPattern.test(line))
      .flatMap((line) => line.match(caseIdPattern) || [])
      .filter((id, index, all) => all.indexOf(id) === index)

    const missingIds = requiredIds.filter((id) => !workflowTest.includes(id))

    expect(missingIds).toEqual([])
  })

  test('PREVIEW-MODE-GUARD 新三模块流程不得新增无 mode 的老预览跳转', () => {
    const files = [
      ...walkFiles('packageD/pages', (file) => /\.(js|wxml)$/.test(file)),
      ...walkFiles('packageD/utils', (file) => /\.js$/.test(file))
    ]
    const literalPattern = /(['"`])([^'"`]*\/packageD\/pages\/preview\/preview[^'"`]*)\1/g
    const variablePatterns = [
      {
        codePattern: 'return PREVIEW_PAGE_URL',
        pattern: /\breturn\s+PREVIEW_PAGE_URL\b/,
        suggestion: '如属于新三模块流程，请改为带 mode 的预览地址；旧兼容恢复入口需登记精确白名单。'
      },
      {
        codePattern: 'url: PREVIEW_PAGE_URL',
        pattern: /\burl\s*:\s*PREVIEW_PAGE_URL\b/,
        suggestion: '不要直接把基础预览常量作为跳转 URL；请改为带 mode 的预览地址或登记精确白名单。'
      },
      {
        codePattern: 'url: previewUrl',
        pattern: /\burl\s*:\s*previewUrl\b/,
        suggestion: '`previewUrl` 仅允许来自同作用域最近的 `getPreviewPageUrl(...)`，否则请改为显式带 mode 的地址。'
      }
    ]
    const hits = []

    files.forEach((filePath) => {
      const file = normalizePath(filePath)
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

      lines.forEach((line, lineIndex) => {
        let match
        literalPattern.lastIndex = 0
        while ((match = literalPattern.exec(line)) !== null) {
          const value = match[2]

          if (isAllowedPreviewModeUrl(value)) {
            continue
          }

          const hit = {
            file,
            line: lineIndex + 1,
            value,
            snippet: line.trim(),
            context: getLineContext(lines, lineIndex)
          }

          if (!isAllowedPreviewWithoutMode(hit)) {
            hits.push({
              ...hit,
              reason: '字符串字面量跳转缺少 mode',
              suggestion: '请改为带 mode 的三阶段预览地址；若是旧兼容兜底，请补充精确白名单和原因。'
            })
          }
        }

        variablePatterns.forEach((item) => {
          if (!item.pattern.test(line)) {
            return
          }

          const hit = {
            file,
            line: lineIndex + 1,
            value: item.codePattern,
            snippet: line.trim(),
            context: getLineContext(lines, lineIndex),
            codePattern: item.codePattern,
            suggestion: item.suggestion
          }

          if (!isAllowedPreviewVariableUse(hit, lines, lineIndex)) {
            hits.push(hit)
          }
        })
      })
    })

    if (hits.length > 0) {
      const formatHit = (hit) => {
        const assignmentText = hit.codePattern === 'url: previewUrl'
          ? `；最近赋值：${hit.assignment ? `${hit.assignment.line}: ${hit.assignment.code}` : '未找到'}`
          : ''

        return `- ${hit.file}:${hit.line} 命中 "${hit.value}"；代码：${hit.snippet}${assignmentText}；建议：${hit.suggestion}`
      }

      throw new Error([
        '发现无 mode 的老预览跳转风险，请改为带 mode 的三阶段预览地址，或补充精确白名单：',
        ...hits.map(formatHit)
      ].join('\n'))
    }
  })

  test('STALE-COPY-GUARD 当前用户可见页面和主文档不得出现过期文案', () => {
    const files = [
      ...walkFiles('packageD/pages', (file) => /\.(js|wxml)$/.test(file)),
      'packageD/utils/ai-config.js',
      'PRDS/PRD.md',
      'PRDS/UI.md',
      'PRDS/tech.md',
      'PRDS/查勘采集助手三阶段采集流程说明.md'
    ]
      .map((file) => (path.isAbsolute(file) ? file : path.join(repoRoot, file)))
      .filter((file) => fs.existsSync(file))

    const hits = []

    files.forEach((filePath) => {
      const file = normalizePath(filePath)
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

      lines.forEach((line, lineIndex) => {
        overdueCopyRules.forEach((rule) => {
          const match = line.match(rule.pattern)

          if (!match) {
            return
          }

          const hit = {
            file,
            line: lineIndex + 1,
            ruleId: rule.id,
            phrase: match[0],
            suggestion: rule.suggestion,
            context: getLineContext(lines, lineIndex),
            sectionHeading: getNearestMarkdownHeading(lines, lineIndex)
          }

          if (!isAllowedOverdueCopy(hit)) {
            hits.push(hit)
          }
        })
      })
    })

    if (hits.length > 0) {
      throw new Error([
        '发现当前用户可见页面或主文档中的过期文案：',
        ...hits.map((hit) => `- ${hit.file}:${hit.line} 命中 "${hit.phrase}"；建议：${hit.suggestion}`)
      ].join('\n'))
    }
  })

  test('COMET-TEMP-GUARD OpenSpec 和 Comet 变更目录不得提交临时产物', () => {
    const entries = walkEntries('openspec/changes')
    const tempRules = [
      {
        pattern: /^\.tmp-.+/i,
        reason: '命中 `.tmp-*` 临时文件或目录'
      },
      {
        pattern: /\.tmp$/i,
        reason: '命中 `*.tmp` 临时文件'
      },
      {
        pattern: /\.zip$/i,
        reason: 'OpenSpec/Comet change 中不应提交 zip 临时包'
      },
      {
        pattern: /^(tmp|temp|temporary)([-_.].*)?$/i,
        reason: '命中明显临时目录或文件名'
      },
      {
        pattern: /(^|[-_.])(tmp|temp|backup|bak)([-_.]|$)/i,
        reason: '命中明显临时、备份目录或文件名'
      },
      {
        pattern: /\.(bak|swp|swo)$/i,
        reason: '命中编辑器备份或交换文件'
      },
      {
        pattern: /~$/,
        reason: '命中编辑器备份文件'
      }
    ]
    const hits = []

    entries.forEach(({ fullPath, type }) => {
      const name = path.basename(fullPath)
      const file = normalizePath(fullPath)

      tempRules.forEach((rule) => {
        if (rule.pattern.test(name)) {
          hits.push(`${file} (${type})：${rule.reason}`)
        }
      })
    })

    if (hits.length > 0) {
      throw new Error([
        '发现 OpenSpec/Comet 变更目录中的临时产物：',
        ...hits.map((hit) => `- ${hit}`)
      ].join('\n'))
    }
  })

  test('ASSET-SIZE-GUARD packageD 分包素材不得出现超限图片或临时源文件', () => {
    const assetFiles = walkFiles('packageD/assets')
    const blockedExtensions = new Set(['.zip', '.tmp', '.psd', '.sketch'])
    const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])
    const sourceAssetNamePattern = /(^|[-_.])(raw|original|source|fullsize|uncompressed)([-_.]|$)|原图|大图|未压缩/i
    const hits = []

    assetFiles.forEach((filePath) => {
      const file = normalizePath(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const basename = path.basename(filePath)
      const stat = fs.statSync(filePath)

      if (imageExtensions.has(ext) && stat.size > imageSizeLimitBytes) {
        hits.push(`${file} 图片大小 ${Math.round(stat.size / 1024)}KB，超过阈值 ${Math.round(imageSizeLimitBytes / 1024)}KB`)
      }

      if (blockedExtensions.has(ext)) {
        hits.push(`${file} 不应进入 packageD/assets，命中禁止扩展名 ${ext}`)
      }

      if (basename.startsWith('.tmp-')) {
        hits.push(`${file} 疑似 Comet/OpenSpec 临时文件，不应进入小程序分包素材目录`)
      }

      if (imageExtensions.has(ext) && sourceAssetNamePattern.test(basename)) {
        hits.push(`${file} 文件名疑似原始大图或未压缩源素材，请仅保留分包可用压缩素材`)
      }
    })

    if (hits.length > 0) {
      throw new Error([
        '发现 packageD/assets 素材风险：',
        ...hits.map((hit) => `- ${hit}`)
      ].join('\n'))
    }
  })
})
