# Pending publication — 2026-11-09

The live website is still the previous release (source commit e8a2d9196954697bffe5f1f8b1e1e39fc32ac9c3). The local changes in this checkout have not been deployed.

## Implemented locally

- Strict manuscript length checks and measured natural-audio duration correction, with a separate verified audio cache.
- Easier / harder regeneration controls preserving topic, direction and target duration.
- Native MediaRecorder compatibility recording alongside AudioWorklet capture.
- Five-second microphone test, permission and signal diagnostics, and recording upload.

## Verification completed

- Seven Node tests for timing, preserved pitch, rubric and voice selection.
- Full browser workflow regression.
- Browser native getUserMedia capture using a file-fed test microphone: normal capture and a deliberately unavailable AudioWorklet both pass, including pause/resume and replay.
- Earlier end-to-end English and Mandarin Whisper tests passed.
- Revision workflow reproduced 27-second audio for a 75-second target and verified replacement manuscript, exact final audio duration, caching and difficulty controls.

The user reports silence in both the embedded window and standalone Edge/Chrome. They could not yet test Windows Sound Recorder. Physical microphone input is therefore still unverified; do not claim that the user's hardware issue is resolved.

## Publication blocker

Sites get_site and create_source_repository_write_credential currently return a transport failure for https://chatgpt.com/backend-api/ps/mcp. Retry through the Sites plugin when its connection is restored. Use the existing project ID appgprj_6aed8286052081919ce9796d8916d296 and preserve its public audience. Follow the Sites source/package/save/deploy workflow.

The user authorized GitHub backup to the private repository https://github.com/Ossie-w/relay-interpreting-studio.git. Verify git status and origin/main before claiming these local changes have been backed up.
