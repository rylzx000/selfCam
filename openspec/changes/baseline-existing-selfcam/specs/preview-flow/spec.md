# 预览与完成流程

## 当前能力说明

selfCam 复用预览页承载模块一、模块二、模块三和最终总预览。不同模式只展示当前模块相关内容，同时提供已拍照片查看、空槽位补拍、已拍照片删除/重拍、按车辆采集证件、最终缺项提示、上传进度和完成结果。补拍流程通过显式返回上下文回到发起预览模式。

## 关联来源

**文档：**

- `PRDS/预览页多模式交互设计.md`
- `PRDS/查勘采集助手三阶段采集流程说明.md`
- `PRDS/查勘采集流程三阶段优化方案.md`
- `PRDS/PRD.md`
- `PRDS/UI.md`
- `PRDS/tech.md`
- `docs/test-cases.md`

**代码：**

- `packageD/pages/preview/preview.js`
- `packageD/pages/preview/preview.wxml`
- `packageD/pages/document/document.js`
- `packageD/pages/complete/complete.js`
- `packageD/components/photo-menu/`
- `packageD/components/confirm-modal/`
- `packageD/utils/documents.js`
- `packageD/utils/cache-selectors.js`
- `packageD/utils/album.js`
- `packageD/utils/workflow-page.js`

**测试：**

- `__tests__/module-one-preview.test.js`
- `__tests__/preview-driving-license.test.js`
- `__tests__/preview-layout.test.js`
- `__tests__/preview-album-save.test.js`
- `__tests__/document-upload-entry.test.js`
- `__tests__/complete-page.test.js`
- `e2e/specs/module-one-two-flow.spec.js`
- `e2e/specs/submit-consistency.spec.js`

## ADDED Requirements

### Requirement: 多模式预览内容隔离

系统 SHALL 通过显式预览模式区分模块一、模块二、模块三和最终总预览，并只展示该模式允许查看和操作的内容。

#### Scenario: 进入模块一预览
- **WHEN** 用户完成模块一车辆信息采集并进入 `moduleOne` 预览
- **THEN** 页面展示现场环境照片和各车辆的车牌、VIN 状态
- **AND** 页面不得混入模块二车损列表或最终提交动作

#### Scenario: 进入模块二预览
- **WHEN** 用户结束当前模块的车损采集并进入 `moduleTwo` 预览
- **THEN** 页面按车辆展示车损照片和每车补拍入口
- **AND** 新增车损不得要求重新采集车牌或 VIN

#### Scenario: 进入最终总预览
- **WHEN** 用户完成或跳过模块三缺项确认后进入 `final` 预览
- **THEN** 页面按阶段和车辆展示现场、车辆识别、车损与证件内容
- **AND** 页面提供最终上传或完成动作

### Requirement: 已拍照片与空槽位交互区分

系统 MUST 区分已完成照片和缺失槽位：已完成照片进入大图预览，缺失槽位进入对应的拍照或选择来源流程。

#### Scenario: 点击已拍照片
- **WHEN** 用户点击已有缩略图
- **THEN** 系统打开大图预览
- **AND** 用户可以从预览操作区执行删除或重拍

#### Scenario: 点击缺失槽位
- **WHEN** 用户点击车牌、VIN、车损、现场补充或证件的空槽位
- **THEN** 系统创建对应补拍上下文并进入相机或来源选择
- **AND** 系统不得把空槽位当作已有照片打开

### Requirement: 补拍返回上下文

系统 SHALL 在发起补拍、重拍或新增照片时保存预览返回模式，完成或取消采集后回到原预览上下文。

#### Scenario: 从模块一补拍现场照片
- **WHEN** 用户从模块一预览发起现场补充照片采集并确认照片
- **THEN** 系统返回 `moduleOne` 预览
- **AND** 新照片出现在现场环境区域

#### Scenario: 从最终预览补拍车损
- **WHEN** 用户从最终总预览发起某辆车的车损补拍
- **THEN** 系统完成确认后返回 `final` 预览
- **AND** 其他模块和车辆的内容保持不变

### Requirement: 车辆证件采集与缺项提示

系统 SHALL 按车辆维护驾驶证和行驶证的电子或实物资料，并允许用户在存在缺项时经过一次风险确认继续进入最终预览。

#### Scenario: 上传车辆证件
- **WHEN** 用户为当前车辆选择电子证件或实物正页/副页并完成拍照或相册选择
- **THEN** 系统把证件保存到当前车辆对应证件槽位
- **AND** 系统不立即产生重复的系统相册保存副作用

#### Scenario: 证件不完整继续
- **WHEN** 任一车辆证件不完整且用户选择进入最终预览
- **THEN** 系统显示一次缺项风险确认
- **AND** 用户确认后可以继续，缺项不得被伪装为已完成

### Requirement: 最终统计与完成结果一致

系统 MUST 使用当前缓存事实生成最终车辆数、车损照片数和证件照片数，删除或重拍后的旧照片不得出现在最终统计或提交数据中。

#### Scenario: 删除重拍后进入完成页
- **WHEN** 用户完成删除、重拍和补拍后执行最终完成流程
- **THEN** 完成页统计与当前车辆和照片集合一致
- **AND** 被删除或替换的旧照片不得出现在最终缓存或上传数据中

## 已知限制 / 待确认点

- `document` 独立页面仍保留历史上传入口，当前主要证件交互已集中在预览页，长期职责边界待确认。
- 预览布局包含 OpenHarmony 横屏适配，具体像素和缩放参数只保留代码引用。
- 缺失证件和缺失现场照片当前均采用风险提示后继续，不属于硬性完整性校验。
- 系统相册保存时机和保存失败提示仍依赖运行环境权限。
