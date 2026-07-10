# 车辆与现场环境信息

## 当前能力说明

模块一负责采集案件级现场环境照片和车辆级识别信息。案件级包含整车 45 度现场照片及有限数量的现场补充照片；每辆车分别保存车牌和 VIN 照片。自然采集模式允许本地创建和流转多辆车，辅助拍照模式以后端初始化返回的车辆与上传槽位为准。

## 关联来源

**文档：**

- `PRDS/模块一：现场环境及车辆信息设计.md`
- `PRDS/查勘采集流程三阶段优化方案.md`
- `PRDS/查勘采集流程优化业务需求文档.md`
- `PRDS/查勘采集助手三阶段采集流程说明.md`
- `PRDS/PRD.md`
- `PRDS/tech.md`
- `docs/辅助拍照微信小程序接口对接文档.md`

**代码：**

- `packageD/pages/camera/camera.js`
- `packageD/pages/preview/preview.js`
- `packageD/utils/storage-schema.js`
- `packageD/utils/storage.js`
- `packageD/utils/cache-selectors.js`
- `packageD/utils/constants.js`
- `packageD/utils/aux-photo-mapper.js`

**测试：**

- `__tests__/module-one-preview.test.js`
- `__tests__/camera-ai-start.test.js`
- `__tests__/aux-photo-mapper.test.js`
- `__tests__/storage.test.js`
- `e2e/specs/module-one-two-flow.spec.js`
- `e2e/specs/multi-vehicle-chaos.spec.js`

## ADDED Requirements

### Requirement: 案件级现场环境照片

系统 SHALL 把整车 45 度照片和现场补充照片保存为案件级现场信息，并在模块一预览和最终预览中与车辆级照片分开展示。

#### Scenario: 完成现场 45 度照片
- **WHEN** 用户确认使用整车 45 度现场照片
- **THEN** 系统把照片保存到案件级现场主槽位
- **AND** 系统进入首辆车的车牌采集步骤

#### Scenario: 缺少现场主照片继续流转
- **WHEN** 用户在模块一预览中缺少整车 45 度照片但选择进入下一模块
- **THEN** 系统显示风险确认提示
- **AND** 用户确认后可以继续进入车损采集

#### Scenario: 现场补充照片达到当前上限
- **WHEN** 案件已经保存两张现场补充照片
- **THEN** 模块一预览不再提供新的现场补充入口
- **AND** 现有现场照片仍可预览、删除或重拍

### Requirement: 车辆级车牌与 VIN 信息

系统 MUST 为每辆车分别维护车牌照片和 VIN 照片，并按照当前车辆上下文写入，禁止跨车辆覆盖。

#### Scenario: 单车完成车辆识别信息
- **WHEN** 当前车辆依次确认车牌照片和 VIN 照片
- **THEN** 系统把两张照片保存到当前车辆
- **AND** 单车场景进入模块一预览

#### Scenario: 多车继续采集
- **WHEN** 当前车辆完成 VIN 且仍存在下一辆待采集车辆
- **THEN** 系统切换到下一辆车辆的车牌步骤
- **AND** 已完成车辆的车牌、VIN 和车损数据保持不变

### Requirement: 多车数据隔离

系统 SHALL 以车辆唯一标识和车辆索引隔离每辆车的识别照片、车损照片和证件数据。

#### Scenario: 修改其中一辆车
- **WHEN** 用户删除、重拍或补拍某辆车的照片
- **THEN** 系统只更新目标车辆的数据和统计
- **AND** 其他车辆的照片顺序、数量和上传元数据不得变化

### Requirement: 辅助拍照车辆由后端控制

系统 MUST 在辅助拍照模式下使用初始化接口返回的车辆列表、显示名称、车辆标识和上传槽位，不允许用户手动改变后端定义的车辆集合。

#### Scenario: 初始化后端车辆
- **WHEN** ticket 初始化成功并返回车辆与上传项
- **THEN** 系统把后端车辆映射为本地车辆缓存
- **AND** 系统保留后端车辆唯一标识和上传元数据

#### Scenario: 辅助拍照尝试手动改车
- **WHEN** 用户在辅助拍照模式尝试新增、删除或切换到后端未定义的车辆
- **THEN** 系统阻止该操作
- **AND** 当前车辆列表继续以后端初始化结果为准

## 已知限制 / 待确认点

- 现场补充照片上限当前按页面测试表现为两张，是否长期固定仍需产品确认。
- 车牌和 VIN 当前主要保存图片及上传元数据，不在本规格中声明已完成稳定 OCR 文本提取。
- 三者车数量和新增时机在自然模式与辅助拍照模式不同，详细交互仍引用三阶段流程文档。
- 后端历史字段兼容和显示名降级规则保留在 `aux-photo-mapper.js`，不在规格中复制完整字段表。
