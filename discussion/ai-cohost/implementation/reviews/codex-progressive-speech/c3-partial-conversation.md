# Review C3: partial delivery and conversation continuity

- 現在の最終ループ: 2
- 現在の判定: **PASS**
- 現在の finding: **Blocker 0 / Major 0 / Minor 0**
- 履歴: loop 1 **REVISE** — Blocker 0 / Major 1 / Minor 0
- レビュー役: independent Review-Sylph

## Scope / attribution

レビュー対象は次の現行 full file と complete dirty diff。

- `apps/soul/agent/src/mind/fire-orchestrator.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`

C3 帰属として判定したのは、固定 interruption note、one-shot continuity instruction、generation ごとの partial projection owner、pending correction、accepted Fire の `fireClaimed` 排他、および C2/C3・C3 focused tests。両ファイルには model identity、conversation instruction、既存 S3–S8、C1/C2 の共有 hunk が大量に含まれるため、それらを C3 成果へ誤帰属していない。

read-only context として、Wave 1 reports、A1/A2/B1/B2 reviews、C1 review、C2 loop 3 PASS、stream-memory inventory、current progressive delivery、transcript buffer、memory digest、self-fire scheduler、Cockpit production projection/session tests を照合した。source implementation は変更していない。

## Basis

- `discussion/ai-cohost/implementation/orchestration/codex-progressive-speech-wave-plan.md` §2 decisions 7–9、§3、§7 C3、§8–§10
- `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-app-server-transport.md`
- `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1b-speech-delivery.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/a1-stream-transport.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/a2-session-lifecycle.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/b1-sentence-playback.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/b2-payload-failure-isolation.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/c1-incremental-boundary.md`
- `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/c2-fire-state-machine.md`
- `discussion/ai-cohost/implementation/orchestration/stream-memory-inventory.md`

## Finding

### Major 1 — zero-completed progressive failure does not preserve the existing normal Fire-error experience

`processAskedReply` returns a settled non-completed progressive outcome directly as `reason:"progressive-delivery-failed"` (`fire-orchestrator.mjs:749-755`). When `completedSentenceCount === 0`, that branch neither throws into the established Fire catch nor emits `onDiagnostic({type:"fireError", ...})`.

The existing one-shot failure path returns `reason:"error"` and emits `fireError`. Cockpit broadcasts that diagnostic, and its existing ghost projection renders `(fire error: ...)`. The progressive zero-spoken path therefore silently loses the normal Cockpit-visible error even though the C3 acceptance explicitly requires the existing normal Fire-error experience. The new zero-completed test currently blesses the mismatch by asserting `progressive-delivery-failed` and checking only the absence of transcript/correction/self-spoke; it does not assert the required `fireError` diagnostic.

Reviewer raw comparison, using the same channel-like failure before any matching `STARTED`/`ENDED`:

```json
{
  "progressive": {
    "result": {
      "fired": false,
      "reason": "progressive-delivery-failed",
      "progressive": {
        "status": "failed",
        "terminalCause": "play-failed",
        "completedSentenceCount": 0,
        "playedChars": 0
      }
    },
    "diagnostics": [],
    "entries": []
  },
  "legacy": {
    "result": {
      "fired": false,
      "reason": "error",
      "message": "channel down"
    },
    "diagnostics": [
      {
        "type": "fireError",
        "message": "channel down"
      }
    ],
    "entries": []
  }
}
```

Required correction:

1. A failed/cancelled progressive delivery with zero completed chunks and a failure cause must enter the established normal Fire-error projection (`reason:"error"` plus one `fireError` diagnostic) without creating a partial transcript, interruption note, correction, or soul/self-spoke append.
2. Keep intentional control outcomes such as killed/disposed and the existing NG policy cause-specific; do not turn this correction into a broad rewrite of previously accepted C2/S8 semantics.
3. Update the zero-completed test to assert the normal error result and exact one diagnostic. Add at least one second pre-first-completion representative (prepare/play/marker or channel) so the test does not depend on one coordinator terminal mapping.

This is Major, not Blocker: no speech is duplicated or omitted and a later Fire remains possible, but the accepted user-visible failure behavior is absent.

## Confirmed acceptance behavior

Apart from Major 1, the C3 state and projection agree with the accepted design:

- A non-completed exact generation with at least one completed sentence appends exactly `playedText + "\n" + PROGRESSIVE_INTERRUPTION_NOTE` once through the existing transcript buffer and `onSoulTranscript` seam. Completed generations do not project interruption metadata.
- The canonical entry contains only the completed playback watermark. Generated/queued suffixes, control tags, and cross-delta NG text do not enter transcript or digest input. The legacy full-response append is bypassed for partial delivery, so the audible prefix is not replayed or duplicated.
- The append itself is the existing production self-fire seam: transcript-buffer `onAppend` receives one `speaker:"soul"` entry, so partial audible delivery resets the refractory clock once; zero-completed channel failure appends nothing.
- `pendingProgressiveCorrection` is created only after the canonical partial projection succeeds. It is consumed at the next actual `session.ask`, prepended once to text input, or inserted into the first text block while preserving vision image-first order. It is not appended to Cockpit transcript as a user entry and does not create another ask/LLM turn.
- Resource acquisition and vision capture occur before correction consumption. Acquisition/capture failure retains the pending correction; an invoked ask consumes it conservatively even when handoff failure is ambiguous, preventing replay on a later Fire.
- `fireClaimed` closes the pre-publication acquisition window synchronously. An overlapping Fire returns busy without acquiring another snapshot or consuming correction.
- Generation IDs, exact projection owners, and the once-only terminal ledger prevent duplicate callback projection. Kill/dispose stop the boundary; stale old markers cannot append suffixes or advance a newer generation.
- Same-thread continuity is preserved for healthy App Server turns: C3 does not dispose/reset the accepted session, and correction is part of the next user turn on the same session. A terminal App Server turn failure continues to use A2's accepted fatal-recovery contract (fresh process/thread after invalidation); C3 adds no extra reset or retry.
- The three Codex brain routes, Sol `low`, one ask per Fire, image-first vision, immutable accepted resource snapshots, Claude one-shot fallback, and 4096-byte cap remain unchanged in the inspected C3 attribution.
- New C3 trace fields are counts, generation IDs, status/cause only; the private terminal hook retains played text for canonical projection, while public Fire progressive state exposes only `playedChars` and counts.

## Adversarial coverage assessment

Current focused tests cover:

- prefix then cross-delta NG and prefix then LLM rejection;
- later channel activation failure and authenticated marker error;
- post-prefix barge-in/inter-sentence gap, kill, and dispose;
- late suffix after kill/dispose, duplicate/late terminal markers, and stale old-generation marker against a fresh Fire;
- fixed canonical text, one visible append, one self-spoke append, and absence of a unique unheard suffix from transcript/digest;
- next-turn correction exact prefix placement, exact-once consumption, ambiguous ask failure consumption, image-first vision placement, and zero/complete no-replay cases;
- pre-ask vision capture failure retention and resource-acquisition overlap guarded by `fireClaimed`.

The current suite does not directly assert App Server thread ID across partial playback failure, but source inspection plus A2's 29/29 session lifecycle lane establishes that C3 neither disposes nor replaces the healthy session. Real App Server conversational behavior remains a later runtime/human gate.

## Reviewer-executed commands / raw summaries

### Repository-standard isolated Fire attempt

```powershell
node --test src/mind/fire-orchestrator.test.mjs
```

Raw summary: **0/1 pass**; module precollection failed with sandbox `spawn EPERM`. No implementation assertion ran.

### Focused worker-free Fire lane

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/fire-orchestrator.test.mjs
```

Raw summary: exit 0; **90 tests / 90 pass / 0 fail**; duration 423.2659 ms.

### Exact current C3 slice

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  --test-name-pattern='C2/C3|C3:' \
  src/mind/fire-orchestrator.test.mjs
```

Raw summary: exit 0; **8 tests / 8 pass / 0 fail**; duration 43.7696 ms. These tests pass, but the zero-completed assertion encodes Major 1.

### Reconstructed nine-file transport/delivery/Fire regression lane

```powershell
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

Raw summary: exit 0; **252 tests / 252 pass / 0 fail**; duration 5,221.6257 ms. The supplied `242/242` count did not include an exact command and was not reproducible from this closest current nine-file reconstruction; the present lane is broader and green, so no pass evidence is fabricated from the stale count.

### Transcript / memory / digest regression lane

The seven-file C2/foundation lane plus `transcript-buffer.test.mjs` and `memory.test.mjs` passed **267/267**, duration 5,231.0709 ms. This verifies the existing append-only and digest formatting seams used by the C3 canonical entry.

### Cockpit production seam

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  scripts/cockpit.test.mjs \
  src/cockpit/cockpit-server.test.mjs
```

Raw summary: exit 0; **207 tests / 207 pass / 0 fail**; duration 5,919.682 ms. This reproduces the supplied Cockpit claim and confirms the existing `fireError` diagnostic-to-ghost path whose absence exposes Major 1.

### Syntax / diff hygiene

```powershell
node --check src/mind/fire-orchestrator.mjs
node --check src/mind/fire-orchestrator.test.mjs
git diff --check -- \
  apps/soul/agent/src/mind/fire-orchestrator.mjs \
  apps/soul/agent/src/mind/fire-orchestrator.test.mjs
```

Exit 0. `git diff --check` produced no whitespace error. No package manifest or lockfile change was attributed to C3.

## Residuals

- The private `onProgressiveTerminal` outcome necessarily carries `playedText` so C3 can construct the canonical response; production Cockpit does not wire this hook. Public Fire state and new trace diagnostics remain content-free.
- Memory/digest correctness here is structural and fake-tested: digest generation consumes `transcriptBuffer.all()`, which contains the canonical partial entry but not the unheard suffix. Actual checkpoint timing and real model digest prose remain outside C3.
- Repository-standard worker isolation remains sandbox-blocked. The worker-free focused and regression lanes are green.
- Real Aivis/WinRT playback, real App Server multi-turn semantics, and subjective interruption-note readability remain mechanical/human-gate work; they do not close Major 1.

## Loop 1 verdict

**REVISE (loop 1) — Blocker 0 / Major 1 / Minor 0.** Partial canonicalization, one-shot correction, generation ownership, transcript/memory exclusion, self-fire append behavior, and concurrency are otherwise sound and well covered. C3 cannot PASS until a zero-completed progressive failure uses the existing normal Fire-error/Cockpit diagnostic path and the focused test asserts that behavior.

## Loop 2 independent correction review

### Scope / attribution

Loop 2 は loop 1 唯一の Major を閉じる限定 correction review。現行 full `fire-orchestrator.mjs` / `.test.mjs`、complete dirty diff、loop 1 report、および周辺の progressive delivery / transcript / memory / scheduler / Cockpit tests を再読した。source implementation は変更せず、他者の model identity、conversation instruction、C1/C2、Cockpit、Runtime hunks を loop 2 correction へ誤帰属していない。

### Loop 1 Major closure

Major 1 は閉じた。

- `processAskedReply` は progressive outcome が `status:"failed"`、`completedSentenceCount === 0`、かつ非 NG の genuine delivery failure の場合だけ、content-free な `progressive_delivery_failed` error を throw する。
- 通常 Fire、manual vision、preferred/degraded の既存外側 catch がその error を一度だけ握り、`{fired:false, reason:"error", message}` と `onDiagnostic({type:"fireError", message})` を作る。terminal callback は projection/private hook だけで診断を発行しないため、terminal/catch race で二重 diagnostic は生じない。
- channel activation failure と独立した prepare failure の両方で、terminal は exact once、completed watermark は 0、soul transcript append は 0、self-spoke は 0、continuity correction は作られず、後続 Fire は通常完了する。
- zero-spoken transcript が追加されないため、`transcriptBuffer.all()` を唯一の入力にする memory/digest に interruption note、unheard suffix、correction が入る経路もない。

Reviewer source inspection と focused tests で確認した narrowness:

- `killed` は新 branch より前の既存 `killed-inflight` / `killDiscarded` 分岐を維持する。
- disposed / barge-in は `status:"cancelled"` なので新しい `status:"failed"` gate に入らず、既存 terminal cause を返す。
- NG は新 branch より前の `containsNgWord` cause-specific branchを維持する。prefix ありは既存 partial canonicalization、prefix なしは既存 `NG_BLOCKED_NOTE` / `ngBlocked` behavior のまま。
- completed chunk 1 以上の channel/marker/LLM/NG/kill/dispose は新しい zero gate に入らず、spoken watermark + 固定 interruption note と next-turn correction を維持する。
- completed progressive response、Claude one-shot fallback、vision image-first、one ask、same healthy session/thread、Sol `low`、4096 cap は correction hunk に触れられていない。

### Focused test adequacy

更新された zero-completed test は channel と prepare の二つを一つの table loop で固定し、各 case について次を直接 assert する。

- `reason:"error"` と terminal cause を含む固定 generic message;
- exactly one `fireError` diagnostic;
- exactly one private terminal、completed count 0;
- soul/self-spoke append 0;
- next Fire input に continuity instruction がないこと;
- fresh playback completionと後続 Fire 回復;
- recovery 後も diagnostic count が 1 のままであること。

既存 C2 channel activation test も同じ normal error projectionへ更新されており、C3 partial tests、control tests、NG tests、complete/Claude tests と合わせて限定修正の退行を検出できる。

### Loop 2 reviewer-executed raw evidence

#### Focused worker-free Fire lane

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  src/mind/fire-orchestrator.test.mjs
```

Raw summary: exit 0; **90 tests / 90 pass / 0 fail**; duration 446.6117 ms.

#### Exact C3 slice

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  --test-name-pattern='C2/C3|C3:' \
  src/mind/fire-orchestrator.test.mjs
```

Raw summary: exit 0; **8 tests / 8 pass / 0 fail**; duration 44.0522 ms.

#### Transport / delivery / Fire nine-file lane

```powershell
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

Raw summary: exit 0; **252 tests / 252 pass / 0 fail**; duration 5,226.5172 ms.

#### Transcript / memory / self-fire lane

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  src/ears/transcript-buffer.test.mjs \
  src/mind/memory.test.mjs \
  src/mind/fire-scheduler.test.mjs
```

Raw summary: exit 0; **107 tests / 107 pass / 0 fail**; duration 70.1448 ms.

#### Cockpit production seam

```powershell
node --test --test-isolation=none --test-concurrency=1 \
  scripts/cockpit.test.mjs \
  src/cockpit/cockpit-server.test.mjs
```

Raw summary: exit 0; **207 tests / 207 pass / 0 fail**; duration 5,914.2107 ms.

#### Repository-standard isolated attempt

```powershell
node --test src/mind/fire-orchestrator.test.mjs
```

Raw summary: **0/1 pass**; module precollection failed with sandbox `spawn EPERM`; duration 9.0156 ms. No implementation assertion ran.

#### Syntax / diff hygiene

```powershell
node --check src/mind/fire-orchestrator.mjs
node --check src/mind/fire-orchestrator.test.mjs
git diff --check -- \
  apps/soul/agent/src/mind/fire-orchestrator.mjs \
  apps/soul/agent/src/mind/fire-orchestrator.test.mjs
```

Exit 0。syntax / whitespace error なし。source ownership は指定の 2 files に限定され、package manifest / lockfile 変更は C3 correction にない。

### Loop 2 residuals

- Repository-standard worker isolation と real Aivis/WinRT/App Server human evidence は引き続き environment/human gate 待ち。worker-free の全 required lanes は green で、loop 1 Major の source assertion と矛盾しない。
- zero failure message は terminal cause のみを含み、生成本文・chunk text・NG content を含まない。public Cockpit diagnostic は既存 `fireError` projection を再利用する。
- Actual memory checkpoint generation は C3 の対象外だが、zero case が transcript を追加しないことと、memory/digest が transcript all() だけを読む既存 seam は 107-test lane で維持されている。

## Loop 2 verdict

**PASS (loop 2) — Blocker 0 / Major 0 / Minor 0.** Loop 1 の zero-completed failure Major は、channel/prepare の二つの原因、exact-one terminal/diagnostic、zero transcript/correction/self-spoke、後続 Fire 回復まで独立に閉じた。control/NG cause-specific behavior、partial canonicalization/correction、complete/Claude path に退行はなく、required focused/regression lanes はすべて green。C3 は次の gated integration review へ進める。
