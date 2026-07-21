## ADDED Requirements

### Requirement: 预览型恢复步骤不得停留在 camera 页
系统 MUST 在同 ticket 二次进入或 camera 页加载缓存时识别预览型步骤，并将用户恢复到对应预览页；只有合法拍摄步骤 SHALL 停留或进入 camera 页。

#### Scenario: 拍摄步骤恢复到 camera 页
- **WHEN** 缓存中的当前步骤为 `scene45`、`licensePlate`、`vinCode` 或 `damage`
- **THEN** 同 ticket 二次进入恢复到 camera 页
- **AND** 当前车辆索引与缓存事实一致

#### Scenario: 模块一预览恢复到模块一预览页
- **WHEN** 缓存中的当前步骤为 `moduleOnePreview`
- **THEN** 同 ticket 二次进入恢复到 `/packageD/pages/preview/preview?mode=moduleOne`

#### Scenario: 模块二预览恢复到模块二预览页
- **WHEN** 缓存中的当前步骤为 `damage` 且工作流状态为预览中，或缓存处于模块二预览态
- **THEN** 同 ticket 二次进入恢复到 `/packageD/pages/preview/preview?mode=moduleTwo`

#### Scenario: 模块三和最终预览恢复到对应预览页
- **WHEN** 缓存中的当前步骤为 `moduleThree` 或 `finalPreview`
- **THEN** 同 ticket 二次进入分别恢复到模块三预览页或最终总预览页

### Requirement: 非法确认步骤不得误存照片
系统 MUST 在确认照片时校验当前步骤白名单，仅允许 `scene45`、`sceneSupplement`、`licensePlate`、`vinCode` 和 `damage` 保存照片；未知或非拍摄步骤不得按车损保存，并 SHALL 回到安全页面或对应预览页并记录日志。

#### Scenario: camera 页加载预览型步骤时重定向
- **WHEN** camera 页从缓存加载到 `moduleOnePreview`、`moduleThree`、`finalPreview` 或旧 `preview` 步骤
- **THEN** 系统立即重定向到对应预览页
- **AND** 不停留在无法拍摄的 camera 页

#### Scenario: 未知步骤确认照片不写入车损
- **WHEN** camera 页当前步骤为未知或非拍摄步骤且用户触发确认照片
- **THEN** 系统不得把照片保存为车损照片
- **AND** 系统记录安全日志并返回安全预览页或首页
