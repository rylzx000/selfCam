# 质量规则与验证方式

## 当前能力说明

selfCam 提供可配置的拍后轻质检，覆盖模糊、偏暗、过曝和预留的距离风险提示。轻质检采用默认配置、远程配置和本地缓存三层机制，分析失败或功能关闭时不得阻断照片保存。项目同时使用 Jest 单元测试、微信开发者工具 automator/e2e 和手工真机用例验证流程、容量、恢复和提交一致性。

## 关联来源

**文档：**

- `docs/photo-quality-design.md`
- `docs/quality-config-design.md`
- `docs/test-run-guide.md`
- `docs/test-cases.md`
- `docs/abnormal-flow-test-cases.md`
- `docs/ai-auto-capture-test-cases.md`
- `docs/codex-review-workflow.md`

**代码：**

- `packageD/utils/photo-quality.js`
- `packageD/utils/quality-config.js`
- `packageD/utils/quality-config-default.js`
- `packageD/utils/quality-config-loader.js`
- `packageD/pages/camera/camera.js`
- `packageD/utils/responsive-ui.js`
- `packageD/utils/cache-selectors.js`
- `packageD/utils/workflow-state.js`

**测试：**

- `__tests__/photo-quality.test.js`
- `__tests__/quality-config.test.js`
- `__tests__/camera-photo-quality.test.js`
- `__tests__/camera-layout.test.js`
- `__tests__/preview-layout.test.js`
- `__tests__/cache-selectors.edge.test.js`
- `__tests__/workflow-recovery.test.js`
- `e2e/specs/capacity-boundary.spec.js`
- `e2e/specs/current-regression.spec.js`
- `e2e/specs/recovery-chaos.spec.js`
- `e2e/specs/submit-consistency.spec.js`

## ADDED Requirements

### Requirement: 拍后轻质检不阻断主流程

系统 SHALL 在照片进入确认流程时按配置执行拍后轻质检，并以提示和元数据形式返回结果；功能关闭、输入无效或分析失败时不得阻断照片确认与保存。

#### Scenario: 检测到质量风险
- **WHEN** 照片分析结果满足模糊、偏暗、过曝或启用的距离风险规则
- **THEN** 系统生成对应质量原因和用户提示
- **AND** 用户仍可选择确认使用或重新拍摄

#### Scenario: 轻质检关闭
- **WHEN** 当前配置的质量总开关为关闭
- **THEN** 系统返回稳定的 disabled 结果
- **AND** 系统不显示质量风险提示、不改变照片保存流程

#### Scenario: 分析失败
- **WHEN** 图片输入无效或分析过程抛出异常
- **THEN** 系统返回安全的 analyze_failed 结果
- **AND** 照片仍可进入原有确认和持久化流程

### Requirement: 质量配置分层与安全降级

系统 MUST 合并默认配置、有效远程配置和未过期本地缓存，并对缺失字段、非法类型、过期缓存和加载失败进行安全降级。

#### Scenario: 远程配置成功
- **WHEN** 远程质量配置通过校验并成功加载
- **THEN** 系统与默认配置合并后使用新配置
- **AND** 系统把有效配置写入本地缓存供后续复用

#### Scenario: 配置加载失败
- **WHEN** 远程请求失败、响应无效或本地缓存已过期
- **THEN** 系统回退到允许环境使用的默认配置
- **AND** 配置失败不得阻断统一业务入口

#### Scenario: release 环境缺少远程配置
- **WHEN** release 环境没有可用远程地址或远程配置不可用
- **THEN** 系统使用安全默认值并记录警告
- **AND** 系统不得静默复用 develop mock 配置

### Requirement: 自动化测试按风险分级

项目 SHALL 使用与改动风险相匹配的最小验证集，并在跨页面流程、缓存、上传、AI 几何或发布前场景扩大到对应 Jest、automator 或 e2e 测试。

#### Scenario: 文档或小范围规则修改
- **WHEN** 变更不影响业务运行代码
- **THEN** 项目只需执行文档结构或 OpenSpec 校验
- **AND** 不要求运行全量 Jest 或微信开发者工具自动化

#### Scenario: 跨页面流程或缓存修改
- **WHEN** 变更涉及流程状态、缓存结构、上传或多车数据
- **THEN** 项目运行直接相关单元测试
- **AND** 在影响范围较大或发布前运行对应 e2e 或全量测试

### Requirement: 容量与多车一致性验证

系统 MUST 在容量边界、删除、重拍、补拍和多车乱序操作后保持车辆归属、照片数量、排序和统计一致。

#### Scenario: 达到全局容量边界
- **WHEN** 当前缓存达到前端允许的总图片容量
- **THEN** 系统阻止继续新增并显示明确提示
- **AND** 删除一张照片后释放的容量允许再次新增

#### Scenario: 多车乱序修改
- **WHEN** 用户删除或重拍其中一辆车的照片
- **THEN** 目标车辆的数据按操作更新
- **AND** 其他车辆的数据、排序和统计保持不变

### Requirement: 恢复与提交一致性验证

系统 SHALL 在退出重进、损坏缓存恢复、删除重拍和最终提交后保持页面摘要、缓存事实、上传队列和完成页统计一致。

#### Scenario: 操作后退出重进
- **WHEN** 用户删除或重拍照片后退出并重新进入
- **THEN** 页面展示与持久化缓存保持一致
- **AND** 已删除照片不得重新出现

#### Scenario: 最终提交一致
- **WHEN** 多车照片和证件完成上传并进入完成页
- **THEN** 上传数据与当前缓存中的有效照片集合一致
- **AND** 完成页车辆数、车损数和证件数与最终事实一致

## 已知限制 / 待确认点

- 测试文档中的 `[ ]` 手工场景不代表已经通过，只有本轮实际执行或自动化测试覆盖的行为可声明为已验证。
- 微信开发者工具 automator 和真机验证成本较高，默认不在纯规格转换中运行。
- 全局 50 张容量限制由当前 e2e 固化，是否长期作为产品规则仍需确认。
- 轻质检的具体阈值、远程配置协议和性能预算继续引用设计文档与代码，不在规格中固化。
