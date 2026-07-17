# selfCam 车辆定损拍摄小程序 - 测试用例

**生成日期**: 2026-04-30
**代码基线**: v1.3.5
**测试类型**: E2E 用户流程测试

---

## 功能概述

车辆定损拍摄小程序，用于保险公司定损员现场拍摄车辆照片，包括车牌、VIN码、车损照片，支持多车辆（标的车+三者车）和每辆车行驶证资料管理。

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
- ✅ 每辆车行驶证资料管理
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
- 左上角显示品牌 logo
- 页面标题为"车辆损失照片采集工具"
- 显示"拍摄须知"卡片
- 显示"开始采集"按钮
- 清除之前的缓存数据

---

### TC-002: 点击开始采集进入拍照页 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:entry, @component:index

**Preconditions**:
- 用户在首页

**Steps**:
1. 点击"开始采集"按钮

**Expected Result**:
- 跳转到拍照页 (`/packageD/pages/camera/camera`)
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
4. 点击"确认使用"按钮

**Expected Result**:
- 拍照后进入确认态，不显示"是否清晰？"类问句
- 确认态按钮显示"确认使用 / 重新拍摄"
- 点击"确认使用"后确认态关闭
- 自动切换到 VIN 码拍摄步骤
- 提示文字变为："请对准前挡风玻璃左下角VIN码，拍清完整字符"

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
2. 在确认态中点击"重新拍摄"按钮

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
3. 点击"确认使用"按钮

**Expected Result**:
- 进入确认态，不显示"是否清晰？"类问句
- 确认态按钮显示"确认使用 / 重新拍摄"
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
2. 在确认态中点击"重新拍摄"按钮

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
3. 点击"确认使用"按钮

**Expected Result**:
- 进入确认态，不显示"是否清晰？"类问句
- 确认态按钮显示"确认使用 / 重新拍摄"
- 点击"确认使用"后确认态关闭
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

### TC-009: 拍摄车损照片达到上限（10张）确认流转 [ ]

**Priority**: Critical
**Type**: Boundary
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:capture, @component:camera

**Preconditions**:
- 用户在拍照页
- 已拍摄 9 张车损照片

**Steps**:
1. 拍摄第 10 张车损照片
2. 点击"确认"按钮

**Expected Result**:
- 确认后显示车损完成确认弹窗，不自动跳转预览页
- 弹窗显示期间暂停拍摄动作，不继续处于可拍照状态
- 有下一辆车时主按钮为 `下一辆车`，次按钮为 `查看已拍`
- 最后一辆车时主按钮为 `去预览`
- 当前车辆车损数量为 10 张

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
1. 点击"完成本车拍摄"按钮

**Expected Result**:
- 因当前车辆少于 3 张，先显示标题为 `车损照片较少` 的软确认弹窗
- 点击 `继续拍摄` 后关闭弹窗并停留在当前车辆车损拍摄页
- 点击 `确认完成` 后执行完成本车拍摄逻辑；有下一辆车时继续现有交接流程，最后一辆车进入模块二预览页
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
- 拍照页保持在车损拍摄态，不闪回预览页
- 车损识别模型在相机初始化完成后正常启动
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
- 当前三者车未达到上限

**Steps**:
1. 点击"完成采集"按钮
2. 在弹窗"确认所有车辆损伤均已拍摄，无需增加其他三者车？"中点击"否，添加其他三者车"

**Expected Result**:
- 显示弹窗："确认所有车辆损伤均已拍摄，无需增加其他三者车？"
- 左侧按钮："否，添加其他三者车"
- 右侧按钮："是，继续提交"
- 点击左侧按钮后跳转到拍照页
- 车辆类型显示"三者车1"
- 开始拍摄三者车车牌

---

> 说明：以下多车新增/删除相关用例保留为本地无 `ticket` 旧链路回归。辅助拍照当前以后端 `init` 返回车辆列表为准，预览页不手动新增或删除三者车。

### TC-024: 不添加三者车继续提交流程 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:multi-vehicle, @component:preview

**Preconditions**:
- 用户在预览页
- 每辆车行驶证资料已完成

**Steps**:
1. 点击"完成采集"按钮
2. 在弹窗"确认所有车辆损伤均已拍摄，无需增加其他三者车？"中点击"是，继续提交"

**Expected Result**:
- 三者车确认弹窗关闭
- 不显示行驶证风险提示
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
1. 点击"完成采集"按钮
2. 在弹窗"确认所有车辆损伤均已拍摄，无需增加其他三者车？"中点击"否，添加其他三者车"

**Expected Result**:
- 显示三者车确认弹窗
- 点击后跳转到拍照页
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
1. 点击"完成采集"按钮

**Expected Result**:
- 不显示三者车询问弹窗
- 直接进入行驶证完成状态检查

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

## 五、每辆车行驶证资料模块

### TC-030: 预览页按车辆展示行驶证入口 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:driving-license, @component:preview

**Preconditions**:
- 用户在预览页
- 标的车与三者车均已完成车牌、VIN、车损拍摄
- 两辆车均未上传行驶证

**Steps**:
1. 查看标的车照片列表
2. 查看三者车照片列表

**Expected Result**:
- 每辆车照片顺序为车牌、VIN、车损照片、行驶证资料
- 每辆车列表末尾显示"上传行驶证"入口
- 入口下方标签为"行驶证资料"
- 页面不显示独立"单证资料"模块

---

### TC-031: 实体行驶证正页和副页齐全才算完成 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:driving-license, @component:preview

**Preconditions**:
- 用户在预览页
- 当前车辆行驶证模式为实体行驶证

**Steps**:
1. 点击当前车辆"上传行驶证"
2. 上传"行驶证正页"
3. 关闭面板后查看车辆照片列表
4. 再次打开面板并上传"行驶证副页"

**Expected Result**:
- 只上传正页时当前车辆仍为行驶证未完成
- 用户仍能继续补充副页
- 正页和副页齐全后，车辆列表展示两张真实缩略图："行驶证正页"、"行驶证副页"
- 两张图片都写入当前车辆 `documents[]`

---

### TC-032: 电子行驶证上传后算完成 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:driving-license, @component:preview

**Preconditions**:
- 用户在预览页
- 当前车辆未上传行驶证

**Steps**:
1. 点击当前车辆"上传行驶证"
2. 点击"改传电子行驶证"
3. 上传"电子行驶证"
4. 关闭面板后查看车辆照片列表

**Expected Result**:
- `documentSelections.driving_license` 更新为 `electronic`
- 车辆列表展示一张真实缩略图："电子行驶证"
- 当前车辆行驶证状态为完成

---

### TC-033: 实体/电子切换不删除已上传图片 [ ]

**Priority**: High
**Type**: Edge Case
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:driving-license, @component:preview

**Preconditions**:
- 用户在预览页
- 当前车辆已有实体正页和副页

**Steps**:
1. 打开行驶证面板
2. 切换到电子行驶证模式
3. 上传电子行驶证
4. 切回实体行驶证模式

**Expected Result**:
- 切换到电子模式时实体正页、副页仍保留在 `documents[]`
- 上传电子行驶证后不会删除实体图片
- 切回实体模式后面板继续显示已上传的正页、副页缩略图
- 当前完成状态只按当前选择模式计算

---

### TC-034: 行驶证图片支持拍照和相册选择 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:driving-license, @integration:chooseMedia

**Preconditions**:
- 用户在行驶证上传面板
- 目标上传位未上传或允许替换

**Steps**:
1. 点击"行驶证正页"上传位
2. 在操作菜单选择"拍照"
3. 上传成功后点击"行驶证副页"上传位
4. 在操作菜单选择"从手机相册选择"

**Expected Result**:
- 两次均调用 `wx.chooseMedia({ count: 1, mediaType: ['image'] })`
- 拍照来源 `sourceType` 记为 `camera`，上传成功后尝试保存到手机相册
- 相册来源 `sourceType` 记为 `album`，不重复保存到手机相册
- 成功后对应上传位显示真实图片缩略图

---

### TC-035: 同一上传位第二次上传会替换旧图片 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:driving-license, @component:preview

**Preconditions**:
- 当前车辆已有"行驶证正页"

**Steps**:
1. 打开当前车辆行驶证面板
2. 点击已上传的"行驶证正页"
3. 选择"重新上传"
4. 选择或拍摄新图片

**Expected Result**:
- 旧的 `docType=driving_license` + `docSide=front_page` 图片被替换
- 当前车辆 `documents[]` 不出现重复的正页记录
- 列表和面板都显示新图片缩略图

---

### TC-036: 删除行驶证图片后更新完成状态 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:driving-license, @component:preview

**Preconditions**:
- 当前车辆实体行驶证正页、副页均已上传

**Steps**:
1. 点击车辆列表中的"行驶证副页"缩略图
2. 选择删除
3. 确认删除

**Expected Result**:
- 对应图片从当前车辆 `documents[]` 移除
- 删除后实体行驶证状态重新变为未完成
- 车辆列表末尾继续提供"上传行驶证"入口，用户可补齐
- 其他车辆的行驶证数据不受影响

---

## 六、提交流程

### TC-037: 完整提交流程 - 无三者车且行驶证齐全 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:submit, @component:complete

**Preconditions**:
- 标的车拍摄完成（车牌 + VIN + 车损）
- 标的车行驶证资料已完成
- 用户在预览页

**Steps**:
1. 点击"完成采集"按钮

**Expected Result**:
- 不显示三者车确认弹窗
- 不显示行驶证风险提示
- 进入相册保存确认或预览页上传遮罩
- `complete` 成功后跳转到完成页
- 显示车辆数量：1
- 显示总照片数量

---

### TC-038: 完整提交流程 - 有三者车且行驶证齐全 [ ]

**Priority**: Critical
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:submit, @component:complete

**Preconditions**:
- 标的车拍摄完成
- 后端 `init` 返回标的车和 1 辆三者车，且两辆车均已完成拍摄
- 标的车和三者车行驶证资料均已完成

**Steps**:
1. 点击"完成采集"

**Expected Result**:
- 不显示三者车确认弹窗
- 不显示行驶证风险提示
- 进入相册保存确认或预览页上传遮罩
- `complete` 成功后跳转到完成页
- 显示车辆数量：2
- 显示总照片数量正确

---

### TC-038A: 有车辆行驶证未完成时继续提交风险提示 [ ]

**Priority**: Critical
**Type**: Edge Case
**Status**: [ ] Not Run
**Suite**: Smoke
**Tags**: @feature:submit, @feature:driving-license, @component:preview

**Preconditions**:
- 用户在预览页
- 至少一辆车行驶证资料未完成

**Steps**:
1. 点击"完成采集"
2. 查看行驶证风险弹窗文案
3. 点击"返回补充"
4. 再次重复步骤 1-2
5. 点击"确认提交"

**Expected Result**:
- 不显示三者车确认弹窗
- 行驶证风险弹窗显示："仍有车辆未上传行驶证，会影响定损金额准确性，建议上传。如确实无法提供，请后续联系案件处理人员补充。是否确认提交？"
- 点击"返回补充"关闭弹窗并停留预览页
- 点击"确认提交"继续相册保存确认和上传闭环

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

### TC-040: 完成页不提供返回修改入口 [ ]

**Priority**: High
**Type**: Happy Path
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:complete, @component:complete

**Preconditions**:
- 用户在完成页

**Steps**:
1. 检查完成页底部按钮

**Expected Result**:
- 只展示“完成退出”
- 不展示“返回修改”
- 不触发跳回预览页

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
- 已拍摄 9 张车损照片

**Steps**:
1. 拍摄第 10 张车损照片
2. 在完成确认弹窗中选择 `查看已拍` 或进入预览页
3. 尝试从拍照页或预览页补拍第 11 张

**Expected Result**:
- 第 10 张确认后只显示完成确认弹窗，不自动写入第 11 张
- 尝试第 11 张时提示 `最多10张车损，请先删除`
- 当前车辆车损照片始终不超过 10 张
- 弹窗不卸载相机组件，跳转下一辆车后相机可继续初始化并拍照

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
- 直接进入行驶证完成状态检查
- 若存在未完成行驶证，则弹出一次总风险提示
- 若全部行驶证完成，则进入完成页

---

### TC-044: 旧缓存无行驶证字段仍能进入预览页 [ ]

**Priority**: High
**Type**: Edge Case
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:cache, @feature:driving-license, @component:preview

**Preconditions**:
- 本地缓存车辆对象没有 `documents`
- 本地缓存车辆对象没有 `documentSelections`

**Steps**:
1. 从旧缓存恢复进入预览页
2. 查看每辆车照片列表末尾

**Expected Result**:
- 页面不白屏
- 每辆车自动补齐 `documents: []`
- 每辆车自动补齐 `documentSelections.driving_license = 'physical'`
- 每辆车列表末尾显示"上传行驶证"入口

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

### TC-047: 行驶证相册选择失败不破坏数据 [ ]

**Priority**: Medium
**Type**: Error Handling
**Status**: [ ] Not Run
**Suite**: Regression
**Tags**: @feature:driving-license, @integration:permission

**Preconditions**:
- 用户未授权相册权限
- 用户在行驶证上传面板

**Steps**:
1. 点击任一行驶证上传位
2. 选择"从手机相册选择"

**Expected Result**:
- 显示权限引导
- 或无法打开相册选择器
- 已有行驶证图片不被清空
- 面板仍可继续选择拍照或关闭

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
- 行驶证正页、行驶证副页、电子行驶证照片示例

---

## 风险与注意事项

### 当前自动化覆盖补充

- `npm run test:automator` 已覆盖首页冒烟、VIN 提示、确认态文案、预览页添加图片成功/取消/失败兜底、车损 AI `initdone` 恢复与首批破坏性场景。
- v1.3.5 Jest 已覆盖车辆级行驶证旧缓存兼容、实体/电子完成态、上传替换、删除、拍照保存相册、提交风险提示和标的车/三者车串车隔离。
- 微信开发者工具自动化入口和环境配置见 `docs/test-run-guide.md` 与 `e2e/README.md`。
- 真机相机权限、真实相册权限、真实拍照预览流和模型推理效果仍需手工回归。

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
| Smoke | 13 | 0 | 0 | 0 | 0 | 13 |
| Regression | 35 | 0 | 0 | 0 | 0 | 35 |
| Full | 6 | 0 | 0 | 0 | 0 | 6 |
| **Total** | **54** | **0** | **0** | **0** | **0** | **54** |

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
*最后更新: 2026-04-30*

---

## v1.3.4 同步备注

- 本版本仅收敛首页权限申请、相册保存失败轻提示和开始采集防重复点击。
- 不修改 UI 样式，不修改拍照、缓存、重拍、补拍、预览主流程。
- 项目未主动调用 backgroundFetch 相关 API，本版本不新增相关处理。

---

## v1.3.4 权限与相册保存补充用例

### TC-053: 开始采集申请相机和相册权限 [P]

**Priority**: Critical
**Type**: Happy Path
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:entry, @component:index, @integration:permission

**Preconditions**:
- 用户在首页
- 相机和相册权限均未授权

**Steps**:
1. 点击 `开始采集`
2. 同意相机权限
3. 同意相册权限

**Expected Result**:
- 进入 `/packageD/pages/camera/camera`
- 当前步骤为车牌拍摄
- 不重复初始化缓存

### TC-054: 拒绝相机权限后不进入拍摄页 [P]

**Priority**: Critical
**Type**: Error Handling
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:entry, @component:index, @integration:permission

**Preconditions**:
- 用户在首页
- 相机权限被拒绝或设置页仍未开启

**Steps**:
1. 点击 `开始采集`
2. 拒绝相机权限或取消设置

**Expected Result**:
- 不进入拍摄页
- 不初始化新的拍摄流程

### TC-055: 拒绝相册权限后仍进入拍摄页 [P]

**Priority**: High
**Type**: Error Handling
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:entry, @component:index, @integration:permission

**Preconditions**:
- 相机权限已授权
- 相册权限被拒绝

**Steps**:
1. 点击 `开始采集`

**Expected Result**:
- 仍进入 `/packageD/pages/camera/camera`
- 不因相册权限拒绝阻断拍摄

### TC-056: 连续快速点击开始采集不会重复跳转 [P]

**Priority**: High
**Type**: Edge Case
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:entry, @component:index

**Preconditions**:
- 用户在首页
- 权限检查尚未完成

**Steps**:
1. 连续快速点击 `开始采集` 两次以上

**Expected Result**:
- 只执行一次权限检查和一次跳转
- `isStartingCapture` 在流程结束后释放

### TC-057: 确认照片保存成功时业务代码不弹成功提示 [P]

**Priority**: High
**Type**: Happy Path
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:capture, @component:camera, @integration:album

**Preconditions**:
- 用户在拍照确认态
- 当前照片有 `compressedPath`
- 相册保存 API 成功

**Steps**:
1. 点击 `确认使用`

**Expected Result**:
- 照片写入缓存并推进原流程
- 调用 `wx.saveImageToPhotosAlbum`
- 不调用业务成功 `wx.showToast`

### TC-058: 相册保存失败只轻提示且不阻断确认 [P]

**Priority**: High
**Type**: Error Handling
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:capture, @component:camera, @integration:album

**Preconditions**:
- 用户在拍照确认态
- 相册保存 API 返回非权限类失败

**Steps**:
1. 点击 `确认使用`

**Expected Result**:
- 照片仍写入缓存并推进下一步或预览流程
- 只提示 `照片未保存到相册，不影响拍摄`
- 不抛异常阻断主流程

### TC-059: 相册权限拒绝导致保存失败时不逐张提示 [P]

**Priority**: Medium
**Type**: Error Handling
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:capture, @component:camera, @integration:album

**Preconditions**:
- 用户在拍照确认态
- `wx.saveImageToPhotosAlbum` 返回权限拒绝类失败

**Steps**:
1. 点击 `确认使用`

**Expected Result**:
- 照片仍写入缓存并推进流程
- 只记录日志
- 不弹出失败 toast

### TC-060: 重新拍摄不保存到系统相册 [P]

**Priority**: High
**Type**: Edge Case
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:capture, @component:camera, @integration:album

**Preconditions**:
- 用户在拍照确认态
- 当前存在待确认照片

**Steps**:
1. 点击 `重新拍摄`

**Expected Result**:
- 关闭确认态并回到当前拍摄步骤
- 不调用 `wx.saveImageToPhotosAlbum`

---

## v1.3.5 每辆车行驶证资料补充用例

- 本版本将行驶证资料从独立单证模块调整为每辆车照片列表末尾的车辆级资料。
- 旧缓存车辆缺少 `documents` / `documentSelections` 时必须自动补默认值，避免预览页白屏。
- 辅助拍照完成采集时直接按后端 `init` 返回车辆列表判断行驶证是否齐全，不再先确认是否添加三者车。

### TC-061: 标的车和三者车行驶证数据互不串车 [P]

**Priority**: Critical
**Type**: Edge Case
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:driving-license, @feature:multi-vehicle, @component:preview

**Preconditions**:
- 预览页存在标的车和三者车

**Steps**:
1. 为标的车上传行驶证正页
2. 为三者车上传电子行驶证
3. 分别查看两辆车的 `documents[]`

**Expected Result**:
- 标的车只包含自己的正页记录
- 三者车只包含自己的电子行驶证记录
- 两辆车的完成状态按各自 `documentSelections` 独立计算

### TC-062: 行驶证风险提示不强制拦截提交 [P]

**Priority**: Critical
**Type**: Happy Path
**Status**: [P]
**Suite**: Smoke
**Tags**: @feature:submit, @feature:driving-license, @component:preview

**Preconditions**:
- 至少一辆车行驶证未完成

**Steps**:
1. 点击 `完成采集`
2. 在行驶证风险提示点击 `确认提交`

**Expected Result**:
- 风险提示只弹一次
- 点击 `确认提交` 后继续原完成流程
- 不要求用户必须补齐行驶证

### TC-063: 辅助拍照不展示三者车确认弹窗 [P]

**Priority**: High
**Type**: Edge Case
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:submit, @feature:multi-vehicle, @component:confirm-modal

**Preconditions**:
- 用户在预览页
- 当前缓存为辅助拍照模式，`auxPhoto.enabled = true`

**Steps**:
1. 点击 `完成采集`

**Expected Result**:
- 不展示 `确认所有车辆损伤均已拍摄，无需增加其他三者车？`
- 不展示 `否，添加其他三者车`
- 直接进入行驶证风险提示、相册保存确认或上传遮罩

### TC-064: 拍照页背景与初始化页、预览页一致 [P]

**Priority**: Medium
**Type**: UI
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:camera, @component:camera, @feature:ui

**Preconditions**:
- 小程序横屏打开

**Steps**:
1. 查看初始化页背景
2. 进入拍照页查看背景
3. 进入预览页查看背景

**Expected Result**:
- 三个页面都使用浅灰绿色背景
- 拍照页右上角有淡绿色装饰层
- 相机预览、按钮和提示文案不被背景装饰遮挡

---

## v1.3.9 完成采集最终相册保存补充用例

### TC-065: 完成采集最后确认是否保存至手机相册 [P]

**Priority**: Critical
**Type**: Happy Path
**Status**: [P]
**Suite**: Smoke
**Tags**: @feature:album-save, @component:preview

**Preconditions**:
- 用户在预览页，当前缓存存在未保存到手机相册的车牌、VIN 或车损照片

**Steps**:
1. 点击 `完成采集`
2. 如存在行驶证风险提示，确认继续提交
3. 查看最终相册保存确认弹窗

**Expected Result**:
- 最后显示 `是否保存全部图片至手机相册？建议保存，便于后续案件处理。`
- 点击 `暂不保存` 不申请相册权限，直接进入预览页上传遮罩
- 点击 `保存至手机` 后才申请相册保存权限并批量保存

### TC-066: 完成页重复进入不重复保存或提交 [P]

**Priority**: Critical
**Type**: Edge Case
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:album-save, @feature:complete, @component:complete

**Preconditions**:
- 已完成采集并进入完成页

**Steps**:
1. 重新进入 `complete` 页面
2. 等待页面稳定
3. 查看请求日志和相册保存记录

**Expected Result**:
- 不重复调用 `uploadPhoto` 或 `complete`
- 不重复调用 `wx.saveImageToPhotosAlbum`
- 页面保持完成态，不自动回到预览页

### TC-067: 最终相册保存失败不阻断完成采集 [P]

**Priority**: High
**Type**: Abnormal
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:album-save, @feature:permission

**Preconditions**:
- 用户在最终相册保存确认中点击 `保存至手机`

**Steps**:
1. 拒绝相册权限，或模拟 `wx.saveImageToPhotosAlbum` 部分失败
2. 观察完成页跳转和提示文案

**Expected Result**:
- 权限拒绝、接口异常或部分失败都不阻断进入完成页
- 完成页根据结果显示 `本次照片采集已完成，未保存至手机相册` 或 `本次照片采集已完成，部分照片未保存至手机相册`

---

## v1.5.x 三阶段采集流程补充用例

### TC-068: 模块一首次进入展示 45 度拍摄指引 [P]

**Priority**: High
**Type**: Happy Path
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:module-one, @feature:capture-guide

**Preconditions**:
- 用户通过有效 ticket 从开始页进入拍照流程

**Steps**:
1. 点击开始采集
2. 进入模块一现场照片拍摄页

**Expected Result**:
- 首次进入自动展示标题为 `拍摄指引：整车照，45度角拍一张，包含现场环境` 的弹窗
- 点击 `知道了，开始拍摄` 后弹窗关闭，左侧保留 `45度示意` 入口
- 关闭弹窗后相机保持可用，不出现相机加载失败

### TC-069: 模块一完成后进入模块一预览页 [P]

**Priority**: Critical
**Type**: Flow
**Status**: [P]
**Suite**: Smoke
**Tags**: @feature:module-one, @feature:preview

**Preconditions**:
- mock ticket 下发标的车和三者车

**Steps**:
1. 完成现场照片、标的车车牌号、标的车 VIN
2. 完成三者车车牌号、三者车 VIN

**Expected Result**:
- 最后一张 VIN 确认后进入模块一预览页
- 不直接跳到车损拍摄页
- 模块一预览页展示现场照片、车辆车牌号和 VIN 信息
- 首次进入模块一预览页时弹出 `补充现场信息` 提示
- 点击 `去拍摄` 写入已提示标记并进入第一张现场补充照片拍摄；点击 `没有了` 写入已提示标记并停留在模块一预览页
- 现场补充照片最多支持 3 张，第 3 张拍完后不再展示新增入口，第 4 张进入或保存会提示最多 3 张

### TC-070: 模块一预览确认后进入模块二车损拍摄 [P]

**Priority**: Critical
**Type**: Flow
**Status**: [P]
**Suite**: Smoke
**Tags**: @feature:module-two, @feature:navigation

**Preconditions**:
- 用户停留在模块一预览页

**Steps**:
1. 点击进入车损拍摄
2. 确认阶段切换弹层

**Expected Result**:
- 直接进入第一辆车车损拍摄页
- 不再拍摄车牌号或 VIN
- 首次进入车损拍摄自动展示标题为 `拍摄指引：车损处远、中、近拍摄` 的弹窗

### TC-071: 模块二预览未满 10 张仅展示一个补拍入口 [P]

**Priority**: High
**Type**: UI
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:module-two, @component:preview

**Preconditions**:
- 某辆车车损照片数量少于 10 张

**Steps**:
1. 进入模块二预览页

**Expected Result**:
- 已拍车损照片正常展示
- 未满 10 张时只出现一个 `+` 补拍入口
- 不用空框补齐 10 个槽位

### TC-072: 模块三按车辆横向展示证件信息 [P]

**Priority**: Critical
**Type**: UI
**Status**: [P]
**Suite**: Regression
**Tags**: @feature:module-three, @feature:documents

**Preconditions**:
- 已进入模块三证件信息页

**Steps**:
1. 查看标的车和三者车证件区域
2. 点击驾驶证或行驶证 `+` 入口
3. 选择实物或电子证件并完成回显

**Expected Result**:
- 每辆车一行展示驾驶证、行驶证入口或已采集图片
- 同一辆车的证件图片不换行，不同车辆可换行
- 实物证件显示 `驾驶证-正页/副页`、`行驶证-正页/副页`
- 电子证件显示 `驾驶证`、`行驶证`
