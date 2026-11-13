# Manuscript generation recovery — 2026-11-13

The reported failure was the final manuscript-length rejection in `generateSpeech`, not a microphone failure. The old algorithm asked the model to rewrite or append until its output landed inside the length tolerance. It had no sentence-safe way to shorten an otherwise usable manuscript. A token-limited JSON response discarded every completed passage when `JSON.parse` failed. In a real one-minute English run, it used all six requests, including one truncated JSON reply, before succeeding; another sequence could exhaust those attempts and show the user's error.

The corrected generator:

- Asks explicitly for complete spoken paragraphs, with Chinese instructions for Chinese output. It rejects section-heading outlines instead of treating them as a manuscript. The requested batch has required numbered paragraph fields: the bundled runtime did not enforce array `minItems` in live tests, so those optional constraints are not relied upon.
- Retains complete JSON strings from a token-limited manuscript response and excludes the unfinished string. This recovery never applies to grading results.
- Fits overlong text at full sentence boundaries; it never slices words, digits or Chinese clauses to satisfy a counter. A short complete prefix can be continued.
- Caps each generation batch at 220 English words or 360 Chinese characters. Long exercises continue in bounded requests instead of trying to write everything inside one context/output budget.
- Gives continuation requests a distinct section focus (implementation, resources, accessibility, risks, examples, evaluation, next steps) tied to the same working title. Passing the whole earlier draft caused repeated copying in a live five-minute test, so it is not used as a continuation prompt.
- Checks the language of each continuation independently and removes exact repeated sentences before joining, including an old opening copied into a new paragraph.
- Keeps the original manuscript-length tolerance and actual audio-duration verification. A previous exercise remains intact if generation fails. No prewritten replacement is labelled as live AI output.

`tests/manuscript.test.mjs` covers safe recovery, complete-sentence fitting, outline and language rejection. `tests/generation-recovery.mjs` exercises the actual generator with controlled engine responses, including truncated JSON and both directions at 60, 75 and 300 seconds. `tests/direction-flow.mjs` covers switching, cache restoration and failed-request recovery. `tests/revision-flow.mjs` verifies that a 27-second voice is rewritten for a 75-second request and never silently substituted.

`tests/generation-live.mjs` runs actual Qwen/WebLLM and optionally the actual Kokoro timed-audio pipeline. Its isolated browser profile and raw test logs live outside the repository, so public model downloads and browser storage are not committed. Set `GEN_AUDIO=1` for audio; `GEN_CASES` accepts a JSON array of direction/target/difficulty settings. Entries with `skipAudio:true` test manuscript generation only. The live model and voice retain their existing versions.

## Verification results

Real local Qwen tests passed English and Mandarin 60-second manuscripts, an English 75-second manuscript, and—after the continuation correction—both 300-second manuscript targets. The final long run produced zh: 1158 units in 72.1 s; en: 733 units in 84.4 s. These are measured manuscript generation times on this machine, excluding natural voice.

During this fix, real Kokoro narration completed in both languages at 60.000 seconds with nonzero waveform peaks (English 0.416, Mandarin 0.459). English initially measured 59.1 seconds and received a small tempo correction. Mandarin initially measured 52.4 seconds, triggered a real Qwen rewrite, then measured 64.7 seconds before the permitted small tempo correction to 60 seconds. These audio tests preceded the final paragraph-count/continuation refinements; the unchanged timed-audio path was also regression-tested. Full five-minute natural narration was not synthesized in this run. Natural voice still takes minutes on the test CPU; this fix addresses generation reliability, not all inference latency or every network/device limitation. Live grading was not revalidated here.

Passed controlled regressions: truncated output recovery; overlong complete drafts; heading rejection; duplicate-sentence removal; English/Mandarin targets at 60, 75, 300 seconds; direction switching and failed-request recovery; exact audio timing correction; first-visit no-download behavior; evidence validation. All generated content remains AI-produced and should be reviewed for factual consistency and phrasing.
