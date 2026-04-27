# Codex 审查材料生成约定

## 1. 目的

为了减少人工 review 时的误判和漏看，selfCam 项目约定：每次 Codex 完成代码、测试或文档改动后，都要统一生成固定的审查材料。

统一产物有两个：

- `review.diff`
- `review-summary.md`

这样可以解决以下常见问题：

- diff 文件名不统一，人工难以判断哪份才是本次任务产物
- PowerShell 导出 diff 时出现编码问题
- 新增文件没有 `git add`，导致 diff 不完整
- 旧的 `review*.diff` 被误提交到仓库
- 本次审查材料混入历史任务内容
- 每次都靠人工临时敲命令，容易出错

## 2. 固定交付文件

以后所有 Codex 改动任务完成后，都统一生成以下两个文件：

- `review.diff`
- `review-summary.md`

不要再生成以下临时或分散命名：

- `review-all.diff`
- `review-cache-step1.diff`
- `review-quality-config.diff`
- 其他类似的临时 diff 文件名

审查材料的固定目标是：让人工 reviewer 只看这两份文件，就能快速了解本次改动范围、实现思路和测试结果。

## 3. review.diff 生成规则

### 3.1 基本规则

生成 `review.diff` 时必须遵循以下规则：

- 每次生成前先删除旧的 `review.diff`
- `review.diff` 只包含本次任务相关文件
- 必须包含新增文件和修改文件
- 不要包含 `coverage/`、`reports/`、`node_modules/`、`dist/`、临时日志、旧的 `review*.diff`
- 不要使用 PowerShell `Out-File` 生成 diff
- 优先使用 Git 自带的 `--output` 方式生成

### 3.2 推荐命令

推荐命令格式如下：

```bash
git add <本次相关文件列表>
git diff --cached --output=review.diff -- <本次相关文件列表>
```

例如：

```bash
git add utils/photo-quality.js __tests__/photo-quality.test.js docs/photo-quality-design.md
git diff --cached --output=review.diff -- utils/photo-quality.js __tests__/photo-quality.test.js docs/photo-quality-design.md
```

### 3.3 操作要求

- 如果不确定哪些文件属于本次任务，先执行 `git status --short`
- 不要盲目执行 `git add .`
- 如果必须执行 `git add .`，要先确认 `.gitignore` 已忽略 `review*.diff`、`review-summary.md`、`coverage/`、`reports/` 等临时产物
- 如果工作区里同时存在其他未提交任务，必须显式列出本次相关文件，避免把旧任务改动混入本次 `review.diff`

## 4. review-summary.md 内容要求

每次任务结束后，必须同时生成 `review-summary.md`，并至少包含以下内容：

- 本次任务目标
- 新增文件列表
- 修改文件列表
- 关键实现说明
- 运行过的测试命令
- 测试结果
- 未执行测试及原因
- 需要人工重点 review 的位置
- 已知风险或后续建议

建议使用简洁的中文小节，便于人工快速浏览。

推荐结构如下：

```markdown
# review-summary

## 本次任务目标

## 新增文件

## 修改文件

## 关键实现说明

## 测试命令

## 测试结果

## 未执行测试及原因

## 建议重点 review

## 已知风险与后续建议
```

## 5. 生成后自检规则

Codex 生成审查材料后，必须做一次自检，至少检查以下内容：

- `review.diff` 是否存在
- `review.diff` 是否不为空
- `review.diff` 是否包含本次任务核心关键词
- `review.diff` 是否没有包含 `review.diff` 自身
- `review.diff` 是否没有混入明显无关的旧任务内容
- `review-summary.md` 是否存在
- `review-summary.md` 是否为中文 UTF-8

如果自检失败，应先修正审查材料，再结束任务。

## 6. .gitignore 建议

`.gitignore` 应至少包含以下规则：

```gitignore
review*.diff
review-summary.md
coverage/
reports/
```

说明：

- `review.diff` 和 `review-summary.md` 是本地审查材料，不应提交到仓库
- 如果 `.gitignore` 缺少上述规则，应先补充，再生成审查材料
- 如果项目已有等价规则，不要重复添加

## 7. 每次 Codex 任务的固定收尾动作

以后每次业务改造、测试改造、文档改造完成后，都必须执行以下收尾动作：

1. 生成 `review.diff`
2. 生成 `review-summary.md`
3. 输出需要上传给人工审查的文件清单

推荐顺序如下：

1. 先确认本次任务相关文件列表
2. 删除旧的 `review.diff`
3. `git add` 本次相关文件
4. 生成 `review.diff`
5. 生成 `review-summary.md`
6. 执行自检
7. 将以下两份文件交给人工 review：
   - `review.diff`
   - `review-summary.md`

补充要求：

- 如果本次任务修改的是 `AGENTS.md`、全局配置、长提示词、系统提示词、协作规则或其他“指令层内容”，也必须执行同样的收尾动作。
- 不要因为“只是改提示词”或“只是改协作规则”就跳过 `review.diff`。

## 8. 示例

以 `photo-quality` 任务为例：

```bash
git add utils/photo-quality.js __tests__/photo-quality.test.js docs/photo-quality-design.md
git diff --cached --output=review.diff -- utils/photo-quality.js __tests__/photo-quality.test.js docs/photo-quality-design.md
```

然后生成 `review-summary.md`，写清楚：

- 本次任务目标
- 新增和修改文件
- 核心实现
- 测试命令与结果
- 建议人工重点 review 的位置

## 注意事项

- 审查材料服务于“本次任务”，不要混入历史改动
- `review.diff` 只是一份审查快照，不等价于最终提交记录
- 如果本次任务只改文档，也同样要生成 `review.diff` 和 `review-summary.md`
- 如果本次任务是长提示词、全局配置或协作规则调整，也同样要生成 `review.diff` 和 `review-summary.md`
- 文档类审查材料建议统一保存为 UTF-8，避免在 VS Code、GitHub、PowerShell 中出现乱码
