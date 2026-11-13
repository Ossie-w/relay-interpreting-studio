# Save practice independently of assessment

Previously an invalid exact-evidence quote from the local assessment model threw
before localStorage was written. The combined button therefore lost the ability
to save whenever assessment failed, despite a usable recording and transcript.

Both buttons now persist metadata, source and both transcripts first. Recording
blobs are saved separately in IndexedDB and can be replayed/downloaded in history.
Failed or skipped assessment is explicitly unscored, with no fabricated percentage.
Retrying from history updates the same record. Reviewed text can still be edited
and saved again. A localStorage failure is reported rather than claiming success;
an audio-storage failure preserves the text record and warns to download the audio.

Validation: controlled Chrome browser test covers rejected assessment, refresh,
history recovery, successful retry without duplicates, uploaded WAV persistence
and playback duration after refresh, and simulated storage quota rejection.
Rubric evidence validation remains strict. No real model score was fabricated.

The reported incomplete 2:17 transcript has not been reproduced against the user's
original audio. Existing ASR passes the full decoded recording to Whisper with
30-second windows/5-second stride. This release does not claim to repair recognition
accuracy or prove transcript completeness. Saved recordings now support later review.
