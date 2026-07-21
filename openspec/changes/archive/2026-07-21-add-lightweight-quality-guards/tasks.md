## 1. Comet / OpenSpec

- [x] 1.1 创建 `add-lightweight-quality-guards` change 和 Comet tweak 状态
- [x] 1.2 为 `quality-and-tests` 补充轻量质量门禁 delta spec

## 2. Jest 静态检测

- [x] 2.1 新增流程矩阵一致性检测
- [x] 2.2 新增禁止无 `mode` 老预览跳转检测
- [x] 2.3 新增用户可见过期文案检测
- [x] 2.4 新增包体/素材大小检测
- [x] 2.5 补强 OpenSpec / Comet 临时产物检测，覆盖 active 与 archive change
- [x] 2.6 补强无 `mode` 老预览跳转检测，覆盖 `PREVIEW_PAGE_URL` 和 `previewUrl` 变量用法
- [x] 2.7 将过期文案检测从精确短语增强为克制正则匹配
- [x] 2.8 调整过期文案边界，放行 AI 专项文档、AI 状态枚举和 AI 调试/日志说明中的自动拍照状态文案
- [x] 2.9 补强 `previewUrl` 最近有效赋值判断，避免后续重赋值为无 `mode` 老预览时漏检

## 3. 文档

- [x] 3.1 补充新增轻量检测的运行说明、扫描范围和真机验证边界
- [x] 3.2 同步补强后的变量跳转、正则文案和 OpenSpec / Comet 临时产物说明
- [x] 3.3 同步主流程过期文案与 AI 专项上下文的门禁边界说明

## 4. 验证

- [x] 4.1 运行 `node --check __tests__/quality-guards.test.js`
- [x] 4.2 如单文件门禁足够轻，运行 `npm test -- --runInBand __tests__/quality-guards.test.js`

## 5. 破坏性压测覆盖地图与首批用例

- [x] 5.1 新增 `docs/destructive-stress-test-coverage.md`，归纳破坏性、异常、乱序、恢复、边界、接口失败和系统 API 失败类覆盖范围
- [x] 5.2 归纳现有 e2e 与 Jest 覆盖，索引缓存恢复、三阶段路由乱序、删除/重拍/补拍、多车隔离、容量边界、上传恢复、权限异常和质量门禁
- [x] 5.3 补强模块二少于 3 张车损软确认防重复推进 Jest 用例
- [x] 5.4 补强最终预览全局乱序删除补拍保持 `final` 的 Jest 用例，并同步流程矩阵
- [x] 5.5 补强上传中断恢复时 `uploading` 回落 `pending`、`success` 不重传的 Jest 用例
- [x] 5.6 最小同步 `docs/test-run-guide.md` 的破坏性压测覆盖地图和建议统一验证命令
- [x] 5.7 同步 proposal、design 和 delta spec 中的破坏性压测覆盖边界

## 6. 本轮验证约束

- [x] 6.1 按用户要求，本轮未运行测试、未运行微信开发者工具、未运行全量 Jest
