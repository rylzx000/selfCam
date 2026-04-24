# selfCam AI 自动拍照功能 - 测试用例

**生成日期**: 2026-04-24
**代码基线**: v1.2.1
**测试类型**: E2E 用户流程测试 / 集成测试

---

## 功能概述

本测试文档覆盖 selfCam 小程序引入前端 AI 自动拍照能力后的核心验证场景，包括车牌自动拍照、车损自动拍照、手动兜底、状态提示、结果保存、预览页反馈及模型加载失败降级等。

---

## 测试范围

### 覆盖功能
- ✅ 车牌自动拍照
- ✅ 车损自动拍照
- ✅ 自动拍照与手动拍照共存
- ✅ 锁定反馈与状态提示
- ✅ 自动拍照冷却机制
- ✅ 模型首次加载与失败降级
- ✅ 拍摄来源字段保存
- ✅ 预览页拍摄来源标记
- ✅ 自动拍照后的重拍流程
- ✅ 横屏拍照流程兼容

### 不覆盖
- ❌ 模型训练效果评估
- ❌ ONNX 模型精度算法验证
- ❌ 服务端接口联调（本方案无后端）
- ❌ 非微信小程序环境兼容性

### 假设条件
- 用户已授权相机权限
- 小程序运行在支持相机组件的微信环境
- AI 模型资源可被正常加载（首次使用需可访问模型下载地址）
- 现有拍照、压缩、预览、重拍主流程保持可用

---

## 测试用例

---

## 一、车牌自动拍照

### TC-AI-001: 车牌进入有效区域后自动拍照成功 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:auto-capture, @component:camera, @feature:plate

**Preconditions**:
- 用户进入拍照页
- 当前步骤为车牌拍摄
- AI 模型已完成加载

**Steps**:
1. 将车牌缓慢移动到辅助框内
2. 保持设备稳定
3. 观察页面提示与拍照行为

**Expected Result**:
- 页面先显示“正在识别目标”或类似文案
- 识别到车牌后显示“已识别目标”或类似文案
- 稳定后显示“请保持稳定”或“已稳定，即将拍摄”
- 系统自动触发一次拍照
- 自动拍照后进入原有车牌确认或识别流程

---

### TC-AI-002: 车牌未进入辅助框时不得自动拍照 [ ]

**Priority**: Critical
**Type**: Edge Case
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:auto-capture, @component:camera, @feature:plate

**Preconditions**:
- 当前步骤为车牌拍摄
- AI 模型已加载

**Steps**:
1. 将车牌保持在辅助框外侧
2. 持续观察 5 秒以上

**Expected Result**:
- 页面可以显示识别状态
- 不触发自动拍照
- 手动拍照按钮始终可用

---

### TC-AI-003: 车牌识别到但画面抖动时不得自动拍照 [ ]

**Priority**: High
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:plate

**Preconditions**:
- 当前步骤为车牌拍摄

**Steps**:
1. 将车牌放入辅助框内
2. 在识别过程中持续轻微晃动手机
3. 观察自动拍照行为

**Expected Result**:
- 页面可进入识别状态
- 若未满足稳定帧条件，不应触发自动拍照
- 页面持续提示用户保持稳定

---

### TC-AI-004: 车牌自动拍照后进入冷却期，禁止连续连拍 [ ]

**Priority**: High
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:plate

**Preconditions**:
- 当前步骤为车牌拍摄
- 自动拍照已触发一次

**Steps**:
1. 保持车牌仍处于辅助框内
2. 观察自动拍照后的短时间行为

**Expected Result**:
- 自动拍照完成后进入冷却状态
- 同一目标不会立刻再次触发自动拍照
- 页面不会出现连续多次拍照

---

## 二、车损自动拍照

### TC-AI-005: 车损位于中心有效区域时自动拍照成功 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:auto-capture, @component:camera, @feature:damage

**Preconditions**:
- 当前步骤为车损拍摄
- AI 车损模型已加载

**Steps**:
1. 将明显车损区域对准中心辅助框
2. 保持设备稳定
3. 观察页面提示和拍照行为

**Expected Result**:
- 页面提示进入识别和锁定状态
- 满足条件后自动拍照
- 拍照后车损照片计数正确增加

---

### TC-AI-006: 车损距离过远时不得自动拍照 [ ]

**Priority**: High
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:damage

**Preconditions**:
- 当前步骤为车损拍摄

**Steps**:
1. 将车损区域保持在画面中但距离较远
2. 观察页面行为

**Expected Result**:
- 可以检测到目标或提示识别中
- 若面积未达到阈值，不触发自动拍照
- 底部状态提示为 `请靠近一点`
- 车损框上方显示向前的静态蓝白箭头
- 手动拍照按钮可正常使用

---

### TC-AI-007: 车损距离过近时不得自动拍照 [ ]

**Priority**: High
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:damage

**Preconditions**:
- 当前步骤为车损拍摄

**Steps**:
1. 将镜头过于贴近车损位置
2. 保持 3 秒以上

**Expected Result**:
- 若面积超过合理阈值，不触发自动拍照
- 底部状态提示为 `请稍微远离`
- 车损框上方显示向后的静态蓝白箭头
- 页面可继续提示调整位置

---

### TC-AI-008: 车损识别不稳定时不得误触发自动拍照 [ ]

**Priority**: Critical
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:damage

**Preconditions**:
- 当前步骤为车损拍摄

**Steps**:
1. 将复杂背景或反光区域置于辅助框附近
2. 观察检测状态

**Expected Result**:
- 若识别框不稳定，不得直接自动拍照
- 页面优先保持等待或提示状态

---

### TC-AI-008A: 车损连续识别后进入保持稳定阶段 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:auto-capture, @component:camera, @feature:damage, @feature:stability-flow

**Preconditions**:
- 当前步骤为车损拍摄
- 前端调试信息已开启

**Steps**:
1. 将车损移入拍照框内
2. 保持目标基本位于框中心
3. 观察调试信息和底部状态提示

**Expected Result**:
- 页面先出现“请对准车损处”或“已识别到车损”
- 连续识别达到阈值后，阶段进入 `HOLD`
- 页面提示切换为“请保持稳定”
- 此时不应立刻自动拍照

---

### TC-AI-008B: 车损保持稳定达到阈值后自动拍照 [ ]

**Priority**: High
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:damage, @feature:stability-flow

**Preconditions**:
- 已进入 `HOLD` 阶段
- 调试信息可见

**Steps**:
1. 继续保持设备稳定
2. 观察调试信息中的 `hold` 计数与 `phase`
3. 观察是否自动拍照

**Expected Result**:
- `hold` 计数逐步增长
- 阶段从 `HOLD` 进入 `SHOOT`
- 页面提示变为“已稳定，即将拍摄”
- 系统自动拍照，不需要用户再次点击按钮

---

### TC-AI-008C: 车损短暂丢失时不应立即重置 [ ]

**Priority**: Critical
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:auto-capture, @component:camera, @feature:damage, @feature:stability-flow

**Preconditions**:
- 已进入 `HOLD` 阶段
- 前端调试信息已开启

**Steps**:
1. 在保持稳定阶段将目标短暂移出框外
2. 在 600ms 内将目标移回框内
3. 观察状态与是否被完全重置

**Expected Result**:
- 页面不应立刻回退到完整初始状态
- 若目标迅速回到框内，应继续当前识别流程或快速恢复到 `HOLD`
- 不应因一次轻微丢帧立刻误触发自动拍照

---

### TC-AI-008D: 车损持续丢失后回退到初始识别状态 [ ]

**Priority**: Medium
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:damage, @feature:stability-flow

**Preconditions**:
- 当前步骤为车损拍摄
- 目标曾被识别到并进入过 `HOLD`

**Steps**:
1. 将目标持续移出框外并保持超过 1.2 秒
2. 观察底部状态文案和调试阶段

**Expected Result**:
- 阶段回退到 `SEEK`
- 页面提示恢复为“请对准车损处”
- 不触发自动拍照

---

### TC-AI-008E: 开发态调试信息与车损稳定流程一致 [ ]

**Priority**: Medium
**Type**: Regression
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:debug, @feature:damage, @component:camera

**Preconditions**:
- 当前步骤为车损拍摄
- 开发调试信息已显示

**Steps**:
1. 观察顶部调试信息
2. 将目标从未识别逐步移动到稳定可拍状态
3. 观察 `phase / seen / hold / q / s / c / area`

**Expected Result**:
- 调试信息持续可见
- 阶段值能正确反映 `SEEK / HOLD / SHOOT`
- 页面提示与阶段切换保持一致
- 调试信息中不再依赖旧版“倍率/远离/靠近”表述

---

## 三、自动拍照与手动拍照共存

### TC-AI-009: 自动识别失败时用户可手动拍照 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:auto-capture, @component:camera, @feature:fallback

**Preconditions**:
- 拍照页可正常显示
- 当前目标难以被稳定识别

**Steps**:
1. 等待一段时间，确保未触发自动拍照
2. 点击手动拍照按钮

**Expected Result**:
- 手动拍照立即生效
- 不依赖 AI 成功与否
- 后续流程正常进入确认/保存链路

---

### TC-AI-010: 自动拍照锁定过程中用户点击手动拍照仍可成功 [ ]

**Priority**: High
**Type**: Edge Case
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:fallback

**Preconditions**:
- 页面已进入“请保持稳定”或“已稳定，即将拍摄”状态

**Steps**:
1. 在自动拍照真正触发前点击手动拍照按钮

**Expected Result**:
- 页面只执行一次拍照
- 不发生自动与手动双重触发
- 保存结果不重复

---

## 四、状态提示与锁定反馈

### TC-AI-011: 拍照页状态提示按顺序变化 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:ui

**Preconditions**:
- 当前步骤为车牌或车损拍摄

**Steps**:
1. 观察目标从未识别到识别成功再到锁定的整个过程

**Expected Result**:
- 状态提示语义清晰
- 至少包含识别中、稳定中、即将拍摄、拍摄完成等关键阶段
- 不出现状态跳变混乱或重复闪烁严重问题

---

### TC-AI-012: 自动拍照前存在明显锁定反馈 [ ]

**Priority**: High
**Type**: UX
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:auto-capture, @component:camera, @feature:ui

**Preconditions**:
- 页面已识别到目标

**Steps**:
1. 将目标稳定放置在有效区域内
2. 观察自动拍照前的 UI 反馈

**Expected Result**:
- 自动拍照前应有明显锁定反馈
- 不应表现为完全无提示地瞬间拍摄

---

## 五、模型加载与失败降级

### TC-AI-013: 首次进入拍照页时模型加载成功 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:model, @component:camera, @feature:auto-capture

**Preconditions**:
- 首次进入拍照页
- 设备环境满足模型加载条件
- 网络连接正常，模型下载地址可访问

**Steps**:
1. 进入拍照页
2. 等待模型下载与初始化

**Expected Result**:
- 页面出现合理的初始化提示或等待状态
- 首次使用时模型会下载到本地缓存目录
- 模型加载完成后可进入自动拍照识别状态
- 不影响相机正常预览

---

### TC-AI-014: 模型加载失败时自动降级为手动拍照 [ ]

**Priority**: Critical
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:model, @component:camera, @feature:fallback

**Preconditions**:
- 模型加载失败或主动制造加载失败环境
- 网络不可用或模型下载地址不可访问

**Steps**:
1. 进入拍照页
2. 观察页面状态
3. 尝试使用手动拍照

**Expected Result**:
- 页面不会崩溃
- 自动拍照能力可以失效，但手动拍照仍可用
- 主流程不被阻断

---

### TC-AI-021: 已缓存模型时再次进入拍照页不重复下载 [ ]

**Priority**: High
**Type**: Regression
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:model, @component:camera, @feature:cache

**Preconditions**:
- 设备本地已存在可用模型缓存

**Steps**:
1. 首次进入拍照页并成功完成模型下载
2. 退出拍照页
3. 再次进入拍照页

**Expected Result**:
- 页面优先使用本地缓存模型
- 不重复下载同一模型文件
- AI 初始化时间明显短于首次进入

---

## 六、结果保存与预览页反馈

### TC-AI-015: 自动拍照结果保存来源字段正确 [ ]

**Priority**: High
**Type**: Integration
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:storage, @feature:auto-capture, @component:camera

**Preconditions**:
- 自动拍照成功一次

**Steps**:
1. 完成自动拍照流程
2. 进入预览页或检查缓存数据

**Expected Result**:
- 照片记录中存在自动拍摄来源标记
- 自动拍摄与手动拍摄可区分

---

### TC-AI-016: 手动拍照结果保存来源字段正确 [ ]

**Priority**: High
**Type**: Integration
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:storage, @feature:fallback, @component:camera

**Preconditions**:
- 用户通过手动按钮拍照成功

**Steps**:
1. 手动拍摄一张车牌或车损照片
2. 进入预览页或检查缓存数据

**Expected Result**:
- 照片记录中存在手动拍摄来源标记
- 与自动拍摄记录可区分

---

### TC-AI-017: 预览页正确展示自动拍摄来源 [ ]

**Priority**: Medium
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @component:preview, @feature:auto-capture

**Preconditions**:
- 已存在至少一张自动拍摄照片

**Steps**:
1. 进入预览页
2. 查看对应照片缩略图或详情信息

**Expected Result**:
- 页面能识别并展示该照片来源于自动拍摄
- 展示方式简洁，不影响原有预览操作

---

### TC-AI-018: 自动拍摄照片可正常重拍并覆盖 [ ]

**Priority**: High
**Type**: Regression
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @feature:retake, @feature:auto-capture

**Preconditions**:
- 已存在一张自动拍摄照片

**Steps**:
1. 在预览页选择该照片
2. 执行重拍操作
3. 完成重新拍摄并返回预览页

**Expected Result**:
- 原照片被替换
- 预览页显示新照片
- 自动拍摄结果不会锁死重拍流程

---

## 七、横屏流程兼容与性能

### TC-AI-019: 横屏拍照页中自动拍照不影响基础操作 [ ]

**Priority**: High
**Type**: Compatibility
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:landscape, @component:camera, @feature:auto-capture

**Preconditions**:
- 横屏页面正常展示

**Steps**:
1. 进入横屏拍照页
2. 观察相机预览、辅助框、提示文案与按钮布局
3. 触发自动拍照或手动拍照

**Expected Result**:
- 自动拍照功能不破坏横屏布局
- 按钮、辅助框、提示区域位置正确
- 页面无明显遮挡或错位

---

### TC-AI-020: 自动拍照开启后页面无明显卡顿和连续误触发 [ ]

**Priority**: High
**Type**: Performance
**Status**: [ ] Not Run
**Suite**: Full
**Tags**: @feature:performance, @component:camera, @feature:auto-capture

**Preconditions**:
- 自动拍照能力已开启

**Steps**:
1. 连续进行车牌、VIN、车损拍摄流程
2. 观察页面流畅度与自动拍照稳定性

**Expected Result**:
- 相机预览保持基本流畅
- 不出现明显卡死、白屏或频繁重复拍照
- 自动拍照和手动拍照可正常协同工作

---

## 测试数据要求

- 标准机动车车牌样本
- 新能源车牌样本
- 不同角度车牌样本
- 不同距离车损样本
- 轻微损伤与明显损伤样本
- 复杂背景与反光场景样本
- 支持自动拍照与手动拍照的缓存数据样本

---

## 风险与备注

- 车损自动拍照比车牌自动拍照更容易出现误识别，需要重点真机验证
- 模型首次加载耗时、机型差异、相机帧率会显著影响体验
- 自动拍照前的锁定反馈属于高优先级 UX 验证点
- 所有自动拍照场景都必须验证手动兜底是否仍然可用
- 开发者工具结果仅供参考，最终以真机测试为准
