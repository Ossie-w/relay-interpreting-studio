# Relay · Interpreting Studio

English–Mandarin consecutive interpreting practice. Use the Studio to choose a direction, topic and duration. The training plan and completed assessments are stored in the current browser.

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

