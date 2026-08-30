# Wave 2 integration review — Codex Progressive Speech

- Verdict: **PASS**
- Findings: **Blocker 0 / Major 0 / Minor 0**
- Scope: C1/C2/C3 と Wave 1A/1B foundation の境界だけを確認した narrow integration review
- Reviewer: fresh independent Review-Sylph

## Scope / attribution

Basis は `codex-progressive-speech-wave-plan.md` §2–§3、§7–§10、Wave 1A/1B completion、A1/A2/B1/B2 final reviews、C1/C2/C3 final PASS reviews、Wave 2 completion。現行 target source/tests、tracked dirty diff、relevant untracked files の full content、passive diagnostic seam を直接照合した。

shared worktree には identity、conversation instruction、Cockpit settings/UI、passive diagnostics、Runtime、documentation、agent profile、Expo を含む多数の同時変更がある。Wave 2 帰属は completion report の source/hunk 境界に限定し、他者の変更を Wave 2 成果へ誤帰属していない。新規 primitive と focused tests は untracked のため、次の 6 files は ordinary diff ではなく current whole-file content を review state として読んだ。

- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.mjs`
- `apps/soul/agent/src/mind/incremental-sentence-tag-buffer.test.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.mjs`
- `apps/soul/agent/src/voice/tts-playback-coordinator.test.mjs`
- `apps/soul/agent/src/voice/progressive-speech-delivery.mjs`
- `apps/soul/agent/src/voice/progressive-speech-delivery.test.mjs`

source implementation、completion、final-mechanical、closeout、human-gate は変更していない。

## Seam inspection

### 1. ordered delta → safe enqueue → final flush

PASS。

- Cockpit の session proxy は additive `askOptions` を同じ session へ透過し、三つの Codex route の App Server `onTextDelta` が一 accepted Fire の一つの callback へ入る。
- callback は delta を Fire-local incremental sentence/tag buffer の `append` へ一度だけ渡す。完成文は callback 内で同期 enqueue され、minimum-length merger はない。
- buffer が delta 境界を跨いで文と tag を組み立てた後に NG scan するため、分割 NG 語も検出される。tag/control syntax は delivery へ渡らない。unsafe sentence は generation を abort し、後続を止め、既に matching ENDED へ到達した safe watermark は C3 owner に残る。
- successful ask だけが guarded `flush()` を一度呼び、unterminated remainder を一度だけ enqueue する。LLM failure は flush せず delivery を閉じ、late callback/late preparation は閉じた generation を再生しない。

### 2. sentence jobs → overlap preparation → FIFO playback authentication

PASS。

- sentence ごとの preparation は並行できるが、Wave 1B coordinator は queue head が ready の時だけ active にし、`activePlaybackId` は常に 0 または 1。準備の逆転で再生順は変わらない。
- FIFO active job だけが actual `intent.speech` preflight/send を行う。exact accepted reply の後に generation-qualified `PLAYID` を同じ owned WAV path へ送り、Soul AudioPlayer が実 WAV owner、Runtime は mouth timeline consumer のまま。
- active owner は `generationId` / `jobId` / module-lifetime-qualified `playbackId` / exact WAV path / `requestId` / serialized UTF-8 bytes を連結する。matching `STARTED` 前の `ENDED`/`STOPPED`、path-only、duplicate、old generation、同一 path の stale marker は commit/advance しない。
- LLM terminal と queue terminal は別。`finishLlm()` は active/queued work がなくなるまで Fire を成功 terminal にしない。STARTED watchdog と duration + bounded margin ENDED watchdog は exact generation を failure にし、timer を completion authority にしない。

### 3. private delivery outcome → canonical audible truth

PASS。

- exact generation の private terminal は `reportedProgressiveGenerations` で一度だけ projection owner を取得する。non-complete かつ completed watermark > 0 の時だけ `playedText + "\n" + fixed interruption note` を transcript buffer へ一度 append し、同じ entry を `onSoulTranscript` へ渡す。
- transcript buffer の production `onAppend` が scheduler の soul/self-spoke refractory を一度更新し、Cockpit は `onSoulTranscript` を soul SSE の唯一の放送元にして append 側の soul broadcast を除外する。memory/digest は同じ canonical transcript snapshot を読むため、unheard suffix、tag、NG content、continuity instruction は入らない。
- progressive full completion は legacy `speak` へ fall through せず、tag-free final answer を一度だけ commit する。partial は prefix を再送/replay しない。
- genuine zero-completed channel/prepare failure は partial transcript/note/correction/self-spoke を作らず、既存 `{reason:"error"}` + exactly one `fireError` へ戻る。kill/dispose/barge/NG の cause-specific control outcome はこの normal-error remap に入らない。

### 4. partial correction and conversation continuity

PASS。

- canonical partial append が成功した後だけ一つの pending correction を作る。resource acquisition と vision capture の失敗は pending を保持し、次の actual `session.ask` が一度だけ consume する。ask handoff 後の ambiguous failure では再送しない。
- normal ask は correction を先頭へ一度付け、vision ask は既存 `[image, text]` 順を保ったまま first text block に付ける。Cockpit transcript への user line、追加 Fire、追加 ask/turn は作らない。
- healthy session を C3 が dispose/reset する経路はなく、A2 の persistent App Server thread をそのまま使う。fatal App Server turn だけは A2 の既存 fresh-process/thread recovery に従う。

### 5. ownership / interruption / reconnect / settings

PASS。

- synchronous `fireClaimed` が resource/capture 前窓を含む accepted Fire single-flight と pending-correction owner を守る。
- kill/dispose は pre-STARTED でも generation を閉じる。barge-in は authenticated STARTED 前は no-op、STARTED 後と completed prefix 後の inter-sentence gap では exact generation を閉じる。late marker/delta/preparation は queued work や later Fire を resurrect しない。
- accepted Fire は session/brain/context/instruction、memory、player/audio revision、Channel URL/revision、TTS deps を immutable snapshot として保持する。mid-Fire settings write は current resource を交換せず、次 accepted Fire の acquisition boundary で適用される。
- close-before-reply / reply-timeout / send failure は current ambiguous request を retry せず exact cached channel generation だけを invalidate する。次 Fire が一度だけ reconnect できる。local 4096 preflight failure は healthy cached connection を保持する。
- focused tests は kill→revive、barge gap、old marker→fresh generation、channel/preflight failure、missing ENDED watchdog、zero failure の各 later-Fire recovery を直接通す。

### 6. passive diagnostics and 4096 boundary

PASS。

- `llm.first_delta`、`progressive.first_safe_sentence`、job prepare start/end、playback activating/activated、authenticated player STARTED/ENDED/error、job terminal、delivery settled、Fire completed/failed が Fire-local monotonic orderで残る。
- `generationId`、`jobId`、`playbackId`、`requestId`、connection generation、speech chars、mora/timeline/WAV counts、actual serialized UTF-8 bytes、terminal cause により chain を再構成できる。`progressive.playback.activated` が job/playback と channel request/bytes の橋になる。
- new passive trace は本文を記録しない。full `playedText` は private terminal/projection seam だけで、production Fire diagnostics はこの hook を購読しない。
- Soul preflight と Runtime frame cap はどちらも **4096** のまま。actual outgoing serialized string を一度測り、4096 は accepted、4097+ は local/transport oversize evidence になる。

### 7. provider / vision / legacy regression

PASS。

- `brains.mjs` の `codex` / `codex-55` / `codex-56-sol` は同じ App Server adapter factory を使い、Sol は `gpt-5.6-sol` + reasoning effort `low`。one Fire は一 App Server ask/turnで、sentence job は ask を作らない。
- vision progressive Fire は image-first blocks と一 ask を維持する。vision requirement を latency optimization で外す変更はない。
- explicit Claude snapshot は progressive delivery を生成せず existing full-result one-shot path を exact once 維持する。Codex の non-streaming result も legacy final fallback 一回だけ。

### 8. accepted scope boundary

PASS。

- manifest/lockfile target diff は空。`SPEECH_ENVELOPE_UTF8_CAP` と Runtime `controlChannelMaxClientMessageBytes` は 4096。
- diagnostic UI、payload-cap redesign、dependency、Runtime audio ownership、public telemetry framework の追加はない。
- Runtime側の relevant seam は accepted Wave 1B/C2 の additive observation と Soul `PLAYID` authentication を支える既存 Control Channel timeline responsibility に留まる。Wave 2 completion は Runtime source を帰属していない。

## Reviewer-executed commands / raw summaries

### Repository-standard Node worker attempt

```powershell
cd apps/soul/agent
node --test src/mind/fire-orchestrator.test.mjs
```

Raw: exit 1; **tests 1 / pass 0 / fail 1**; duration 8.6562 ms。test file precollection の `ChildProcess.spawn` で `Error: spawn EPERM`。implementation assertion は一件も走っていない。

### Worker-free integrated transport / delivery / Fire lane

```powershell
cd apps/soul/agent
node --test --test-isolation=none --test-concurrency=1 \
  src/mind/incremental-sentence-tag-buffer.test.mjs \
  src/voice/tts-playback-coordinator.test.mjs \
  src/voice/progressive-speech-delivery.test.mjs \
  src/voice/speak.test.mjs \
  src/channel/channel-client.test.mjs \
  src/mind/fire-orchestrator.test.mjs \
  scripts/cockpit.test.mjs \
  src/mind/codex-session.test.mjs \
  src/mind/brains.test.mjs
```

Raw: exit 0; **252 tests / 252 pass / 0 fail**; wall 5.307 s。`--test-reporter=dot` で再実行して **252 dots**、exit 0、wall 5.517 s も確認した。

### Exact current C2/C3 integrated slice

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  --test-name-pattern='C2|C3' \
  src/mind/fire-orchestrator.test.mjs
```

Raw: exit 0; **16 tests / 16 pass / 0 fail**; duration 67.7232 ms。

### Transcript / memory / self-fire lane

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  src/ears/transcript-buffer.test.mjs \
  src/mind/memory.test.mjs \
  src/mind/fire-scheduler.test.mjs
```

Raw: exit 0; **107 tests / 107 pass / 0 fail**; dot reporter **107 dots**、wall 0.367 s。

### Cockpit projection seam

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  scripts/cockpit.test.mjs \
  src/cockpit/cockpit-server.test.mjs
```

Raw: exit 0; **207 tests / 207 pass / 0 fail**; duration 5,970.5613 ms。dot reporter **207 dots**、wall 6.225 s。

### Fire diagnostics lane

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/fire-diagnostics.test.mjs
```

Raw: exit 0; **6 tests / 6 pass / 0 fail**; duration 327.647 ms。

### Runtime focused lane

```powershell
cd apps/runtime-player
pnpm.cmd exec vitest run -c vitest.config.ts \
  src/main/control-channel/control-channel-overlay-store.test.ts \
  src/main/control-channel/channel-websocket-connection.test.ts \
  src/main/control-channel/channel-server-events.test.ts \
  --pool=threads --maxWorkers=1 --no-file-parallelism
```

Sandbox raw: exit 1 before collection; Vite config load 時に esbuild `spawn EPERM`。同一 command を process-spawn 許可下で再実行し、exit 0; **3 files / 37 tests pass / 0 fail**（29 + 6 + 2）、Vitest duration 962 ms。

```powershell
pnpm.cmd typecheck
```

Raw: exit 0; `tsc --noEmit -p tsconfig.json` PASS。

### Syntax / diff hygiene / scope

`node --check` を Fire orchestrator、progressive delivery、coordinator、incremental buffer、channel client、speak、audio player、Cockpit entry に実行し、すべて exit 0。

`git diff --check -- <tracked target files>` は exit 0、whitespace error なし。LF→CRLF warning のみ。package manifests / lockfiles の `git diff --name-only` と target status は空。

## Residuals / later gates

- real App Server/model、AivisSpeech、WinRT AudioPlayer、Runtime Player を同時に使う progressive run は未実施。first audible latency、自然な gap、実 playback marker timing、subjective interruption note は mechanical/human gate の対象。
- real run の per-chunk serialized payload distribution は未取得。4096 の retain/raise/remove/subdivide は accepted user decision gate まで未決定のまま。
- real same-thread conversational quality と actual memory digest prose は human observation 待ち。source seam、fake/probe-shaped integration、later-Fire recovery は green。
- standard Node test worker と sandbox内 esbuild spawn は environment `EPERM`。worker-free Node lane と許可済み Runtime lane は greenで、source assertion failure はない。

## Verdict

**PASS — Blocker 0 / Major 0 / Minor 0.** C1/C2/C3 と Wave 1A/1B の seam に duplicate/omitted completed speech、conversation break、stale commit、later-Fire failure、accepted mismatch、critical untested failure、byte/timing evidence mismatch、Claude/existing regressionを認めなかった。focused integrated lanes は greenで、Wave 2 は mechanical integration gate へ進める。
