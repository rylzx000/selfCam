# AI 自动抓拍能力

## 当前能力说明

selfCam 在车牌和车损步骤使用相机实时帧进行 AI 检测。车牌抓拍依据辅助框、识别结果和稳定性判断；车损抓拍通过检测、跟踪、面积、中心偏移、运动稳定性和阶段控制选择候选帧。AI 不可用时保留手动拍照入口，不阻断业务流程。

## 关联来源

**文档：**

- `PRDS/auto-capture-ai.md`
- `PRDS/tech.md`
- `PRDS/UI.md`
- `docs/ai-auto-capture-test-cases.md`
- `docs/env-config-design.md`

**代码：**

- `packageD/pages/camera/camera.js`
- `packageD/utils/ai-config.js`
- `packageD/utils/plate-detector.js`
- `packageD/utils/damage-detector.js`
- `packageD/utils/damage-auto-capture-engine.js`
- `packageD/utils/damage-phase-controller.js`
- `packageD/utils/damage-frame-scorer.js`
- `packageD/utils/damage-motion-estimator.js`
- `packageD/utils/damage-tracker.js`
- `packageD/utils/frame-utils.js`
- `packageD/utils/model-cache.js`
- `packageD/utils/yolo-process-utils.js`

**测试：**

- `__tests__/camera-ai-start.test.js`
- `__tests__/damage-capture-modules.test.js`
- `__tests__/ai-realtime-log.test.js`
- `__tests__/model-cache.test.js`
- `__tests__/camera-layout.test.js`
- `docs/ai-auto-capture-test-cases.md`

## ADDED Requirements

### Requirement: AI 按采集步骤启停

系统 SHALL 仅在支持 AI 的车牌或车损采集步骤启动对应检测能力，并在离开步骤、页面隐藏或页面销毁时停止实时帧监听和检测循环。

#### Scenario: 进入车损步骤
- **WHEN** 拍照页完成车损步骤数据初始化且相机实时帧可用
- **THEN** 系统启动车损检测和自动抓拍引擎
- **AND** 系统不得回退启动无关的车牌或 VIN 检测流程

#### Scenario: 离开 AI 采集步骤
- **WHEN** 用户进入确认态、预览页或其他不需要 AI 的步骤
- **THEN** 系统停止对应检测循环和重复定时器
- **AND** 系统不得在后台继续触发自动拍照

### Requirement: 自动抓拍门控

系统 MUST 在目标识别、目标位置、目标大小和画面稳定性均满足当前步骤规则时才触发自动抓拍。

#### Scenario: 目标符合抓拍条件
- **WHEN** 目标被识别且位于有效区域、面积处于允许范围、中心偏移和运动稳定性满足门控
- **THEN** 系统选择当前或评分更优的实时帧进入待确认态
- **AND** 系统记录自动抓拍来源和必要诊断信息

#### Scenario: 目标不稳定或位置不合格
- **WHEN** 目标位于辅助框外、距离过远或过近、面积不合格或画面抖动
- **THEN** 系统不得自动触发拍照
- **AND** 系统继续显示距离、位置或稳定性引导

### Requirement: 冷却与防重复触发

系统 SHALL 在一次自动抓拍触发后进入冷却或锁定状态，避免同一目标在确认完成前连续触发多张照片。

#### Scenario: 自动抓拍后连续检测到目标
- **WHEN** 已经存在待确认照片或自动抓拍仍处于冷却期
- **THEN** 系统忽略新的自动抓拍触发
- **AND** 现有待确认照片保持唯一

### Requirement: 实时帧几何兼容

系统 MUST 根据实时帧与相机显示区域的适配方式映射检测坐标，使 4:3、宽屏和近方形帧使用一致的可视门控语义。

#### Scenario: 非 4:3 实时帧
- **WHEN** 相机实时帧宽高比与虚拟相机区域不一致
- **THEN** 系统按实际 aspect-fill 裁剪关系转换目标坐标和面积
- **AND** 系统不得通过修改既有业务阈值来掩盖坐标映射错误

### Requirement: AI 失败时业务可继续

系统 SHALL 在模型加载、推理 API、检测器初始化或单帧分析失败时提供可诊断日志，并保留手动拍照能力。

#### Scenario: 推理能力不可用
- **WHEN** 当前运行环境不提供推理 API或模型初始化失败
- **THEN** 系统把 AI 状态标记为不可用并记录安全诊断信息
- **AND** 用户仍可使用手动拍照完成当前步骤

#### Scenario: 单帧检测失败
- **WHEN** 某次实时帧检测抛出异常或返回无效结果
- **THEN** 系统忽略该帧并继续后续检测
- **AND** 页面不得因单帧失败退出采集流程

## 已知限制 / 待确认点

- 模型文件、下载地址、量化和精度参数仍以 `PRDS/auto-capture-ai.md` 与 `ai-config.js` 为详细来源，不复制到规格。
- 部分 AI 测试仍属于真机手工验收，未标记完成的用例不能视为自动化通过。
- 不同设备相机帧格式和 OpenHarmony 横屏行为仍需持续真机验证。
- 车损面积与稳定性阈值属于当前实现参数，不在基线规格中固化具体数值。
