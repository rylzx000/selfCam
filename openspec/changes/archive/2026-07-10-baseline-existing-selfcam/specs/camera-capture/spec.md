# 拍照采集主流程

## 当前能力说明

selfCam 通过开始页进入横屏拍照页，以缓存中的流程状态驱动现场照片、车牌、VIN 和车损照片采集。照片进入待确认态后，用户可以确认使用或重新拍摄；确认照片会经过压缩并写入对应案件/车辆槽位。流程支持补拍、重拍、删除、异常缓存恢复和多车切换。

## 关联来源

**文档：**

- `PRDS/PRD.md`
- `PRDS/tech.md`
- `PRDS/UI.md`
- `PRDS/查勘采集流程三阶段优化方案.md`
- `PRDS/查勘采集助手三阶段采集流程说明.md`
- `docs/test-cases.md`
- `docs/abnormal-flow-test-cases.md`

**代码：**

- `packageD/pages/index/index.js`
- `packageD/pages/camera/camera.js`
- `packageD/pages/camera/camera.wxml`
- `packageD/utils/workflow-state.js`
- `packageD/utils/workflow-page.js`
- `packageD/utils/storage.js`
- `packageD/utils/storage-schema.js`
- `packageD/utils/compress.js`
- `packageD/utils/permission.js`

**测试：**

- `__tests__/workflow-state.test.js`
- `__tests__/workflow-recovery.test.js`
- `__tests__/storage.test.js`
- `__tests__/storage-resume.test.js`
- `__tests__/camera-ai-start.test.js`
- `e2e/specs/capacity-boundary.spec.js`
- `e2e/specs/delete-retake-replenish.spec.js`
- `e2e/specs/recovery-chaos.spec.js`

## ADDED Requirements

### Requirement: 合法采集入口与流程状态

系统 SHALL 从开始页创建或恢复合法采集上下文后进入拍照页，并确保当前车辆索引、当前步骤和返回上下文与缓存事实一致。

#### Scenario: 新案件开始采集
- **WHEN** 用户在没有可恢复缓存的情况下完成相机权限检查并点击开始采集
- **THEN** 系统创建首辆车和初始流程状态
- **AND** 系统进入现场 45 度照片采集步骤

#### Scenario: 恢复已有采集
- **WHEN** 用户重新进入且存在可恢复的合法缓存
- **THEN** 系统按缓存中的事实恢复车辆、步骤和目标页面
- **AND** 系统不得重复创建车辆或重复写入已确认照片

### Requirement: 照片确认与重新拍摄

系统 MUST 在拍照后进入待确认态，只有用户确认使用后才把照片写入对应业务槽位；用户选择重新拍摄时不得持久化待确认照片。

#### Scenario: 确认使用照片
- **WHEN** 用户对待确认照片选择确认使用
- **THEN** 系统压缩照片并写入当前现场、车牌、VIN、车损或补拍目标
- **AND** 系统记录后续流程所需的照片元数据和返回上下文

#### Scenario: 重新拍摄照片
- **WHEN** 用户对待确认照片选择重新拍摄
- **THEN** 系统清除当前待确认态并返回同一采集步骤
- **AND** 对应业务槽位的已确认数据不得增加

### Requirement: 车损照片容量与完成动作

系统 SHALL 将车损照片归属到当前车辆，并限制每辆车最多保存 10 张车损照片。用户在未达到上限时可以主动结束当前车辆的车损采集，达到上限后不得保存第 11 张。

#### Scenario: 达到每车车损上限
- **WHEN** 当前车辆已经保存 10 张车损照片且再次确认新的车损照片
- **THEN** 系统拒绝把该照片加入当前车辆
- **AND** 系统提示用户进入下一车辆或当前模块预览

#### Scenario: 未达到上限时主动结束
- **WHEN** 当前车辆车损照片少于 10 张且用户选择结束车损采集
- **THEN** 系统显示基于当前照片数量的确认信息
- **AND** 用户确认后进入下一车辆或模块二预览

#### Scenario: 删除后释放容量
- **WHEN** 用户删除当前车辆的一张已确认车损照片
- **THEN** 系统从该车辆的照片集合中移除目标照片
- **AND** 系统允许在剩余容量内继续补拍

### Requirement: 缓存异常安全恢复

系统 MUST 对缺失、旧版本、损坏或越界的缓存进行安全降级，避免白屏、非法状态迁移或车辆数据串写。

#### Scenario: 缓存内容损坏
- **WHEN** 本地缓存无法解析或缺少关键结构
- **THEN** 系统返回可用的安全缓存结构或回到开始页
- **AND** 页面不得因缓存异常而白屏

#### Scenario: 流程索引越界
- **WHEN** 缓存中的当前车辆索引超出车辆数组范围
- **THEN** 系统把索引修正为合法值
- **AND** 其他车辆的照片与证件数据不得被覆盖

#### Scenario: 无效补拍上下文
- **WHEN** 补拍或重拍上下文已过期、缺失或与当前流程事实冲突
- **THEN** 系统清理无效上下文并回到可确定的流程位置
- **AND** 当前步骤不得漂移到无关模块

## 已知限制 / 待确认点

- 当前每车车损上限按代码和现行测试记录为 10 张，历史文档中的更低数量仅保留为历史口径。
- 全局 50 张图片容量由 e2e 边界测试覆盖，是否作为长期业务规则仍需确认。
- 相机权限、真机拍照失败和系统相册能力仍依赖微信运行环境，单元测试主要验证流程降级。
- 现场 45 度照片缺失时当前采用提示确认而非硬拦截，长期策略待产品确认。
