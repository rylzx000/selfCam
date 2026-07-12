## MODIFIED Requirements

### Requirement: 后端上传项映射

系统 SHALL 将案件级现场照片、车辆级识别照片、车损照片和证件照片映射到后端定义的上传项，并保留图片类型、排序、来源元数据及适用的案件或车辆归属信息。

#### Scenario: 初始化案件级上传项
- **WHEN** 初始化结果包含 `caseUploadItems`
- **THEN** 系统把 `SCENE_45` 和 `SCENE_SUPPLEMENT` 保存为案件级上传槽位
- **AND** 系统保留 `SCENE_SUPPLEMENT.maxCount`，前端 mock 和测试数据按最多 3 张补充现场照片同步口径
- **AND** 系统不得把案件级上传项写入任一车辆的 `uploadItems`
