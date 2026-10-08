# Review A1R: App Server wire compatibility

- ループ番号: 1
- 判定: **PASS**
- レビュー役: independent Review-Sylph
- Human Cockpit: **PENDING**

## Target files / diff

- `apps/soul/agent/src/mind/codex-session.mjs`
- `apps/soul/agent/src/mind/codex-session.test.mjs`
- `apps/soul/agent/src/mind/brains.test.mjs`
- context completion: `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-corrective-wire-compatibility.md`

現在の working diff は Wave 1A 全体および並行作業を含む dirty worktree 上の差分であり、correction-only patch ではない。`git diff --numstat` は順に `594/330`、`425/422`、`70/51`、completion context は untracked だった。`brains.test.mjs` の identity tests は並行差分として correction へ誤帰属せず、今回の対象は App Server fake envelope のみとした。レビューは他者差分を revert、overwrite、format、stage、commit していない。

Basis として次を原本から確認した。

- `discussion/ai-cohost/research/app-server-validation-compatibility-inventory.md`
- historical `discussion/ai-cohost/implementation/reviews/codex-progressive-speech/a1-stream-transport.md`
- historical `discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-app-server-transport.md`
- `discussion/ai-cohost/experiments/codex-app-server-streaming-probe.md`
- 現 source、direct tests、target diff、corrective completion

## Independent source and test inspection

### Wire envelope and fake compatibility

- inbound は `jsonrpc` を検査せず、`id` と `result/error`、または `method` の consumer-needed shape で分類する（`codex-session.mjs:280-321`）。実 0.144.5 と同形の `{id,result}` は initialize の pending request を resolve する。
- common fake の response / RPC error / notification は `jsonrpc` を付与しない（`codex-session.test.mjs:37-42`）。`brains.test.mjs` の App Server fake も同じ省略形である。
- test 側の `jsonrpc` は、別値だけで spoof / fatal にできないことを確かめる意図的 adversarial record 1件だけ（`codex-session.test.mjs:233`）。
- initialize-only direct test は process 1、initialize 1、thread/start 0、turn/start 0を固定する（`:190-200`）。

### Validation classification

| 分類 | 現 source の境界 | レビュー結果 |
|---|---|---|
| Connection fatal | child unexpected exit/error、stdin/stdout error、unexpected/truncated stdout EOF、newline-terminated invalid JSON、stdin write failure（`:221-251,262-275,352-367`） | 必要な transport / framing / write loss に限定されている。close/reap不能は persistent reset barrier を reject し replacement spawn を止める（`:448-461,569-595`）。 |
| Request-local failure | known response の RPC error、result/error双方欠落、known id + unusable method、RPC timeout（`:291-318,328-345`） | pending request のみ reject。initialize の semantic failureは同じchildでretryできることをdirect testが固定（test `:203-219`）。 |
| Turn-local failure | active agent lifecycle/delta/final不整合、correlation片側一致、non-retrying error、non-completed terminal（`:497-565`） | `failTurn` はactive turnをrejectしowned threadを放棄するがconnectionをcloseしない（`:470-477`）。mismatch / failed terminal後のfresh thread recoveryはいずれもchild count 1（tests `:283-335`）。 |
| Diagnose and ignore | valid non-object、unknown response id、unsupported notification、stale generation、thread/turn両方unowned（`:287-295,317-325,479-503`） | active stateをcommit、complete、reviveしない。adversarial direct testはwrong completion後もtrusted textだけを返しchild count 1（test `:222-250`）。 |
| Untrusted/malformed | invalid JSONLはconnection fatal。active relevant malformed eventはturn-local failure。non-agent itemのunused identityは消費せず無視（`:505-565`） | wrong turnのtext/finalを成功としてcommitする経路は見当たらない。invalid JSONL後のreplacementはold child reap barrier後のみ（tests `:355-417`）。 |

`AppServerConnection.fail()` の呼出し箇所と `dispatchNotification()` の catch path を全て追跡した。protocol purityだけを理由にした追加 connection-fatal は見当たらない。semantic turn failure後は `threadId=null` のため次askが同じinitialized process上でfresh threadを開始し、process/stdio loss時だけconnectionをreapして次generationへ進む。

### Scope hygiene

Corrective target source/testから、Claude、Wave 1B progressive sentence/queue/partial path、UI、Runtime Player、dependency/lock、payload cap、`fire-orchestrator` への追加依存または必要変更はない。global working treeにはこれらの一部を含む並行・既存差分があるため、それらをcorrective成果へ帰属させていない。corrective completionも対象3 source/test filesと自身だけをowned filesとして記録している。

## Independent test execution

### Default isolation attempt

```powershell
node --test --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
```

```text
tests 2
pass 0
fail 2
cancelled 0
skipped 0
todo 0
duration_ms 11.9558
both test-file workers failed before module load with Error: spawn EPERM
exit 1
```

これはsource/test failureではなく、sandboxがNode test worker spawnを拒否した既知の実行環境制約である。

### Focused worker-free lane

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs
```

```text
tests 32
pass 32
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 301.2754
exit 0
```

### Narrow adjacent worker-free lane

```powershell
node --test --test-isolation=none --test-concurrency=1 src/mind/codex-session.test.mjs src/mind/brains.test.mjs src/mind/fire-orchestrator.test.mjs src/mind/memory.test.mjs scripts/cockpit.test.mjs
```

```text
tests 230
pass 230
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 5238.7931
exit 0
```

### Syntax and diff hygiene

```powershell
node --check src/mind/codex-session.mjs
node --check src/mind/codex-session.test.mjs
node --check src/mind/brains.test.mjs
git diff --check -- apps/soul/agent/src/mind/codex-session.mjs apps/soul/agent/src/mind/codex-session.test.mjs apps/soul/agent/src/mind/brains.test.mjs
```

全て exit 0。`git diff --check` はrepository既存のLF→CRLF working-copy warningだけを出し、whitespace errorはなかった。

## Real bundled App Server smoke

corrective completionに保存された bounded smoke evidenceを、現 `session.initialize()` のsource境界（`codex-session.mjs:620-624`）およびinitialize-only direct testと照合した。account/processを再使用する必要はないため、レビューではreal smokeを再実行していない。

記録されたraw outcome:

```text
first sandbox attempt:
Error: codex-session: failed to start App Server process.
cause: Error: spawn EPERM
exit 1

escalated bounded retry:
REAL_SMOKE initialize=PASS threadIds=0
exit 0
```

この evidence は、current bundled 0.144.5 executableをcorrected adapterから起動し、`initialize` → `initialized` → `dispose` が成立したことだけを証明する。`threadIds=0` と source/test境界から、thread/start、turn/start、prompt、response、LLM quota消費は含まれない。prompt/response本文を保存する経路もない。一方で、real turn、notification stream、model quality、Cockpit、人間受け入れは証明しない。

## Findings

### Blocker

なし。

### Major

なし。

### Minor

なし。

## Residual boundary / pending verification

- Human Cockpit validation remains **PENDING**。
- terminal notificationが永続的に来ない場合の独立bounded timeoutはpre-existing residual riskであり、この限定wire-compatibility correctionのfindingにはしていない。
- real smokeはinitialize-onlyであり、real thread/turn recoveryや長文・画像・tool attemptを追加証明しない。
- dirty worktreeではout-of-scope並行差分の作者をgit diff単独で立証できないため、本レビューは指定targetとcorrective-relevant hunksだけを帰属対象とした。

## Verdict

PASS

実0.144.5の`jsonrpc`省略envelopeはsource、standard fake、focused test、bounded real initialize smokeの4点で閉じた。fatalはtransport/framing/write/reap lossに限定され、request/turn semantic failureはchildを置換せず局所失敗、unknown/stale/unowned/additive messageはstateへcommitせず継続する。Blocker/Major/Minorはいずれもなし。
