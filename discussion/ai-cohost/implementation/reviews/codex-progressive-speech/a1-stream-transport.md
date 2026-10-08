# Review A1: streaming transport contract

- ループ番号: 2
- 判定: PASS
- レビュー役: independent Review-Sylph

## Target diff / files

- `apps/soul/agent/src/mind/codex-session.mjs`
- `apps/soul/agent/src/mind/codex-session.test.mjs`
- `apps/soul/agent/src/mind/brains.mjs`
  - A1 帰属として確認したのは共通 Codex adapter route、Sol `effort: "low"`、および A1 loop 1 の stale `ttftMs` コメント修正。
  - identity import/property/resolver は並行作業の既存差分であり、A1 の成果へ誤帰属していない。
- `apps/soul/agent/src/mind/brains.test.mjs`
  - A1 帰属として確認したのは Codex 3 頭の App Server route/model/effort tests のみ。
  - identity tests は並行作業の既存差分であり、A1 に誤帰属していない。
- context: `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-app-server-transport.md`

`apps/soul/agent/src/mind/llm-session.mjs` の diff は空で、Claude の `BRAINS.claude.create` は引き続き `createLlmSession(options)` を呼ぶ。dependency manifest / lockfile の対象 diff も空だった。

## Basis inspected

- `discussion/ai-cohost/implementation/orchestration/codex-progressive-speech-wave-plan.md` §1, §2, §5 A1, §8, §9
- `discussion/ai-cohost/research/app-server-transport-integration-inventory.md`
- `discussion/ai-cohost/research/codex-text-streaming-official-options-2026-08.md`
- `discussion/ai-cohost/experiments/codex-app-server-streaming-probe.md`
- loop 1 review 原本、現 target source/tests、現 diff、Wave 1A completion context

## Acceptance inspection

- **protocol initialization**: process は遅延起動され、connection ごとに `initialize` response 後 `initialized` を 1 回送り、`thread/start` 後に各 ask を 1 `turn/start` として送る。
- **vision**: caller input を最初の await 前に snapshot し、画像を scratch の `localImage` へ変換する。first-turn system prompt は最初の text item に merge され、画像先行順を壊さない。temp image は成功・失敗・dispose 競合でも ask `finally` で除去される。
- **stream contract**: relevant notification は generation/thread/turn/item ID を検証する。agent delta は item lifetime 中だけ受理され、受信順に同期 callback へ公開される。Wave 1B / `fire-orchestrator.mjs` の編集はない。
- **exact final agreement**: item 単位と turn 全体の双方で ordered delta concat と completed text の完全一致を要求する。不一致、未完了 item、agent item 欠如は成功結果にならない。
- **terminal/failure**: completed 以外の terminal status、non-retrying error、malformed JSON/RPC/relevant notification、unexpected protocol ID、process error/exit、callback throw、active dispose は ask rejection と connection invalidationへ写像される。成功確定後の late callback は抑止される。
- **fatal reset/reap correction**: fatal callback は exact stale connection を session の `invalidateConnection(error, fresh)` へ渡す。`stale.close()` は既存 `resetPromise` と合成され、ask catch、次 `ensureThread()`、dispose が同じ barrier を待つ。close failure には即時 rejection observer があり、barrier 自体の rejection は呼出元へ残る。
- **stdio lifecycle**: stderr は本文を保持せず drain され、stdout error と unexpected clean/truncated EOF は fatal 扱いになる。
- **routing**: Codex 3 頭は共通 adapter を通り、Terra=`none`、GPT-5.5=`none`、Sol=`low` を `turn/start` に渡す。Claude factory は変更されていない。

## Correction-loop verification

Loop 1 Blocker は解消した。

- `AppServerConnection.fail()` は session `onFatal` だけへ ownership を渡し、rejected `void close()` を作らない（`codex-session.mjs:325-328`）。
- `invalidateConnection(error, stale)` は exact stale connection の idempotent `closePromise` を persistent reset barrier へ合成する（`:406-420`）。
- connection-local fatal callback は `fresh` を明示して invalidation し、その後 active ask を reject する（`:529-532`）。
- ask catch は barrier 完了を待ってから元 error、または reap error を返し（`:611-613`）、次 spawn は `ensureThread()` の barrier await 後に限られる（`:516-521`）。
- dispose は live close と reset barrier を待ち、reap error 時も exact rollout/ledger/scratch cleanup を `finally` で行ってから error を返す（`:625-654`）。

独立 adversarial probe でも次を確認した。

1. invalid JSON 後の旧 child exit を 50 ms 遅延:

```json
{"firstError":"codex-session: malformed App Server message — invalid JSON (...) ","reply":"ok","childCount":2,"firstExitedBeforeRecovery":true,"secondSpawnBeforeFirstExit":false}
```

2. TERM/KILL 後も exit しない旧 child:

```json
{"spawnCount":1,"firstError":"codex-session: App Server process could not be reaped.","secondError":"codex-session: App Server process could not be reaped.","disposeError":"codex-session: App Server process could not be reaped.","unhandled":[]}
```

旧 child 生存中の replacement spawn、reap failure の未処理 rejection、reap failure 後の成功報告はいずれも再現しなくなった。

## Test commands and raw summaries

### Repository-standard isolated runner attempt

```powershell
node --test --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
```

Test module 読み込み前に sandbox が worker spawn を拒否した既知環境制約。

```text
tests 2
pass 0
fail 2
Error: spawn EPERM
duration_ms 16.0232
```

### Focused worker-free lane

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
```

```text
tests 29
pass 29
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 387.759
```

### Relevant worker-free regression lane

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs src/mind/fire-orchestrator.test.mjs src/mind/memory.test.mjs scripts/cockpit.test.mjs
```

```text
tests 200
pass 200
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5290.9802
```

### Syntax / diff hygiene

```powershell
node --check src/mind/codex-session.mjs
node --check src/mind/codex-session.test.mjs
node --check src/mind/brains.mjs
node --check src/mind/brains.test.mjs
git diff --check -- apps/soul/agent/src/mind/codex-session.mjs apps/soul/agent/src/mind/codex-session.test.mjs apps/soul/agent/src/mind/brains.mjs apps/soul/agent/src/mind/brains.test.mjs
```

Exit 0。syntax / whitespace error なし。

## Findings

### Blocker

なし。

### Major

なし。

### Minor

なし。Loop 1 の stale `ttftMs` contract comment は現挙動へ修正された。

## Residual risks / open verifications

- この implementation/correction loop では実 Codex/App Server model turn を実行していない。runtime evidence は既存の bounded App Server 0.144.5 Sol/low/vision probe に限られ、長文、複数画像、tool attempt、再接続、他 Codex model の実運用は未確認。
- `turn/start` response 後の terminal notification 待ちには独立 timeout がない。timeout policy は A1 accepted requirement に含まれないため finding にはしていないが、silent protocol stall の運用確認は残る。
- callback throw は source の同期 try/catch で turn failure へ写像されるが、専用 focused test はない。
- App Server 0.144.5 の `thread/delete` `agent_jobs` DB error により metadata deletion 成功は保証されず、exact rollout cleanup は best-effort のまま。
- automated tests は fake/probe-shaped であり、実 account、network、実 `~/.codex`、model quota を使用していない。

## Verdict

PASS

Loop 1 Blocker は source、correction-focused tests、独立 adversarial probes の三点で閉じた。A1 acceptance の全項目に対し zero Blocker/Major かつ focused tests green のため PASS とする。
