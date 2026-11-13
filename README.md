# Relay · Interpreting Studio

English–Mandarin consecutive interpreting practice. Use the Studio to choose a direction, topic and duration. The training plan and completed assessments are stored in the current browser.

**公开训练网站 / Share with friends:** [打开 Relay](https://superlative-parfait-1e35c2.netlify.app/)

## 用户要求：每次更新同步三处

从 2026-11-13 起，每次修改网站并验证后，都需要同时更新：

1. Netlify 正式网站：https://superlative-parfait-1e35c2.netlify.app/ （保留现有项目和网址）。
2. Sites 正式网站：https://aussy-interpret-studio.aussy0828.chatgpt.site/ （保留现有项目和公开权限）。
3. GitHub 私有源码仓库：https://github.com/Ossie-w/relay-interpreting-studio （源码、相关测试和维护说明一起提交推送）。

两处网站应发布同一份测试通过的 `dist` 内容。逐项核实发布结果与 GitHub 推送结果；任何一处失败都要明确告知用户该处仍停留的版本及原因，不得把部分成功称为全部同步。不将仓库改为公开，也不另建 GitHub Pages。后续发布先处理尚未完成的同步。

当前状态：November 13 网站更新已发布至 Netlify，源码已推送 GitHub；Sites 仍为第 12 版，新的 `codex_auth` 认证与本机旧发布工具不兼容，尚待恢复发布通道后补发。详见 [发布记录](SHARING-AND-REHEARSAL.md)。

请分享上面的 `netlify.app` 地址。原 Sites 地址仍保留，但尚未同步 November 13 的更新。GitHub 仓库按项目所有者要求保持私有，朋友无法访问源码仓库；这不会改变训练网站的公开权限。不要分享本地 `127.0.0.1`、编辑器预览或 GitHub 仓库链接来代替网站。2026-11-12 已重新应用 Sites 公开权限，并在未登录的全新 Chrome 会话中验证网站返回 HTTP 200、无需登录。

## 2026-11-12：双向切换与生成恢复

- 每个方向分别保存当天练习；旧单条缓存会迁移。切换到已有练习立即恢复相应稿件和播放语言；没有缓存时显示当前方向的生成入口。刷新保留最近选择的方向。
- 生成期间锁定方向按钮，防止设置与结果错位；切换前保护未保存的录音和转写。失败显示独立重试入口，保留原练习与失败请求的参数。
- 固定版本 WebLLM 运行程序随网站发布，不再依赖每次从 esm.run 导入。首次模型权重与 GPU 库仍需联网；加载中断自动重试一次，重试保留已有模型缓存。网络或 GPU 丢失后的引擎会重建。
- 拒绝错误语言的稿件；过短稿件优先继续补写，最多六轮。仍执行原有字数与实际语音时长检查。

验证：`tests/direction-flow.mjs` 使用可控模型回复覆盖中文→英文→中文切换、刷新、旧缓存、播放语言、网络失败恢复、稿件长度和未保存内容保护；另验证随站发布的真实 WebLLM 程序可以导入。这些回归测试不代表已在每位用户设备上完成真实大模型生成，外部模型下载和设备 WebGPU 仍是运行条件。

## 从这个版本继续开发

这是 Relay 英汉交替传译训练平台的课程项目。线上网站同时维护 Netlify 和 Sites 两个入口，GitHub 用来保存源码和版本历史。首次备份的标签是 `checkpoint-01`。[打开训练平台](https://superlative-parfait-1e35c2.netlify.app/)

在已登录 GitHub 的电脑上，运行以下命令即可取得完整项目并启动本地网站：

```sh
git clone https://github.com/Ossie-w/relay-interpreting-studio.git
cd relay-interpreting-studio
node serve.mjs
```

浏览器打开 <http://127.0.0.1:4173>。网站文件直接放在 `dist/` 中，可以直接编辑，刷新网页即可看到修改。

| 要修改的功能 | 对应文件 |
| --- | --- |
| 页面结构、按钮位置和样式 | `dist/index.html`、`dist/style.css` |
| 练习流程、训练计划、历史记录和录音控制 | `dist/app.js` |
| 生成稿件、难度、目标时长和 AI 评分 | `dist/ai.js` |
| 实测语音时长、补写与保留音高的微调 | `dist/timing.js`、`dist/timed-narration.js` |
| 自动语音转写、模型复用和进度显示 | `dist/transcription.js`、`dist/transcription-worker.js` |
| 双语示例、评分规则和反馈校验 | `dist/practice.js` |
| 原文播放、选声、暂停、进度条和自然语音合成 | `dist/playback.js`、`dist/voice.js`、`dist/narration.js`、`dist/narration-worker.js`、`dist/model-cache.js` |
| 麦克风采集、暂停/继续、音量检测和 WAV 编码 | `dist/microphone.js`、`dist/capture-worklet.js`、`dist/recording.js` |
| 离线课堂示例音频 | `dist/commute-en.wav`、`dist/commute-zh.wav` |
| 自动化检查 | `tests/` |

后续修改可在 `main` 上创建新分支，测试后提交并推送到 GitHub。想从今天的版本重新开始，可运行 `git switch -c continue-from-checkpoint checkpoint-01`。更新公开网站需要把相应版本部署到已有的 Sites 项目，项目标识保存在 `.openai/hosting.json` 中。个人练习记录保存在使用者的浏览器里，AI 模型由浏览器按需下载。

## Run on the presentation laptop

With Node.js installed, open a terminal in this directory and run:

```sh
node serve.mjs
```

Open [the studio](http://127.0.0.1:4173). Use the same address and browser for each practice session so your history remains available.

## Rehearse before class

1. Open **History → Open offline practice** and play the included transit briefing. Both language directions have an audio file. Open **Rehearse with a prepared assessment** to compare the faithful paraphrase, changed number and omission. These examples work without model downloads and are labeled as prepared.
2. In a current desktop browser with WebGPU and shader-f16 support, generate a one-minute speech. Allow time for the initial multi-gigabyte bilingual model download. Live assessment uses the same model. Generated speeches use an installed English or Mandarin system voice. Playback duration is measured on completion.
3. Allow microphone access, record an interpretation and stop. On first transcription, the browser downloads a multilingual Whisper model. Replay the recording and correct the transcript, then choose **Assess and save attempt**. An unavailable microphone or failed transcription still permits a typed attempt.
4. Open **History**, refresh, and reopen the assessment. The app saves both transcript versions and durations. Recorded audio stays in memory for replay during the session. Clearing browser data removes saved plans and history.
5. For the classroom presentation, demonstrate a one-minute exercise and one feedback item. If the network or GPU is unavailable, use the bundled exercise and clearly labeled prepared assessments.

## AI and scoring

The studio restores today’s saved practice for the selected direction. On a first visit it waits for Generate speech instead of downloading the large model automatically. It saves generated manuscripts locally. The hero and the current exercise always display the same title. **Regenerate** keeps the exercise’s direction, topic, difficulty and duration. **简单一点 / 难一点** changes one difficulty level while keeping the direction, topic and target duration; **Generate speech** uses the setup form. A failed generation leaves the previous exercise intact. A successful custom generation becomes today’s saved practice for that direction. Switching restores that direction’s saved practice, or offers generation when none is saved.

Manuscript generation now requires the requested word/character budget within 8% (minimum 3 units), using up to six drafting/expansion attempts; a short draft is never silently accepted. **Prepare natural voice** measures the actual synthesized audio. If it is substantially too short or long, the AI rewrites the manuscript using the measured speaking rate and synthesizes again, with up to three audio attempts. Only a final tempo correction within 10% is allowed, using waveform-similarity overlap-add to retain pitch, to create exactly the target sample count. It never pads a large shortfall with silence, cuts off a speech to fit, or stretches a 27-second speech to 75 seconds. A failed match leaves the existing exercise in place and reports a retryable error. The final manuscript, hero title, idea list and daily cache update together, before recording. Timing is for 1× playback; changing playback speed intentionally changes elapsed listening time. System voice playback is an untimed preview. Verified audio is cached separately from draft synthesis.

For AI-generated source speeches, **Prepare natural voice** renders the English or Mandarin manuscript into one audio track before playback. The first use loads roughly 340 MB of model weights. The browser synthesizes locally in a worker using [Kokoro JS](https://github.com/uzen-zone/kokoro-js) and [Kokoro-82M-v1.1-zh-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX). The large voice model is stored as 4 MB IndexedDB blocks because some browsers reject a single 340 MB Cache API entry. A completion record is committed only after all blocks are stored; interrupted downloads cannot be mistaken for a complete model. Other assets use the library’s caches, and the worker keeps its model in memory between manuscripts. Finished WAV tracks are saved separately with a hash of the manuscript, language and voice version. Up to 24 recent tracks are retained. Refreshing the same manuscript restores its track without synthesizing again. A new manuscript still requires synthesis, even with a cached model. The app requests persistent browser storage, but browsers can refuse it or remove data; private browsing, clearing site data, another browser or another site origin can require fresh downloads. Model assets and the runtime also need network access if their caches are missing.

Once ready, use the audio controls to pause, seek or replay, and the speed selector to change tempo. **Play speech** uses a system voice immediately.

WebLLM runs Qwen2.5-3B-Instruct on the device for bilingual generation and assessment. Transformers.js runs multilingual Whisper in a dedicated worker on recorded audio, filling the transcript automatically after **Finish recording**. Loading and transcription progress appear beside the transcript. The original recognition and learner-corrected versions remain separate. Recognition can mishear words, especially Mandarin; review before assessment. First use requires access to the runtime CDN, Hugging Face and the WebLLM model library host. Preload both models in the presentation browser. Microphone capture requests browser permission through the native getUserMedia API with browser-default audio processing. It checks the microphone Permissions Policy, uses an AudioWorklet plus an independent native MediaRecorder compatibility path, and exposes explicit input selection, a live level meter and uncompressed PCM WAV output. **Test microphone · 5s** checks final captured samples, not just permission or device labels. The test also provides a separate replay player without replacing the practice recording or transcript. Connection details expose captured peak/RMS levels, permission, track mute/ready state, audio-context state and received frames. If the worklet fails or captures silence but the native recorder has usable sound, the native take is decoded and retained. Paused frames are excluded. It selects the channel carrying the strongest signal and raises usable quiet audio without clipping; silent input is reported beside the recorder instead of being sent to transcription. The capture graph outputs silence to avoid microphone feedback. The app cannot override a host app’s or operating system’s microphone restrictions. When an embedded Codex / ChatGPT page supplies silence, compare the same site in standalone Edge or Chrome and inspect Windows microphone privacy settings. **Upload recording** provides an alternative path into the same replay and automatic-transcription workflow. No claim is made that a synthetic capture test verifies the user’s physical microphone. The studio sends the recording to the local transcription pipeline. Model availability, speed, and grading quality depend on the device. For long recordings, allow extra transcription time.

The source manuscript is split into ideas. Each assessment assigns 1, 0.5 or 0 per idea. The app computes the percentage, checks submitted evidence against the reviewed transcript and retains the original transcription separately. Assessments are study feedback. Test a faithful paraphrase, a changed quantity and an omission with the live model before presenting.

## Checks

Run `node --test tests/rubric.test.mjs` for bilingual example, audio asset and evidence validation checks. With the server running and Playwright installed, run `node tests/browser.mjs`. The browser checks use controlled model replies for the generate/save workflow and the real app for demo playback metadata, microphone fallback, reports, plan persistence and history. Set `EDGE_PATH` to use a specific Chromium executable.

Additional checks:

```sh
node --test tests/rubric.test.mjs tests/voice.test.mjs
node tests/browser.mjs
node tests/media-flow.mjs
node --test tests/timing.test.mjs
node tests/revision-flow.mjs
node tests/browser-capture.mjs
```

With `QA_REAL_ASR=1`, `tests/media-flow.mjs` passes prerecorded English and Mandarin speech through the actual microphone capture/WAV/transcription path (no physical microphone is used). It tests silence detection, a silent first input channel, pause/resume, seeking, automatic transcripts, daily rollover, regeneration failure recovery and audio-cache restoration. `node tests/voice-cache-live.mjs` downloads and exercises the real bilingual voice model, then verifies that a page refresh reuses both finished audio and model weights. `tests/revision-flow.mjs` reproduces 27-second audio against a 75-second request and tests correction, cache restoration, difficulty changes and permission denial. `tests/browser-capture.mjs` uses Chromium’s file-fed test microphone through the unchanged native getUserMedia implementation; it checks permission/device handling, five-second diagnosis, pause/resume and native-recording fallback when the worklet is unavailable. It does not record the user’s physical microphone.

These live checks require network access and may take several minutes. Set `PLAYWRIGHT_MODULE` to the installed Playwright module path if it is outside this project.

## Credits

The interface, bilingual speeches and prepared assessments were written for this project. The included demo audio was synthesized from its manuscripts with Windows system voices. The implementation uses [WebLLM](https://github.com/mlc-ai/web-llm) and [Transformers.js](https://github.com/huggingface/transformers.js). [Whisper Web](https://github.com/xenova/whisper-web) and [NaatiAce Practice Studio](https://github.com/gorock007/naatiace-practice-studio) were reviewed during planning.


## November 12 interface and transcription update

Difficulty uses an explicit bilingual sans-serif font stack. Listen now uses the system voice immediately; natural narration still requires local synthesis and duration verification. Whisper begins loading when recording starts, reusing the same worker when recording finishes. Preparation failures do not interrupt recording. Updated entry scripts use versioned URLs. English and Mandarin prerecorded captures produced transcripts in local Edge checks; this does not establish the cause of every empty transcript on the user device, and Mandarin output still needs correction. Speech-expansion responses now use a token budget based on the missing passage rather than the entire speech.

## November 13 visitor readiness

The first visit stays interactive without downloading models. `check.html` checks device support and small configuration-file connections; it does not prove full model availability. Included practice is reachable before AI setup. See [sharing and rehearsal instructions](SHARING-AND-REHEARSAL.md) for manual hosting and tonight’s rehearsal.

Verified locally on November 13: native browser microphone capture and fallback, real bilingual Kokoro synthesis and persistent cache, real English and Mandarin Whisper transcription, UI recording/replay, direction switching, history, duration correction, and diagnostic behavior with external hosts blocked. Synthetic/prerecorded microphone input is used in automated tests; the physical presentation microphone still needs a five-second test. Live WebLLM manuscript generation and live AI assessment have not been verified in this round; their UI and validation tests use controlled responses. Mandarin recognition needs review.
