## MODIFIED Requirements

### Requirement: 后端上传项映射

系统 SHALL 将案件级现场照片、车辆级识别照片、车损照片和证件照片映射到后端定义的上传项，并保留图片类型、排序、来源元数据及适用的案件或车辆归属信息。

#### Scenario: 初始化案件级上传项
- **WHEN** 初始化结果包含 `caseUploadItems`
- **THEN** 系统把 `SCENE_45` 和 `SCENE_SUPPLEMENT` 保存为案件级上传槽位
- **AND** 系统不得把案件级上传项写入任一车辆的 `uploadItems`

#### Scenario: 初始化车辆级上传项
- **WHEN** 初始化结果包含 `vehicles[].uploadItems`
- **THEN** 系统按车辆保存车牌、VIN、车损、驾驶证和行驶证上传槽位
- **AND** 每个车辆级上传项保留对应的 `vehicleId`

#### Scenario: 创建案件级上传队列
- **WHEN** 用户进入最终上传且缓存中存在已确认的案件级现场照片
- **THEN** 系统使用对应 `caseUploadItems` 创建上传项
- **AND** 案件级上传项不要求真实 `vehicleId`

#### Scenario: 创建车辆级上传队列
- **WHEN** 用户进入最终上传且缓存中存在已确认的车辆级照片
- **THEN** 系统为可上传照片创建稳定的上传项
- **AND** 每个上传项关联正确的车辆和车辆级上传槽位
