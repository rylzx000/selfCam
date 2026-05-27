# selfCam 变更记录

所有重要变更都记录在此文件中，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

---

## 未发布

暂无。

## [v1.4.6] - 2026-05-27

### 新增

- 接入辅助拍照 `uploadPhoto` 逐张上传和 `complete` 完成接口，上传全部成功后才提交完成，完成成功后进入完成页。
- 新增本地辅助拍照 mock 后端脚本，可在开发者工具中用真实 `wx.uploadFile` 验证 multipart 报文和完成接口重试。

### 调整

- 预览页上传遮罩从本地 mock 进度改为读取真实上传队列状态；单张上传失败停止后续上传，重试只继续未成功照片。
- `uploadSession` 缓存补充单张上传成功记录和完成提交状态，支持上传中断恢复、complete 失败后只重试 complete。

### 版本

- `package.json`、`package-lock.json`、`VERSION.md` 和辅助拍照请求 `CLIENT_VERSION` 提升到 `1.4.6`。

## [v1.4.5] - 2026-05-25

### 调整

- 完成采集流程在相册保存确认后改为停留预览页展示上传遮罩，先写入本地 `uploadSession` 并用 mock/stub 推进上传进度；本阶段不调用真实 `uploadPhoto` 和 `complete`。
- 新增本地上传队列结构，按车辆照片和车辆级行驶证资料组装 `vehicleId/uploadItemId/photoType/sortNo/filePath/clientPhotoId`，为后续逐张接入真实上传接口预留。
- 备用 `document` 页提交入口不再直达完成页，改为创建本地上传状态后回到预览页统一展示上传遮罩。
- `package.json`、`package-lock.json`、`VERSION.md` 和辅助拍照请求 `CLIENT_VERSION` 提升到 `1.4.5`。

### 修复

- 收口辅助拍照车损照片上限：单车满 5 张后不再允许第 6 张写入缓存，预览页补拍同样拦截。
- 车损完成后改为确认弹窗流转：有下一辆车时可选择 `下一辆车` 或 `查看已拍`，最后一辆显示 `去预览`。
- 车损完成弹窗显示期间卸载拍照页相机并暂停 AI/帧监听，切换下一辆车时等待相机停止和重新初始化后再恢复识别，避免出现多个 `<camera>` 或压缩失败。

### 测试

- 将车损 5 张上限、第 6 张拦截、完成弹窗关闭相机、下一辆车相机恢复和预览页补拍上限纳入主流程/e2e 回归覆盖。
- 新增上传本地状态、预览页上传遮罩和备用单证页提交入口测试，覆盖上传进度、失败重试和不直达完成页。

### 文档

- 同步 `PRDS/` 和上传遮罩 HTML 样式稿，明确第 3 步只做预览页遮罩与本地上传状态，真实 `uploadPhoto/complete` 留到后续步骤。

### 验证

- 用户已完成真机验证：通过。
- 本次版本提交按用户要求未重新执行测试。

## [v1.4.4] - 2026-05-25

### 调整

- 辅助拍照预览页行驶证槽位对齐后端 `uploadItems`：实物行驶证正页、副页分别绑定 `DRIVING_LICENSE_FRONT`、`DRIVING_LICENSE_BACK`，电子行驶证绑定 `DRIVING_LICENSE_ELECTRONIC`。
- 行驶证本地缓存补充 `vehicleId`、`uploadItemId`、`photoType`，为后续真实 `uploadPhoto` 接口实现预留元数据。
- 辅助拍照模式下预览页增加防御式车辆锁定，避免误触发新增或删除三者车。

### 文档

- 同步辅助拍照接口文档和 `PRDS/`，补齐电子行驶证独立上传类型与本阶段不调用真实上传接口的说明。
- `package.json`、`package-lock.json`、`VERSION.md` 和辅助拍照请求 `CLIENT_VERSION` 提升到 `1.4.4`。

### 验证

- 用户已完成真机验证：通过。
- 本次补版本号与改提交备注按用户要求未重新执行测试。

## [v1.4.2] - 2026-05-22

### 新增

- 接入辅助拍照 `ticket` 初始化链路：小程序启动时读取并缓存 `ticket`，首页开始采集时调用 `AuxPhotoService/init`，车辆数量、车辆角色、车牌号和拍照项以后端返回为准。
- 新增辅助拍照 mock 能力：开发/体验环境支持 `mock-1`、`mock-2`、`mock-3` 控制车辆数，便于未联调时验证车辆初始化、车牌展示和多车辆拍摄流转。
- 新增在线平台错误日志上传通道：按 `reportNo` 关联错误事件，只上传白名单内的明确报错，失败静默处理，不阻断拍照主流程。

### 调整

- 辅助拍照链路隐藏手动新增/删除三者车能力，车辆列表以后端初始化数据为准；无 `ticket` 的正式版入口阻断，开发/体验环境保留原有本地采集链路。
- 拍照页当前车辆展示拆分为车辆角色、车牌标签和车辆进度，油车蓝底、电车绿底，避免长车牌与角色拼接后溢出。
- 辅助拍照模式下，车损拍完后有下一辆车时按钮显示 `下一辆车` 并直接进入下一辆车车牌拍摄；最后一辆显示 `去预览`，拍满 5 张车损不再自动跳转预览。
- 预览页车辆展示优先使用后端车辆显示名，车辆级行驶证仍按实物正副页和电子行驶证独立类型处理。

### 文档

- 新增 `docs/backend-integration/` 后台对接文档目录，补充客户端错误日志上报接口、Oracle 落库表结构、错误事件白名单、`reportNo` 关联规则和联调验收标准。
- 新增辅助拍照微信小程序接口对接文档，明确 `ticket` 鉴权、初始化车辆、拍照项、图片上传到 onlineclaim、完成接口和状态查询约定。
- 同步 `PRDS/` 与环境配置设计文档：后台错误日志只上传明确报错事件，不上传正常状态、页面行为或 AI 几何诊断快照；接口闭环前不新增缺少 `reportNo` 的入口阻断。
- `package.json` 与 `package-lock.json` 版本号提升到 `1.4.2`。

### 验证

- `node --check utils/cache-selectors.js utils/aux-photo-api.js utils/aux-photo-mapper.js utils/aux-photo-mock.js pages/camera/camera.js pages/index/index.js pages/preview/preview.js app.js utils/env-config.js utils/runtime-logger.js`：通过。
- `npm test -- --runInBand`：27 个测试套件、254 个用例通过。
- `npm run test:automator:smoke`：微信开发者工具自动化关键链路通过。
- 微信开发者工具临时 mock ticket 验证：`mock-2` 第一辆车切第二辆车通过，`mock-3` 绿牌和最后 `去预览` 通过。

## [v1.4.1] - 2026-05-11

### 修复 - 2026-05-12

- 拍照页 UI 缩放分支补充 OpenHarmony/OHOS 横屏判定：正常 iOS/Android 横屏机型继续走原有 `rpx`，nova13 这类 `layoutScale < 1.3` 但系统 `rpx` 显示偏小的设备也会输出显式 `px` 样式。
- 预览页接入同一套横屏 UI 缩放规则，覆盖页面标题、车辆卡片、缩略图、上传入口、底部按钮、行驶证面板和全屏预览浮层，修复 nova13 上预览页元素整体偏小的问题。
- AI 坐标映射补充分支：4:3 帧继续沿用旧逻辑，宽帧继续按 aspect-fill 裁剪映射，正方形/窄于 4:3 的实时帧改为按高度贴合并左右补边，修复 `480 x 480` 帧在 nova13 上识别到车牌但中心映射偏下导致无法自动拍照的问题。
- 自动拍照 gate 日志补充 `centerInBox`、`areaInRange`、`centerOffsetX/Y`、阈值和 `failReason`；布局日志补充 `uiScale`、`uiScaleReason`，预览页新增 `preview_layout_snapshot`，便于业务一次真机测试抓到关键几何信息。

### 验证 - 2026-05-12

- `node --check pages\camera\camera.js pages\preview\preview.js utils\frame-utils.js utils\runtime-logger.js utils\responsive-ui.js`：通过。
- `npm test -- --runInBand`：23 个测试套件、229 个用例通过。
- `npm run test:automator`：244 秒超时；`node e2e\test-launch.js` 显示本机 `miniprogram-automator` 无法拉起微信开发者工具，单条 smoke 报 `Connection closed, check if wechat web devTools is still running`。

### 调整 - 2026-05-11

- 拍照页新增高分辨率横屏 UI 缩放分支：正常横屏机型继续使用原有 `rpx` 样式，nova13 类高分辨率横屏才将文字、按钮、提示条和边框按相机布局比例输出 `px` 样式。
- 车牌和车损自动拍照新增实时帧到虚拟 `400 x 300` 相机坐标的 aspect-fill 裁剪映射，保持原业务阈值不变，修复宽屏实时帧与视觉取景框不一致导致识别到目标但无法触发自动拍照的问题。
- 取景框几何统一由虚拟坐标比例生成；正常机型不输出额外取景框 inline 样式，高分辨率缩放分支才输出动态样式，避免影响已正常设备。
- 新增 AI 几何诊断实时日志：布局快照、帧映射快照、自动拍照 gate 抽样和触发成功事件写入微信小程序实时日志，抽样日志按步骤限频，避免高频刷屏。
- `package.json` 与 `package-lock.json` 版本号提升到 `1.4.1`。

### 验证 - 2026-05-11

- `node --check pages\camera\camera.js utils\frame-utils.js utils\damage-tracker.js utils\damage-auto-capture-engine.js utils\runtime-logger.js`：通过。
- `npm test -- --runInBand`：22 个测试套件、225 个用例通过。
- `npm run test:automator`：184 秒超时无有效输出；缩小到单条 smoke 后，微信开发者工具连接关闭，报 `Connection closed, check if wechat web devTools is still running`。

## [v1.4.0] - 2026-05-10

### 调整 - 2026-05-10

- 相册保存从拍照页 `确认使用` 后移到预览页 `完成采集` 最后一步；三者车确认和行驶证风险确认完成后，再询问是否保存全部/新增图片至手机相册。
- 首页开始采集不再预申请相册保存权限；用户点击最终保存确认中的 `保存至手机` 后才申请 `scope.writePhotosAlbum`。
- 新增 `localPhotoId`、`albumSaveRecords` 和 `albumSaveSummary`，完成页返回修改后只保存新增或替换后的当前图片，避免重复保存已保存照片。
- 完成页提示改为按本次保存结果展示：已保存、未保存或部分未保存，不再无条件显示“所有照片已保存完成”。
- `package.json` 与 `package-lock.json` 版本号提升到 `1.4.0`。

### 验证 - 2026-05-10

- `node --check` 覆盖相册、权限、缓存、相机页、预览页和完成页核心 JS 文件：通过。
- `npm test -- --runInBand`：22 个测试套件、215 个用例通过。
- `npm run test:e2e -- --testPathPattern=submit-consistency`：2 个 P0 微信开发者工具 automator 用例通过。
- 用户已完成真机测试，确认功能没问题。

## [v1.3.8] - 2026-05-09

### 修复 - 2026-05-09

- 修复部分真机车牌/车损模型加载时 `wx.createInferenceSession` 返回 `invalid session` 的问题。
- 车牌/车损检测器在创建推理 session 前轻量调用一次 `wx.getInferenceEnvInfo`，成功、失败或不支持都只记录日志，不阻断加载。
- 车牌/车损 `wx.createInferenceSession` 参数统一为 `precisionLevel=0`、`allowNPU=false`、`allowQuantize=false`，移除旧的 `precisionLevel=1/4` 尝试逻辑。
- 保留现有 runtimeLogger、结构化错误、session 有效性校验、`onLoad/onError` 处理和相机页 AI 不可用降级逻辑。

### 未变更 - 2026-05-09

- 未修改拍照逻辑、AI 检测循环、预处理、后处理、页面、缓存和上传逻辑。

### 验证 - 2026-05-09

- `node --check utils/plate-detector.js`：通过。
- `node --check utils/damage-detector.js`：通过。
- `npm test -- --runInBand`：21 个测试套件、199 个用例通过。

## [v1.3.7] - 2026-05-08

### 追加 - 2026-05-08

- 收敛 We分析实时日志：本地 runtime 日志继续完整保存，普通实时日志仅上报 AI 排障关键事件，避免 `camera/page_show`、`workflow/transition`、`ai/resume_detection_skipped` 等高频日志挤掉模型失败信息。
- 精简 We分析 payload，仅保留反馈编号、环境、模型、阶段、错误、设备和 session 尝试信息，降低 `UserLog:fail Log Size Exceed` 风险。
- 车牌/车损推理 session 创建增加有效性校验，避免部分 Android 设备上 `wx.createInferenceSession` 返回无效对象后触发 `Cannot read properties of undefined (reading 'onLoad')`。
- 推理 session 首次仍使用 `precisionLevel=1`，创建失败、无效 session 或 `onError` 后只重试一次 `cpu_safe_precision_4`，并设置 `allowNPU=false`、`allowQuantize=false`；不重新下载模型，不清理模型缓存。
- 拍照页相机区新增横屏窗口尺寸计算，按横屏长边复刻旧版 `400rpx x 300rpx` 视觉尺寸，修复部分机型横屏下相机预览区被短边 `rpx` 换算压小的问题。
- 车牌、VIN、车损取景框和距离提示箭头改为相对相机区的百分比布局，保持固定虚拟 `400 x 300` 坐标系不变。
- 车牌/车损 AI 检测抽帧改用 `CameraContext.onCameraFrame` 与 `frame-size="medium"`，不再通过低清 `cameraContext.takePhoto()` 轮询取帧，保留车损 `selectedFramePath` 候选帧成片逻辑。

### 修复 - 2026-05-08

- 修复 nova13 等部分横屏机型上拍照页相机区缩在中间小块的问题。
- 修复首次布局修正中误用竖屏 `safeArea` 宽度和固定高度比例导致正常机型相机区、按钮区变小的回归风险。
- 修复 iPhone12 真机进入车牌页/车损页后，AI 检测抽帧被系统表现为连续快门的问题；VIN 页仍不启用 AI 自动检测。
- 修复华为设备上单独 `precisionLevel=4` fallback 仍可能返回无效 session 的问题，第二档改为更保守的 CPU-safe 模式以绕开 NPU/量化兼容风险。

### 追加验证 - 2026-05-08

- `node --check utils/plate-detector.js`：通过。
- `node --check utils/damage-detector.js`：通过。
- `node --check utils/runtime-logger.js`：通过。
- `npm test -- --runTestsByPath __tests__\camera-layout.test.js __tests__\camera-ai-start.test.js __tests__\camera-photo-quality.test.js`：3 个测试套件、15 个用例通过。
- `npm test -- --runInBand`：21 个测试套件、194 个用例通过。
- `npx jest __tests__/camera-ai-start.test.js __tests__/damage-capture-modules.test.js __tests__/camera-photo-quality.test.js --runInBand`：3 个测试套件、28 个用例通过。
- `npx jest --runInBand`：21 个测试套件、197 个用例通过。
- `npm test -- --runInBand`：21 个测试套件、199 个用例通过。

### 追加 - 2026-05-05

- 新增总照片容量上限 `LIMITS.MAX_TOTAL_PHOTOS = 50`，在拍照确认、预览页补拍/上传、备用单证页上传入口统一拦截，达到上限时提示 `最多50张，请先删除`。
- 扩充微信开发者工具 e2e P0 自动化，新增容量边界、删除后补拍、重拍替换、多车满图、提交一致性和恢复乱序场景。
- 新增 `e2e/support/scenario-builder.js`，集中构造满图、多车、近 50 张容量场景，并提供图片路径收集和重复路径断言。
- 新增 `test:e2e:capacity`、`test:e2e:chaos`、`test:e2e:p0`、`test:e2e:full` 脚本。

### 追加验证 - 2026-05-05

- `npm test -- --runInBand`：18 个测试套件、156 个用例通过。
- `npm run test:e2e:p0`：5 个 e2e 测试文件、12 个 P0 用例通过。

### 变更

- 车损 `areaRatio` 口径调整为检测框占整张图面积比例，并保留 `imageAreaRatio` 与 `captureAreaRatio` 便于调试和后续归档。
- 车损自动拍照将原“占取景框 50%～100%”业务阈值按取景框面积换算为整图有效阈值，用于阶段判断和靠近/远离提示。
- 首次识别车损时中心偏移直接使用当前值，HOLD / SHOOT 阶段改为每帧运行车损检测，降低稳定后等待候选帧的卡顿。
- 放宽车损 SEEK / HOLD 中心阈值，并增加 HOLD 面积短暂出界 2 帧缓冲，提升真机手持自动拍照手感。
- 开发态拍照框调试信息精简为 `phase / area / center / stable / hold`。
- `package.json` 与 `package-lock.json` 版本号提升到 `1.3.7`。

### 修复

- 修复 `centerOffset = 0` 被 `|| 1` 当作偏移过大的问题。
- 修复车损面积口径变化后候选帧与阈值判断不一致风险。

### 验证

- `npm test -- --runTestsByPath __tests__\damage-capture-modules.test.js --runInBand`：13 个用例通过。
- `npm test -- --runInBand`：18 个测试套件、156 个用例通过。

## [v1.3.6] - 2026-05-02

### 追加 - 2026-05-07

- 接入微信小程序实时日志 `wx.getRealtimeLogManager()`，通过 `selfCam_${sessionId}` 过滤号定位业务人员真机问题。
- `runtime-logger` 写入本地日志后同步上报实时日志，并自动带上 `appEnv`、`wxEnvVersion`、基础库和设备信息。
- 车牌/车损模型加载链路补充下载开始、缓存命中、下载成功、下载失败、缓存写入失败、推理会话加载失败等事件。
- 相机页 AI 初始化失败日志补充模型地址、环境、错误阶段和设备信息；业务用户端提示仍保持 `AI 不可用，请手动拍照`。
- 体验版 `trial` 临时将 `runtimeLoggerLevel` 调整为 `info`，方便在实时日志中看到模型配置、缓存命中和下载开始等诊断事件。
- 启用小程序组件按需注入 `lazyCodeLoading: requiredComponents`，用于通过微信开发者工具代码质量扫描。
- 压缩首页品牌 logo 本地资源，保持页面尺寸和品牌展示基本不变。
- 清理未实际使用的 `components/image-preview` 组件及预览页旧组件声明，现有预览、重拍、删除流程继续使用页面内联实现。
- `package.json` 与 `package-lock.json` 版本号保持 `1.3.6`。

### 新增

- 新增业务环境 `appEnv`，在微信运行版本 `develop / trial / release` 之外支持 `dev / sit / pilot / prod`，默认映射为 `develop -> dev`、`trial -> sit`、`release -> prod`。
- 首页 logo 区域新增隐藏环境切换入口，非正式版连续点击 7 次后可选择允许的业务环境、清除本地环境选择或清除 AI 模型缓存。
- AI 模型缓存文件按业务环境和模型地址 hash 隔离，避免 SIT、pilot 等环境复用同一个 `plate.onnx` / `damage.onnx`。
- 新增 `utils/model-cache.js`，用于隐藏调试入口清除当前环境车牌/车损 onnx 模型缓存，不影响用户照片、车辆/单证/流程缓存和本地日志。

### 变更

- `utils/env-config.js` 统一维护业务环境模型地址，`ai-config.js` 不再写死模型地址。
- `dev.modelHost` 调整为与 SIT 相同的 `https://onlineclaimsit.chinalife-p.com.cn/video/model`，开发环境调试复用 SIT 模型资源。
- `release` 正式版强制 `prod`，忽略本地 `SELF_CAM_APP_ENV` 覆盖。
- 非 `dev` 业务环境禁止使用 `http`、`localhost`、`127.0.0.1` 和局域网 IP 模型地址。
- 首页、拍照页、预览页右下角增加透明环境标识，`dev / sit / pilot` 分别显示本地、sit、实盘，`prod` 不显示。
- `package.json` 与 `package-lock.json` 版本号提升到 `1.3.6`。

### 修复

- 修复环境切换后拍照页仍复用 `ai-config.js` 模块加载期模型地址的问题；相机页创建检测器前改为实时读取 `envConfig.getAiConfig()` 并传入检测器。

### 验证

- `npm test -- --runInBand`：19 个测试套件、170 个用例通过。

## [v1.3.5] - 2026-04-30

### 新增

- 新增车辆级通用单证结构 `vehicle.documents[]` 与 `vehicle.documentSelections`，行驶证资料按车辆独立保存，预留后续驾驶证、身份证、银行卡等单证扩展。
- 新增 `utils/documents.js`，统一处理行驶证类型常量、默认模式、旧缓存兼容、完成态判断、上传槽位和预览数据构建。
- 预览页新增每辆车行驶证上传面板，支持实体行驶证正页/副页和电子行驶证单张上传。
- 行驶证上传支持拍照和从手机相册选择；拍照来源上传成功后尝试保存到手机相册，相册来源不重复保存。
- 新增 `__tests__/vehicle-documents.test.js` 与 `__tests__/preview-driving-license.test.js`，覆盖缓存迁移、完成态、切换、上传替换、删除、风险提示和串车隔离。

### 变更

- `package.json` 与 `package-lock.json` 版本号提升到 `1.3.5`。
- 预览页每辆车照片列表调整为 `车牌 -> VIN -> 车损 -> 行驶证资料`，行驶证缩略图使用真实图片缩略图并复用现有全屏预览、重拍和删除逻辑。
- 原独立“单证资料”展示模块在预览页隐藏，底部提示栏改为行驶证未完成风险提示。
- 完成采集流程调整为先确认 `确认所有车辆损伤均已拍摄，无需增加其他三者车？`，再检查行驶证是否齐全。
- 行驶证风险提示调整为 `仍有车辆未上传行驶证，会影响定损金额准确性，建议上传。如确实无法提供，请后续联系案件处理人员补充。是否确认提交？`，确认按钮为 `确认提交`。
- 通用确认弹窗新增 `masktap` 事件，点击空白仅关闭弹窗，不触发取消按钮业务动作。
- 初始化页拍摄须知改为提前准备所有事故车辆行驶证，支持 12123 电子版。
- 拍照页背景统一为初始化页和预览页同款浅灰绿色背景与右上角淡绿色装饰。

### 修复

- 修复未完成行驶证风险提示早于“三者车确认”弹出的顺序问题。
- 修复行驶证上传面板和车辆列表使用占位图而不是真实缩略图的问题。
- 修复点击三者车确认弹窗空白位置会误触发添加三者车流程的问题。

### 验证

- `node --check pages\preview\preview.js`：通过。
- `node --check components\confirm-modal\confirm-modal.js`：通过。
- `npm test -- --runInBand`：18 个测试套件、130 个用例通过。

---

## [v1.3.4] - 2026-04-29

### 变更

- 首页开始采集补齐相机必需权限与相册可选权限申请，相机拒绝时阻止进入拍摄页，相册拒绝时继续原拍摄流程。
- 首页开始采集增加防重复点击保护，避免连续点击造成重复初始化或重复跳转。
- 确认使用照片后尝试保存到手机相册；保存成功不调用业务成功 toast，保存失败仅轻提示“照片未保存到相册，不影响拍摄”。
- 相册权限拒绝导致保存失败时仅记录日志，不逐张弹失败提示。
- 清理权限与相册保存实现，删除权限状态记录、相册权限弹窗、保存成功 toast 绕过逻辑和 backgroundFetch 相关误判处理。

### 验证

- `npm test -- --runInBand`：16 个测试套件、115 个用例通过。

---

## [v1.3.3] - 2026-04-28

### 新增

- 新增 `miniprogram-automator + Jest` 页面自动化测试入口，覆盖首页冒烟、VIN 提示、确认态文案、预览页添加图片异常兜底、车损 AI 启动时机与首批破坏性回归场景。
- 新增 `e2e/specs/current-regression.spec.js`、`e2e/support/automator.js`、`e2e/support/fixtures.js`、`e2e/setup.js` 与 `e2e/jest.config.js`，复用现有 `e2e/` 目录而不另起复杂框架。
- 新增根级 `jest.config.js`，让默认 `npm test` 继续只运行单元测试，避免页面自动化用例误混入普通 Jest。

### 变更

- `test:automator` 改为运行 Jest 版页面自动化；旧版 `node e2e/run-tests.js` 保留为 `test:automator:legacy`。
- `e2e/config.js` 支持通过 `WECHAT_DEVTOOLS_CLI` / `WECHAT_CLI_PATH`、`MINIPROGRAM_PROJECT_PATH`、`MINIPROGRAM_AUTOMATOR_PORT` 与 `E2E_TIMEOUT_MS` 配置微信开发者工具自动化环境。
- 拍照页 VIN 提示与确认态按钮文案改为数据绑定，作为轻量测试标识，不改变 UI 样式、点击事件或业务流程。
- 同步更新测试运行指南、产品/技术/UI/AI 文档与测试用例文档到 `v1.3.3`。

### 验证

- `npm test -- --runInBand`：13 个测试套件、102 个用例通过。
- `npm run test:automator`：1 个测试套件、12 个页面自动化用例通过。

---

## [v1.3.2] - 2026-04-28

### 新增

- 新增 `__tests__/camera-ai-start.test.js`，覆盖车损步骤数据落定后重新尝试启动 AI 检测、VIN 确认切换到车损后重新拉起检测的回归场景。
- 新增 `storage-resume` 回归用例，覆盖预览页点击车损 `+` 返回拍照页时仍保持 `damage + CAPTURING` 的恢复行为。

### 变更

- `pages/camera/camera.wxml` 在 VIN 步骤复用现有顶部引导样式，提示用户对准前挡风玻璃左下角 VIN 码并拍清完整字符。
- 拍照确认态移除“是否清晰？”类问句，按钮文案调整为 `确认使用` / `重新拍摄`，确认与重拍事件保持不变。
- `pages/camera/camera.js` 将 AI 检测恢复统一放到 `setData` 完成后执行，并在相机 `initdone` 后按当前步骤再次尝试恢复检测。

### 修复

- 修复从预览页车损 `+` 进入拍照页时，安全恢复逻辑把 `fromPreview + damage` 误判回预览态，导致拍照页一闪回到预览页的问题。
- 修复首次进入或从 VIN 切换到车损步骤时，相机尚未初始化导致车损识别模型未能再次启动的问题，并通过检测循环 `runId` 避免旧循环继续调度。

---

## [v1.3.1] - 2026-04-28

### 新增

- 新增首页品牌资源 `assets/logo.png`，用于横屏首页左上角固定 logo 展示。

### 变更

- `pages/index/index.wxml` 按横屏样式稿重构首页结构，改为左上品牌 logo、中部标题/副标题、拍摄须知卡片、`开始采集` 按钮和底部权限提示的一屏布局。
- `pages/index/index.wxss` 按样式稿重写横屏单屏样式，容器固定为 `100vw / 100vh` 并禁用纵向滚动，保证首页内容在横屏下一屏展示。
- `package.json` 版本号提升至 `1.3.1`，作为 `1.3.x` 业务需求调整序列的起点。
- 同步更新 `VERSION.md`、`PRDS/PRD.md`、`PRDS/UI.md`、`PRDS/tech.md`、`PRDS/auto-capture-ai.md`、`docs/test-cases.md` 和 `docs/ai-auto-capture-test-cases.md`。

### 修复

- 修复旧首页与横屏样式稿不一致、内容层级偏弱且容易形成竖向长页的问题。

---

## [v1.2.6] - 2026-04-28

### 新增

- 新增 `__tests__/complete-page.test.js`，覆盖完成页三指标展示映射、旧摘要字段回退、返回修改保留缓存和完成退出直接清缓存的既有行为。

### 变更

- `pages/complete/complete.js` 改为读取缓存摘要中的 `vehicleCount`、`damagePhotoCount` 和 `documentPhotoCount`，不再在页面层保留质量提示相关状态。
- `pages/complete/complete.wxml` 保持原始横屏居中成功页结构，只将白色统计框从“车辆数 / 照片数”调整为“车辆数 / 车损照片 / 单证照片”。
- `pages/complete/complete.wxss` 仅做统计卡片的轻微收紧，保持成功图标、主标题、提示文案和底部按钮的原始视觉风格。
- `utils/cache-selectors.js` 在现有 `getCacheSummary(cache)` 上补充 `damagePhotoCount` 与 `documentPhotoCount`，供完成页直接读取。
- 同步更新 `PRDS/PRD.md`、`PRDS/UI.md` 和 `PRDS/tech.md`，让产品、UI 和技术说明与当前完成页轻量实现一致。

### 修复

- 移除完成页中已不再使用的质量提示卡片依赖，避免页面说明与当前实现不一致。

---

## [v1.2.5] - 2026-04-27

### 新增

- 新增统一环境配置模块 `utils/env-config.js`，统一读取 `wx.getAccountInfoSync().miniProgram.envVersion` 并收口 `develop / trial / release` 默认策略。
- 新增 `__tests__/env-config.test.js`，覆盖环境识别、`wx` 缺失安全降级、异常保护，以及 develop / trial / release 默认开关行为。
- 新增 `docs/env-config-design.md`，说明环境配置收口目标、三套环境策略、生产禁用项与后续扩展方式。

### 变更

- `utils/ai-config.js`、`utils/runtime-logger.js`、`utils/quality-config-loader.js`、`app.js` 与 `pages/camera/camera.js` 最小接入统一环境配置模块，减少散落环境判断。
- `release` 环境下的调试日志、调试上传、开发面板和 mock 默认策略统一由 `env-config` 兜底控制。
- 强化 `docs/codex-review-workflow.md`，要求 `review.diff` 与 `review-summary.md` 基于同一份“本轮相关文件列表”生成，并用 diff 文件头判断是否混入旧任务文件。

### 修复

- 修复 `utils/ai-config.js` 中 `DEBUG_LOG.enabled` 在 `release` 环境下可能被误判为开启的问题。
- 修复审查材料工作流中“`review-summary.md` 已切到本轮任务，但 `review.diff` 仍是旧任务内容”的规则漏洞。

---

## [v1.2.4] - 2026-04-26

### 新增

- 新增独立的端上轻质检图片分析模块 `utils/photo-quality.js`，支持拍后单张照片的模糊、偏暗、过曝和预留的过近/过远检测结构。
- 新增 `__tests__/photo-quality.test.js`，覆盖 disabled、清晰图、偏暗、过曝、模糊、多问题叠加、子开关关闭、阈值生效和异常输入安全降级场景。
- 新增 `docs/photo-quality-design.md`，说明轻质检设计目标、检测项、配置控制、性能策略、局限与后续接入方向。

### 变更

- 将轻质检默认 `processing.maxEdge` 调低为 `640`，降低端上像素分析开销。
- 明确 `enabled=false` 的返回语义：`level='good'`、`suggestRetake=false`、`reasons=['disabled']`，避免后续 UI 误判为质量告警。
- 保持轻质检模块独立实现，不接入页面主流程，不改拍后确认流程和现有拍摄顺序。

### 修复

- 修复 `docs/photo-quality-design.md` 的 UTF-8 中文文档内容，清理旧乱码并重新整体重写。

---

## [v1.2.3] - 2026-04-24

### 新增

- 新增端上轻质检三层配置体系，包含默认配置、静态 JSON 配置加载、本地短缓存和统一读取入口。
- 新增轻质检默认配置、远程静态 JSON mock 文件与统一配置设计文档。
- 新增 `quality-config` 相关 Jest 测试，覆盖默认值、merge、sanitize、缓存命中/过期、降级与加载失败不阻断主流程。

### 变更

- 轻质检配置默认 source 策略按微信小程序 `envVersion` 区分：`develop / trial` 默认 `mock`，`release` 默认远程静态 JSON。
- `release` 环境未配置远程地址时改为告警并降级到默认配置，不再静默使用 `mock`。
- `initQualityConfig()` 增加内存配置过期判断，过期后允许重新加载配置。

### 修复

- 修复 `docs/quality-config-design.md` 的 UTF-8 编码与中文显示问题，确保在 VS Code、GitHub、PowerShell 中可正常查看。

---

## [v1.2.2] - 2026-04-24

### 新增

- 新增本地缓存 schema 治理骨架，包括 `schemaVersion`、`migrate`、`validate`、`repair`。
- 新增缓存摘要/选择器模块，统一提供车辆、单证、当前流程和完成页摘要能力。
- 新增安全恢复与短期上下文清理能力，包括 `loadCacheForResume()`、`clearRetakeContext()`、`clearPreviewFlags()`、`clearCompletionContext()`、`clearTransientContext()`。
- 新增异常链路与恢复边界测试，补齐 `workflow-state`、`storage`、`storage-schema`、`cache-selectors` 的故障注入覆盖。
- 新增测试文档与本地测试结果输出，支持将 Jest 摘要、原始输出和覆盖率摘要写入 `reports/test/`。

### 变更

- 将前端流程恢复规则统一为“事实优先，历史状态辅助”，优先依据修复后的缓存和安全恢复结果决定页面状态。
- 将 `complete`、`preview`、`document`、`camera` 的关键缓存读取收口到统一入口，减少页面自行拼装和容错判断。
- 保持现有页面路径、主流程顺序和 UI 主体不变，仅增强缓存入口鲁棒性和恢复边界控制。

### 修复

- 修复 `retakeMode`、`fromPreview`、`completion context` 残留导致的误恢复问题。
- 修复坏 JSON、旧格式 `workflowState`、越界 `currentVehicleIndex`、脏 `vehicles/documents` 等场景下可能触发的恢复崩溃风险。
- 修复缓存结构合法但业务上下文已过期时仍被机械恢复的问题，过期上下文现在会安全回落到 `PREVIEWING` 或 `CAPTURING`。

---

## [v1.2.1] - 2026-04-24

### 新增

- 新增最小前端工作流状态机模块与页面轻量同步 helper。
- 新增 `workflow-state` 相关单元测试，覆盖状态恢复与持久化边界。

### 变更

- 将状态恢复规则调整为“事实优先，历史状态辅助”。
- 收敛页面中的状态写入点，只保留拍摄、确认、预览、重拍、单证、完成等关键业务节点。
- 后续同类小改动继续按 `v1.2.x` 补丁版本递增。

### 修复

- 修复 `DOCUMENTING`、`LOCAL_COMPLETED` 恢复过度依赖缓存状态的问题。
- 修复 `complete` 页面进入时可能主动推进完成态的问题。
- 修复单证拍照/选图在用户尚未成功保存前就提前切换状态的问题。

---

## [v1.2.0] - 2026-04-23

### 新增

- 车损拍摄新增面积方向引导箭头，复用车牌同款蓝白静态箭头方案。
- 车损识别面积过小时提示“请靠近一点”。
- 车损识别面积过大时提示“请稍微远离”。

### 变更

- 车牌检测间隔单独调整为 `800ms`，减少周期性预览抓图对相机预览的影响。
- AI 覆盖层状态更新改为 `setDataIfChanged()`，避免相同状态反复刷新。
- 产品、UI、技术架构、AI 集成文档和 AI 测试用例同步到当时实现。

### 修复

- 优化车牌拍摄时移动摄像头出现的真机掉帧、卡顿感。
- 移除车牌和车损检测器每轮检测的高频日志输出。

---

## [v1.1.0] - 2026-04-22

### 新增

- 接入车牌 AI 自动拍照能力。
- 接入车损 AI 自动拍照能力，支持 `SEEK / HOLD / SHOOT` 稳定流。
- 支持 ONNX 模型下载到 `wx.env.USER_DATA_PATH` 后本地复用。
- 预览页照片增加拍摄来源标签，可区分 AI 自动拍摄与手动拍摄。
- 新增 `versions/v1.1.0/` 本地封板归档目录。

### 变更

- 车牌距离提示箭头改为“静态帧 + JS 定时切换”方案，替代覆盖层复杂动效。
- 车损拍摄左侧信息区精简。
- 单证资料继续以预览页底部区域为主入口，独立 `document` 页面保留为备用。

### 修复

- 修复车损状态提示偶发乱码问题。
- 修复车牌距离提示在真机上频闪不稳定、偶发中断的问题。
- 修复文档与代码长期不一致的问题。

---

## [v1.0.0] - 2026-04-01

### 新增

- 首页、拍照页、预览页、完成页主流程落地。
- 支持车牌、VIN、车损照片采集。
- 支持多车辆与单证资料拍照/相册上传。
- 支持照片预览、删除、重拍。
- 支持本地缓存与照片压缩。

---

## 版本历史

| 版本 | 日期 | 类型 | 说明 |
| --- | --- | --- | --- |
| v1.4.6 | 2026-05-27 | 辅助拍照后端提交闭环版 | 接入真实 `uploadPhoto` 逐张上传、`complete` 完成提交、本地 mock 后端和失败重试恢复 |
| v1.4.5 | 2026-05-25 | 辅助拍照上传准备版 | 完成采集后展示预览页上传遮罩，落地本地 `uploadSession` 队列和失败重试 mock |
| v1.4.4 | 2026-05-25 | 辅助拍照预览单证规则适配版 | 预览页行驶证槽位对齐后端 `uploadItems/photoType`，补齐电子行驶证独立类型和车辆锁定 |
| v1.4.2 | 2026-05-22 | 辅助拍照后端初始化接入版 | ticket 初始化、后端车辆控制、相机多车辆流转、错误日志上传和接口文档同步 |
| v1.4.1 | 2026-05-11 | nova13 横屏相机适配修复版 | 高分辨率横屏 UI 缩放、实时帧坐标映射和低频 AI 几何诊断日志 |
| v1.4.0 | 2026-05-10 | 图片本机保存模式调整版 | 相册保存后移到完成采集最终确认，支持保存记录、增量保存和完成页结果提示 |
| v1.3.8 | 2026-05-09 | 模型加载修复版 | 创建推理 session 前记录推理环境，并统一使用 `precisionLevel=0`、禁用 NPU 与量化 |
| v1.3.7 | 2026-05-08 | AI 诊断与横屏兼容性优化版 | 收敛 We分析实时日志，补充推理 session CPU-safe 重试，修复部分机型横屏相机区缩小 |
| v1.3.6 | 2026-05-02 | 业务环境切换版 | 新增 appEnv、隐藏环境切换入口、模型地址安全校验与模型缓存隔离 |
| v1.3.5 | 2026-04-30 | 行驶证资料版 | 每辆车行驶证上传、缓存兼容、提交风险提示与预览页交互补齐 |
| v1.3.4 | 2026-04-29 | 权限瘦身版 | 权限申请与相册保存瘦身，保留失败轻提示和开始采集防重复点击 |
| v1.3.3 | 2026-04-28 | 测试增强版 | 补齐微信开发者工具 miniprogram-automator + Jest 自动化测试入口，覆盖当前首批回归与破坏性测试场景 |
| v1.3.2 | 2026-04-28 | 拍照修复版 | 修复预览页车损补拍一闪回预览页、车损 AI 首次启动时机，并同步 VIN 引导与确认态文案 |
| v1.3.1 | 2026-04-28 | 业务调整版 | 首页按横屏样式稿重构为单屏品牌入口，补齐 logo 资源与版本/PRDS/测试文档同步 |
| v1.2.6 | 2026-04-28 | 封板补丁版 | 完成页轻量收口，统计卡片改为车辆数/车损照片/单证照片，并同步摘要字段、测试与 PRDS 文档 |
| v1.2.5 | 2026-04-27 | 封板补丁版 | 环境配置与调试开关收口，补齐 env-config 测试与审查工作流规则 |
| v1.2.4 | 2026-04-26 | 封板补丁版 | 端上轻质检拍后分析模块落地，补齐测试、设计文档与 disabled 语义修正 |
| v1.2.3 | 2026-04-24 | 封板补丁版 | 端上轻质检三层配置体系落地，补齐环境策略、缓存降级、测试与设计文档 |
| v1.2.2 | 2026-04-24 | 封板补丁版 | workflow-state 收敛、本地缓存治理三步补齐、异常链路测试与测试文档落地 |
| v1.2.1 | 2026-04-24 | 补丁版 | 前端状态机骨架接入、恢复收紧与单证流程修正 |
| v1.2.0 | 2026-04-23 | 封板版 | 车损距离引导与车牌真机流畅度优化 |
| v1.1.0 | 2026-04-22 | 封板归档版 | AI 自动拍照增强与文档对齐 |
| v1.0.0 | 2026-04-01 | 正式版 | 首个正式发布版本 |

---

*最后更新：2026-05-27*
