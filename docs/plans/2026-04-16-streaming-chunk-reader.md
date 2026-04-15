# Streaming Chunk Reader Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Start reading long documents after the first generated chunk is ready while later chunks are converted in the background, keeping preview highlight and scroll synchronized with playback.

**Architecture:** Split cleaned Markdown text into sentence-indexed chunks, generate speech per chunk through Electron IPC, and drive playback from a renderer-side queue with prefetching. Highlighting uses global sentence indexes plus subtitle timing where available, falling back to sentence order when subtitles are missing.

**Tech Stack:** Electron main/renderer, Node.js built-in `node:test`, Edge TTS CLI, HTMLAudioElement, DOM Range highlighting.

---

## Scope

- Keep the existing single-window Electron app.
- Use chunked generation, not byte-level MediaSource streaming.
- Generate the first chunk immediately, then prefetch following chunks with a small concurrency limit.
- Preserve existing voice, volume, playback-rate, pause, resume, stop, and live preview behavior.
- Improve highlight positioning so repeated sentences do not always match the first occurrence.

## Tasks

### Task 1: Add Planning Document

**Objective:** Capture the design and implementation boundary before changing behavior.

**Files:**
- Create: `docs/plans/2026-04-16-streaming-chunk-reader.md`

**Verification:**
- Read the document and confirm it lists scope, architecture, and task order.

### Task 2: Add Text Pipeline Tests

**Objective:** Define expected behavior for Markdown cleaning, sentence splitting, chunk creation, and subtitle parsing.

**Files:**
- Create: `tests/textPipeline.test.js`
- Create: `tests/subtitles.test.js`
- Create later: `src/textPipeline.js`
- Create later: `src/subtitles.js`

**Verification:**
- Run `node --test tests/textPipeline.test.js tests/subtitles.test.js`
- Expected first run: fail because modules do not exist.

### Task 3: Implement Text Pipeline Modules

**Objective:** Provide reusable pure functions for renderer playback planning.

**Files:**
- Create: `src/textPipeline.js`
- Create: `src/subtitles.js`

**Verification:**
- Run `node --test tests/textPipeline.test.js tests/subtitles.test.js`
- Expected: pass.

### Task 4: Add Chunk Speech IPC

**Objective:** Generate one chunk at a time and return audio plus parsed subtitles.

**Files:**
- Modify: `main.js`
- Use: `src/subtitles.js`

**Implementation Notes:**
- Keep `generate-speech` for compatibility.
- Add `generate-speech-chunk` that receives `text`, `voice`, and `volume`.
- Use cache keys that include chunk text, voice, and volume.
- Prefer `execFile` over interpolated shell commands for new code.

**Verification:**
- Run `node --check main.js`.

### Task 5: Replace Renderer Playback With Queue

**Objective:** Start playback after the first chunk is ready and continue through the queue.

**Files:**
- Modify: `index.html`
- Use: `src/textPipeline.js`

**Implementation Notes:**
- Build a playback plan from current input at start.
- Maintain a `playSessionId` to ignore stale background results.
- Use `chunkStates` and `audioQueue`.
- Generate first chunk, play it, prefetch next chunks.
- Pause/resume acts on the current `audio`.
- Stop cancels the current session and clears pending highlights.

**Verification:**
- Run `node --check` on the extracted script or a temporary JS wrapper if needed.
- Run app manually with a long document and verify first audio starts before all chunks are ready.

### Task 6: Synchronize Highlight and Scroll

**Objective:** Map chunk-local subtitle cues to global sentence indexes and scroll the preview to the active sentence.

**Files:**
- Modify: `index.html`

**Implementation Notes:**
- Store `currentChunk`.
- On timer, compute active subtitle cue for `audio.currentTime / rate` or direct current time depending on generated base speed.
- Highlight `chunk.sentenceStartIndex + cue.index`.
- Fall back to proportional sentence index within chunk if subtitles are unavailable.
- Use DOM text offsets with a starting search offset to avoid repeated sentence collisions.

**Verification:**
- Manually verify repeated sentences highlight in order.
- Manually verify long-document scroll follows playback.

### Task 7: Final Verification

**Objective:** Confirm code parses and tests pass.

**Commands:**
- `node --test tests/textPipeline.test.js tests/subtitles.test.js`
- `node --check main.js`

**Manual Checks:**
- Empty input still blocks play.
- Short input still plays normally.
- Long input enters generating, then playing, and prefetches later chunks.
- Pause, resume, stop, voice change, input edit do not continue stale playback.
