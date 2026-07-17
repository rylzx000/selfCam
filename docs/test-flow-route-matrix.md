# 流程路由测试矩阵

## 文档目的

本矩阵用于系统排查三模块拍摄流程中的同类跳转问题，重点覆盖补拍、重拍、删除后补拍、查看已拍、自然流程、最终预览重拍返回和兜底跳转。矩阵只描述流程路由，不覆盖 UI 样式、上传、图片压缩、AI 自动拍照质量门控或真机相机能力。

## 页面模式定义

- `moduleOne`：模块一预览页，展示现场环境及车辆信息。
- `moduleTwo`：模块二预览页，展示车损照片。
- `moduleThree`：证件信息页，展示车辆驾驶证和行驶证槽位。
- `final`：最终总预览，提交前统一确认全部采集内容。

## 核心路由规则

- 从模块正式预览进入补拍或重拍，拍完后按动作语义返回原模块预览或继续当前采集流程。
- 从最终预览进入重拍，拍完后必须回最终总预览。
- 查看已拍必须进入当前流程对应预览页，不进入无 `mode` 的老预览页。
- 模块一自然拍摄中临时查看已拍后补必拍空槽，应继续模块一下一项未拍必拍项；正式预览补空槽才回模块一预览。
- 模块二点击已有车损重拍应回预览；点击 `+` 新增车损应继续当前车辆车损拍摄。
- 删除后补拍需按入口动作区分：正式模块一空槽回预览，模块二删除后点击 `+` 新增车损继续车损拍摄。
- 只有首次自然拍摄流程才允许进入下一拍摄步骤。
- 新三模块流程不应跳转 `/packageD/pages/preview/preview` 无 `mode`。
- `capturePreviewSource` 用于标记拍摄页“查看已拍”形成的临时预览来源，`captureReturnStrategy` 用于标记本次进入相机后的返回策略；字段名保留英文是为了兼容代码字段和机器可读状态。
- 预览页 `onLoad` / `onShow` / `loadData` / safe resume 不得过早清理临时预览来源，否则空槽或 `+` 点击无法区分临时预览、正式预览和最终预览。

## 模块一测试矩阵

| 用例ID | 场景 | 起点 | 操作 | 期望跳转 / 期望状态 | 自动化覆盖状态 | Jest 文件 / 用例名 |
|---|---|---|---|---|---|---|
| ROUTE-M1-001 | 首次自然拍完 45 度 | 相机页 `scene45` | 确认照片 | 留在相机页并进入 `licensePlate` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-001` |
| ROUTE-M1-002 | 从模块一预览补拍 45 度 | `mode=moduleOne` | 确认照片 | 返回 `mode=moduleOne`，不得进入车牌号 | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-002` |
| ROUTE-M1-003 | 删除 45 度后点击 + 框补拍 | `mode=moduleOne` | 确认照片 | 返回 `mode=moduleOne`，不得进入车牌号 | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-003` |
| ROUTE-M1-004 | 首次自然拍完车牌号 | 相机页 `licensePlate` | 确认照片 | 留在相机页并进入 `vinCode` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-004` |
| ROUTE-M1-005 | 从模块一预览补拍车牌号 | `mode=moduleOne` | 确认照片 | 返回 `mode=moduleOne`，不得进入 VIN | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-005` |
| ROUTE-M1-006 | 车牌号拍摄页查看已拍 | 相机页 `licensePlate` | 点击查看已拍 | 进入 `mode=moduleOne`，不得进入无 mode 老预览 | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-006` |
| ROUTE-M1-007 | 从模块一预览补拍 VIN | `mode=moduleOne` | 确认照片 | 返回 `mode=moduleOne`，不得进入下一车或模块二 | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-007` |
| ROUTE-M1-008 | VIN 拍摄页查看已拍 | 相机页 `vinCode` | 点击查看已拍 | 进入 `mode=moduleOne`，不得进入无 mode 老预览 | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-008` |
| ROUTE-M1-009 | 现场补充照片补拍完成 | 相机页 `sceneSupplement` | 确认照片 | 返回 `mode=moduleOne`，不再次弹补充提示 | 已覆盖路由，提示需现有预览测试补充观察 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-009` |
| ROUTE-M1-010 | 双车模块一自然流程 | 相机页 `vinCode` | 依次确认两辆车 VIN | 标的车 VIN 后进入三者车车牌，三者车 VIN 后进入 `mode=moduleOne` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-010` |
| ROUTE-M1-011 | 模块一临时查看已拍补 45 度空槽 | 相机页自然流程点击查看已拍进入 `mode=moduleOne` | 点击 45 度空槽并确认照片 | 继续进入首辆车 `licensePlate`，清理 `captureReturnStrategy` | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-011` |
| ROUTE-M1-012 | 模块一临时查看已拍补车牌空槽 | 相机页自然流程点击查看已拍进入 `mode=moduleOne` | 点击车牌空槽并确认照片 | 继续进入同车 `vinCode`，清理 `captureReturnStrategy` | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-012` |
| ROUTE-M1-013 | 模块一临时查看已拍补 VIN 后继续下一车 | 相机页自然流程点击查看已拍进入 `mode=moduleOne`，存在下一辆车未拍 | 点击当前车 VIN 空槽并确认照片 | 继续下一辆车 `licensePlate`，全部完成时进入 `mode=moduleOne` | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-013` |
| ROUTE-M1-014 | 模块一正式预览补空槽 | `mode=moduleOne` 正式预览 | 点击空槽并确认照片 | 返回 `mode=moduleOne`，不继续自然拍摄 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M1-014` |

## 模块二测试矩阵

| 用例ID | 场景 | 起点 | 操作 | 期望跳转 / 期望状态 | 自动化覆盖状态 | Jest 文件 / 用例名 |
|---|---|---|---|---|---|---|
| ROUTE-M2-001 | 从模块一预览进入车损拍摄 | `mode=moduleOne` | 确认阶段完成 | 直接进入第一辆车 `damage`，不再拍车牌/VIN | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-001` |
| ROUTE-M2-002 | 车损拍摄页查看已拍 | 相机页 `damage` | 点击查看已拍 | 进入 `mode=moduleTwo`，不得进入老预览或 stale final | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-002` |
| ROUTE-M2-003 | 从模块二预览补拍车损 | `mode=moduleTwo` | 确认照片 | 返回 `mode=moduleTwo` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-003` |
| ROUTE-M2-004 | 从最终预览补拍车损 | `mode=final` | 确认照片 | 返回 `mode=final` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-004` |
| ROUTE-M2-005 | 多车当前车完成后拍下一辆 | 相机页 `damage` | 弹层确认下一辆 | 留在相机页并切到下一车 `damage` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-005` |
| ROUTE-M2-006 | 多车当前车完成后查看已拍 | 相机页 `damage` | 弹层点击查看已拍 | 进入 `mode=moduleTwo` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-006` |
| ROUTE-M2-007 | 模块二已有 5 张车损重拍第 3 张 | `mode=moduleTwo` | 点击第 3 张重拍并确认照片 | 返回 `mode=moduleTwo`，替换第 3 张 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-007` |
| ROUTE-M2-008 | 模块二已有 5 张车损点击 `+` 拍第 6 张 | `mode=moduleTwo` | 点击 `+` 并确认照片 | 继续当前车辆 `damage` 拍摄，车损数量变 6，清理 `captureReturnStrategy` | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-008` |
| ROUTE-M2-009 | 删除第 3 张后点击 `+` 新增 | `mode=moduleTwo`，删除后剩 4 张 | 点击 `+` 并确认照片 | 继续当前车辆 `damage` 拍摄，车损数量变 5 且编号连续 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-009` |
| ROUTE-M2-010 | 多车第二辆点击 `+` 新增车损 | `mode=moduleTwo`，第二辆车当前分组 | 点击第二辆车 `+` 并确认照片 | 继续第二辆车 `damage` 拍摄，不跳第一辆或最终预览 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-010` |
| ROUTE-M2-011 | 多车当前车低于 3 张点击完成 | 相机页 `damage`，第一辆车已拍 2 张且仍有下一辆车 | 点击 `完成本车拍摄`，再点击 `确认完成`，再确认下一辆 | 先展示 `车损照片较少` 软确认；确认后仍按当前车辆交接进入下一辆车损，不串车 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M2-011` |

## 完整链路回归矩阵

旧 `ROUTE-M1-011` 只预置了 `captureReturnStrategy=continueModuleOne` 后直接确认照片，能证明相机页拿到策略后会继续车牌，但没有覆盖“相机页点击查看已拍 → 预览页生命周期与 safe resume → 点击空槽 / 加号 / 重拍 → 回相机确认照片”的真实链路。因此本轮补充 `LINK-*` 用例，专门防止临时预览来源在预览页加载时被过早清理。

| 用例ID | 场景 | 完整链路 | 期望跳转 / 期望状态 | 自动化覆盖状态 | Jest 文件 / 用例名 |
|---|---|---|---|---|---|
| LINK-M1-011 | 模块一临时预览补 45 度空槽 | 相机页 45 度 → 查看已拍 → `mode=moduleOne` → 点击 45 度空槽 → 确认照片 | 继续首辆车 `licensePlate`，清理临时上下文 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `LINK-M1-011` |
| LINK-M1-012 | 模块一临时预览补车牌空槽 | 相机页车牌 → 查看已拍 → `mode=moduleOne` → 点击车牌空槽 → 确认照片 | 继续同车 `vinCode`，清理临时上下文 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `LINK-M1-012` |
| LINK-M1-013 | 模块一临时预览补 VIN 空槽 | 相机页 VIN → 查看已拍 → `mode=moduleOne` → 点击 VIN 空槽 → 确认照片 | 有下一辆车时继续下一车车牌；全部完成后进入 `moduleOne` | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `LINK-M1-013` |
| LINK-M1-014 | 模块一正式预览补空槽 / 重拍 | `mode=moduleOne` 正式预览 → 点击空槽或已有照片 → 确认照片 | 返回当前 `moduleOne` 预览，不继续自然流程 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `LINK-M1-014` |
| LINK-FINAL-001 | 最终预览补模块一空槽 / 重拍 | `mode=final` → 点击 45 度 / 车牌 / VIN 空槽或已有照片 → 确认照片 | 返回 `final`，不进入模块一自然流程 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `LINK-FINAL-001` |
| LINK-M2-008 | 模块二临时预览新增 / 重拍车损 | 相机页车损 → 查看已拍 → `mode=moduleTwo` → 点击 `+` 或已有车损 → 确认照片 | 新增继续当前车辆 `damage`；重拍返回 `moduleTwo` | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `LINK-M2-008` |
| LINK-M2-011 | 模块二正式预览新增 / 重拍车损 | `mode=moduleTwo` 正式预览 → 点击 `+` 或已有车损 → 确认照片 | 新增继续当前车辆 `damage`；重拍返回 `moduleTwo` | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `LINK-M2-011` |
| LINK-FINAL-002 | 最终预览新增 / 重拍车损 | `mode=final` → 点击 `+` 或已有车损 → 确认照片 | 返回 `final`，不进入模块二自然车损流程 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `LINK-FINAL-002` |

## 模块三测试矩阵

| 用例ID | 场景 | 起点 | 操作 | 期望跳转 / 期望状态 | 自动化覆盖状态 | Jest 文件 / 用例名 |
|---|---|---|---|---|---|---|
| ROUTE-M3-001 | 补拍驾驶证电子 | `mode=moduleThree` | 选择拍照并保存 | 停留证件信息页，缓存仍为 `moduleThree` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M3-001` |
| ROUTE-M3-002 | 补拍驾驶证实物正页/副页 | `mode=moduleThree` | 选择拍照并保存 | 停留证件信息页，缓存仍为 `moduleThree` | 已覆盖正页；副页需真机抽测 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M3-002` |
| ROUTE-M3-003 | 补拍行驶证电子 | `mode=moduleThree` | 选择拍照并保存 | 停留证件信息页，缓存仍为 `moduleThree` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M3-003` |
| ROUTE-M3-004 | 补拍行驶证实物正页/副页 | `mode=moduleThree` | 选择拍照并保存 | 停留证件信息页，缓存仍为 `moduleThree` | 已覆盖副页；正页需真机抽测 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M3-004` |
| ROUTE-M3-005 | 从最终预览重拍任一证件 | `mode=final` | 选择拍照并保存 | 停留最终总预览，缓存仍为 `finalPreview` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-M3-005` |

## 最终总预览测试矩阵

| 用例ID | 场景 | 起点 | 操作 | 期望跳转 / 期望状态 | 自动化覆盖状态 | Jest 文件 / 用例名 |
|---|---|---|---|---|---|---|
| ROUTE-FINAL-001 | 从最终预览重拍 45 度 | `mode=final` | 确认照片 | 返回 `mode=final` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FINAL-001` |
| ROUTE-FINAL-002 | 从最终预览重拍现场补充照片 | `mode=final` | 确认照片 | 返回 `mode=final` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FINAL-002` |
| ROUTE-FINAL-003 | 从最终预览重拍车牌号 | `mode=final` | 确认照片 | 返回 `mode=final`，不得进入 VIN | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FINAL-003` |
| ROUTE-FINAL-004 | 从最终预览重拍 VIN | `mode=final` | 确认照片 | 返回 `mode=final`，不得进入车损 | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FINAL-004` |
| ROUTE-FINAL-005 | 从最终预览重拍车损 | `mode=final` | 重拍保存且 navigateBack 失败 | 兜底返回 `mode=final` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FINAL-005` |
| ROUTE-FINAL-006 | 从最终预览重拍证件 | `mode=final` | 证件来源选择保存 | 停留最终总预览证件上下文 | 已覆盖入口状态，需真机验证拍照弹层 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FINAL-006` |
| ROUTE-FINAL-007 | 最终预览重拍已有车损 | `mode=final`，已有车损照片 | 点击已有车损重拍并确认照片 | 返回 `mode=final`，不得进入模块二车损拍摄 | 本轮补充 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FINAL-007` |

## 异常与兜底跳转矩阵

| 用例ID | 场景 | 起点 | 操作 | 期望跳转 / 期望状态 | 自动化覆盖状态 | Jest 文件 / 用例名 |
|---|---|---|---|---|---|---|
| ROUTE-FB-001 | 模块一预览进入相机后 navigateBack 失败 | 相机页，栈内有预览页 | 触发返回预览 | 兜底 `redirectTo mode=moduleOne` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FB-001` |
| ROUTE-FB-002 | 模块二预览进入相机后 navigateBack 失败 | 相机页，栈内有预览页 | 触发返回预览 | 兜底 `redirectTo mode=moduleTwo` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FB-002` |
| ROUTE-FB-003 | 最终预览进入相机后 navigateBack 失败 | 相机页，栈内有预览页 | 触发返回预览 | 兜底 `redirectTo mode=final` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FB-003` |
| ROUTE-FB-004 | 任意新三模块流程不得跳老预览 | 新三模块相机流程 | 点击查看已拍或返回预览 | 不出现 `/packageD/pages/preview/preview` 无 `mode` | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ROUTE-FB-004` |

## 删除后入口可达性矩阵

| 用例ID | 场景 | 起点 | 操作 | 期望跳转 / 期望状态 | 自动化覆盖状态 | Jest 文件 / 用例名 |
|---|---|---|---|---|---|---|
| ACCESS-M1-001 | 模块一删除 45 度 | `mode=moduleOne` | 删除后点击 45 度空槽位 | 进入相机 `scene45`，`previewReturnMode=moduleOne` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-M1-001` |
| ACCESS-M1-002 | 模块一删除车牌号 | `mode=moduleOne` | 删除后点击车牌空槽位 | 进入相机 `licensePlate`，`previewReturnMode=moduleOne` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-M1-002` |
| ACCESS-M2-001 | 模块二删除最后一张车损 | `mode=moduleTwo` | 删除后点击车损空入口 | 进入相机 `damage`，`previewReturnMode=moduleTwo` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-M2-001` |
| ACCESS-M3-001 | 模块三删除驾驶证 | `mode=moduleThree` | 删除后查看证件区 | 驾驶证上传入口重新出现 | 已补充 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-M3-001` |
| ACCESS-FINAL-001 | 最终预览删除唯一 45 度 | `mode=final` | 删除后查看现场环境区 | 现场环境区不消失，45 度空槽位可见 | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-FINAL-001` |
| ACCESS-FINAL-002 | 最终预览删除 45 度但仍有补充照片 | `mode=final` | 删除后查看现场环境区 | 45 度空槽位仍可见 | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-FINAL-002` |
| ACCESS-FINAL-003 | 最终预览删除现场补充照片 | `mode=final` | 删除后查看现场环境区 | 补充现场照片空入口仍可见 | 已覆盖 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-FINAL-003` |
| ACCESS-FINAL-004 | 最终预览删除车牌号 | `mode=final` | 删除后点击车牌空槽位 | 进入相机 `licensePlate`，`previewReturnMode=final` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-FINAL-004` |
| ACCESS-FINAL-005 | 最终预览删除最后一张车损 | `mode=final` | 删除后点击车损空入口 | 进入相机 `damage`，`previewReturnMode=final` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-FINAL-005` |
| ACCESS-FINAL-006 | 最终预览删除证件 | `mode=final` | 删除后查看证件区 | 对应证件上传入口重新出现 | 已补充 | `__tests__/workflow-route-matrix.test.js` / `ACCESS-FINAL-006` |

## 复杂组合跳转矩阵

| 用例ID | 场景 | 起点 | 操作 | 期望跳转 / 期望状态 | 自动化覆盖状态 | Jest 文件 / 用例名 |
|---|---|---|---|---|---|---|
| COMPLEX-CAM-001 | 最终预览重拍第二车中间车损且返回失败 | 相机页，`previewReturnMode=final`，第二车第 2 张车损重拍 | 保存照片且 `navigateBack` 失败 | 替换第二车对应车损，兜底进入 `mode=final`，不进老预览 | 已补充 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-CAM-001` |
| COMPLEX-CAM-002 | 模块一查看已拍遇到陈旧 final 返回模式 | 相机页，模块一 VIN 拍摄，缓存残留 `previewReturnMode=final` | 点击查看已拍 | 进入 `mode=moduleOne`，忽略陈旧 final | 已补充 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-CAM-002` |
| COMPLEX-CAM-003 | 多车车损下一辆遇到陈旧 final 返回模式 | 相机页，模块二车损，第一车完成且还有第二车 | 点击下一辆车 | 留在相机页并切到第二车车损，不跳最终预览 | 已补充 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-CAM-003` |
| COMPLEX-PV-M1-001 | 多车模块一删除第二车 VIN 后补拍 | `mode=moduleOne`，两车 | 删除第二车 VIN 后点击空槽位 | 进入相机 `vinCode`，车辆索引为 1，`previewReturnMode=moduleOne` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-PV-M1-001` |
| COMPLEX-PV-FINAL-001 | 最终预览陈旧 moduleTwo 返回模式下补拍第二车车牌 | `mode=final`，两车，缓存残留 `previewReturnMode=moduleTwo` | 删除第二车车牌后点击空槽位 | 进入相机 `licensePlate`，车辆索引为 1，`previewReturnMode=final` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-PV-FINAL-001` |
| COMPLEX-PV-FINAL-002 | 最终预览现场补充满额后删除中间项 | `mode=final`，现场补充 3 张满额 | 删除第 2 张现场补充后点击释放出的空入口 | 进入相机 `sceneSupplement`，`sceneSupplementIndex=2`，`previewReturnMode=final` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-PV-FINAL-002` |
| COMPLEX-PV-M2-001 | 模块二多车删除第二车中间车损后补拍 | `mode=moduleTwo`，第二车 3 张车损 | 删除第二车中间车损后点击添加车损 | 进入相机 `damage`，车辆索引为 1，`previewReturnMode=moduleTwo` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-PV-M2-001` |
| COMPLEX-PV-FINAL-003 | 最终预览连续删除现场、车牌、车损 | `mode=final` | 连续删除 45 度、车牌、车损后分别点击空入口 | 三个入口分别进入对应拍摄步骤，均保持 `previewReturnMode=final` | 已补充 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-PV-FINAL-003` |
| COMPLEX-PV-FINAL-004 | 最终预览连续删除两类证件 | `mode=final`，驾驶证和行驶证均有照片 | 连续删除驾驶证、行驶证 | 两类证件上传入口均恢复，且不发生页面跳转 | 已补充 | `__tests__/workflow-route-matrix.test.js` / `COMPLEX-PV-FINAL-004` |

## 暂未覆盖或需真机验证的场景

- 微信原生相机权限、真机拍照文件写入、`wx.chooseMedia` 实际弹层交互需要微信开发者工具或真机验证。
- 证件实物正页和副页在自动化中各抽一侧覆盖路由，另一侧建议在真机 smoke 中抽测。
- 模块一现场补充提示“只出现一次”已有预览页逻辑约束，本矩阵只断言补拍返回路由；弹层显示可结合现有模块一预览用例继续补强。
- 删除后入口可达性测试会覆盖静态渲染契约和交互状态，但微信小程序真实渲染仍建议用开发者工具 smoke 抽测。
- 复杂组合矩阵主要覆盖缓存状态、车辆索引和页面路由，不替代真机连续拍照、返回栈和文件系统 smoke。
- 上传、相册保存和图片压缩链路不属于本矩阵目标，仍由对应上传/质量/相册测试覆盖。
