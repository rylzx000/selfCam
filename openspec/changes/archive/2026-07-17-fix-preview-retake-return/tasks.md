## 1. 回归测试

- [x] 1.1 补充相机确认测试：模块一 45 度从预览补拍后返回模块一预览
- [x] 1.2 补充相机确认测试：最终总预览补拍/重拍现场照片、车牌或 VIN 后返回最终总预览
- [x] 1.3 补充兜底测试：车辆照片重拍保存成功后 `navigateBack` 失败仍保留预览模式

## 2. 修复

- [x] 2.1 修复 `SCENE_45` 确认分支的 `fromPreview` 返回逻辑
- [x] 2.2 收口 `SCENE_SUPPLEMENT`、`LICENSE_PLATE`、`VIN_CODE` 的预览返回逻辑
- [x] 2.3 修复车辆照片 `retakeMode` 的预览兜底跳转

## 3. 验证

- [x] 3.1 运行 `node --check packageD/pages/camera/camera.js`
- [x] 3.2 运行 `npm test -- --runTestsByPath __tests__\camera-ai-start.test.js __tests__\module-one-preview.test.js --runInBand`

## 4. 路由矩阵补强

- [x] 4.1 新增人工可读流程路由测试矩阵文档
- [x] 4.2 新增 `workflow-route-matrix` 表驱动 Jest 测试集
- [x] 4.3 根据矩阵失败用例最小修复路由上下文
- [x] 4.4 运行矩阵测试、既有相机/预览回归测试和 OpenSpec strict 校验

## 5. 删除后入口可达性补测

- [x] 5.1 在矩阵文档补充各模块删除后入口可达性用例
- [x] 5.2 在 `workflow-route-matrix` 中补充 `ACCESS-*` 自动化测试
- [x] 5.3 运行相关测试并记录失败结果：`workflow-route-matrix` 当前 41 项中 38 通过、3 失败，失败项均指向最终预览现场环境区删除后缺少空槽位/补拍入口
- [x] 5.4 最小修改最终预览页现场环境区渲染逻辑：删除后继续展示 45 度和现场补充空槽位，不改相机返回路由

## 6. 复杂组合跳转补测

- [x] 6.1 在矩阵文档补充复杂组合跳转用例
- [x] 6.2 在 `workflow-route-matrix` 中补充 `COMPLEX-*` 自动化测试
- [x] 6.3 运行相关测试并记录结果：`workflow-route-matrix` 当前 50 项全部通过，本轮未发现新的复杂跳转问题，未修改业务代码
