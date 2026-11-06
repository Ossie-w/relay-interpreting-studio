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
| 生成稿件、难度、目标时长、语音转写和 AI 评分 | `dist/ai.js` |
| 双语示例、评分规则和反馈校验 | `dist/practice.js` |
| 原文播放、选声、暂停、进度条和自然语音合成 | `dist/playback.js`、`dist/voice.js`、`dist/narration-worker.js` |
| 录音回放和 WAV 转换 | `dist/recording.js` |
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

1. Open **Classroom demo** and play the included transit briefing. Both language directions have an audio file. Open **Rehearse with a prepared assessment** to compare the faithful paraphrase, changed number and omission. These examples work without model downloads and are labeled as prepared.
2. In a current desktop browser with WebGPU and shader-f16 support, generate a one-minute speech. Allow time for the initial multi-gigabyte bilingual model download. Live assessment uses the same model. Generated speeches use an installed English or Mandarin system voice. Playback duration is measured on completion.
3. Allow microphone access, record an interpretation and stop. On first transcription, the browser downloads a multilingual Whisper model. Replay the recording and correct the transcript, then choose **Assess and save attempt**. An unavailable microphone or failed transcription still permits a typed attempt.
4. Open **History**, refresh, and reopen the assessment. The app saves both transcript versions and durations. Recorded audio stays in memory for replay during the session. Clearing browser data removes saved plans and history.
5. For the classroom presentation, demonstrate a one-minute exercise and one feedback item. If the network or GPU is unavailable, use the bundled exercise and clearly labeled prepared assessments.

## AI and scoring

For AI-generated source speeches, **Prepare natural voice** renders the English or Mandarin manuscript into one audio track before playback. The first use loads roughly 340 MB of model weights. The browser synthesizes locally in a worker using [Kokoro JS](https://github.com/uzen-zone/kokoro-js) and [Kokoro-82M-v1.1-zh-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX). Once ready, use the audio controls to pause, seek or replay, and the speed selector to change tempo. **Play speech** uses a system voice immediately.

WebLLM runs Qwen2.5-3B-Instruct on the device for bilingual generation and assessment. Transformers.js runs multilingual Whisper on recorded audio. First use requires access to the runtime CDN, Hugging Face and the WebLLM model library host. Preload both models in the presentation browser. The studio sends the recording to the local transcription pipeline. Model availability, speed, and grading quality depend on the device. For long recordings, allow extra transcription time.

The source manuscript is split into ideas. Each assessment assigns 1, 0.5 or 0 per idea. The app computes the percentage, checks submitted evidence against the reviewed transcript and retains the original transcription separately. Assessments are study feedback. Test a faithful paraphrase, a changed quantity and an omission with the live model before presenting.

## Checks

Run `node --test tests/rubric.test.mjs` for bilingual example, audio asset and evidence validation checks. With the server running and Playwright installed, run `node tests/browser.mjs`. The browser checks use controlled model replies for the generate/save workflow and the real app for demo playback metadata, microphone fallback, reports, plan persistence and history. Set `EDGE_PATH` to use a specific Chromium executable.

## Credits

The interface, bilingual speeches and prepared assessments were written for this project. The included demo audio was synthesized from its manuscripts with Windows system voices. The implementation uses [WebLLM](https://github.com/mlc-ai/web-llm) and [Transformers.js](https://github.com/huggingface/transformers.js). [Whisper Web](https://github.com/xenova/whisper-web) and [NaatiAce Practice Studio](https://github.com/gorock007/naatiace-practice-studio) were reviewed during planning.

