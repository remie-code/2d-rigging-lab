# Workspace Activity Refresh: AI Cohost / Soul

> 調査基準日: 2026-08-08 (Asia/Tokyo)。`discussion/reports/workspace-activity-refresh/audit-contract.md`、`discussion/_conventions.md`、`discussion/_map.md`を先に読み、AI Cohostのtopic map、`apps/soul`のREADME/source/test/package、runtime-playerの関連契約、C1--C7/S1--S8のGit・wave記録を照合した。調査中に編集したのは本ファイルだけで、stage/commitはしていない。

## 1. Scope / inspected entry points

### AI Cohost maps

| Map | 種別 | 判定 (2026-08-08) | 備考 |
|---|---|---|---|
| `discussion/ai-cohost/_map.md` | living-current-state + living-index | Current（履歴欄は時点付き） | C1--C7、S1--S8、残存human/product gate、特区境界を現在欄へ routing。番号付き旧履歴は「履歴」と明記されている。 |
| `discussion/ai-cohost/architecture/_map.md` | living-index | Current | C4契約、C5/C6接地、Runtime Player境界をAcceptedとして索引。 |
| `discussion/ai-cohost/concept/_map.md` | living-index | Current | `apps/soul`のみLLM/知覚可、特区外禁止のMVP境界とbehavior-model未決を保持。 |
| `discussion/ai-cohost/implementation/_map.md` | living-current-state + living-index | Current（旧wave欄は時点付き） | 実装pass、実機/人間ゲート、brain/memoryの残ゲートを分離。 |
| `discussion/ai-cohost/implementation/orchestration/_map.md` | living-index | Current | S7実配信、S8、brain-swap、reading/interjection、stream-memoryの現行wave入口。 |
| `discussion/ai-cohost/implementation/screens/_map.md` | living-index | Current | C1/C3/C4/S2.5と操縦席改定を索引。`cockpit-redesign.md`本文のDraft表記は履歴と注記。 |
| `discussion/ai-cohost/premises/_map.md` | accepted-decision index | Current | 品質・費用・決定性境界のAccepted前提。 |
| `discussion/ai-cohost/research/_map.md` | historical-evidence index | Intentionally historical | 2026-07の外部調査スナップショット。料金/TTS/ASRは実装着手時再確認の注意書きあり。 |
| `discussion/ai-cohost/soul/_map.md` | living-current-state + living-index | Current | Max 20x+Agent SDK、4頭registry、memory、S8、persona/S9を現行判断と残ゲートへ分離。 |

### Code/package/test/contract scope

- `apps/soul/README.md`（特区憲章、agent package、S2耳、S2.5 cockpit、S6 barge-in/scheduler、S7 chat、S8 safety、brain、reading/interjection、stream-memory）。
- `apps/soul/agent/package.json` / `package-lock.json`。agentは独立npm packageで、workspace rootのlockfileを増やさない構成（README:18--28、package.json:1--15）。
- source: `src/mind/brains.mjs`, `memory.mjs`, `fire-orchestrator.mjs`, `barge-in.mjs`, `fire-scheduler.mjs`, `ng-words.mjs`; `src/cockpit/cockpit-server.mjs`; chat/ears/voiceの実装と同居test。
- runtime-player境界: `discussion/ai-cohost/architecture/runtime-player-control-channel.md`（Accepted方向、契約Draft）と `c4-control-channel-v0.md`、`discussion/runtime-player/_map.md:109--115`。
- Git履歴: C1--C7のwave/closure記録、S1--S8実装、操縦席改定、brain追加、reading/interjection、stream-memoryのコミット説明と各wave artifact。

## 2. Executive summary

1. **器/魂境界はAccepted**: runtime-playerは決定論的な生理・操縦チャネル、知性/知覚/ASR/TTSは`apps/soul`特区に置く（README:7--14、`runtime-player-control-channel.md:7--12`）。器側から魂をimportせず、魂は契約だけを参照する。
2. **D4/D6/D7は解決済み**: 配信先=YouTube、初手の宛先判定=キー操作から段階的自動化、Variant切替=D7は当面対象外（`discussion/ai-cohost/_map.md:75--80`）。S7の非公式innertubeはToSグレーを明示した実装上の選択で、法務/製品受容は別ゲート。
3. **C1--C7（器）は閉鎖**: C1〜C6は実装・機械/人間ゲート記録が揃い、C7はwaveなしのOBS二体目視閉鎖。C7は性能計測ゲートではなく、Runtime Player mapも再プロファイリングを禁止している（`discussion/ai-cohost/_map.md:47--53`、`discussion/runtime-player/_map.md:106--110`）。
4. **S1--S7は実装済み**: S1耳/声/常駐LLM、S2 ASR、S2.5 cockpit、S3 fire、S4 expression、S5 vision、S6 speech/barge-in/scheduler、S7 YouTube chatまで機械pass。S7は後続の`/live/<id>`修正後、30分実配信ノーブレイクを実質合格として記録（`implementation/orchestration/s7-wave-plan.md`の現行欄）。
5. **S8は実装・機械ゲート済みだがhuman gate未実施**: `f9c5f34`の764/764・9 lanesは実装証拠であり、発話中kill→全発火拒否→一クリック復帰→通常発話無退行の実射が残る（`discussion/ai-cohost/_map.md:36,59,83`）。
6. **brain swapは4頭registryまで実装**: Claude Opus、GPT-5.6 Terra、GPT-5.5、GPT-5.6 Solを`brains.mjs:47--84`で宣言。827/827・9 lanes後も速度/品質、Claude無退行、rollout掃除の3点human/運用ゲートは未記録（`discussion/ai-cohost/_map.md:38,60,84`）。
7. **stream-memoryは実装・機械ゲート済みだがprivacy/運用実射未完了**: `memory.mjs`はviewer `displayName`を整形段階で落とし、直近3件自動搭載、20分checkpoint/手動/SIGINT、OFF止水栓を実装。957/957・6 lanes後も保存/次回搭載/OFF/手動記録の4点human gateが残る（`discussion/ai-cohost/_map.md:39,61,85`）。
8. **reading/interjectionは実装と実配信4点確認が記録済み**: 887/887・6 lanes、1時間40分実配信でOFF/猶予/合いの手/通常会話の無退行を確認（`discussion/ai-cohost/implementation/orchestration/reading-interjection-wave-plan.md`）。これはS8、brain、memoryの未完ゲートを閉じない。
9. **persona/S9 voiceは製品判断**: 自己名「コーディ」は最小実装済み（`bbd78c7`）。声・人格の確定時期、身体/リグ引き渡しは未決で、model-authoring責務を侵食しない（`discussion/ai-cohost/soul/_map.md:15--17,46`）。
10. **実装存在≠受入完了**: node test runnerの全体実行は環境の`spawn EPERM`で起動前に停止した一方、worker-free import方式で主要10 test module・389/389がpass。これはソース検証とhuman/device/privacy/product gateを混同しないための証拠分離である。

## 3. What was built or investigated

### 器（C1--C7）

- C1 (`0603d05`, closure `f74005e`): slot基盤、役割合成、身元表示、二体起動/profile分離。手動ゲート全項目合格。
- C2 (`5cd75e5`, closure `2386d4f`): headless resolver、決定論blink生成器、60Hz frame heart。手動美的ゲートとOBS二体非干渉を確認。
- C3 (`4475795`, follow-up `86b4d6c`, closure `0a6f601`): gaze/head/posture、Physiology UI、Stage Presence。手動再ゲート合格。
- C4 (`140fb63`): loopback WS+token、JSON契約、拒否列挙、TTL overlay、`apps/soul`参照ドライバ、方向ルール検査。C4契約の正は`c4-control-channel-v0.md:1--13`。
- C5 (`aab63c6`, follow-up `6770760`): envelope/set状態機械、release、動く基底への追随。初回不合格後の診断・追撃で「滑らかに動く」合格。
- C6 (`bc8e04e`, integration `ed49b5d`): mouth group、vowel timeline、`intent.speech`、re-attack/Articulation。比較ゲート合格。
- C7 (closure `8bcc1aa`): wave/実装ゼロのOBS二体並走目視で閉鎖。負荷測定は未実施・スコープ外裁定。

### 魂（S1--S8と後続拡張）

| Wave | Git / 現在の到達 | 受入・残課題 |
|---|---|---|
| S1 | `3eaf605`, 84/84 + 器925/925 | 機械pass。実マイク/声/長時間運転はhuman/device gate。 |
| S2 | `4d797ce`, 196/196、ASR縦貫通約1.5s | 実マイク・モデル/音響環境の確認は別。 |
| S2.5 | `214c0e5`, 226/226、127.0.0.1 cockpit | UI/実運用 gateは後続waveへ。 |
| S3 | `19dc033` + `54ab800`, 269/284 | Fire→Opus→口/TTS→SSE。人間 gate未記録。 |
| S4 | `e4cb0f5` + `626d5d1`, 331/337 | 表情タグ・翻訳・ゲイン。人間ゲートは「今の動きでも満足」で閉鎖。 |
| S5 | `eca6b0e`, 411/411 | PrintWindow vision、実SDK5ask。人間ゲート記録はwave履歴を確認する。 |
| S6 | `882fc4f` + `7702b99`, 507/518 | MediaPlayer、barge-in、scheduler、vision preferred。実SDK5askはあるがhuman gateと別。 |
| S7 | `1699855` + URL fix `dcf84cc`, 609/728 | innertube、viewer timeline、`/live/<id>`。後続記録で実配信30分ノーブレイクを確認。ToSグレーは未解決。 |
| S8 | `f9c5f34`, 764/764・9 lanes | kill/NG/hotkey機械pass。kill実射と通常発話無退行のhuman gate待ち。 |
| 後続 | UI `691eb10`, verbosity `bd5d184`; brain `1889372` + `99bc41d`; reading `307a923` + `5f883b7`; memory `a5e2d07` | UI/verbosityは実装済み。brainは3点、memoryは4点のhuman/運用 gate待ち。readingは887/887・1h40確認済み。 |

### 特区（apps/soul）

`apps/soul`はLLM provider統合・知覚（screen capture/vision）を許す唯一の特区で、器のコードをimportせず契約だけを参照する（README:7--14）。直下にpackage.jsonを置かず、`apps/soul/agent`だけが独立npm package（README:18--28）。現package依存はClaude Agent SDK、Codex SDK、ONNX Runtimeの3つ（`apps/soul/agent/package.json:11--15`）。

現行実装は、耳（ffmpeg→Silero VAD→whisper）、声（AivisSpeech/WinRT MediaPlayer）、mind（Claude/Codex session、memory、kill/NG）、channel、cockpit、chat、eyesを同一特区に閉じる。秘密は環境/ローカル資格情報のみで扱い、API key env guardが誤課金を拒否する（README:61--66）。

## 4. Current repository state

### Current repository facts

- `brains.mjs:47--84`のregistryは4頭、`BRAIN_IDS`は`Object.keys(BRAINS)`（同:86--90）。
- `memory.mjs`は整形段階で`displayName`を落とし、使い捨てaskでdigestを生成し、直近3件を最大上限内で合成する。save/load/checkpoint/OFFの実体は`memory.mjs`およびcockpit wiringにある。
- `fire-orchestrator.mjs`は`fire()`入口でkill状態を確認し、in-flight応答を破棄できる。NG検査はTTS直前でNFKC+部分一致を行う。S8 READMEの仕様説明はREADME:367--392。
- `fire-scheduler.mjs`は`call|turn-end|silence|comment|comment-call|interjection`の発火種を持ち、verbosityの9→12値拡張・interjectionのrun/2秒境界を実装する。
- `cockpit-server.mjs:1051--1080`の`/api/brain`は4値（`claude`, `codex`, `codex-55`, `codex-56-sol`）を検証。`/api/kill`、`/api/memory`、`/api/memory-record`も実体化している。
- `cockpit-server.mjs`のstatic UI commentは既存22 endpoint×13 SSEと記す（:1167--1169）。READMEの旧16 endpoint表記（:355--357）との数字差は文書整合性の要確認で、runtime failureと断定しない。

### README/sourceのstale・suspicious箇所（修正は別作業）

1. `apps/soul/README.md:50--54`はランタイム依存をAnthropic SDK「のみ」と記すが、現`package.json:11--15`にはCodex SDK/ONNX Runtimeもある。Claude専用の説明を残すか、全依存の説明へ更新する必要がある。
2. `apps/soul/README.md:362--363`はverbosityを「場所のみ」、KILLを「S8予約枠のみ」と記す。S6後続・S8で実配線済みのsource/waveと矛盾するため、履歴として明示するか現行説明を追加すべきである。
3. `apps/soul/README.md:394--402`はbrain選択をClaude/Codex Terraの2択と記すが、現registryは4頭（`brains.mjs:47--84`）で、cockpit endpointも4値を検証する。これは現行説明としてstale。
4. `apps/soul/agent/src/cockpit/cockpit-server.mjs:378--382`のJSDocも`"claude" | "codex"`のみと記す一方、実endpointは4値（:1060--1068）。型/説明のstaleで、動作不一致ではない。
5. `discussion/ai-cohost/_map.md:66`などの番号付きNext ActionはS1着手待ち等の旧wave記録を残す。ただし:64で履歴と明記し、:55--62のCurrent next actionsが優先されるため、time-qualified historicalと判定する。
6. `discussion/ai-cohost/implementation/screens/cockpit-redesign.md`本文先頭のDraft表記は、同map:13が「モック承認・実装反映、本文Draftは設計履歴」と補っている。mapと本文の読み分けが必要。

## 5. Accepted decisions and boundaries

- **器/魂**: runtime-playerは決定論的な器、魂は外部オーケストレータ。AI入力はsession-onlyで保存/export/provenanceに触れない（`runtime-player-control-channel.md:40--46`）。
- **特区憲章**: LLM/知覚は`apps/soul`配下のみ。契約はJSON/WS、魂→契約の一方向、器→魂import禁止、秘密非コミット（README:7--14）。これは実装許可範囲であり、品質/法務/製品受入の完了宣言ではない。
- **D4** YouTube、**D6** 初手キー操作→実機ゲート後の段階的自動化、**D7** Variant切替は当面対象外（`discussion/ai-cohost/_map.md:75--80`）。
- **LLMアクセス**: Max 20x + Agent SDKを主経路とする裁定（`discussion/ai-cohost/soul/_map.md:13--17,44--45`）。実効枠/レイテンシ監視、制度変更/費用枠は未閉鎖。
- **モデル選択**: registryの現在4頭は実装の事実。初回体感の序列（Opus > Sol ≒ 5.5 > Terra）は実験/観測であり、最終運用選択ではない。
- **persona/body**: 自己名の最小事実は実装済み。声・人格・S9相槌の最終決定はユーザー/製品判断、身体/リグはmodel-authoring責務（`soul/_map.md:15--17,46`）。

## 6. Verification and experiment evidence

### Tests

- 実行コマンド: `npm.cmd test`（cwd=`apps/soul/agent`）。Node test runnerのworker spawnが環境で`EPERM`となり、53 test filesがassertion前にfail（pass 0、fail 53）。これはテスト内容のfailではなく実行環境制限。
- worker-free importで主要moduleを再実行: `node --input-type=module -e "import('./src/...test.mjs')"`。brains 12、codex-session 20、memory 27、fire-orchestrator 66、fire-scheduler 58、barge-in 29、ng-words 10、cockpit-server 118、live-chat-client 20、innertube 29の合計**389/389 pass**。
- したがって「選択した純関数/契約/状態機械はpass」と「全体test runner/実機が受入済み」は分離する。

### Wave/real observations

- S7: commit時点は実ネット不出・SDK消費ゼロ（`1699855`）。後続URL fix（`dcf84cc`）後、current map/wave記録が`/live/<id>` 30分ノーブレイクを実配信観測として記録。これはinnertube ToS/legal/product受入ではない。
- S6後続 reading/interjection: 887/887・6 lanes、1h40実配信で4点確認（OFF、2秒猶予、interjection、通常会話無退行）。
- brain: 827/827・9 lanes、Codex rollout sidecarのthread_id完全一致掃除、実機sessions 4494不変をcommit説明に記録。速度/品質・Claude無退行・掃除の最終human/運用ゲートは未記録。
- memory: 957/957・6 lanes、実消費ゼロ・`memories/`生成なしをcommit説明に記録。保存/次回搭載/OFF/手動更新のprivacy/運用実射は未記録。
- S8: 764/764・9 lanes、kill/NG/hotkey機械pass。kill実射・通常発話無退行は未実施。
- C7: OBS二体の目視閉鎖は受入済みだが、二体同時負荷/FPSは未計測。Runtime Player mapは深いprofiler再導入・C7を性能gate化しないよう明記（`discussion/runtime-player/_map.md:106--110`）。

## 7. Historical progression / turning points

1. 2026-07-10: C1の役割/slot骨格、D4 YouTube、D6 key-operation、MVP境界改定をAccepted。
2. 2026-07-11: C2 blink、C3 gaze/head/posture、C4 WS control channelと`apps/soul`特区、C5 envelope、D7 Variant-out-of-scopeを閉鎖。特区は「リポジトリ外」から「境界外」へ改定。
3. 2026-07-12: C6 speech timeline/口、C7 OBS二体目視で器を閉鎖。S前提討議でMax 20x+Agent SDKとテキストpipelineをAccepted。
4. 2026-07-12--16: S1 ASR/TTS縦貫通、S2耳、S2.5 cockpit、S3 Fire、S4 expression、S5 vision、S6 voice/barge-in/scheduler、S7 YouTube chatを順次実装。実装passは各waveで増加したが、wave時点ではhuman gate待ちを正直に残した。
5. 2026-07-14: cockpit redesign/verbosity wiringで運転面を再構成。READMEの一部は当時のDraft/予約表記を保持し、map側で履歴と現行を分離。
6. 2026-07-16: S8 kill/NG safety実装。機械pass後もkill実射/通常発話無退行を縮小human gateとして残す。
7. 2026-07-17: brain-swapをClaude/Codexから4頭registryへ拡張。Terra spikeはレイテンシ・永続性・画像橋渡しの実験根拠を提供したが、最終運用順序は未決。
8. 2026-07-18--19: reading/interjectionのbarge-in二段猶予と第7語彙を実装・実配信確認。stream-memoryを追加し、privacy/次回搭載/OFF/手動のhuman gateを残す。

## 8. Open gates, debts, and uncertainties

### Human / device / privacy / product / legal gate

- S8: 発話中killの即時停止、全発火拒否、一クリック復帰、通常発話無退行。AHK hotkey再読込・実TTS/デバイスを伴う。
- brain: 4頭の速度/品質体感、Claude無退行、Codex rollout掃除の実運用。資格情報存在確認・sidecar cleanupのprivacy観測を含む。
- stream-memory: 保存内容の秘匿（viewer名を含まない）、次回3件自動搭載、OFFの完全止水栓、手動/定期/SIGINT更新。ファイルを人間が編集/削除できる運用も含む。
- persona/S9 voice: 声、人格、相槌の確定時期と受入基準。body/rigはmodel-authoring側の別gate。
- S7: 非公式innertubeのToS/法務/製品採用判断、実配信アカウント/ネットワークの継続性。
- AI disclosure: 概要欄開示とpre-stream checklistはコードwave外の運用タスク（README:387--389）。

### Repository/document debt

- READMEの依存記述（Anthropicのみ）、verbosity/KILL旧説明、brain 2択記述を現行sourceと同期する必要がある（上記4. Current repository state）。
- cockpit-serverのbrain JSDoc 2値と実endpoint 4値の説明を同期する。endpoint behavior自体は4値検証で機械pass。
- READMEの「16 endpoints×13 SSE」とserver commentの「22 endpoints×13 SSE」の由来/契約数を一度照合する。
- 2026-07外部調査の料金/ASR/TTS/ToS根拠はhistorical snapshot。再利用時に公式情報を再確認する。

### Uncertainties

- Codex Solのreasoning effort `none`は公式一覧が未確認で、`brains.mjs:78--80`自身がTerra前例からの推論と明記。初回runの400で可視化される失敗形を採用している。
- NG starterの部分一致は誤爆候補をfollow-upに残す。v0の人間編集/確認なしに拡張しない。
- 実配信/実マイク/実TTS/OBS/複数runtime instanceをこの監査環境では再現していない。

## 9. Candidate next work (facts-derived, not a recommendation)

1. S8 waveの2点human gate実射と記録。
2. brain-swap waveの3点（4頭比較、Claude無退行、rollout掃除）記録。
3. stream-memory waveの4点（保存/秘匿、次回搭載、OFF、手動/定期）記録。
4. persona/S9 voiceの製品判断をユーザーが確定し、body/rig要件をmodel-authoringへ渡す。
5. README/cockpit-serverのstale説明とendpoint数表記を、sourceを正として別文書更新waveで同期。
6. S7 innertubeのToS/製品採用、AI開示、実デバイス/実ネットの運用チェックを別human/legal gateとして扱う。
7. `npm test`のspawn EPERMを解消できる実行環境が得られた場合のみ、53-file suiteを再実行する。worker-free 389/389は代替証拠であり、全体runner受入の代用とはしない。

## 10. Evidence index

| Evidence | Type | Result |
|---|---|---|
| `discussion/ai-cohost/_map.md:34--46,55--66,75--88` | current map + time-qualified history | C/S到達、特区、D4/D6/D7、残存gateを確認。 |
| `discussion/ai-cohost/soul/_map.md:13--17,21--24,33--50` | accepted decisions + current gate index | Max path、4頭、memory、persona/S9、S8 gateを確認。 |
| `discussion/ai-cohost/architecture/runtime-player-control-channel.md:7--12,19--46,52--57` | accepted architecture boundary | 決定論的channel、session-only、D7/未決を確認。 |
| `discussion/ai-cohost/architecture/c4-control-channel-v0.md:1--13,24--45,83--100` | C4 contract decision | JSON/WS/token、TTL、参照ドライバ、Max/API未決を確認。 |
| `discussion/runtime-player/_map.md:106--115` | cross-topic boundary | C7は性能gateではなく、AI control-channelのsource of truthはai-cohostと確認。 |
| `apps/soul/README.md:1--20,48--69,367--416,439--501` | repository fact + stale docs | 特区、package、S8、brain、reading、memoryの実装説明を照合。 |
| `apps/soul/agent/package.json:1--15` | repository fact | 独立package、Claude/Codex/ONNX依存を確認。 |
| `apps/soul/agent/src/mind/brains.mjs:47--90` | source fact | 4頭registryとBRAIN_IDSを確認。 |
| `apps/soul/agent/src/cockpit/cockpit-server.mjs:1051--1080` | source fact | `/api/brain`の4値検証を確認。 |
| `apps/soul/agent/src/cockpit/cockpit-server.mjs:1167--1169` | source comment | 22 endpoint×13 SSE記述を確認（READMEの16との整合性は未決）。 |
| `npm.cmd test` (cwd `apps/soul/agent`) | experiment | 53 filesがworker spawn `EPERM`でassertion前に停止。 |
| worker-free imports of 10 selected `.test.mjs` modules | experiment | 合計389/389 pass。 |
| `git log --oneline --all -- apps/soul` and `git log --grep='C[123]'` | historical evidence | C1--C7/S1--S8、brain、reading、memoryのcommit順とpass数を確認。 |

## 11. Limitations

- このreportはAI Cohost/Soul担当の一次調査であり、他topicのcurrent truthを裁定しない。
- 既存map/source/test/READMEを修正していない。stale箇所は修正候補として列挙しただけである。
- API料金・OpenAI/Anthropic/YouTubeの最新規約・ToS・価格は再調査していない。research mapは2026-07 snapshotである。
- 実機マイク、AivisSpeech、WinRT MediaPlayer、OBS/CEF、YouTube実配信、複数runtimeの負荷、privacy/kill/memoryのhuman gateはこの環境から再現していない。
- Node test runnerの全体実行不能は環境制約であり、389/389のworker-free passを53-file suiteの完全passとは扱わない。
- `discussion/ai-cohost/implementation`配下の番号付きwave記録は履歴証拠。現行判定はchild mapのCurrent欄、source、最新Git、human gate記録の順で行った。

**最終監査判定: PASS（調査範囲・current/historical・implementation/human/product gate・境界・制限を分離）。README/cockpit-serverのstale説明同期と、S8/brain/memory/personaの残gateはNEEDS FIXの候補として別作業に残る。**
