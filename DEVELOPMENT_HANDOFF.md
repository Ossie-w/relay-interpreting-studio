# Relay development handoff — 2026-11-27

## Checkout and release
- Development branch: `codex/deepseek-next`, based on `fe2cf85114123c4e4061ce57f222c2440a5d355e`.
- Repository: https://github.com/Ossie-w/relay-interpreting-studio
- Public site: https://aussy-interpret-studio.aussy0828.chatgpt.site/
- Sites project: `appgprj_6aed8286052081919ce9796d8916d296`.
- Buildless static application in `dist`, hosting manifest `.openai/hosting.json`.
- Do NOT deploy Netlify until user explicitly requests the formal release. Ordinary authorized updates previously synchronized Sites and GitHub; this branch is experimental, do not publish it automatically without establishing release intent.
- Preserve all existing features. Current styling: pale blue, indigo, white, restrained bright yellow.

## User workflow
Short consecutive practice supports topic, duration, direction, voice and model selection. Video long consecutive practice lives at `#video` alongside studio, history and training plan. Users import transcripts (paste, SRT/VTT/TXT), translate and compare paragraphs, upload interpreting recordings, transcribe, review, save, assess and export Word. Voice-Pro is optional, locally installed at `D:/各种安装包/voice-pro`, local UI port 7870.

## Recent implementation
- 2026-11-29 development only: `video.js` persists video draft and conversation to `relay-video-draft-v1` in localStorage, restores on reload; no API key or audio in this draft. Old misleading conversation copy replaced. `tests/video-draft.mjs` verifies browser reload with mocked AI. Published to Sites on 2026-11-29 at bb7e267 after explicit user authorization; Netlify unchanged.
- `dist/subtitles.js`: subtitle parsing, timestamp-aware translation batches and TXT export.
- `dist/video-conversation.js`: Q&A or direct translation revision, whole talk or selected paragraphs; atomic update after all batches succeed. Called from `dist/video.js`. Updated translations feed comparison and Word export.
- `dist/assessment.js`: source/confirmed-transcript grading; accuracy 40, completeness 25, expression 15; local audio rhythm estimate up to 20. Original and confirmed transcripts and recordings save before scoring. No per-sentence audio replay in reports.
- `dist/assessment-audit.js`: numbered source/learner fragment evidence; retries missing checks and validates returned IDs. Full matched learner sentences feed the audit, not just shortened display quotes.
- `dist/assessment-recovery.js`: bounded automatic retries for transient/schema errors, tab-memory validated batch checkpoints (60-entry cap), source batches <=6 units or roughly 4500 characters. No automatic retry for invalid credentials, balance errors or cancellation. Refresh clears checkpoints.
- Latest release revision: `resumable-audit-20261127`. User reported scoring sometimes fails first time and succeeds second time; latest recovery changes address this but have NOT been validated against their actual recording with a real model call.

## Tests and limits
- `node tests/assessment-recovery.mjs`
- `node tests/audit-recovery.mjs`
- `node tests/audit-long.mjs`
- `node tests/video-conversation.mjs`
- Browser `tests/score-flow.mjs` verified recording, save, invalid-key/network failure, retry, reload and persisted report with mocked AI responses. Run using PLAYWRIGHT_MODULE pointing to sibling `relay-qa-tools/node_modules/playwright` and EDGE_PATH to installed Chrome. Browser tools may require sandbox approval.
- Mock tests demonstrate control flow, not actual translation or scoring quality. Do not claim live scoring reliability or quality is proven.
- Remaining concerns: whole-transcript input on each scoring batch; excessive latency on long talks; scoring alignment and quality need real representative evaluation. Conversation uses batch responses rather than streaming tokens. No cross-device user-account sync implemented.

## Credentials and storage
- Never include API keys in commits, docs, logs, screenshots or model prompts. Do not search for or print key files.
- Existing BYOK browser requests go directly to DeepSeek; key lives only in tab memory and clears on reload/exit. `dist/deepseek-access.js` owns endpoints and request/auth logic.
- Practice history is browser localStorage (`relay-history`); audio uses local IndexedDB through `attempt-audio.js`. Data is origin/browser-specific, not automatically shared across Sites and Netlify or devices.
- Codex development provider configuration is separate from the website's DeepSeek integration. No Codex provider configuration has been changed.
- A chat fork could not be created automatically: no fork/create-thread tool was exposed. This document enables continuation in a new chat/tool, but is not full conversation memory.

## Working convention
Read current git status and code before changing anything. Use isolated development branch, retain user changes, run relevant tests, clearly distinguish local changes from published releases. Never silently relax evidence validation or award full credit to missing audits.
