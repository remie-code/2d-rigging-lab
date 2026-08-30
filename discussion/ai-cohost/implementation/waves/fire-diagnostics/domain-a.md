# Fire diagnostics D1 — Domain A（Soul）完了記録

- Mechanical status: **PASS (Domain A; integrated review loop 3)**
- User Gate: **PENDING**（この記録はユーザーゲートを通過させない）
- Integrated review: [final-review.md](../../reviews/fire-diagnostics/final-review.md) — PASS / blocking 0.

## 変更ファイル（この担当の正確な範囲）

- `apps/soul/agent/.gitignore`
- `apps/soul/agent/scripts/cockpit.mjs`
- `apps/soul/agent/src/channel/channel-client.mjs`
- `apps/soul/agent/src/channel/channel-client.test.mjs`
- `apps/soul/agent/src/mind/fire-diagnostics.mjs`
- `apps/soul/agent/src/mind/fire-diagnostics.test.mjs`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.success.jsonl`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.failure.jsonl`
- `apps/soul/agent/src/mind/fire-orchestrator.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`
- `apps/soul/agent/src/test-support/ws-double.mjs`
- `apps/soul/agent/src/voice/speak.mjs`
- `apps/soul/agent/src/voice/speak.test.mjs`
- `discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-a.md`

既存の Cockpit UI/API/HTML、4096 上限、reconnect/retry/timeout の値と挙動、依存関係、lockfile は変更していない。共有 worktree にある Cockpit UI 等のユーザー所有差分は revert/整形していない。

## 自動ログと境界

Cockpit 起動時に自動で有効になり、操作・toggle・UI は追加しない。Soul 側の正確な保存先は次である。

```text
apps/soul/agent/fire-diagnostics/fire-<ISO-safe timestamp>-<sequence>.jsonl
```

同ディレクトリは `.gitignore` 対象で、`fire-*.jsonl` は開始時刻順で最新 **5** run のみ残す。書込みと prune は **非同期・直列・best-effort** queue に載せ、Fire/TTS/Channel/再生の production path は await しない。queue は最大 **128** pending task で、その上限では新しい diagnostic task を drop する（Fire の挙動は変えない）。各 task の失敗は握り、後続 task は継続する。`flush()` は test/lifecycle seam のみであり、production Fire dependency から呼ばない。

保存するのは wall timestamp、Soul process-local monotonic timestamp、stage、duration、counts/lengths、request identity、connection generation/state、結果と failure name/code のみである。本文、会話、system prompt、image/audio/WAV body、URL/token、例外 message は保存しない。

`channel.request.send` は実際に送った `{v,id,kind,payload}` の `JSON.stringify` 後の UTF-8 byte length を、同じ request id と kind で保存する。speech と expression/envelope request は kind/id により別 event であり混同しない。`speech.timeline.built` 自体に serialized byte 数は置かない。

## fixture / sample logs と再構成可能な事実

- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.success.jsonl`
- `apps/soul/agent/src/mind/fixtures/fire-diagnostics.failure.jsonl`

両 fixture は production hook chain の event 名・field shape と parity を focused test で固定した checked-in JSONL であり、content/binary/secrets を含まない。

success fixture から読める **facts** は、`tts.synthesis.request_completed.durationMs=320`、audio query 30 ms、timeline build 1 ms、実 speech envelope の `channel.request.send.serializedUtf8Bytes=138`、`player.play.enqueued` 後 child `STARTED` まで 4 ms、accepted 後 STARTED まで 499 ms である。明示された単独の pre-playback duration の中では synthesis 320 ms が最大である、という **inference** ができる。ただし並行 request（expression 等）を足して排他的時間とは扱わない。また STARTED 後の `fire.completed` まで 1501 ms は **post-start playback occupancy** であり、Fire→child STARTED の dominant pre-playback duration ではない。物理音声の onset/end、別 process の内部時間、重なった区間の排他的内訳は **unknown** である。

failure fixture は actual `channel.request.send`、`channel.close`、`channel.request.failed`、`speech.channel.failed`、`fire.failed` を含み、final boundary は `failureCode=channel_closed` / `stage=control_channel.close` と再構成できる。invented `control-channel.reply` stage や timeline-built の byte field は含まない。

## 成功・失敗の機械証拠

- injected success は実 `speak()` を通して parent `player.play` proxy に到達し、persisted log に `player.play.enqueued` を残す。production wiring では resident player の `onOutput` が child `STARTED` / `ENDED` / `STOPPED` / `ERROR` marker を `player.child` として記録する。
- TTS audio query request/parse、synthesis、WAV inspect/write preparation、timeline build、channel close/send/reply timeout/rejection は content-free machine-readable code/stage を運ぶ。final `fire.failed.stage` は generic fire branch ではなく直近の production failure boundary を保存する。明示 stage を持たない post-ask failure は `fire.processing.unknown` / `fire_processing_unknown` として正直に残し、`llm.ask` と捏造分類しない。
- production-shaped persisted tests は audio-query request/parse、synthesis rejection、invalid WAV inspect、WAV write preparation、timeline-build failure、channel rejection、synchronous socket-send failure、close-before-reply、reply-timeout を Fire final record まで実行する。各 case は final stage/code と、parse 前 request completion、inspect 前 synthesis completion、write/send 前 timeline build 等の pre-failure observation を検証する。
- async writer test は incremental ordering、write failure 後の recovery、5-run retention、queue bound/drop、`flush()` 後の persistence を検証する。

## 実行コマンドと結果

```text
node --test src/mind/fire-diagnostics.test.mjs src/mind/fire-orchestrator.test.mjs src/voice/speak.test.mjs src/channel/channel-client.test.mjs
```

結果: assertion 前に Node test worker の `spawn EPERM` が発生。製品 failure ではなく環境制約として分離した。

```text
node --test --test-isolation=none src/mind/fire-diagnostics.test.mjs src/channel/channel-client.test.mjs src/voice/speak.test.mjs src/mind/fire-orchestrator.test.mjs
```

結果: **98 passed / 0 failed**。worker-free path で writer queue、実 production hook chain との fixture event/field parity、success/failure persistence、audio-query parse/WAV inspect-write を含む machine-readable failure boundaries、actual UTF-8 envelope bytes、expression/speech distinction、既存 Soul Fire tests を確認した。

```text
node --test --test-isolation=none scripts/cockpit.test.mjs
```

結果: **74 passed / 0 failed**。

```text
node --check src/mind/fire-diagnostics.mjs
node --check src/mind/fire-orchestrator.mjs
node --check src/voice/speak.mjs
node --check src/channel/channel-client.mjs
node --check scripts/cockpit.mjs
git diff --check -- apps/soul/agent discussion/ai-cohost/implementation/waves/fire-diagnostics/domain-a.md
git diff --name-only -- apps/soul/agent/package-lock.json package-lock.json pnpm-lock.yaml
```

結果: syntax / diff check は exit 0、lockfile output はなし。status の Cockpit UI/API 差分は開始時からの user-owned dirty worktree であり、この担当の変更として扱わない。

## 残差・環境制限

- 実 provider、microphone、vision capture、AivisSpeech、物理 speaker の live run は mechanical scope では未実施。Accepted User Gate で従来どおりの通常操作による実観測を行う。
- 通常 Node test isolation はこの環境で `spawn EPERM` のため使えない。worker-free focused tests は green であり、この制約を製品 failure と混同しない。
- Runtime 側 transport/lifecycle log と統合レビューは Domain B / Review の所有であり、Domain A は未主張である。
