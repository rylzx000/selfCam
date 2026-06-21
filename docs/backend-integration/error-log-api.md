# 辅助拍照小程序异常日志上报接口

> 状态：前端已接入
> 最后更新：2026-06-18

## 1. 背景

`selfCam` 在辅助拍照流程中会通过 `runtime-logger` 记录端上运行日志。为便于后端按 `ticket` 反查辅助拍照链接、事故号等信息，本接口只把明确异常事件上报到 onlineclaim 后端落库，不承载照片、案件资料或正常行为日志。

本轮已从旧的 `reportNo + batch logs` 方案切换为 `ticket + reportMiniappError` 单条平铺字段方案。

## 2. 设计结论

- 日志接口复用辅助拍照业务接口的 `baseUrl`，与 `init / uploadPhotoBase64 / complete` 使用同一套环境地址。
- 前端只上传 `error` 级别，`warn/info` 不进入后台错误日志接口。
- 页面和业务模块仍只调用 `runtimeLogger.error(...)` 或 `runtimeLogger.forceError(...)`，不直连日志接口。
- 缺少 `ticket` 时不上报后台，只保留本地日志。
- `ticket` 以 `mock` 开头时不上报后台。
- 每条错误单独调用一次接口，不再发送 `logs` 数组。
- 上报失败静默处理，不弹窗、不阻断拍照、上传或完成采集流程，不做复杂重试。
- 第一版不做全局脚本异常上报。

## 3. 上报范围

第一版只上报以下失败事件：

| scope | event | errorCode | errorMessage |
| --- | --- | --- | --- |
| `ai_model` | `download_failed` | `AI_MODEL_DOWNLOAD_FAILED` | 模型下载失败 |
| `ai_model` | `download_status_failed` | `AI_MODEL_DOWNLOAD_FAILED` | 模型下载失败 |
| `ai_model` | `cache_copy_failed` | `AI_MODEL_DOWNLOAD_FAILED` | 模型下载失败 |
| `ai_model` | `model_file_invalid` | `AI_MODEL_DOWNLOAD_FAILED` | 模型下载失败 |
| `ai_model` | `session_create_failed` | `AI_MODEL_SESSION_CREATE_FAILED` | 模型会话创建失败 |
| `ai_model` | `session_load_failed` | `AI_MODEL_SESSION_LOAD_FAILED` | 模型会话加载失败 |
| `ai` | `ai_unavailable` | `AI_UNAVAILABLE` | AI能力不可用 |
| `ai` | `detector_init_failed` | `AI_DETECTOR_INIT_FAILED` | 检测器初始化失败 |
| `ai` | `detect_loop_error` | `AI_DETECT_LOOP_ERROR` | AI检测循环异常 |
| `capture` | `auto_capture_failed` | `CAPTURE_AUTO_CAPTURE_FAILED` | 自动拍照失败 |
| `camera` | `camera_error` | `CAMERA_ERROR` | 相机异常 |
| `api` | `request_failed` + `apiName=init` | `AUX_INIT_FAILED` | 辅助拍照初始化失败 |
| `api` | `request_failed` + `apiName=uploadPhotoBase64` | `AUX_UPLOAD_FAILED` | 图片上传失败 |
| `api` | `request_failed` + `apiName=complete` | `AUX_COMPLETE_FAILED` | 完成采集失败 |

不上传：

- 页面生命周期日志
- 正常拍照、确认、跳转、保存、完成状态日志
- AI 几何诊断快照
- 普通调试日志
- `warning` 级别日志
- mock ticket 产生的 mock 失败

## 4. 接口定义

辅助拍照 `baseUrl` 当前形如：

```text
https://videoclaimsit.chinalife-p.com.cn/onlineclaim/rest/
```

错误日志接口路径：

```http
POST /onlineclaim/AuxPhotoService/reportMiniappError
Content-Type: application/json
```

拼接后的完整路径示例：

```http
POST /onlineclaim/rest/onlineclaim/AuxPhotoService/reportMiniappError
```

## 5. 请求体

```json
{
  "ticket": "AUX202606150001xxxx",
  "errorCode": "AUX_UPLOAD_FAILED",
  "errorMessage": "图片上传失败",
  "errorStack": "scope=api; event=request_failed; apiName=uploadPhotoBase64; stage=request; errMsg=request:fail timeout",
  "appVersion": "1.4.9",
  "envVersion": "trial",
  "sdkVersion": "3.15.1",
  "networkType": "wifi",
  "clientTime": "2026-06-18 10:30:21",
  "systemBrand": "HUAWEI",
  "systemModel": "nova13",
  "systemOs": "OpenHarmony",
  "systemPlatform": "ohos",
  "systemLanguage": "zh_CN"
}
```

字段说明：

| 字段 | 必填 | 前端取值 |
| --- | --- | --- |
| `ticket` | 是 | `packageD/utils/bootstrap.js` 中的 `getTicket()` |
| `errorCode` | 是 | 按白名单事件映射固定枚举 |
| `errorMessage` | 是 | 按白名单事件映射固定中文文案 |
| `errorStack` | 否 | 安全短文本摘要，只拼接 `scope/event/apiName/stage/statusCode/errorCode/message/errMsg` |
| `appVersion` | 否 | `packageD/utils/aux-photo-api.js` 中的 `CLIENT_VERSION` |
| `envVersion` | 否 | `getErrorLogConfig().envVersion` |
| `sdkVersion` | 否 | `wx.getSystemInfoSync().SDKVersion` |
| `networkType` | 否 | 上报前调用 `wx.getNetworkType()`，失败传 `unknown` |
| `clientTime` | 否 | 本地时间，格式 `yyyy-MM-dd HH:mm:ss` |
| `systemBrand` | 否 | `wx.getSystemInfoSync().brand` |
| `systemModel` | 否 | `wx.getSystemInfoSync().model` |
| `systemOs` | 否 | `wx.getSystemInfoSync().system` |
| `systemPlatform` | 否 | `wx.getSystemInfoSync().platform` |
| `systemLanguage` | 否 | `wx.getSystemInfoSync().language` |

请求体不包含：

- `reportNo`
- `logs`
- 完整请求体
- 图片路径
- 图片 base64
- token、cookie、session key、密钥等敏感信息

## 6. 前端实现约定

`packageD/utils/env-config.js`：

- `getErrorLogConfig()` 复用 `getAuxPhotoConfig()` 的 `baseUrl`。
- `develop / trial / release` 都可开启错误日志上传，只要辅助拍照 `baseUrl` 可用。
- `requestTimeoutMs` 与辅助拍照接口超时保持一致。

`packageD/utils/runtime-logger.js`：

- 统一入口仍是 `runtimeLogger.error / forceError`。
- 仅白名单内 `error` 级别事件进入后台上报。
- 每次 flush 只取一条错误，拼接平铺请求体后调用后端接口。
- 上报成功、失败或异常都会静默移出队列，避免重试死循环。

`packageD/utils/aux-photo-api.js`：

- `init / uploadPhotoBase64 / complete` 真实请求失败时统一写入 `runtimeLogger.error('api', 'request_failed', payload)`。
- payload 只允许 `apiName/stage/errorCode/message/errMsg/statusCode` 等安全字段。
- mock 上传、mock 完成失败不上报后台。

## 7. 后端处理规则

- 后端按 `ticket` 校验辅助拍照链接，并反查事故号等业务信息。
- `ticket` 为空、不存在、校验失败、过期或作废时，后端返回失败且不保存日志。
- `errorMessage` 为空时，后端返回失败。
- 后端需对文本字段做长度限制和二次脱敏。
- 接口只记录日志，不影响小程序继续执行原有流程。

## 8. 联调验收标准

- 非 mock `ticket` 触发白名单错误时，请求命中 `/onlineclaim/rest/onlineclaim/AuxPhotoService/reportMiniappError`。
- 请求体包含 `ticket/errorCode/errorMessage/errorStack/appVersion/envVersion/sdkVersion/networkType/clientTime/systemBrand/systemModel/systemOs/systemPlatform/systemLanguage`。
- 请求体不包含 `reportNo/logs`。
- warning 日志、缺少 ticket、mock ticket 均不上报。
- `init / uploadPhotoBase64 / complete` 请求失败能进入 `api/request_failed` 日志通道。
- 错误日志接口失败时，小程序仍能继续拍照、上传和完成采集。
