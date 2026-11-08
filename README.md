# Relay · Interpreting Studio

English–Mandarin consecutive interpreting practice. Use the Studio to choose a direction, topic and duration. The training plan and completed assessments are stored in the current browser.

## 从这个版本继续开发

这是 Relay 英汉交替传译训练平台的课程项目。线上公开网站由 Sites 部署，GitHub 用来保存源码和版本历史。首次备份的标签是 `checkpoint-01`。[打开训练平台](https://aussy-interpret-studio.aussy0828.chatgpt.site/)

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

The studio generates a recommendation on the first visit of each local calendar day, using the daily plan’s direction and a random preferred topic (one minute, Intermediate). It saves the manuscript locally. The hero and the current exercise always display the same title. **Regenerate** keeps the exercise’s direction, topic, difficulty and duration. **简单一点 / 难一点** changes one difficulty level while keeping the direction, topic and target duration; **Generate speech** uses the setup form. A failed generation leaves the previous exercise intact. A successful custom generation becomes today’s saved practice.

Manuscript generation now requires the requested word/character budget within 8% (minimum 3 units), using up to four drafting/expansion attempts; a short draft is never silently accepted. **Prepare natural voice** measures the actual synthesized audio. If it is substantially too short or long, the AI rewrites the manuscript using the measured speaking rate and synthesizes again, with up to three audio attempts. Only a final tempo correction within 10% is allowed, using waveform-similarity overlap-add to retain pitch, to create exactly the target sample count. It never pads a large shortfall with silence, cuts off a speech to fit, or stretches a 27-second speech to 75 seconds. A failed match leaves the existing exercise in place and reports a retryable error. The final manuscript, hero title, idea list and daily cache update together, before recording. Timing is for 1× playback; changing playback speed intentionally changes elapsed listening time. System voice playback is an untimed preview. Verified audio is cached separately from draft synthesis.

For AI-generated source speeches, **Prepare natural voice** renders the English or Mandarin manuscript into one audio track before playback. The first use loads roughly 340 MB of model weights. The browser synthesizes locally in a worker using [Kokoro JS](https://github.com/uzen-zone/kokoro-js) and [Kokoro-82M-v1.1-zh-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX). The large voice model is stored as 4 MB IndexedDB blocks because some browsers reject a single 340 MB Cache API entry. A completion record is committed only after all blocks are stored; interrupted downloads cannot be mistaken for a complete model. Other assets use the library’s caches, and the worker keeps its model in memory between manuscripts. Finished WAV tracks are saved separately with a hash of the manuscript, language and voice version. Up to 24 recent tracks are retained. Refreshing the same manuscript restores its track without synthesizing again. A new manuscript still requires synthesis, even with a cached model. The app requests persistent browser storage, but browsers can refuse it or remove data; private browsing, clearing site data, another browser or another site origin can require fresh downloads. Model assets and the runtime also need network access if their caches are missing.

Once ready, use the audio controls to pause, seek or replay, and the speed selector to change tempo. **Play speech** uses a system voice immediately.

WebLLM runs Qwen2.5-3B-Instruct on the device for bilingual generation and assessment. Transformers.js runs multilingual Whisper in a dedicated worker on recorded audio, filling the transcript automatically after **Finish recording**. Loading and transcription progress appear beside the transcript. The original recognition and learner-corrected versions remain separate. Recognition can mishear words, especially Mandarin; review before assessment. First use requires access to the runtime CDN, Hugging Face and the WebLLM model library host. Preload both models in the presentation browser. Microphone capture requests browser permission through the native getUserMedia API with browser-default audio processing. It checks the microphone Permissions Policy, uses an AudioWorklet plus an independent native MediaRecorder compatibility path, and exposes explicit input selection, a live level meter and uncompressed PCM WAV output. **Test microphone · 5s** checks final captured samples, not just permission or device labels. Connection details expose permission, track mute/ready state, audio-context state and received frames. If the worklet fails or captures silence but the native recorder has usable sound, the native take is decoded and retained. Paused frames are excluded. It selects the channel carrying the strongest signal and raises usable quiet audio without clipping; silent input is reported beside the recorder instead of being sent to transcription. The capture graph outputs silence to avoid microphone feedback. The app cannot override a host app’s or operating system’s microphone restrictions. When an embedded Codex / ChatGPT page supplies silence, compare the same site in standalone Edge or Chrome and inspect Windows microphone privacy settings. **Upload recording** provides an alternative path into the same replay and automatic-transcription workflow. No claim is made that a synthetic capture test verifies the user’s physical microphone. The studio sends the recording to the local transcription pipeline. Model availability, speed, and grading quality depend on the device. For long recordings, allow extra transcription time.

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

