## ADDED Requirements

### Requirement: 预览恢复路径必须具备明确可退出性
系统 SHALL 在恢复到预览页后提供明确主操作，使用户可以继续采集、进入下一阶段、提交、重试上传、查看完成结果或退出完成页；系统 MUST 禁止新三阶段流程主动恢复到无 `mode` 普通预览，历史 `currentStep=preview` 只能作为输入被迁移到明确模式。

#### Scenario: 模块预览恢复后存在主操作
- **WHEN** 用户恢复到 `mode=moduleOne`、`mode=moduleTwo`、`mode=moduleThree` 或 `mode=final` 的预览页
- **THEN** 页面展示该模式对应的主操作
- **AND** 主操作分别可以进入车损拍摄、进入证件信息、进入最终总预览或提交

#### Scenario: 无 mode 普通预览历史输入被迁移
- **WHEN** 同 `ticket` 本地缓存处于 `currentStep=preview` 且 `workflowState=PREVIEWING`
- **THEN** 首页恢复 MUST NOT 跳转 `/packageD/pages/preview/preview` 无 `mode`
- **AND** 无法从缓存推导模块时 MUST 恢复到 `/packageD/pages/preview/preview?mode=final`

#### Scenario: 大图预览关闭后回到列表预览
- **WHEN** 用户在预览页点击已拍照片打开大图预览层
- **AND** 用户关闭大图预览层
- **THEN** 页面回到当前模式的列表预览
- **AND** 底部主操作不得被大图预览层遮挡

#### Scenario: 上传态恢复后存在可继续路径
- **WHEN** 用户恢复到上传失败、上传中、上传完成待 complete、完成失败或已完成的预览上传态
- **THEN** 页面展示上传遮罩或跳转完成页
- **AND** 失败态提供重试操作，已完成态进入完成页
