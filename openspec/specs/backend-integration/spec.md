# backend-integration Specification

## Purpose
TBD - created by archiving change baseline-existing-selfcam. Update Purpose after archive.
## Requirements
### Requirement: ticket 初始化与状态拦截

系统 MUST 在辅助拍照入口使用 ticket 调用初始化能力，并根据后端 ticket 状态决定是否创建、恢复或阻止采集流程。

#### Scenario: 有效 ticket 初始化
- **WHEN** 入口包含有效 ticket 且初始化接口返回可采集状态、车辆和上传项
- **THEN** 系统建立辅助拍照缓存和后端车辆映射
- **AND** 系统进入新采集或可恢复页面

#### Scenario: 不可继续的 ticket
- **WHEN** 初始化结果或本地恢复状态表明 ticket 已完成、过期或撤销
- **THEN** 系统阻止进入上传和完成流程
- **AND** 系统向用户展示轻量状态提示

### Requirement: 后端上传项映射

系统 SHALL 将案件级现场照片、车辆级识别照片、车损照片和证件照片映射到后端定义的上传项，并保留车辆标识、图片类型、排序和来源元数据。

#### Scenario: 创建上传队列
- **WHEN** 用户进入最终上传且缓存中存在已确认照片
- **THEN** 系统为可上传照片创建稳定的上传项
- **AND** 每个上传项关联正确的车辆或案件级上传槽位

#### Scenario: 后端提供案件级现场槽位
- **WHEN** 初始化结果包含现场环境上传项元数据
- **THEN** 系统使用后端元数据映射现场照片
- **AND** 系统不得把案件级现场照片误归属到单辆车辆

### Requirement: 图片逐张上传与可恢复重试

系统 MUST 使用 JSON Base64 请求逐张上传图片，成功项在后续重试中不得重复上传，失败项可以从持久化状态继续。

#### Scenario: 部分图片上传失败
- **WHEN** 上传队列中的某一图片失败
- **THEN** 系统停止或标记当前上传会话为失败并保存失败项
- **AND** 用户重试时只继续未成功的图片

#### Scenario: 上传中断后恢复
- **WHEN** 页面退出或进程中断后重新进入且存在可恢复上传会话
- **THEN** 系统从缓存恢复已成功、失败和待上传状态
- **AND** 已成功图片不得重新上传

### Requirement: 完成接口独立于图片上传

系统 SHALL 仅在全部图片上传成功后调用完成接口，并把完成失败与图片上传失败分开记录和重试。

#### Scenario: 全部上传成功
- **WHEN** 上传会话中的全部图片状态为成功
- **THEN** 系统调用完成接口
- **AND** 完成成功后进入可结束状态或完成页

#### Scenario: 完成接口失败
- **WHEN** 图片已全部上传但完成接口失败
- **THEN** 系统保留图片成功记录并标记完成失败
- **AND** 用户重试时只重新调用完成接口

### Requirement: 环境与 mock 隔离

系统 MUST 根据小程序环境和项目配置选择真实接口或本地 mock；release 环境不得静默使用 mock 数据替代真实后端。

#### Scenario: 开发环境 mock ticket
- **WHEN** develop 环境启用 mock 且 ticket 符合 mock 规则
- **THEN** 系统可以使用本地 mock 初始化、上传和完成能力
- **AND** mock 行为不得写入真实后端

#### Scenario: release 环境配置不完整
- **WHEN** release 环境缺少真实接口地址或请求能力
- **THEN** 系统安全失败并记录配置问题
- **AND** 系统不得自动回退到 mock 完成业务

### Requirement: 错误日志安全上报

系统 SHALL 仅上报允许的 error 级事件和安全摘要字段，不得上传密钥、cookie、图片 Base64、请求体或本地图片路径。

#### Scenario: 真实请求失败
- **WHEN** 初始化、图片上传或完成请求失败
- **THEN** 系统通过 runtime logger 记录并按白名单上报错误摘要
- **AND** 日志使用 ticket 关联业务且不包含敏感内容

#### Scenario: warning 或 mock 失败
- **WHEN** 事件级别不是 error 或请求属于本地 mock 流程
- **THEN** 系统不得把该事件上传到在线错误日志接口
