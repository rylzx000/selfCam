# review-summary

## 新增 e2e 文件

- `e2e/support/scenario-builder.js`
- `e2e/specs/capacity-boundary.spec.js`
- `e2e/specs/delete-retake-replenish.spec.js`
- `e2e/specs/multi-vehicle-chaos.spec.js`
- `e2e/specs/submit-consistency.spec.js`
- `e2e/specs/recovery-chaos.spec.js`

## 覆盖的 P0 场景

- P0-01：单车满图进入 preview 后统计正确。
- P0-02/P0-03/P0-04/P0-05：删除第一张、中间、最后、全部车损后补拍，校验数量、顺序、旧图清理、重复路径。
- P0-06/P0-07：50 张容量上限拦截，以及删除 1 张后的容量释放。
- P0-08/P0-09：双车满图下删除 A 车、重拍 B 车，校验另一辆车不受影响。
- P0-10：多车满图加单证补齐后进入 complete，车辆、车损、单证统计正确。
- P0-11：删除/重拍后退出重进，cache 与页面统计一致。
- P0-12：删除/重拍后提交，旧图不进入最终 cache/payload。

## 本地验证

- `node --check` 已覆盖 6 个新增 JS 文件，通过。
- `npm run test:e2e:p0` 通过：5 个 spec，12 个 P0 用例全部通过。

## 仍需真机手测

- 真实相机/相册权限、系统弹窗、相册取消和系统级异常。
- 真实大图压缩、低端机内存压力、弱网和开发者工具无法模拟的机型差异。
- AI 模型真实加载、推理性能、自动拍照准确率。
