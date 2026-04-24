# selfCam 异常链路测试清单

## 说明

- 范围：`workflow-state`、`storage`、`storage-schema`、`cache-selectors` 以及恢复相关页面流转。
- 状态标记：
  - `[P]` 已通过自动化
  - `[ ]` 仅手工，尚未自动化执行
  - `[B]` 受环境限制阻塞
- 本文优先覆盖“前端地基改造”后的异常恢复与缓存污染风险，不覆盖后端接口与真实提交流程。

---

### TC-AF-001: 无缓存时返回安全结果 [P]

**自动化 / 手工**：自动化  
**前置条件**：本地不存在 `car_damage_photos_cache`  
**操作步骤**：
1. 调用 `storage.loadCache()`
2. 调用 `storage.loadCacheForResume()`

**预期结果**：
- `loadCache()` 返回 `null`
- `loadCacheForResume()` 返回 `null`
- 页面入口不会因为空缓存直接崩溃

**关联模块**：storage  
**备注**：对应单测 `storage.test.js`、`storage-resume.test.js`

---

### TC-AF-002: 坏 JSON 缓存自动降级为空壳 [P]

**自动化 / 手工**：自动化  
**前置条件**：将本地缓存伪造为非法 JSON  
**操作步骤**：
1. 注入坏 JSON 到本地缓存
2. 调用 `storage.loadCache()`

**预期结果**：
- 返回安全空缓存
- `schemaVersion`、`currentStep`、`workflowState` 等基础字段存在
- 页面不会因为 `JSON.parse` 失败报错

**关联模块**：storage、storage-schema  
**备注**：对应单测 `storage.test.js`

---

### TC-AF-003: 旧版本缓存自动迁移并补齐字段 [P]

**自动化 / 手工**：自动化  
**前置条件**：准备无 `schemaVersion`、旧格式 `workflowState` 的缓存  
**操作步骤**：
1. 注入旧缓存
2. 调用 `storage.loadCache()`

**预期结果**：
- 返回的新缓存带 `schemaVersion`
- 旧字符串格式 `workflowState` 被迁移为对象
- 缺失或异常字段被修复为安全值

**关联模块**：storage、storage-schema  
**备注**：对应单测 `storage.test.js`

---

### TC-AF-004: currentVehicleIndex 越界自动修正 [P]

**自动化 / 手工**：自动化  
**前置条件**：缓存中 `currentVehicleIndex` 大于车辆数组长度  
**操作步骤**：
1. 注入越界缓存
2. 调用 `storage.loadCache()` 与 `selectors.getVehicleSummary()`

**预期结果**：
- `currentVehicleIndex` 被修正到合法范围
- 预览摘要和当前车辆摘要仍能稳定返回

**关联模块**：storage、storage-schema、cache-selectors  
**备注**：对应单测 `storage.test.js`、`cache-selectors.edge.test.js`

---

### TC-AF-005: 非法状态迁移不会污染流程状态 [P]

**自动化 / 手工**：自动化  
**前置条件**：缓存处于 `CAPTURING`  
**操作步骤**：
1. 调用 `workflow.transitionTo('NOT_A_STATE')`
2. 调用 `workflow.transitionTo('LOCAL_COMPLETED')`

**预期结果**：
- 返回失败结果，不抛异常
- 本地 `workflowState` 不被污染
- 流程仍停留在原有合法状态

**关联模块**：workflow-state  
**备注**：对应单测 `workflow-recovery.test.js`

---

### TC-AF-006: PREVIEWING 可恢复，但以事实为准 [P]

**自动化 / 手工**：自动化  
**前置条件**：缓存 `currentStep=preview`，但历史 `workflowState=IDLE`  
**操作步骤**：
1. 调用 `workflow.inferStateFromCache(cache)`

**预期结果**：
- 恢复结果为 `PREVIEWING`
- 不会被历史辅助状态错误拉回 `IDLE`

**关联模块**：workflow-state  
**备注**：对应单测 `workflow-recovery.test.js`

---

### TC-AF-007: DOCUMENTING / LOCAL_COMPLETED 不应被过度恢复 [P]

**自动化 / 手工**：自动化  
**前置条件**：
- 场景 A：`DOCUMENTING` checkpoint 过期
- 场景 B：`LOCAL_COMPLETED` checkpoint 过期

**操作步骤**：
1. 分别构造过期缓存
2. 调用 `workflow.inferStateFromCache()` 或 `storage.loadCacheForResume()`

**预期结果**：
- 过期 `DOCUMENTING` 不继续深度恢复
- 过期 `LOCAL_COMPLETED` 回落到 `PREVIEWING`
- 用户不会被卡在过时业务态

**关联模块**：workflow-state、storage-schema、storage  
**备注**：对应单测 `workflow-recovery.test.js`、`storage.test.js`

---

### TC-AF-008: 重拍发起后长时间挂起，恢复时自动丢弃短期上下文 [P]

**自动化 / 手工**：自动化  
**前置条件**：缓存中 `retakeMode.enabled=true` 且上下文已超时  
**操作步骤**：
1. 用 fake timers 模拟长时间挂起
2. 调用 `schema.resolveSafeResumeCache()` 或 `storage.loadCacheForResume()`

**预期结果**：
- `retakeMode` 被清理
- 恢复结果回到 `PREVIEWING`
- 不会误入错误重拍流程

**关联模块**：storage-schema、storage  
**备注**：对应单测 `storage-resume.test.js`

---

### TC-AF-009: preview 返回 camera 后中断，再进入时清理 fromPreview 残留 [P]

**自动化 / 手工**：自动化  
**前置条件**：缓存 `fromPreview=true` 且上下文已超时  
**操作步骤**：
1. 用 fake timers 模拟超时
2. 调用 `storage.loadCacheForResume()`

**预期结果**：
- `fromPreview` 被自动清理
- 若当前仍是拍摄步骤，则回到安全的 `CAPTURING`
- 不会把跳转语义残留到下一次恢复

**关联模块**：storage-schema、storage、page flow  
**备注**：对应单测 `storage.test.js`、`storage-resume.test.js`

---

### TC-AF-010: complete 返回修改前清理 completion context [ ]

**自动化 / 手工**：手工  
**前置条件**：已进入 `complete` 页面，缓存存在完成态  
**操作步骤**：
1. 点击“返回修改”
2. 跳回 `preview`
3. 再次强退并重进小程序

**预期结果**：
- 返回修改时先清理 completion context
- 重进后不应再次误进 `complete`
- 应落到 `preview` 或更安全的恢复态

**关联模块**：storage、storage-schema、page flow  
**备注**：页面行为已接清理 helper，但本用例仍建议上线前手工复测

---

### TC-AF-011: 选择器在缺字段和脏结构下仍返回稳定摘要 [P]

**自动化 / 手工**：自动化  
**前置条件**：构造缺少 `documents`、非法 `currentStep`、异常 `workflowState` 的缓存  
**操作步骤**：
1. 调用 `getCacheSummary()`
2. 调用 `getCurrentFlowContext()`
3. 调用 `getDocumentSummary()`

**预期结果**：
- 不抛异常
- 统计字段返回安全默认值
- `currentStep`、`workflowState`、`currentVehicleIndex` 稳定可读

**关联模块**：cache-selectors  
**备注**：对应单测 `cache-selectors.edge.test.js`

---

### TC-AF-012: retake 上下文无效时，current flow context 不漂移 [P]

**自动化 / 手工**：自动化  
**前置条件**：`retakeMode.enabled=true`，但 `damageIndex` 或车辆索引无效  
**操作步骤**：
1. 调用 `selectors.getCurrentFlowContext()`

**预期结果**：
- `hasRetakeContext=false`
- 当前流程仍锚定在 `currentVehicleIndex/currentStep`
- 不会被无效重拍上下文劫持

**关联模块**：cache-selectors  
**备注**：对应单测 `cache-selectors.edge.test.js`

---

### TC-AF-013: 高频重复操作后摘要和恢复边界仍稳定 [P]

**自动化 / 手工**：自动化  
**前置条件**：单车、多张车损、单证混合缓存  
**操作步骤**：
1. 连续调用车辆摘要、文档摘要、完成页摘要
2. 对同一缓存重复读取

**预期结果**：
- 统计结果一致
- 输入缓存对象不被 selector 意外修改
- 剩余可上传数量、照片总数等边界值稳定

**关联模块**：cache-selectors  
**备注**：对应单测 `cache-selectors.edge.test.js`

---

### TC-AF-014: camera → preview → retake → document → complete 主链路回归 [B]

**自动化 / 手工**：页面自动化 / 手工  
**前置条件**：
- 本机已安装微信开发者工具
- 已开启服务端口
- `e2e/config.js` 中的 CLI 路径可用

**操作步骤**：
1. 运行页面自动化脚本或按链路手工操作
2. 观察跨页面缓存恢复与摘要渲染

**预期结果**：
- 主流程可走通
- 重拍、资料上传、完成页统计不回归
- 中断恢复时不进入错误业务态

**关联模块**：page flow、storage、cache-selectors  
**备注**：仓库已有 automator 基础，但本次执行环境未纳入自动化运行范围，需手工或专用设备环境复测

---

### TC-AF-015: 用户确认本地完成后退出，缓存应被清空 [ ]

**自动化 / 手工**：手工  
**前置条件**：进入 `complete` 页面，缓存中已有完整拍摄数据  
**操作步骤**：
1. 点击“退出”
2. 重新启动小程序

**预期结果**：
- 执行 `storage.clearCache()`
- 重新进入时不恢复旧流程
- 首页作为新的起点展示

**关联模块**：storage、page flow  
**备注**：与平台退出行为耦合，建议真机或开发者工具手工验证
