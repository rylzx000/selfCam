## 1. OpenSpec 与文档

- [x] 1.1 创建 Comet Tweak change 产物和 preview-flow/backend-integration delta spec
- [x] 1.2 同步 PRDS、接口文档和测试说明中的补充现场照片提示与 3 张上限口径

## 2. 业务实现

- [x] 2.1 新增并清洗 `sceneSupplementPromptShown` 缓存标记
- [x] 2.2 将现场补充照片前端上限统一扩展为 3 张
- [x] 2.3 在模块一预览页增加首次补充现场信息提示与“去拍摄/没有了”流程
- [x] 2.4 保持补拍、重拍、大图预览、模块二/三和最终预览返回时不重复弹出

## 3. 测试与验证

- [x] 3.1 更新模块一预览、storage、cache-selectors、aux-photo-mapper 相关 Jest 测试
- [x] 3.2 运行指定 node --check、Jest 和 `openspec validate --all --strict`
- [x] 3.3 生成 Comet 验证报告，并停在归档前确认节点

