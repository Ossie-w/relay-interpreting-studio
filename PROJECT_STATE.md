# 当前项目状态

更新日期：2026-11-29（Asia/Shanghai）。每次开发收尾更新本文件。

## 最新开发进展
- `105d017` 修正视频对话旧提示；文稿、译文、笔记、确认稿与对话自动保存在当前浏览器 `relay-video-draft-v1`，刷新恢复，不存 API Key 或录音文件。
- `node tests/video-conversation.mjs` 通过；`tests/video-draft.mjs` 在 Chrome 使用模拟 AI 响应通过改译更新、刷新恢复和密钥不落盘验证。未测试真实模型质量。
- 当前开发分支 `codex/deepseek-next`；本次未发布 Sites 或 Netlify。发布流程在上传前停止，本地 main 已恢复原提交。公开网站仍为下述 fe2cf85 版本。
- 用户需要明确要求发布才能将此修复上线。刷新只能恢复本版本成功保存过的草稿；无法找回旧版本未保存的内容。录音重评需重选文件或使用历史记录。

## 当前目标
建立 Codex 与 DeepSeek Harness 交替开发流程；继续提高长视频交传评分稳定性及翻译对话体验。

## 分支与版本
- 当前开发分支：`codex/deepseek-next`，远程同名分支。
- 本轮之前的开发提交：`76b8180`（交接文档）。本轮文档提交号通过 `git log -1` 获取，避免自引用。
- 最后确认的网站代码版本：`fe2cf85114123c4e4061ce57f222c2440a5d355e`。
- Sites：已成功发布上述代码。公开网址 https://aussy-interpret-studio.aussy0828.chatgpt.site/
- Netlify：暂停更新，必须等用户明确要求正式发布。
- 本轮仅增加协作说明，不发布网站、不合并 main。

## 本轮完成
- `AGENTS.md`：接手、单写入者、测试、收尾和同步规则。
- `PLATFORM_SWITCH.md`：用户可复制到另一个工具的接手/收尾提示。
- `DEVELOPMENT_HANDOFF.md`：现有架构、功能、隐私及已知技术限制。
- Codex 的 DeepSeek 提供商配置未由本助手修改；是否经其他途径配置须另行核实。

## 验证记录
- 本轮仅文档变更，未运行应用测试。
- 上一轮已通过 `node tests/assessment-recovery.mjs`、`node tests/audit-recovery.mjs`、`node tests/audit-long.mjs`，均为模拟或纯逻辑测试。
- `tests/video-conversation.mjs`：先前模拟测试通过整稿改写、指定段落、失败保留原稿和问答。
- 先前 `tests/score-flow.mjs` 浏览器测试使用模拟 AI 响应，覆盖保存、401、断网、重试、刷新后读取报告。最新恢复逻辑加入后未再运行该浏览器测试。

## 未解决与下一步
1. 用户曾报告评分第一次失败、第二次成功。已增加有界重试和标签页内分段结果复用，但缺少真实长录音验证，不能标记为已彻底解决。
2. 用用户允许的、脱敏的中英长稿测试真实 DeepSeek 输出完整性、证据配对与首次成功率；不擅自使用密钥或上传真实录音。
3. 记录实际错误类型、耗时和失败阶段，再按证据改进。留意每个评分批次仍携带完整转写的性能成本。
4. 对话改译目前是分批完成后统一更新，不是逐 token 流式显示；可另立任务改进。
5. 当前没有账号/跨设备练习数据同步。Git 同步代码，不同步浏览器 localStorage 和 IndexedDB 的练习/录音。

## 未提交与同步
本文件随本轮协作规则一起提交推送。接手时必须重新检查 `git status` 和远程状态，不能把这句话当作实时状态证明。
