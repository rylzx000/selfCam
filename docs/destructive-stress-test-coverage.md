# 破坏性压测覆盖清单

## 文档目的

本文件是破坏性压测覆盖地图，用于集中索引异常、乱序、恢复、边界、接口失败和系统 API 失败类测试。它不替代 `docs/test-flow-route-matrix.md`、`docs/abnormal-flow-test-cases.md`、`docs/test-run-guide.md` 或 `e2e/README.md`，只负责说明高风险破坏性场景目前在哪里覆盖、哪里还有缺口、后续优先补哪些用例。

表格中的 `ID` 是机器可读测试标识，保留英文是为了和 Jest/e2e 用例名、质量门禁输出保持一致。

## 覆盖范围定义

- 破坏性操作：连续点击、重复确认、反复打开关闭弹层、删除后重拍、乱序补拍。
- 异常恢复：坏 JSON、旧缓存、挂起恢复、退出重进、上传中断、完成失败重试。
- 边界容量：单车满图、50 张总容量、删除后释放容量、多车图片隔离。
- 接口失败：`init`、`uploadPhotoBase64`、`complete` 真实请求失败和错误日志。
- 系统 API 失败：相机权限、相册保存、`chooseMedia`、真实拍照和压缩失败。
- 静态门禁：流程矩阵、预览跳转、过期文案、素材大小、Comet/OpenSpec 临时产物。

## 已覆盖范围

### 缓存/状态恢复

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| CACHE-REC-001 | 坏 JSON 进入页面或恢复入口 | 页面白屏、缓存异常扩散 | 已覆盖 | Jest / e2e | P0 | `__tests__/storage.test.js`、`e2e/specs/current-regression.spec.js` |
| CACHE-REC-002 | 旧缓存迁移、陈旧重拍上下文清理 | 恢复到错误步骤或错误车辆 | 已覆盖 | Jest | P0 | `__tests__/storage.test.js`、`__tests__/storage-resume.test.js` |
| CACHE-REC-003 | 越界索引、缺字段、异常字段摘要稳定 | 统计崩溃、错误完成态 | 已覆盖 | Jest | P1 | `__tests__/cache-selectors.edge.test.js` |
| CACHE-REC-004 | 删除/重拍后退出重进，cache 与页面一致 | 页面统计与缓存不一致 | 已覆盖 | e2e | P0 | `e2e/specs/recovery-chaos.spec.js` |
| CACHE-REC-005 | 状态机非法迁移、陈旧 workflowState 纠偏 | 恢复到错误状态 | 已覆盖 | Jest | P1 | `__tests__/workflow-recovery.test.js` |

### 三阶段路由乱序

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| ROUTE-STRESS-001 | 模块一临时查看已拍后补空槽 | 临时预览来源被清理，拍完进错下一步 | 已覆盖 | Jest | P0 | `docs/test-flow-route-matrix.md`、`__tests__/workflow-route-matrix.test.js` / `LINK-M1-*` |
| ROUTE-STRESS-002 | 模块二查看已拍、新增和重拍返回策略 | 新增/重拍都回错预览或串车 | 已覆盖 | Jest | P0 | `docs/test-flow-route-matrix.md`、`__tests__/workflow-route-matrix.test.js` / `LINK-M2-*` |
| ROUTE-STRESS-003 | 最终预览重拍回跳 `final` | 从最终预览补拍后进入模块一/模块二 | 已覆盖 | Jest | P0 | `__tests__/workflow-route-matrix.test.js` / `LINK-FINAL-*`、`ACCESS-FINAL-*` |
| ROUTE-STRESS-004 | 最终预览全局乱序删除后补拍 | 多类空槽交叉删除后回跳上下文被污染 | 已覆盖 | Jest | P0 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-PV-FINAL-005` |

### 删除/重拍/补拍

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| DRR-001 | 单车满图后删除第一张车损再补拍 | 旧图残留、数量不恢复 | 已覆盖 | e2e | P0 | `e2e/specs/delete-retake-replenish.spec.js` |
| DRR-002 | 单车满图后删除中间车损再补拍 | 索引错乱、顺序错误 | 已覆盖 | e2e | P0 | `e2e/specs/delete-retake-replenish.spec.js` |
| DRR-003 | 单车满图后删除最后一张车损再补拍 | 越界、无法补拍 | 已覆盖 | e2e | P0 | `e2e/specs/delete-retake-replenish.spec.js` |
| DRR-004 | 删除全部车损后重新补满 | 空数组恢复失败 | 已覆盖 | e2e | P0 | `e2e/specs/delete-retake-replenish.spec.js` |
| DRR-005 | 连续确认使用/重新拍摄各 20 次 | 重复写入、重复状态推进 | 已覆盖 | e2e | P0 | `e2e/specs/current-regression.spec.js` |

### 多车隔离

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| MV-CHAOS-001 | 两车满图后删除 A 车图片 | B 车图片或统计被误改 | 已覆盖 | e2e | P0 | `e2e/specs/multi-vehicle-chaos.spec.js` |
| MV-CHAOS-002 | 两车满图后重拍 B 车图片 | A 车图片或统计被误改 | 已覆盖 | e2e | P0 | `e2e/specs/multi-vehicle-chaos.spec.js` |
| MV-CHAOS-003 | 多车第二辆删除中间车损后补拍 | 补拍回到第一辆或错误预览 | 已覆盖 | Jest | P0 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-PV-M2-001` |

### 容量边界

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| CAP-001 | 单车满图进入 preview 后统计正确 | 满图统计失真 | 已覆盖 | e2e | P0 | `e2e/specs/capacity-boundary.spec.js` |
| CAP-002 | 50 张总图片后禁止继续新增 | 超容量写入、包体/上传压力扩大 | 已覆盖 | e2e | P0 | `e2e/specs/capacity-boundary.spec.js` |
| CAP-003 | 50 张删除 1 张后释放容量 | 删除后仍无法新增 | 已覆盖 | e2e | P0 | `e2e/specs/capacity-boundary.spec.js` |
| CAP-004 | aux photo 第 6 张车损限制和确认推进 | 车损数量上限或流程推进异常 | 已覆盖 | e2e | P1 | `e2e/specs/capacity-boundary.spec.js` |

### 上传/完成失败恢复

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| UPLOAD-REC-001 | 上传失败后只重试失败项 | 成功项重复上传、payload 重复 | 已覆盖 | Jest | P0 | `__tests__/preview-upload-overlay.test.js`、`__tests__/upload-state.test.js` |
| UPLOAD-REC-002 | `uploading` 中断回落 `pending` 并继续未完成项 | 中断项卡死、成功项重复上传 | 已覆盖 | Jest | P0 | `__tests__/preview-upload-overlay.test.js` / `STRESS-UPLOAD-RESUME-001` |
| UPLOAD-REC-003 | `complete_failed` 只重试 complete | 照片重复上传、完成态混乱 | 已覆盖 | Jest | P0 | `__tests__/preview-upload-overlay.test.js`、`__tests__/upload-state.test.js` |
| UPLOAD-REC-004 | 删除/重拍后提交，旧图不进入 payload | 已删除图片被提交 | 已覆盖 | e2e | P0 | `e2e/specs/submit-consistency.spec.js` |
| UPLOAD-REC-005 | 真实接口失败日志不带图片敏感数据 | 失败难定位或泄露图片内容 | 已覆盖 | Jest | P1 | `__tests__/aux-photo-api.test.js` |

### 权限/相册异常

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| PERM-001 | 相机权限拒绝不初始化采集 | 无权限仍跳转、空白相机页 | 已覆盖 | Jest / 真机 | P0 | `__tests__/permission.test.js`、`__tests__/index-permission.test.js` |
| PERM-002 | 首页开始采集重复点击 | 重复 init、重复跳转、缓存覆盖 | 已覆盖 | Jest | P0 | `__tests__/index-permission.test.js` |
| ALBUM-001 | 最终保存相册权限拒绝 | 保存失败阻塞完成流程 | 已覆盖 | Jest / 真机 | P1 | `__tests__/preview-album-save.test.js`、`__tests__/album.test.js` |
| ALBUM-002 | 批量保存部分失败汇总 | 用户误以为全部保存成功 | 已覆盖 | Jest | P1 | `__tests__/album.test.js` |

### 质量门禁/素材门禁

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| QG-001 | 流程矩阵声明覆盖但 Jest 缺失 | 文档误导、回归空洞 | 已覆盖 | Jest 静态检测 | P0 | `__tests__/quality-guards.test.js` |
| QG-002 | 无 `mode` 老预览跳转 | 新三阶段流程回到旧预览 | 已覆盖 | Jest 静态检测 | P0 | `__tests__/quality-guards.test.js` |
| QG-003 | 主流程过期文案 | 用户被旧自动拍照或旧证件叫法误导 | 已覆盖 | Jest 静态检测 | P1 | `__tests__/quality-guards.test.js` |
| QG-004 | 分包素材过大或误放源文件 | 小程序包体超限或误提交设计源文件 | 已覆盖 | Jest 静态检测 | P1 | `__tests__/quality-guards.test.js` |
| QG-005 | OpenSpec/Comet 临时产物误提交 | 归档污染、临时包进入仓库 | 已覆盖 | Jest 静态检测 | P1 | `__tests__/quality-guards.test.js` |

## 当前覆盖缺口

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| GAP-DOC-001 | 模块三证件电子/实物反复切换、删除、重传 | 证件选择串车或串证件 | 部分覆盖 | Jest / e2e | P1 | `__tests__/workflow-route-matrix.test.js`、`__tests__/vehicle-documents.test.js` |
| GAP-CONFIG-001 | 后端配置缺 `caseUploadItems`、缺 vehicle `uploadItemId`、车辆数异常 | 上传项映射失败或错误 payload | 部分覆盖 | Jest | P1 | `__tests__/upload-state.test.js`、`__tests__/aux-photo-api.test.js` |
| GAP-SYS-001 | `takePhoto`、`compressImage`、`chooseMedia`、`readFile` 失败 | 用户无法恢复或失败无提示 | 部分覆盖 | Jest / 真机 | P1 | `__tests__/aux-photo-api.test.js`、待补系统 API 失败用例 |
| GAP-COMPLETE-001 | 完成页重复进入幂等 | 重复上传或重复 complete | 部分覆盖 | Jest / e2e | P1 | `__tests__/preview-upload-overlay.test.js`、待补完成页幂等用例 |
| GAP-REAL-001 | 低端机横屏、真实 50 张滑动删除、真实文件压缩耗时 | 开发者工具与真机表现不一致 | 需真机 | 真机 | P0 | 真机 smoke 清单 |

## 第一批建议新增测试

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| STRESS-M1-SUP-001 | 模块一现场补充弹层只出现一次，选择“有/没有”都写一次性标记 | 反复弹窗打断模块一预览 | 已覆盖 | Jest | P0 | `__tests__/module-one-preview.test.js` |
| STRESS-M2-SOFT-001 | 模块二车损少于 3 张软确认连续点击/取消/完成不重复推进 | 重复进入下一车、重复弹层、串车 | 已覆盖 | Jest | P0 | `__tests__/camera-ai-start.test.js` |
| COMPLEX-PV-FINAL-005 | 最终预览全局乱序删除 45 度、现场补充、第二车车牌/VIN/车损/证件后分别补拍/上传 | 从 final 误入 moduleOne/moduleTwo/moduleThree | 已覆盖 | Jest | P0 | `__tests__/workflow-route-matrix.test.js` |
| STRESS-UPLOAD-RESUME-001 | 上传中断恢复时 `success` 不重传、`uploading` 回落 `pending`、继续未完成项 | 上传卡死或重复上传 | 已覆盖 | Jest | P0 | `__tests__/preview-upload-overlay.test.js` |
| STRESS-COMPLETE-RETRY-001 | `complete_failed` 恢复后只允许重试 complete | complete 重试时重复上传照片 | 已覆盖 | Jest | P0 | `__tests__/preview-upload-overlay.test.js`、`__tests__/upload-state.test.js` |

## 第二批后续测试

| ID | 场景 | 风险 | 当前状态 | 推荐实现方式 | 优先级 | 关联文件 |
|---|---|---|---|---|---|---|
| NEXT-DOC-001 | 模块三证件电子/实物反复切换、删除、重传 | 串车、串证件、完成态误判 | 未覆盖 | Jest / e2e | P1 | 待补：证件流程测试 |
| NEXT-CONFIG-001 | 后端配置缺 `caseUploadItems`、缺 vehicle `uploadItemId`、车辆数异常 | 上传初始化或 payload 映射失败 | 未覆盖 | Jest | P1 | 待补：上传映射测试 |
| NEXT-SYS-001 | `takePhoto`、`compressImage`、`chooseMedia`、`readFile` 失败 | 用户无法继续或错误不可见 | 未覆盖 | Jest / 真机 | P1 | 待补：系统 API 失败测试 |
| NEXT-COMPLETE-001 | 完成页幂等：完成后重复进入不重复上传、不重复 complete | 重复提交、重复跳转 | 未覆盖 | Jest / e2e | P1 | 待补：完成页幂等测试 |
| NEXT-REAL-001 | 真实相机权限拒绝、真实 50 张图片滑动删除、低端机横屏渲染、真实文件写入和压缩耗时 | 真机性能和系统权限差异 | 需真机 | 真机 smoke | P0 | 待补：真机专项清单 |

## 执行方式

### Jest

建议最终统一执行：

```powershell
node --check __tests__/camera-ai-start.test.js
node --check __tests__/workflow-route-matrix.test.js
node --check __tests__/preview-upload-overlay.test.js
node --check __tests__/quality-guards.test.js
npm test -- --runInBand __tests__/module-one-preview.test.js __tests__/camera-ai-start.test.js __tests__/workflow-route-matrix.test.js __tests__/preview-upload-overlay.test.js __tests__/upload-state.test.js
npm test -- --runInBand __tests__/quality-guards.test.js
```

### 微信开发者工具 e2e

破坏性页面自动化建议按风险分批执行：

```powershell
npm run test:e2e:chaos
npm run test:e2e:capacity
npm run test:e2e:p0
```

### 真机 smoke

真机只覆盖开发者工具和 Jest 不能证明的系统能力：真实相机权限拒绝、真实拍照文件写入、50 张真实图片滑动删除、低端机横屏渲染、真实压缩耗时和返回栈表现。

## 关联文件索引

- `docs/test-flow-route-matrix.md`：三阶段路由、删除后入口、最终预览回跳矩阵。
- `docs/abnormal-flow-test-cases.md`：手工异常链路清单。
- `docs/test-run-guide.md`：测试命令、运行前提和结果查看说明。
- `e2e/README.md`：微信开发者工具页面自动化入口。
- `e2e/specs/current-regression.spec.js`：连续确认/重拍、连续打开关闭弹层、快速切换步骤、损坏缓存恢复。
- `e2e/specs/capacity-boundary.spec.js`：单车满图、50 张总容量、删除后释放容量。
- `e2e/specs/delete-retake-replenish.spec.js`：删除第一张/中间/最后/全部车损后补拍。
- `e2e/specs/multi-vehicle-chaos.spec.js`：多车删除/重拍不串车。
- `e2e/specs/recovery-chaos.spec.js`：删除/重拍后退出重进，cache 与页面一致。
- `e2e/specs/submit-consistency.spec.js`：提交一致性、旧图不进入 payload。
- `__tests__/workflow-route-matrix.test.js`：三阶段路由乱序、临时预览、最终预览回跳。
- `__tests__/module-one-preview.test.js`：模块一预览和现场补充弹层。
- `__tests__/storage.test.js`、`__tests__/storage-resume.test.js`、`__tests__/workflow-recovery.test.js`、`__tests__/cache-selectors.edge.test.js`：坏 JSON、旧缓存、越界索引、过期上下文清理。
- `__tests__/preview-upload-overlay.test.js`、`__tests__/upload-state.test.js`、`__tests__/aux-photo-api.test.js`：上传失败、完成失败、重试、真实接口失败日志。
- `__tests__/permission.test.js`、`__tests__/index-permission.test.js`、`__tests__/preview-album-save.test.js`、`__tests__/album.test.js`：权限拒绝、相册失败、开始采集重复点击。
- `__tests__/quality-guards.test.js`：静态质量门禁、素材大小、无 mode 老预览跳转、过期文案、Comet 临时文件。
