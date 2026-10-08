# Passive Fire Diagnostics D1 — independent integrated review

- Review loop: **3 / 5**
- Verdict: **PASS**
- Blocking findings: **0**
- Loop 1 A-1: **RESOLVED**
- Loop 1 A-2 / loop 2 A-2R: **RESOLVED**
- Loop 1 A-3: **RESOLVED**
- Domain B: **no blocking regression found**
- Accepted User Gate: **PENDING**（mechanical review はユーザーの代わりに通過判定しない）

## Review method and exact inspected scope

loop 3 でも、source/report の意味を先に補わず、次の unchanged fixture JSONL だけを最初に読み直して black-box reconstruction が維持されることを確認した。

- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.success.jsonl`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.failure.jsonl`

その後、actual source/diff/tests を次の順で確認した。

- `apps/soul/agent/src/voice/speak.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.mjs`
- `apps/soul/agent/src/mind/fire-diagnostics.mjs`
- `apps/soul/agent/src/mind/fire-diagnostics.test.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`
- `apps/soul/agent/src/voice/speak.test.mjs`
- `apps/soul/agent/src/channel/channel-client.mjs`
- `apps/soul/agent/src/channel/channel-client.test.mjs`
- `apps/soul/agent/src/test-support/ws-double.mjs`
- `apps/soul/agent/scripts/cockpit.mjs`
- `apps/soul/agent/.gitignore`
- `discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-a.md`
- scoped current diff/status、syntax、dependency/lockfile inventory

Domain B は loop 1/2 で no-blocking であり、loop 3 fix は Soul 内の failure classification と test に限定される。current Runtime scoped diff/name inventory と Soul↔Runtime request boundary に新しい変更が無いことだけを確認し、Runtime suite の再実行は過剰拡張を避けた。loop 2 の typecheck green と immediate focused rerun 20/20 は prior evidence として保持する。

`fire-orchestrator.mjs` には別 wave の user-owned 差分も混在するため、D1 trace/error-classification hunk だけを本判定に含めた。既存 dirty worktree は revert、format、stage、commit していない。

## Black-box success reconstruction (fixture-only first pass)

### Facts

- 一系列の `fireId=soul-1700000000000-1` は `fire.accepted(monotonicMs=0)` から child `STARTED(499)` まで **499 ms**。
- event order は accepted/context → LLM start/completion → parse → TTS audio-query start/request-completion/parsed completion → synthesis start/request-completion → timeline start/build-completion → channel connect/open/hello → speech send/reply → parent enqueue → child `STARTED`。
- 明示 duration は LLM **120 ms**、audio query **30 ms**、synthesis **320 ms**、timeline build **1 ms**、connect-to-hello **19 ms**、speech reply RTT **5 ms**、enqueue-to-child STARTED **4 ms**。
- `rawMoraCount=2`、`timelineCount=2`、`wavBytes=48044`、`wavDurationSec=1.5`。
- actual envelope measurement は `channel.request.send(req-1, kind=intent.speech, generation=1)` の `serializedUtf8Bytes=138` にだけある。
- child `STARTED(499)` から `fire.completed(2000)` までは **1501 ms** だが、playback-start proxy より後である。

### Inference

- 明示された pre-playback の単独 duration では TTS synthesis の **320 ms** が最大で、dominant segment と説明できる。
- event order は逐次 speech path と整合するが、並行作業を含む実 run では durations を単純合算して排他的内訳にしてはならない。

### Unknown

- physical speaker onset/end、PowerShell/WinRT 内部時間、OS scheduling は不明。
- post-STARTED の 1501 ms は `wavDurationSec=1.5` と整合する playback occupancy と推測できるが、Fire-to-audio latency へ含めない。

結論: fixture-only で accepted → child STARTED、dominant pre-playback segment、counts、request identity を再構成できる。

## Black-box failure reconstruction (fixture-only first pass)

### Facts

- `fireId=soul-1700000100000-1` は accepted/context → LLM → audio query → synthesis → timeline → `channel.request.send` → `channel.close` → `channel.request.failed` → `speech.channel.failed` → diagnostic → `fire.failed` の順。
- pre-failure facts は `rawMoraCount=110`、`timelineCount=110`、`wavBytes=3528044`、`wavDurationSec=110`、actual serialized envelope **4164 UTF-8 bytes**、`requestId=req-7`、`kind=intent.speech`、`connectionGeneration=1`。
- machine-readable final boundary は `stage=control_channel.close` / `failure.code=channel_closed`。request/speech failure records も同じ code/stage を保持する。

### Inference

- 4164-byte request の直後に close した系列は既知の 4096-byte cap chain と整合する。

### Unknown

- fixture 単体には Runtime-side close reason が無いため oversize は断定できない。Runtime の 4097-byte oversize sample は別 run であり相関していない。
- physical output、server process state、TCP 内部理由は不明。

結論: fixture-only で pre-failure counts/request identity と close-before-reply boundary を facts/inference/unknown に分けて再構成できる。

## A-2R targeted confirmation

### Machine-readable production boundaries

- `tts.audioQuery()` rejection: `tts.audio_query` / `tts_audio_query_failed`。
- malformed audio-query parse: `tts.audio_query.parse` / `tts_audio_query_invalid`。`parseAudioQuery(query)` 自体を独立 try/catch し、`tts.audio_query.parse.failed` を content-free に記録する。
- synthesis rejection: `tts.synthesis` / `tts_synthesis_failed`。
- invalid/truncated WAV inspection: `speech.wav.inspect` / `speech_wav_invalid`。`wavBytes` は残すが WAV body/message は残さない。
- timeline build: `speech.timeline.build` / `timeline_build_failed`。
- temp WAV preparation/write: `speech.wav.write` / `speech_wav_write_failed`。
- synchronous send: `control_channel.send` / `channel_send_failed`。
- close-before-reply: `control_channel.close` / `channel_closed`。
- reply timeout: `control_channel.reply_timeout` / `reply_timeout`。
- server rejection: `control_channel.rejection` / `speech_rejected`。

`fire-orchestrator.mjs` は `session.ask(...)` の throw だけを `llm.ask` / `llm_ask_failed` に付与する。ask 完了後の未分類 throw は正直な `fire.processing.unknown` / `fire_processing_unknown` であり、LLM failure を捏造しない。normal、vision、preferred の全 catch が同じ規律を使う。

### Production-shaped persisted coverage

`fire-diagnostics.test.mjs` の harness は real orchestrator → real `speak()` → async diagnostics writer を通し、任意の final fields を注入せず persisted JSONL の最終 stage/code を読む。audio-query request、malformed parse、synthesis rejection、invalid WAV、write failure、513-mora timeline、channel rejection、unknown post-ask、real WS close-before-reply、real channel の synchronous send failure、real WS reply timeoutを区別し、利用可能な pre-failure event/count も固定する。

`fire-orchestrator.test.mjs` は ask throw が `llm.ask/llm_ask_failed` であり、arbitrary post-ask failure が `fire.processing.unknown/fire_processing_unknown` であることを別々に固定する。

fixture parity test は real orchestrator → real `speak()` → lazy channel → real `connectChannel()` → WS double → player proxy → async writer を通し、success fixture と production event sequence/各 record key set の exact parity を検証する。別 test は actual envelope 138 UTF-8 bytes と 320-ms synthesis dominance を production shape から固定する。failure fixture が表す close chain も real WS persisted test と一致する。

## A-1/A-3 no-regression and proportional findings

### Passivity / scope

- D1 の UI、user operation、public API/toggle、dependency は増えていない。
- cap、reconnect/retry、protocol、reply timeout default 4000 ms の挙動変更は無い。
- diagnostic observer/write failure は nonfatal。Fire production path は diagnostics の Promise/flush を await しない。

### Measurement meaning

- Production `channel-client.mjs` は actual `{v,id,kind,payload}` envelope を一度 serialize し、同じ string の UTF-8 bytes を測って同じ string を送る。
- monotonic clock は process-local duration、wall clock は相関用に分離される。cross-process monotonic subtraction は無い。
- stage duration は境界ごとの事実として残り、overlap を合算していない。child `STARTED` 後の playback occupancy は latency と分離される。

### Failure preservation

- TTS request/parse/synthesis、WAV inspect/write、timeline、send/close/timeout/rejection が同じ generic label に collapse しない。
- final failure は前段の query/mora/WAV/timeline/request observations を消さず incremental JSONL に残す。

### Safety / bounded disk

- persisted events は counts、timings、IDs、enumerated stage/code/name のみ。prompt/conversation/speech text、URL/token、image/audio/WAV body、binary payload、exception message/path は保存しない。
- Soul writer は `node:fs/promises` の serialized best-effort queue。queue は 128 で bounded、overflow は drop-new、retention は 5。
- ordering、incremental write、write failure recovery、retention、queue bound/drop は tests で固定済み。`flush()` は test/lifecycle seam で production latency dependency ではない。

### Domain B scoped no-regression

- loop 3 の Soul classification fix は Runtime envelope/cap/close path、request shape、shared correlation key を変更しない。
- Domain B success `req-speech-42` / wall `2026-08-30T03:01:12Z` と oversize sample wall `2026-08-30T03:02:33Z` / 4097 bytes は引き続き別 sample としてのみ読める。Soul fixture と同一 run とは扱わない。

## Blocking findings and routing

**None.** 新たな user/product decision や immutable gate change は不要。

## Raw verification results

```text
cd apps/soul/agent
node --test --test-isolation=none src/mind/fire-diagnostics.test.mjs src/channel/channel-client.test.mjs src/voice/speak.test.mjs src/mind/fire-orchestrator.test.mjs
→ exit 0
→ tests 98 / pass 98 / fail 0 / duration_ms 1121.0484
```

```text
cd apps/soul/agent
node --test --test-isolation=none scripts/cockpit.test.mjs
→ exit 0
→ tests 74 / pass 74 / fail 0 / duration_ms 5223.1333
```

```text
node --check apps/soul/agent/src/mind/fire-diagnostics.mjs
node --check apps/soul/agent/src/mind/fire-orchestrator.mjs
node --check apps/soul/agent/src/voice/speak.mjs
node --check apps/soul/agent/src/channel/channel-client.mjs
node --check apps/soul/agent/scripts/cockpit.mjs
node --check apps/soul/agent/src/test-support/ws-double.mjs
→ aggregate exit 0 / output none
```

```text
git diff --check -- <tracked Soul/Runtime D1 scope + Domain A/B reports>
git diff --name-only -- apps/soul/agent/package.json apps/soul/agent/package-lock.json apps/runtime-player/package.json package.json pnpm-lock.yaml
→ aggregate exit 0
→ diff check emitted CRLF conversion warnings only
→ dependency/lockfile output: none
```

Prior Domain B evidence retained from loop 2 because loop 3 introduced no cross-domain change:

```text
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck
→ exit 0 / tsc --noEmit -p tsconfig.json

focused Runtime rerun
→ first run: transient loopback open failures, 17/20
→ immediate identical rerun: exit 0 / Test Files 4 passed / Tests 20 passed
```

Environment limitation: Windows working-copy CRLF conversion warnings were emitted by Git. They are not `diff --check` errors and no file was normalized or formatted during review.

## Nonblocking residuals

- Soul fixtures and Runtime sample are different runs; oversize attribution remains inference without same wall-time/request/generation evidence。
- Soul child `STARTED` is a playback-process proxy, not physical speaker onset。
- Queue overflow intentionally drops new diagnostic tasks; saturated traces may be incomplete and missing events must be treated as unknown。
- Real provider、AivisSpeech、microphone、vision capture、Cockpit ordinary use、physical speaker observation remain the Accepted User Gate。

## Final gate state

- Mechanical integrated review: **PASS**
- Blocking findings: **0**
- Domain B: **no blocking regression found**
- Accepted User Gate: **PENDING**
