# Microphone repair release — 2026-11-09

This release contains the locally tested microphone repair and duration controls. Check the Sites deployment result and GitHub remote branch for publication and backup status; local commits alone do not confirm either.

## Implemented locally

- Strict manuscript length checks and measured natural-audio duration correction, with a separate verified audio cache.
- Easier / harder regeneration controls preserving topic, direction and target duration.
- Native MediaRecorder compatibility recording alongside AudioWorklet capture.
- Five-second microphone test with a separate audible replay player, peak/RMS diagnostics, permission and signal diagnostics, and recording upload.

## Verification completed

- Seven Node tests for timing, preserved pitch, rubric and voice selection.
- Full browser workflow regression.
- Browser native getUserMedia capture using a file-fed test microphone: normal capture and a deliberately unavailable AudioWorklet both pass, including pause/resume and replay.
- Earlier end-to-end English and Mandarin Whisper tests passed.
- Revision workflow reproduced 27-second audio for a 75-second target and verified replacement manuscript, exact final audio duration, caching and difficulty controls.

On 2026-11-09 the user tested the repaired local build at http://127.0.0.1:4175/#history in a standalone browser and confirmed they could hear their own voice in the five-second microphone test. Physical microphone capture and test replay are therefore user-verified for this local build. The hosted version still needs publication and confirmation; the complete live interpretation/transcription flow was not part of this user test.

## Publication notes

Earlier publication attempts encountered intermittent Sites transport failures. A fresh source credential and source checkout synchronization subsequently succeeded. Use the existing project ID appgprj_6aed8286052081919ce9796d8916d296 and preserve its public audience. Follow the Sites source/package/save/deploy workflow.

The user authorized GitHub backup to the private repository https://github.com/Ossie-w/relay-interpreting-studio.git. Verify git status and origin/main before claiming these local changes have been backed up.
