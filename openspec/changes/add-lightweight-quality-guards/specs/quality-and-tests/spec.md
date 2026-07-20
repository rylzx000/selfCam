## MODIFIED Requirements

### Requirement: 自动化测试矩阵与质量门禁

系统 MUST 维护一组轻量自动化质量门禁，用于提前发现流程矩阵、三阶段预览跳转、用户可见文案、分包素材和 Comet/OpenSpec 临时产物风险。门禁不得依赖新增第三方依赖；过期文案检测必须聚焦当前三阶段主流程误导文案，不得误伤 AI 专项文档、AI 状态枚举、AI 调试/日志说明、无关历史方案或测试说明历史背景。

#### Scenario: 流程矩阵声明已覆盖但 Jest 缺失
- **WHEN** `docs/test-flow-route-matrix.md` 中的流程用例标记为 `已覆盖`、`已补充` 或 `本轮补充`
- **AND** 该行未明确标记 `需真机`、`抽测`、`暂未覆盖` 或 `不覆盖`
- **THEN** 对应用例 ID 必须能在 `__tests__/workflow-route-matrix.test.js` 中找到
- **AND** 检测失败时必须输出缺失用例 ID 列表

#### Scenario: 新三模块流程跳到无 mode 老预览
- **WHEN** 当前三阶段流程相关源码中出现 `/packageD/pages/preview/preview`
- **THEN** 该跳转地址必须带 `mode=moduleOne`、`mode=moduleTwo`、`mode=moduleThree` 或 `mode=final`
- **AND** 检测必须继续覆盖字符串字面量跳转
- **AND** 检测必须覆盖 `return PREVIEW_PAGE_URL`、`url: PREVIEW_PAGE_URL`、`wx.navigateTo({ url: PREVIEW_PAGE_URL })`、`wx.redirectTo({ url: PREVIEW_PAGE_URL })` 和 `wx.reLaunch({ url: PREVIEW_PAGE_URL })` 等危险变量用法
- **AND** 局部变量 `previewUrl` 仅当最近有效赋值来自 `getPreviewPageUrl(...)` 时允许
- **AND** 若 `previewUrl` 在使用前被重赋值为无 `mode` 老预览地址或其他非 `getPreviewPageUrl(...)` 来源，检测必须拦截并输出最近赋值行
- **AND** `getPreviewPageUrl(...)` 内部直接返回无 `mode` 老预览地址的位置必须以具体文件、具体上下文和“旧流程兜底，不是新三模块入口”原因登记白名单
- **AND** 如需保留旧兼容逻辑，必须以具体文件、具体命中片段或上下文和保留原因登记白名单
- **AND** 检测失败时必须输出具体文件、行号、命中代码片段和建议

#### Scenario: 当前用户可见页面或主文档出现过期文案
- **WHEN** 当前用户可见页面或当前主文档出现旧自动拍照、身份证作为当前采集项、带 `12123` 的证件叫法或过期车损数量文案
- **THEN** 检测必须失败
- **AND** 检测必须使用克制正则覆盖 `稳定后自动拍摄`、`正在自动拍照`、`已自动拍照`、`5 张车损`、`车损照片 x/5`、`满 5 张` 等变体
- **AND** 检测失败时必须输出文件路径、命中文案和建议替换方向
- **AND** AI 专项章节、AI 状态枚举、AI 调试/日志说明中的自动拍照状态文案不应失败
- **AND** 明确排除当前历史背景、旧方案、归档文档、AI 旧文档和测试说明中的历史语境

#### Scenario: 分包素材过大或误放源文件
- **WHEN** `packageD/assets` 中图片超过阈值、出现 `.zip`、`.tmp`、`.psd`、`.sketch`、原始大图或 `.tmp-*` 临时文件
- **THEN** 检测必须失败
- **AND** 图片大小失败信息必须输出素材路径、实际大小和阈值

#### Scenario: OpenSpec 或 Comet 变更目录误提交临时产物
- **WHEN** `openspec/changes` 下 active change 或 archive change 中出现 `.tmp-*`、`*.tmp`、zip 临时包、明显临时目录或编辑器备份文件
- **THEN** 检测必须失败
- **AND** 检测失败时必须输出具体路径和命中原因
- **AND** 检测不得误伤正常 Comet/OpenSpec 文件，例如 `.comet.yaml`、`.openspec.yaml`、`.comet/state-events.jsonl`、`.comet/trajectory.jsonl`、`.comet/skill-snapshots/**/package.json` 和 `.comet/skill-snapshots/**/sha256`

#### Scenario: 破坏性压测覆盖地图索引已有测试与缺口
- **WHEN** 维护测试说明文档
- **THEN** 系统 MUST 提供 `docs/destructive-stress-test-coverage.md`
- **AND** 该文档 MUST 定位为破坏性压测覆盖地图，不替代流程矩阵、异常流清单或测试运行指引
- **AND** 该文档 MUST 归纳缓存/状态恢复、三阶段路由乱序、删除/重拍/补拍、多车隔离、容量边界、上传/完成失败恢复、权限/相册异常、质量门禁/素材门禁的已有覆盖
- **AND** 每条测试场景 SHOULD 包含 ID、场景、风险、当前状态、推荐实现方式、优先级和关联文件
- **AND** 未自动化覆盖或必须真机确认的场景 MUST 标记为未覆盖、部分覆盖或需真机，不得声明为已覆盖

#### Scenario: 模块二少于三张车损软确认防重复推进
- **WHEN** 当前车辆车损少于 3 张并点击完成本车拍摄
- **AND** 用户连续触发完成、取消、确认或重复完成动作
- **THEN** Jest 用例 MUST 覆盖软确认不重复推进下一车
- **AND** 确认进入交接后 MUST 只推进到下一车一次
- **AND** 缓存中的 `currentVehicleIndex`、`currentStep` 和页面车辆信息 MUST 保持一致

#### Scenario: 最终预览全局乱序删除补拍仍保持 final
- **WHEN** 最终预览连续删除 45 度、现场补充、第二车车牌、第二车 VIN、第二车车损和证件
- **THEN** Jest 用例 MUST 覆盖各空槽或上传入口仍可见
- **AND** 触发补拍或上传后 MUST 保持 `previewReturnMode=final` 或停留最终预览上下文
- **AND** 流程不得进入 `moduleOne`、`moduleTwo`、`moduleThree` 或无 `mode` 老预览

#### Scenario: 上传中断恢复继续未完成项
- **WHEN** `uploadSession` 中同时存在 `success`、`uploading` 和 `pending` 项
- **THEN** Jest 用例 MUST 覆盖重新进入预览页后 `uploading` 回落为可继续的未完成项
- **AND** 已成功项 MUST 不重复调用上传接口
- **AND** 中断项和待上传项 MUST 继续上传至成功
