---
change: integrate-case-level-upload-items
design-doc: docs/superpowers/specs/2026-07-13-case-level-upload-items-design.md
base-ref: 1d3fdeb03648ff98ce2f29d9cc444a3758f87438
---

# 案件级拍照项接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务执行。步骤使用 checkbox（`- [ ]`）跟踪。  
> **项目约束:** 本轮不要自动 commit，不要 push，不要切换或创建分支；如需提交，必须回到主流程让用户确认。

**Goal:** 接入后端 `init.caseUploadItems[]`，让现场 45 度和现场补充照片在最终总预览页统一上传，并保持车辆级上传逻辑不变。

**Architecture:** mapper 负责把案件级拍照项缓存为按 `photoType` 查询的结构；upload-state 负责把现场照片转成无 `vehicleId` 的案件级上传队列项；aux-photo-api 负责按案件级/车辆级区分请求体验证和 payload；旧 document 页只做安全跳转，不再创建上传会话。

**Tech Stack:** 微信小程序 CommonJS 模块、Jest 单测、OpenSpec/Comet change、Markdown 接口文档。

---

## 文件职责

- 修改 `packageD/utils/aux-photo-mapper.js`：解析并缓存 `caseUploadItems[]`，不影响 `vehicles[].uploadItems[]`。
- 修改 `packageD/utils/upload-state.js`：构建 `SCENE_45`、`SCENE_SUPPLEMENT` 队列项，案件级项不含 `vehicleId`。
- 修改 `packageD/utils/aux-photo-api.js`：案件级上传不校验/不发送 `vehicleId`，车辆级继续强校验 `vehicleId`。
- 修改 `packageD/pages/document/document.js`：旧入口 `onSubmit` 不再创建 `uploadSession`，不触发旧上传。
- 修改 `docs/辅助拍照微信小程序接口对接文档.md`：记录最小化接口改造口径。
- 修改 `openspec/changes/integrate-case-level-upload-items/tasks.md`：实现与验证完成后勾选对应任务。
- 更新测试：`__tests__/aux-photo-mapper.test.js`、`__tests__/upload-state.test.js`、`__tests__/aux-photo-api.test.js`、`__tests__/document-upload-entry.test.js`。

## 全局不变量

- 上传只发生在最终总预览页统一提交时；不要恢复模块完成即上传。
- `init`、`uploadPhotoBase64`、`complete` 接口路径保持不变。
- 单张照片仍是一张请求；不要新增批量上传。
- 不新增 `missingItems`、`requiredPassed` 前端依赖。
- 案件级照片类型仅为 `SCENE_45`、`SCENE_SUPPLEMENT`；车辆级照片必须继续带 `vehicleId`。
- 案件级照片存在但缺少 `uploadItemId` 时，错误必须是 `AUX_CASE_UPLOAD_ITEM_MISSING` / `案件级拍照项未下发，请联系后台配置。`。

### Task 1: mapper 解析案件级拍照项

**Files:**
- Modify: `packageD/utils/aux-photo-mapper.js`
- Test: `__tests__/aux-photo-mapper.test.js`

- [ ] **Step 1: 写 mapper 测试**

在 `__tests__/aux-photo-mapper.test.js` 增加或保留以下覆盖点，确保 `caseUploadItems[]` 被解析为数组和 by-photoType 映射：

```js
test('preserves backend case-level scene upload item metadata when provided', () => {
  const cache = mapper.buildCacheFromInit({
    ticket: 'AUX202605220004',
    caseUploadItems: [
      { uploadItemId: 'CASE_SCENE_45', photoType: 'SCENE_45', photoName: '整车45度现场照片', maxCount: 1 },
      { uploadItemId: 'CASE_SCENE_SUPPLEMENT', photoType: 'SCENE_SUPPLEMENT', photoName: '现场补充照片', maxCount: 3 }
    ],
    vehicles: [
      {
        vehicleId: 'LOSS_VEHICLE_100001',
        vehicleRoleName: '标的车',
        uploadItems: [
          { uploadItemId: 'V1_DAMAGE', photoType: 'DAMAGE', photoName: '车损', maxCount: 10 }
        ]
      }
    ]
  })

  expect(cache.caseUploadItems).toHaveLength(2)
  expect(cache.caseUploadItemsByPhotoType.SCENE_45.uploadItemId).toBe('CASE_SCENE_45')
  expect(cache.caseUploadItemsByPhotoType.SCENE_SUPPLEMENT.maxCount).toBe(3)
  expect(cache.vehicles[0].uploadItemsByPhotoType.DAMAGE.uploadItemId).toBe('V1_DAMAGE')
})
```

- [ ] **Step 2: 运行 mapper 测试，确认当前行为**

Run: `npm test -- --runInBand --runTestsByPath __tests__/aux-photo-mapper.test.js`  
Expected: 如果已支持则 PASS；如果缺 `caseUploadItemsByPhotoType` 则 FAIL，进入 Step 3。

- [ ] **Step 3: 实现最小 mapper 逻辑**

在 `packageD/utils/aux-photo-mapper.js` 中复用现有 `normalizeUploadItem` 和 `buildUploadItemsByPhotoType`，增加：

```js
function normalizeCaseUploadItems(initData = {}) {
  const rawCaseUploadItems = Array.isArray(initData.caseUploadItems)
    ? initData.caseUploadItems
    : []

  return rawCaseUploadItems.map(normalizeUploadItem).filter(Boolean)
}
```

并在 `buildCacheFromInit` 中写入：

```js
cache.caseUploadItems = normalizeCaseUploadItems(initData)
cache.caseUploadItemsByPhotoType = buildUploadItemsByPhotoType(cache.caseUploadItems)
```

不要把 `caseUploadItems` 写入任何车辆，也不要改 `vehicles[].uploadItems[]` 的映射方式。

- [ ] **Step 4: 复跑 mapper 测试**

Run: `npm test -- --runInBand --runTestsByPath __tests__/aux-photo-mapper.test.js`  
Expected: PASS。

### Task 2: upload-state 构建案件级上传队列

**Files:**
- Modify: `packageD/utils/upload-state.js`
- Test: `__tests__/upload-state.test.js`

- [ ] **Step 1: 写队列测试**

在 `__tests__/upload-state.test.js` 覆盖以下行为：

```js
test('buildUploadItems includes case-level SCENE_45 without vehicleId', () => {
  const cache = storage.initCache()
  cache.caseUploadItemsByPhotoType = {
    SCENE_45: { uploadItemId: 'CASE_SCENE_45', photoType: 'SCENE_45' }
  }
  cache.scenePhotos.scene45 = {
    status: 'completed',
    compressedPath: '/scene45.jpg',
    localPhotoId: 'scene45-local'
  }

  const items = uploadState.buildUploadItems(cache)
  expect(items).toContainEqual(expect.objectContaining({
    id: 'case-scene45',
    clientPhotoId: 'scene45-local',
    uploadItemId: 'CASE_SCENE_45',
    photoType: 'SCENE_45',
    sortNo: 1
  }))
  expect(items.find((item) => item.photoType === 'SCENE_45')).not.toHaveProperty('vehicleId')
})

test('buildUploadItems includes up to 3 SCENE_SUPPLEMENT items with ordered sortNo', () => {
  const cache = storage.initCache()
  cache.caseUploadItemsByPhotoType = {
    SCENE_SUPPLEMENT: { uploadItemId: 'CASE_SCENE_SUPPLEMENT', photoType: 'SCENE_SUPPLEMENT' }
  }
  cache.scenePhotos.supplements = [1, 2, 3, 4].map((index) => ({
    compressedPath: `/supplement-${index}.jpg`,
    localPhotoId: `supplement-${index}`
  }))

  const items = uploadState.buildUploadItems(cache).filter((item) => item.photoType === 'SCENE_SUPPLEMENT')
  expect(items).toHaveLength(3)
  expect(items.map((item) => item.sortNo)).toEqual([1, 2, 3])
  expect(items.every((item) => !Object.prototype.hasOwnProperty.call(item, 'vehicleId'))).toBe(true)
})

test('throws explicit case upload item error when scene photo exists without backend item', () => {
  const cache = storage.initCache()
  cache.scenePhotos.scene45 = {
    status: 'completed',
    compressedPath: '/scene45.jpg'
  }

  expect(() => uploadState.buildUploadItems(cache)).toThrow(expect.objectContaining({
    code: 'AUX_CASE_UPLOAD_ITEM_MISSING',
    message: '案件级拍照项未下发，请联系后台配置。'
  }))
})
```

- [ ] **Step 2: 运行 upload-state 测试，确认失败点**

Run: `npm test -- --runInBand --runTestsByPath __tests__/upload-state.test.js`  
Expected: 新增案件级用例在实现前 FAIL。

- [ ] **Step 3: 增加案件级工具函数**

在 `packageD/utils/upload-state.js` 中增加常量和错误构造：

```js
const CASE_PHOTO_TYPES = {
  SCENE_45: 'SCENE_45',
  SCENE_SUPPLEMENT: 'SCENE_SUPPLEMENT'
}

const CASE_UPLOAD_ITEM_MISSING_ERROR = {
  code: 'AUX_CASE_UPLOAD_ITEM_MISSING',
  message: '案件级拍照项未下发，请联系后台配置。'
}

function buildCaseUploadItemMissingError() {
  return {
    ...CASE_UPLOAD_ITEM_MISSING_ERROR
  }
}
```

增加案件级 upload item 读取函数：

```js
function getCaseUploadItem(cache, photoType) {
  if (!cache || !photoType) {
    return null
  }

  if (isPlainObject(cache.caseUploadItemsByPhotoType) && isPlainObject(cache.caseUploadItemsByPhotoType[photoType])) {
    return cache.caseUploadItemsByPhotoType[photoType]
  }

  if (Array.isArray(cache.caseUploadItems)) {
    return cache.caseUploadItems.find((item) => item && item.photoType === photoType) || null
  }

  return null
}
```

- [ ] **Step 4: 让 buildUploadItem 支持无 vehicleId 项**

把 `buildUploadItem` 扩展为支持 `includeVehicleId = true`：

```js
function buildUploadItem({
  id,
  photo,
  vehicle,
  vehicleIndex,
  photoType,
  sortNo,
  label,
  uploadItemId,
  includeVehicleId = true
}) {
  const filePath = getPhotoFilePath(photo)

  if (!photo || !filePath) {
    return null
  }

  const item = {
    id,
    clientPhotoId: getClientPhotoId(photo, id),
    vehicleIndex,
    uploadItemId: sanitizeString(uploadItemId),
    photoType,
    sortNo,
    filePath,
    fileSize: getPhotoFileSize(photo),
    label,
    status: UPLOAD_ITEM_STATUS.PENDING,
    attempts: 0,
    startedAt: '',
    uploadedAt: '',
    failedAt: '',
    uploadRecordId: '',
    photoId: '',
    duplicate: false,
    itemUploadedCount: 0,
    ticketStatus: '',
    lastErrorCode: '',
    lastErrorMessage: ''
  }

  if (includeVehicleId) {
    item.vehicleId = getVehicleId(vehicle, vehicleIndex)
  }

  return item
}
```

车辆级调用不传 `includeVehicleId`，保持默认行为。

- [ ] **Step 5: 加入 scene45 和 supplements 队列**

在 `buildUploadItems(cache)` 进入车辆循环前调用案件级构建函数：

```js
function requireCaseUploadItem(cache, photoType) {
  const uploadItem = getCaseUploadItem(cache, photoType)
  if (!uploadItem || !sanitizeString(uploadItem.uploadItemId)) {
    throw buildCaseUploadItemMissingError()
  }
  return uploadItem
}

function pushCasePhoto(result, cache, slotName, photo, photoType, sortNo, label) {
  if (!photo || !getPhotoFilePath(photo)) {
    return
  }

  const uploadItem = requireCaseUploadItem(cache, photoType)
  result.push(buildUploadItem({
    id: slotName,
    photo,
    vehicleIndex: null,
    photoType,
    sortNo,
    label,
    uploadItemId: uploadItem.uploadItemId,
    includeVehicleId: false
  }))
}

function pushCaseScenePhotos(result, cache) {
  const scenePhotos = isPlainObject(cache && cache.scenePhotos) ? cache.scenePhotos : {}
  pushCasePhoto(result, cache, 'case-scene45', scenePhotos.scene45, CASE_PHOTO_TYPES.SCENE_45, 1, '现场45度照片')

  const supplements = Array.isArray(scenePhotos.supplements) ? scenePhotos.supplements.slice(0, 3) : []
  supplements.forEach((photo, index) => {
    pushCasePhoto(
      result,
      cache,
      `case-scene-supplement-${index}`,
      photo,
      CASE_PHOTO_TYPES.SCENE_SUPPLEMENT,
      index + 1,
      `现场补充照片${index + 1}`
    )
  })
}
```

并在 `buildUploadItems(cache)` 开头加入：

```js
pushCaseScenePhotos(result, cache)
```

- [ ] **Step 6: 复跑 upload-state 测试**

Run: `npm test -- --runInBand --runTestsByPath __tests__/upload-state.test.js`  
Expected: PASS，且车辆级原有队列用例未变。

### Task 3: aux-photo-api 区分案件级和车辆级上传

**Files:**
- Modify: `packageD/utils/aux-photo-api.js`
- Test: `__tests__/aux-photo-api.test.js`

- [ ] **Step 1: 写 API payload 和校验测试**

在 `__tests__/aux-photo-api.test.js` 增加：

```js
test('uploads case-level scene photo without vehicleId in request body', async () => {
  const readFile = jest.fn(({ success }) => success({ data: 'BASE64_IMAGE_DATA' }))
  global.wx = {
    getFileSystemManager: jest.fn(() => ({ readFile })),
    request: jest.fn(({ success }) => success({ data: { code: 0, data: { uploadRecordId: 'UP1' } } }))
  }
  const api = loadApi({
    wxEnvVersion: 'trial',
    envVersion: 'trial',
    appEnv: 'sit',
    mockEnabled: true,
    requestEnabled: true,
    baseUrl: 'https://onlineclaim.example.com',
    requestTimeoutMs: 5000
  })

  await api.uploadPhoto({
    clientPhotoId: 'scene45-local',
    uploadItemId: 'CASE_SCENE_45',
    photoType: 'SCENE_45',
    sortNo: 1,
    filePath: 'wxfile://tmp/scene45.jpg',
    fileSize: 2048
  }, {
    ticket: 'AUX_REAL_001'
  })

  const requestBody = global.wx.request.mock.calls[0][0].data
  expect(requestBody).toEqual(expect.objectContaining({
    ticket: 'AUX_REAL_001',
    uploadItemId: 'CASE_SCENE_45',
    photoType: 'SCENE_45',
    sortNo: 1,
    fileBase64: 'BASE64_IMAGE_DATA'
  }))
  expect(requestBody).not.toHaveProperty('vehicleId')
})

test('keeps vehicle-level vehicleId validation', async () => {
  const api = loadApi({
    wxEnvVersion: 'trial',
    envVersion: 'trial',
    appEnv: 'sit',
    mockEnabled: true,
    requestEnabled: true,
    baseUrl: 'https://onlineclaim.example.com',
    requestTimeoutMs: 5000
  })

  await expect(api.uploadPhoto({
    clientPhotoId: 'damage-local',
    uploadItemId: 'V1_DAMAGE',
    photoType: 'DAMAGE',
    sortNo: 1,
    filePath: 'wxfile://tmp/damage.jpg',
    fileSize: 2048
  }, {
    ticket: 'AUX_REAL_001'
  })).rejects.toEqual(expect.objectContaining({
    code: 'AUX_PHOTO_UPLOAD_PARAM_INVALID'
  }))
})

test('returns explicit error when case-level uploadItemId is missing', async () => {
  const api = loadApi({
    wxEnvVersion: 'trial',
    envVersion: 'trial',
    appEnv: 'sit',
    mockEnabled: true,
    requestEnabled: true,
    baseUrl: 'https://onlineclaim.example.com',
    requestTimeoutMs: 5000
  })

  await expect(api.uploadPhoto({
    clientPhotoId: 'scene45-local',
    photoType: 'SCENE_45',
    sortNo: 1,
    filePath: 'wxfile://tmp/scene45.jpg',
    fileSize: 2048
  }, {
    ticket: 'AUX_REAL_001'
  })).rejects.toEqual({
    code: 'AUX_CASE_UPLOAD_ITEM_MISSING',
    message: '案件级拍照项未下发，请联系后台配置。'
  })
})
```

- [ ] **Step 2: 运行 API 测试，确认失败点**

Run: `npm test -- --runInBand --runTestsByPath __tests__/aux-photo-api.test.js`  
Expected: 新案件级用例在实现前 FAIL。

- [ ] **Step 3: 实现案件级判定和参数校验**

在 `packageD/utils/aux-photo-api.js` 增加：

```js
const CASE_LEVEL_PHOTO_TYPES = ['SCENE_45', 'SCENE_SUPPLEMENT']

function isCaseLevelPhotoType(photoType) {
  return CASE_LEVEL_PHOTO_TYPES.includes(photoType)
}

function buildCaseUploadItemMissingError() {
  return buildError('AUX_CASE_UPLOAD_ITEM_MISSING', '案件级拍照项未下发，请联系后台配置。')
}
```

在 `requestUploadPhoto` 或其参数校验附近按 `metadata.photoType` 分支：

```js
const isCaseLevel = isCaseLevelPhotoType(metadata.photoType)

if (!metadata.ticket || !metadata.uploadItemId || !metadata.photoType || !item.filePath) {
  const errorPayload = isCaseLevel && !metadata.uploadItemId
    ? buildCaseUploadItemMissingError()
    : buildError('AUX_PHOTO_UPLOAD_PARAM_INVALID', '上传照片参数不完整')
  logApiRequestFailed('uploadPhotoBase64', errorPayload, { stage: 'before_request' }, ticket)
  return Promise.reject(errorPayload)
}

if (!isCaseLevel && !metadata.vehicleId) {
  const errorPayload = buildError('AUX_PHOTO_UPLOAD_PARAM_INVALID', '上传照片参数不完整')
  logApiRequestFailed('uploadPhotoBase64', errorPayload, { stage: 'before_request' }, ticket)
  return Promise.reject(errorPayload)
}
```

车辆级错误语义保持现有 `AUX_PHOTO_UPLOAD_PARAM_INVALID`。

- [ ] **Step 4: request body 排除案件级 vehicleId**

修改 `buildUploadBase64Payload(metadata, fileBase64)`：

```js
function buildUploadBase64Payload(metadata, fileBase64) {
  const payload = {
    ticket: metadata.ticket,
    uploadItemId: metadata.uploadItemId,
    photoType: metadata.photoType,
    sortNo: metadata.sortNo,
    fileBase64
  }

  if (!isCaseLevelPhotoType(metadata.photoType)) {
    payload.vehicleId = metadata.vehicleId
  }

  return payload
}
```

不要修改 `UPLOAD_PHOTO_BASE64_PATH`。

- [ ] **Step 5: 复跑 API 测试**

Run: `npm test -- --runInBand --runTestsByPath __tests__/aux-photo-api.test.js`  
Expected: PASS，且已有车辆级上传请求仍包含 `vehicleId`。

### Task 4: 旧 document 页入口无上传副作用

**Files:**
- Modify: `packageD/pages/document/document.js`
- Test: `__tests__/document-upload-entry.test.js`

- [ ] **Step 1: 改写 document 入口测试**

将旧用例从“创建 uploadSession 并返回 preview”改为“直接安全跳转 preview，不创建 uploadSession”：

```js
test('redirects legacy document submit to preview without creating upload session', () => {
  const cache = storage.initCache()
  cache.vehicles.push(completeVehicle(0))
  cache.currentStep = constants.SHOOT_STEP.PREVIEW
  storage.saveCache(cache)
  const page = loadDocumentPage()

  page.onSubmit()

  const savedCache = storage.loadCache()
  expect(savedCache.uploadSession).toBeNull()
  expect(savedCache.currentStep).toBe(constants.SHOOT_STEP.PREVIEW)
  expect(global.wx.redirectTo).toHaveBeenCalledWith({
    url: '/packageD/pages/preview/preview'
  })
  expect(global.wx.redirectTo).not.toHaveBeenCalledWith({
    url: '/packageD/pages/complete/complete'
  })
})
```

如果现有 `storage.initCache()` 的 `uploadSession` 默认值不是 `null`，断言改为 `expect(savedCache.uploadSession).toBeFalsy()`，但不要允许出现 `phase: 'uploading'` 的新会话。

- [ ] **Step 2: 运行 document 测试，确认失败点**

Run: `npm test -- --runInBand --runTestsByPath __tests__/document-upload-entry.test.js`  
Expected: 当前仍调用 `uploadState.createUploadSession(cache)` 时 FAIL。

- [ ] **Step 3: 修改 onSubmit**

在 `packageD/pages/document/document.js` 的 `onSubmit` 中删除或绕开：

```js
cache.uploadSession = uploadState.createUploadSession(cache)
```

改为安全提示并跳转最终预览页：

```js
onSubmit() {
  const cache = storage.loadCache()

  if (!cache || !Array.isArray(cache.vehicles)) {
    wx.redirectTo({ url: '/packageD/pages/index/index' })
    return
  }

  cache.currentStep = constants.SHOOT_STEP.PREVIEW
  storage.saveCache(cache)

  if (wx.showToast) {
    wx.showToast({
      title: '请在总预览页提交',
      icon: 'none'
    })
  }

  wx.redirectTo({ url: '/packageD/pages/preview/preview' })
}
```

保留文件，不删除旧 document 页面。

- [ ] **Step 4: 复跑 document 测试**

Run: `npm test -- --runInBand --runTestsByPath __tests__/document-upload-entry.test.js`  
Expected: PASS。

### Task 5: 文档与 OpenSpec 任务同步

**Files:**
- Modify: `docs/辅助拍照微信小程序接口对接文档.md`
- Modify: `openspec/changes/integrate-case-level-upload-items/tasks.md`

- [ ] **Step 1: 更新接口文档**

在接口文档中补充“最小化接口改造”说明：

```md
### 案件级拍照项 caseUploadItems

`init` 接口路径不变。后端在初始化响应中通过 `caseUploadItems[]` 下发案件级拍照项，目前前端使用：

| photoType | 含义 | 上传归属 | vehicleId |
|---|---|---|---|
| `SCENE_45` | 现场 45 度照片 | 案件级 | 不传 |
| `SCENE_SUPPLEMENT` | 现场补充照片，最多 3 张 | 案件级 | 不传 |

车辆级照片仍来自 `vehicles[].uploadItems[]`，包括车牌号、VIN、车损、驾驶证、行驶证；上传时仍必须传 `vehicleId`。

如果现场照片存在但 `caseUploadItems[]` 未下发或缺少对应 `uploadItemId`，前端提示：`案件级拍照项未下发，请联系后台配置。`

`uploadPhotoBase64` 接口路径不变，仍为单张照片一个请求；案件级请求体不包含 `vehicleId` 字段，车辆级请求体继续包含 `vehicleId`。

`complete` 完成接口路径和处理逻辑本轮不变；前端不新增 `missingItems` 或 `requiredPassed` 依赖。
```

不要加入暂不实现的 `missingItems` 方案。

- [ ] **Step 2: 勾选 OpenSpec tasks**

实现和验证通过后，在 `openspec/changes/integrate-case-level-upload-items/tasks.md` 将已完成项从 `- [ ]` 改为 `- [x]`。只勾选本轮实际完成并验证的任务。

### Task 6: 集成验证

**Files:**
- Check only

- [ ] **Step 1: 语法检查**

Run:

```powershell
node --check packageD\utils\upload-state.js
node --check packageD\utils\aux-photo-api.js
node --check packageD\pages\document\document.js
```

Expected: 每条命令退出码 0。

- [ ] **Step 2: 相关 Jest**

Run:

```powershell
npm test -- --runInBand --runTestsByPath __tests__/upload-state.test.js __tests__/aux-photo-api.test.js __tests__/document-upload-entry.test.js __tests__/aux-photo-mapper.test.js
```

Expected: 4 个测试文件全部 PASS。

- [ ] **Step 3: OpenSpec 严格校验**

Run:

```powershell
openspec validate --all --strict
```

Expected: PASS。

- [ ] **Step 4: diff 空白检查**

Run:

```powershell
git diff --check
```

Expected: 无输出，退出码 0。

- [ ] **Step 5: 最终人工核对**

确认以下点全部成立后再汇总：

- `SCENE_45` 上传项 `sortNo = 1`，无 `vehicleId`。
- `SCENE_SUPPLEMENT` 最多 3 张，`sortNo = 1..3`，无 `vehicleId`。
- 车辆级照片上传项仍包含 `vehicleId`。
- 案件级缺配置错误为 `AUX_CASE_UPLOAD_ITEM_MISSING` / `案件级拍照项未下发，请联系后台配置。`。
- 旧 document 页 `onSubmit` 不创建 `uploadSession`，不跳 complete。
- 接口文档保持“最小化接口改造”口径。

## 自检结果

- Spec coverage: mapper、upload-state、aux-photo-api、document、接口文档、OpenSpec tasks 和验证命令均已覆盖。
- Placeholder scan: 未使用 TBD、TODO、implement later、similar to 等占位表达。
- Type consistency: 计划统一使用 `SCENE_45`、`SCENE_SUPPLEMENT`、`AUX_CASE_UPLOAD_ITEM_MISSING`、`caseUploadItemsByPhotoType`、`buildUploadItems`、`uploadPhoto`/ `uploadPhotoBase64` 现有命名。

Plan complete and saved to `docs/superpowers/plans/2026-07-13-case-level-upload-items.md`.
