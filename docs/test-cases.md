# selfCam 车辆定损拍摄小程序 - 测试用例

**生成日期**: 2026-04-24
**代码基线**: v1.2.3
**测试类型**: E2E 用户流程测试

---

## 功能概述

车辆定损拍摄小程序，用于保险公司定损员现场拍摄车辆照片，包括车牌、VIN码、车损照片，支持多车辆（标的车+三者车）和单证资料管理。

---

## 测试范围

### 覆盖功能
- ✅ 首页入口
- ✅ 拍照流程（车牌 → VIN码 → 车损）
- ⏸️ 车牌/VIN 文本识别（暂未纳入当前版本）
- ✅ 识别结果确认与修改
- ✅ 照片确认与重拍
- ✅ 预览页管理（查看、重拍、删除）
- ✅ 多车辆处理（标的车 + 三者车）
- ✅ 单证资料管理
- ✅ 提交流程
- ✅ 完成页

### 不覆盖
- ❌ 微信授权流程（依赖真机环境）
- ❌ 图片压缩算法（单元测试覆盖）
- ❌ 网络异常处理（无服务端交互）

### 假设条件
- 用户已授权相机权限
- 用户已授权相册权限
- 小程序运行在微信开发者工具或真机环境

---

## 测试用例

---

## 一、首页模块 (index)

### TC-001: 启动小程序进入首页 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:entry, @component:index

**Preconditions**:
- 微信开发者工具或真机已就绪
- 小程序已编译

**Steps**:
1. 打开小程序

**Expected Result**:
- 显示首页
- 页面标题正确
- 显示"开始拍摄"按钮
- 清除之前的缓存数据

---

### TC-002: 点击开始拍摄进入拍照页 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:entry, @component:index

**Preconditions**:
- 用户在首页

**Steps**:
1. 点击"开始拍摄"按钮

**Expected Result**:
- 跳转到拍照页 (`/pages/camera/camera`)
- 当前步骤为"车牌拍摄"
- 显示车牌引导框
- 提示文字："将车牌号放入框内"
- 车辆类型显示为"标的车"

---

## 二、拍照模块 (camera)

### TC-003: 拍摄车牌照片 - 成功确认 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 当前步骤为"车牌拍摄"
- 相机权限已授权

**Steps**:
1. 对准车牌
2. 点击拍照按钮
3. 等待处理完成
4. 点击"确认"按钮

**Expected Result**:
- 拍照后显示确认弹窗："车牌照片清晰吗？"
- 点击确认后弹窗关闭
- 自动切换到 VIN 码拍摄步骤
- 提示文字变为："VIN码位于驾驶舱挡风玻璃角落"

---

### TC-004: 拍摄车牌照片 - 重拍 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 当前步骤为"车牌拍摄"

**Steps**:
1. 点击拍照按钮
2. 在确认弹窗中点击"重拍"按钮

**Expected Result**:
- 弹窗关闭
- 停留在车牌拍摄步骤
- 可以重新拍照

---

### TC-005: 拍摄 VIN 码照片 - 成功确认 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 当前步骤为"VIN码拍摄"
- 车牌照片已拍摄完成

**Steps**:
1. 对准 VIN 码位置
2. 点击拍照按钮
3. 点击"确认"按钮

**Expected Result**:
- 显示确认弹窗："VIN码照片清晰吗？"
- 确认后切换到车损拍摄步骤
- 顶部提示文字变为："请对准车损处"
- 车损计数器显示为 0

---

### TC-006: 拍摄 VIN 码照片 - 重拍 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 当前步骤为"VIN码拍摄"

**Steps**:
1. 点击拍照按钮
2. 在确认弹窗中点击"重拍"按钮

**Expected Result**:
- 弹窗关闭
- 停留在 VIN 码拍摄步骤
- 可以重新拍照

---

### TC-007: 拍摄第一张车损照片 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 当前步骤为"车损拍摄"
- 车牌和 VIN 码照片已完成

**Steps**:
1. 对准车损处
2. 点击拍照按钮
3. 点击"确认"按钮

**Expected Result**:
- 显示确认弹窗："车损照片清晰吗？"
- 确认后弹窗关闭
- 车损计数器更新为 1
- 继续停留在车损拍摄步骤

---

### TC-008: 拍摄多张车损照片（2-4张） [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 当前步骤为"车损拍摄"
- 已拍摄 1 张车损照片

**Steps**:
1. 继续拍摄第 2 张车损照片
2. 确认
3. 继续拍摄第 3 张车损照片
4. 确认
5. 继续拍摄第 4 张车损照片
6. 确认

**Expected Result**:
- 每次确认后车损计数器正确更新
- 显示当前车损数量（2、3、4）
- 继续停留在车损拍摄步骤

---

### TC-009: 拍摄车损照片达到上限（5张）自动跳转 [ ]

**Priority**: Critical
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 已拍摄 4 张车损照片

**Steps**:
1. 拍摄第 5 张车损照片
2. 点击"确认"按钮

**Expected Result**:
- 确认后自动跳转到预览页
- 预览页显示所有已拍摄照片
- 车损数量为 5 张

---

### TC-010: 车损照片未达上限手动点击完成 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 已拍摄 2 张车损照片

**Steps**:
1. 点击"完成拍摄"或"查看已拍"按钮

**Expected Result**:
- 跳转到预览页
- 预览页显示所有已拍摄照片
- 车损数量为 2 张

---

### TC-011: 拍照失败处理 [ ]

**Priority**: High
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页

**Steps**:
1. 模拟拍照失败场景（如相机异常）

**Expected Result**:
- 显示 Toast 提示："拍照失败"
- 停留在当前步骤
- 可以重新尝试拍照

---

### TC-012: 相机权限未授权 [ ]

**Priority**: High
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera, @integration:permission

**Preconditions**:
- 用户未授权相机权限

**Steps**:
1. 进入拍照页
2. 触发相机错误

**Expected Result**:
- 显示授权提示弹窗
- 提示内容："请授权使用摄像头"
- 点击确定后返回上一页或首页

---

### TC-013: 无缓存数据进入拍照页 [ ]

**Priority**: High
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 缓存数据被清除

**Steps**:
1. 直接访问拍照页（无缓存）

**Expected Result**:
- 自动跳转回首页
- 首页重新初始化流程

---

## 四、预览模块 (preview)

### TC-014: 进入预览页显示所有照片 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:preview, @component:preview

**Preconditions**:
- 标的车已完成拍摄（车牌 + VIN + 2张车损）

**Steps**:
1. 从拍照页跳转到预览页

**Expected Result**:
- 显示所有已拍摄照片的缩略图
- 显示车辆分组（标的车）
- 显示照片标签（车牌、VIN码、车损1、车损2）
- 显示总照片数量：4
- 进度条正确显示

---

### TC-015: 点击照片进入全屏预览 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @component:preview

**Preconditions**:
- 用户在预览页
- 有已拍摄的照片

**Steps**:
1. 点击任意一张照片

**Expected Result**:
- 进入全屏预览模式
- 显示高清照片
- 底部显示操作按钮（重拍、删除）
- 可左右滑动切换照片

---

### TC-016: 全屏预览滑动切换照片 [ ]

**Priority**: Medium
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @component:preview

**Preconditions**:
- 用户在全屏预览模式
- 有多张照片

**Steps**:
1. 左滑切换到下一张
2. 右滑切换到上一张

**Expected Result**:
- 照片切换流畅
- 标签信息同步更新
- 当前照片索引正确

---

### TC-017: 重拍照片 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:preview, @component:camera

**Preconditions**:
- 用户在全屏预览模式
- 当前显示车牌照片

**Steps**:
1. 点击"重拍"按钮
2. 重新拍摄照片
3. 确认新照片

**Expected Result**:
- 跳转到拍照页
- 重拍模式提示正确
- 拍摄后返回预览页
- 新照片替换原照片

---

### TC-018: 删除照片 - 车牌 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @component:preview

**Preconditions**:
- 用户在全屏预览模式
- 当前显示车牌照片

**Steps**:
1. 点击"删除"按钮
2. 在确认弹窗中点击"确定"

**Expected Result**:
- 弹窗显示："确定删除该照片？"
- 确认后照片被删除
- 返回预览页列表
- 车牌状态变为"待拍摄"

---

### TC-019: 删除照片 - 取消删除 [ ]

**Priority**: Medium
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @component:preview

**Preconditions**:
- 用户在全屏预览模式
- 点击了"删除"按钮

**Steps**:
1. 在确认弹窗中点击"取消"

**Expected Result**:
- 弹窗关闭
- 照片保留
- 继续显示当前照片

---

### TC-020: 删除照片 - 车损 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @component:preview

**Preconditions**:
- 用户在全屏预览模式
- 有多张车损照片
- 当前显示车损照片

**Steps**:
1. 点击"删除"按钮
2. 确认删除

**Expected Result**:
- 车损照片被删除
- 剩余车损照片重新编号
- 车损数量减少 1

---

### TC-021: 补拍车牌照片 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @component:camera

**Preconditions**:
- 用户在预览页
- 车牌照片状态为"待拍摄"或需要补拍

**Steps**:
1. 找到车牌照片区域
2. 点击"补拍"按钮

**Expected Result**:
- 跳转到拍照页
- 当前步骤为"车牌拍摄"
- 拍摄后返回预览页

---

### TC-022: 添加车损照片 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @component:camera

**Preconditions**:
- 用户在预览页
- 车损照片未达上限（<5张）

**Steps**:
1. 找到车损照片区域
2. 点击"添加车损"按钮
3. 拍摄新车损照片
4. 确认

**Expected Result**:
- 跳转到拍照页
- 当前步骤为"车损拍摄"
- 拍摄后返回预览页
- 车损数量增加 1

---

## 四、多车辆处理

### TC-023: 添加第一辆三者车 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:multi-vehicle, @component:preview

**Preconditions**:
- 用户在预览页
- 标的车拍摄完成
- 点击"提交"按钮

**Steps**:
1. 点击"提交"按钮
2. 在弹窗"是否有其他三者车？"中点击"是"

**Expected Result**:
- 显示弹窗："是否有其他三者车？"
- 确认按钮："是"
- 取消按钮："否，下一步"
- 点击"是"后跳转到拍照页
- 车辆类型显示"三者车1"
- 开始拍摄三者车车牌

---

### TC-024: 不添加三者车继续提交流程 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:multi-vehicle, @component:preview

**Preconditions**:
- 用户在预览页
- 点击"提交"按钮

**Steps**:
1. 在弹窗"是否有其他三者车？"中点击"否，下一步"
2. 在单证弹窗中点击"否，提交"

**Expected Result**:
- 第一个弹窗关闭
- 显示单证资料询问弹窗
- 点击后跳转到完成页

---

### TC-025: 完成三者车拍摄流程 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:multi-vehicle, @component:camera

**Preconditions**:
- 已添加三者车1
- 正在拍摄三者车

**Steps**:
1. 拍摄三者车车牌
2. 确认
3. 拍摄三者车 VIN 码
4. 确认
5. 拍摄三者车车损照片（1-5张）
6. 确认

**Expected Result**:
- 每步确认后进入下一步
- 车损拍摄完成后跳转回预览页
- 预览页显示标的车 + 三者车1

---

### TC-026: 添加第二辆三者车 [ ]

**Priority**: High
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:multi-vehicle, @component:preview

**Preconditions**:
- 用户在预览页
- 已有一辆三者车

**Steps**:
1. 点击"提交"按钮
2. 在弹窗中点击"是"

**Expected Result**:
- 跳转到拍照页
- 车辆类型显示"三者车2"
- 开始拍摄三者车2的车牌

---

### TC-027: 三者车达到上限无法再添加 [ ]

**Priority**: High
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:multi-vehicle, @component:preview

**Preconditions**:
- 用户在预览页
- 已有两辆三者车（达到上限）

**Steps**:
1. 点击"提交"按钮

**Expected Result**:
- 不显示三者车询问弹窗
- 直接显示单证资料询问弹窗

---

### TC-028: 删除三者车 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:multi-vehicle, @component:preview

**Preconditions**:
- 用户在预览页
- 有已拍摄的三者车

**Steps**:
1. 找到三者车区域
2. 点击删除按钮
3. 在确认弹窗中点击"删除"

**Expected Result**:
- 显示确认弹窗："确定删除「三者车1」及其 X 张照片？"
- 确认后三者车被删除
- 预览页更新，剩余车辆重新编号

---

### TC-029: 删除三者车 - 取消 [ ]

**Priority**: Medium
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:multi-vehicle, @component:preview

**Preconditions**:
- 用户点击了删除三者车按钮

**Steps**:
1. 在确认弹窗中点击"取消"

**Expected Result**:
- 弹窗关闭
- 三者车保留
- 照片数据不变

---

## 五、单证资料模块

### TC-030: 添加单证资料 - 拍照 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:document, @component:preview

**Preconditions**:
- 用户在预览页
- 单证资料区域可见

**Steps**:
1. 点击"添加单证资料"按钮
2. 在弹窗中选择"拍照"
3. 拍摄照片
4. 确认

**Expected Result**:
- 显示选择方式弹窗（拍照/相册）
- 选择拍照后打开相机
- 拍摄后照片自动压缩
- 单证资料列表显示新照片

---

### TC-031: 添加单证资料 - 从相册选择单张 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:document, @component:preview

**Preconditions**:
- 用户在预览页

**Steps**:
1. 点击"添加单证资料"按钮
2. 在弹窗中选择"从相册选择"
3. 选择 1 张照片

**Expected Result**:
- 打开相册
- 选择后照片自动压缩
- 单证资料列表显示新照片

---

### TC-032: 添加单证资料 - 从相册选择多张 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:document, @component:preview

**Preconditions**:
- 用户在预览页
- 当前单证数量 < 10

**Steps**:
1. 点击"添加单证资料"按钮
2. 选择"从相册选择"
3. 选择 3 张照片

**Expected Result**:
- 可选择多张照片
- 选择后自动压缩处理
- 单证资料列表显示 3 张新照片

---

### TC-033: 单证资料达到上限 [ ]

**Priority**: Medium
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:document, @component:preview

**Preconditions**:
- 用户在预览页
- 已有 10 张单证资料（达到上限）

**Steps**:
1. 尝试添加更多单证资料

**Expected Result**:
- 无法添加超过 10 张
- 或显示已达上限提示

---

### TC-034: 预览单证资料 [ ]

**Priority**: Medium
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:document, @component:preview

**Preconditions**:
- 用户在预览页
- 有单证资料照片

**Steps**:
1. 点击单证资料照片

**Expected Result**:
- 进入微信原生图片预览
- 可左右滑动查看
- 支持缩放

---

### TC-035: 删除单证资料 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:document, @component:preview

**Preconditions**:
- 用户在预览页
- 有单证资料照片

**Steps**:
1. 长按或点击删除按钮
2. 在确认弹窗中点击"删除"

**Expected Result**:
- 显示确认弹窗："确定删除这张照片？"
- 确认后照片被删除
- 单证数量减少 1

---

### TC-036: 从提交弹窗进入添加单证 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:document, @component:preview

**Preconditions**:
- 用户在预览页
- 点击"提交"按钮

**Steps**:
1. 在三者车弹窗中点击"否，下一步"
2. 在单证弹窗中点击"是"

**Expected Result**:
- 弹窗关闭
- 页面滚动到单证资料区域
- 单证区域高亮显示

---

## 六、提交流程

### TC-037: 完整提交流程 - 无三者车无单证 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:submit, @component:complete

**Preconditions**:
- 标的车拍摄完成（车牌 + VIN + 车损）
- 用户在预览页

**Steps**:
1. 点击"提交"按钮
2. 在三者车弹窗中点击"否，下一步"
3. 在单证弹窗中点击"否，提交"

**Expected Result**:
- 跳转到完成页
- 显示车辆数量：1
- 显示总照片数量

---

### TC-038: 完整提交流程 - 有三者车有单证 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:submit, @component:complete

**Preconditions**:
- 标的车拍摄完成
- 添加了 1 辆三者车并完成拍摄
- 添加了 2 张单证资料

**Steps**:
1. 点击"提交"
2. 添加三者车（点击"是"）→ 完成拍摄
3. 再次提交
4. 不再添加三者车（点击"否，下一步"）
5. 添加单证（点击"是"）→ 添加 2 张
6. 点击"提交"

**Expected Result**:
- 跳转到完成页
- 显示车辆数量：2
- 显示总照片数量正确

---

## 七、完成页

### TC-039: 完成页显示统计信息 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:complete, @component:complete

**Preconditions**:
- 已完成提交流程

**Steps**:
1. 查看完成页

**Expected Result**:
- 显示车辆总数
- 显示照片总数
- 显示完成提示信息

---

### TC-040: 返回修改功能 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:complete, @component:complete

**Preconditions**:
- 用户在完成页

**Steps**:
1. 点击"返回修改"按钮

**Expected Result**:
- 跳转回预览页
- 所有数据保留
- 可以继续编辑

---

### TC-041: 退出小程序 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:complete, @component:complete

**Preconditions**:
- 用户在完成页

**Steps**:
1. 点击"完成退出"按钮

**Expected Result**:
- 清除缓存数据
- 退出小程序
- 或返回首页

---

## 八、边界条件测试

### TC-042: 车损照片上限边界 [ ]

**Priority**: High
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 已拍摄 4 张车损照片

**Steps**:
1. 拍摄第 5 张车损照片
2. 尝试拍摄第 6 张

**Expected Result**:
- 第 5 张拍摄后自动跳转预览页
- 无法拍摄超过 5 张车损照片

---

### TC-043: 三者车上限边界 [ ]

**Priority**: High
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:multi-vehicle, @component:preview

**Preconditions**:
- 已有标的车 + 2 辆三者车

**Steps**:
1. 点击"提交"按钮

**Expected Result**:
- 不再询问是否添加三者车
- 直接进入单证资料流程

---

### TC-044: 单证资料上限边界 [ ]

**Priority**: Medium
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:document, @component:preview

**Preconditions**:
- 已有 10 张单证资料

**Steps**:
1. 尝试添加更多单证资料

**Expected Result**:
- 显示已达上限提示
- 或选择数量限制为 0

---

### TC-045: 空状态 - 无照片进入预览页 [ ]

**Priority**: Medium
**Type**: Edge Case
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:preview, @component:preview

**Preconditions**:
- 初始化状态但未拍摄任何照片

**Steps**:
1. 进入预览页

**Expected Result**:
- 显示空状态或引导提示
- 或自动跳转回拍照页

---

## 九、异常处理测试

### TC-046: 图片处理失败 [ ]

**Priority**: High
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页

**Steps**:
1. 拍照后模拟图片压缩失败

**Expected Result**:
- 显示 Toast："图片处理失败"
- 允许重新拍照

---

### TC-047: 相册权限未授权 [ ]

**Priority**: Medium
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:document, @integration:permission

**Preconditions**:
- 用户未授权相册权限

**Steps**:
1. 尝试从相册选择单证资料

**Expected Result**:
- 显示权限引导
- 或无法打开相册选择器

---

### TC-048: 快速连续点击拍照按钮 [ ]

**Priority**: Medium
**Type**: Edge Case
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页

**Steps**:
1. 快速连续点击拍照按钮 3 次

**Expected Result**:
- 只响应第一次点击
- 不产生重复照片
- 状态正确更新

---

### TC-049: 页面快速切换 [ ]

**Priority**: Medium
**Type**: Edge Case
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:navigation, @component:all

**Preconditions**:
- 用户在拍照页

**Steps**:
1. 拍照后立即点击返回

**Expected Result**:
- 页面正常响应
- 数据不丢失
- 状态正确

---

### TC-050: 缓存数据异常 [ ]

**Priority**: Medium
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:storage, @component:all

**Preconditions**:
- 缓存数据被篡改或损坏

**Steps**:
1. 进入任意页面

**Expected Result**:
- 应用不崩溃
- 重新初始化或提示用户

---

## 十、性能测试

### TC-051: 图片压缩性能 [ ]

**Priority**: Medium
**Type**: Performance
**Status**: [ ] Not Run
**Suite: Full
**Tags**: @feature:capture, @component:compress

**Preconditions**:
- 准备大尺寸测试图片（>5MB）

**Steps**:
1. 拍摄或选择大尺寸图片
2. 观察处理时间

**Expected Result**:
- 处理时间 < 3 秒
- 显示加载提示
- 不出现卡顿

---

### TC-052: 多照片预览性能 [ ]

**Priority**: Medium
**Type**: Performance
**Status**: [ ] Not Run
**Suite**: Full
**Tags**: @feature:preview, @component:preview

**Preconditions**:
- 拍摄 20+ 张照片（多车辆 + 单证）

**Steps**:
1. 进入预览页
2. 滚动浏览所有照片

**Expected Result**:
- 列表滚动流畅
- 无明显卡顿
- 图片加载正常

---

## 测试数据要求

### 测试账号
- 无需登录账号

### 测试设备
- 微信开发者工具
- 真机（iOS/Android）

### 测试数据
- 车牌照片示例
- VIN 码照片示例
- 车损照片示例
- 单证资料照片示例

---

## 风险与注意事项

### 高风险区域
1. **相机权限**：首次使用需授权，可能影响用户体验
2. **图片压缩**：大图片可能导致处理时间过长
3. **页面跳转**：复杂的跳转逻辑可能导致状态不一致
4. **缓存管理**：缓存清除后数据丢失

### 已知问题
- 暂无

### 依赖项
- 微信小程序基础库 2.0+
- 相机权限
- 相册权限
- 本地存储

---

## 测试统计

| Suite | Total | Pass | Fail | Blocked | Skip | Not Run |
|-------|-------|------|------|---------|------|---------|
| Smoke | 12 | 0 | 0 | 0 | 0 | 12 |
| Regression | 34 | 0 | 0 | 0 | 0 | 34 |
| Full | 6 | 0 | 0 | 0 | 0 | 6 |
| **Total** | **52** | **0** | **0** | **0** | **0** | **52** |

---

## 附录：测试执行日志模板

```
## 测试执行记录

**日期**: YYYY-MM-DD
**测试人员**: 
**环境**: 微信开发者工具 / iOS 真机 / Android 真机
**版本**: 

### 执行结果
- 通过: X
- 失败: X
- 阻塞: X
- 跳过: X

### 问题记录
| TC-ID | 问题描述 | 严重程度 | 状态 |
|-------|---------|---------|------|
| TC-XXX | XXX | High/Medium/Low | Open/Fixed |
```

---

*文档生成工具: qa-test-cases skill*
*最后更新: 2026-04-24*
