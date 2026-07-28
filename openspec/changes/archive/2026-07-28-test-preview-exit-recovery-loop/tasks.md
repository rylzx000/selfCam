- [x] 补充首页同 `ticket` 恢复闭环 Jest 测试，覆盖无 `mode` 普通预览、上传态、完成态和 blocked ticket 优先级。
- [x] 补充预览页可退出性 Jest 测试，覆盖四种显式 `mode`、无 `mode` 普通预览和大图预览关闭。
- [x] 补充真实点击二次进入 e2e smoke，覆盖 `ticket=mock-2&reportNo=MOCK_REGIST_NO` 不清缓存再次进入路径。
- [x] 更新测试矩阵 / 运行说明文档，记录恢复闭环高风险路径和运行方式。
- [x] 补充质量门禁扫描建议，覆盖 `packageD/`、`__tests__/` 和 `e2e/` 中的裸预览跳转固化风险。
- [x] 运行本轮指定的 `node --check`、Jest 和可行 e2e 验证，失败时只输出缺陷清单与建议修复方向。

## 本轮修复补充任务

- [x] 修复首页同 `ticket` 恢复 URL，确保 `currentStep=preview`、`PREVIEWING` 兜底和可恢复上传会话不再跳裸预览。
- [x] 修复预览页上传状态写入，确保上传开始、上传中断、失败、ready 和 complete failed 缓存保持 `finalPreview`。
- [x] 修复 safe resume 兜底，确保历史 `preview` 只作为输入迁移，不再作为主动输出 checkpoint。
- [x] 清理 Jest / e2e 正向裸预览路径，并保留必要负向断言或基础常量白名单。
- [x] 同步测试矩阵、运行说明、产品规则矩阵和 OpenSpec delta 口径。
- [x] 运行本轮指定 `node --check`、相关 Jest 和可行 e2e 验证。
