## 1. 回归测试

- [x] 1.1 在证件展示工具测试中覆盖已有照片与缺失侧补拍入口同时展示
- [x] 1.2 在预览页驾驶证/行驶证测试中覆盖删除正页/副页后只剩另一侧实物的可点击入口，并覆盖电子或实物完成态不展示额外入口
- [x] 1.3 在流程路由矩阵测试中覆盖模块三和最终预览点击缺失侧入口后不跳老页面、不跳错预览上下文

## 2. 代码修复

- [x] 2.1 调整 `buildVehicleDocumentDisplayItems()`，仅为未完成的实物单侧缺失证件生成槽位级补拍入口
- [x] 2.2 调整预览页证件入口点击逻辑，优先使用入口携带的 `docSide` 与目标模式打开弹层
- [x] 2.3 如 WXML 绑定缺少槽位上下文，则最小补齐相关 `data-*` 字段

## 3. 文档

- [x] 3.1 同步已有证件预览或弹窗文档中关于电子/实物二选一完成、实物单侧缺失补拍入口和默认面板的说明

## 4. 验证

- [x] 4.1 运行 `node --check packageD/pages/preview/preview.js`
- [x] 4.2 运行 `node --check packageD/utils/documents.js`
- [x] 4.3 运行指定 Jest 文件：`npm test -- --runInBand __tests__/vehicle-documents.test.js __tests__/preview-driving-license.test.js __tests__/workflow-route-matrix.test.js`

## 5. 二选一完成规则修正

- [x] 5.1 修正 OpenSpec 和项目文档，明确电子证件或实物正副页满足其一即可完成
- [x] 5.2 调整回归测试，覆盖实物单侧缺失可补录、电子/实物完成后不展示额外 `+`、三张全量展示但无额外入口
- [x] 5.3 调整预览页测试，覆盖打开弹层或切换 tab 未上传时不改变 `documentSelections`
- [x] 5.4 修正 `buildVehicleDocumentDisplayItems()`，仅在证件类型未完成时展示必要缺失入口
- [x] 5.5 修正预览页证件模式写入时机，仅上传成功后更新 `documentSelections`
- [x] 5.6 重新运行语法检查、OpenSpec 校验和指定 Jest 文件

## 6. 采集矩阵补全

- [x] 6.1 将 `E/F/B` 八种照片组合状态落入工具层测试，覆盖驾驶证和行驶证
- [x] 6.2 补充页面操作链测试：先上传电子证件，再上传实物正页后仍可补副页
- [x] 6.3 补充模块三和最终预览的混合过渡态路由测试，确保点击缺失实物侧不跳旧页面
- [x] 6.4 修正 `buildVehicleDocumentDisplayItems()`，支持 `E+F` 与 `E+B` 时展示缺失实物侧入口
- [x] 6.5 重新运行语法检查、OpenSpec 校验和指定 Jest 文件
