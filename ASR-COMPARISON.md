# Browser-only transcription trial — 2026-11-13

No server or paid speech API was used. Audio remains in the browser. Three real engines ran sequentially in local Chrome on this computer, using the identical bundled Windows-synthesized `commute-en.wav` (54.875 s) and `commute-zh.wav` (70.366 s). These clear synthetic voices are a smoke test, **not an accuracy benchmark for learner accents, real microphones or noise**. Times are observations, not a service guarantee.

| Engine / runtime | English inference | Mandarin inference | Warm English repeat |
| --- | ---: | ---: | ---: |
| Existing multilingual Whisper tiny, q8, WASM, Transformers.js 3.7.2 | 11.73 s | 15.96 s | 11.08 s |
| Multilingual Whisper small, fp32 encoder / q4 decoder, WebGPU, Transformers.js 4.3.2 | 12.38 s | 15.47 s | 9.53 s |
| SenseVoice Small int8, sherpa-onnx 1.12.35, single-thread WASM, whole recording | 23.59 s | 33.34 s | 23.36 s |

First Whisper pipeline preparation took 8.96 s for tiny and 51.41 s for small (download/loading combined; network-dependent). SenseVoice loaded locally in 3.46 s, **excluding** the separately downloaded 165.75 MB compressed release, so that figure is not comparable to Whisper's initial download. SenseVoice was tested without VAD segmentation; segmentation may improve its speed and needs a separate controlled trial before judging its best achievable performance.

The final integrated run passed both languages and refresh reuse with all model requests blocked. It took 114.67 s for the first English result including download/cache writes/loading/inference, 14.83 s for subsequent Mandarin, and 24.47 s for English after refresh including loading the saved model into memory. Earlier integrated first runs took 59–72 s. This variation is why first-use download is not advertised as a fixed-time experience. The refresh check initially revealed one-byte network probes; cached range responses now remove those requests too.

Examples from the Mandarin output:

- Tiny: `最凡王的兩條陷入` / `30兩電動工交車`.
- Small: `最繁忙的兩條線路` / `30輛電動公交車`.
- SenseVoice: `最繁忙的两条线路` / `30辆电动公交车`.

Small still made errors including `本事` for `本市`, `是` for `市`, and a damaged character near a chunk boundary. SenseVoice's Mandarin was strongest in this sample, but included `票价将保持不便` for `不变`. English small produced `Fairs` for `Fares`; SenseVoice produced `Trans department` for `transport department`. Do not silently repair learner content using the source manuscript: an incorrect number may be the learner's actual interpretation and matters to assessment.

## Implementation decision

Add an Enhanced mode using small/WebGPU and retain Lightweight using the existing tiny/WASM. Enhanced is the initial choice; unavailable WebGPU selects tiny and the actual engine is displayed with the completed transcript. GPU/runtime errors preserve the recording and suggest choosing Lightweight and retrying rather than secretly switching models. A mode change does not download a model by itself. Initial site load still makes no model request.

Small's two weight files total 585,975,197 bytes (about 586 MB decimal). Store them in 4 MiB IndexedDB blocks with completion manifests; serve cached GET/HEAD requests after refresh. Each site's origin has its own cache. Browser storage removal/eviction, private browsing or storage failure can require downloading again. The runtime and configuration files still depend on CDN/Hugging Face availability; this change does not guarantee access from mainland/Hong Kong networks.

The worker shares model preparation across warmup and transcription with per-request status routing, and retains one engine for repeated English/Mandarin recordings. Changing modes terminates the old worker to release resources. The UI records the engine name with saved attempts, preserves original recognition output and supports correction before assessment. Neither quality mode uses manuscript text as an ASR prompt.

SenseVoice's official WebAssembly release was downloaded and tested outside the repository. No third-party SenseVoice files or model weights are published with this change. Its web demo returned an access error during the trial; the official GitHub release worked. A future VAD-segmented trial and deployment/license review can determine whether it should become a Mandarin-oriented option.

## Reproduce

Set `PLAYWRIGHT_MODULE` to the installed Playwright module and `EDGE_PATH` to Chrome or Edge. Run from the project root:

```
ASR_CANDIDATE=tiny node tests/asr-benchmark.mjs
ASR_CANDIDATE=small node tests/asr-benchmark.mjs
node tests/sensevoice-benchmark.mjs
node tests/asr-live.mjs
node tests/asr-routing.mjs
```

On PowerShell, set variables using `$env:ASR_CANDIDATE='small'` before running Node. `SENSEVOICE_TRIAL` can point to the extracted official v1.12.35 browser release. `asr-live` exercises the actual production module and blocks model weight requests after a refresh to verify reuse. `asr-routing` uses controlled runtime responses to check no-GPU fallback, warmup races, language direction, failed recognition/retry, preference retention and mobile width. It is not an accuracy test.

Sources: [Whisper small ONNX](https://huggingface.co/onnx-community/whisper-small), [Transformers.js releases](https://github.com/huggingface/transformers.js/releases), [sherpa-onnx v1.12.35](https://github.com/k2-fsa/sherpa-onnx/releases/tag/v1.12.35), [SenseVoice browser build workflow](https://github.com/k2-fsa/sherpa-onnx/blob/master/scripts/wasm/generate-vad-asr.py).
