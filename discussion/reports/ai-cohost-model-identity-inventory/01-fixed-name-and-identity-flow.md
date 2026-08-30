# 固定名「コーディ」／モデル identity 伝播 inventory

調査日: 2026-08-08

この文書は discussion/reports/ai-cohost-model-identity-inventory/inventory-contract.md の
実装前 inventory である。実装・identity registry の設計採用は行わない。

分類は次のとおり。

- **Accepted**: 既存の裁定・契約に明記されたもの。
- **Current fact**: 現在の source/test/config の挙動。
- **Historical/stale**: 過去の実験・計画・重複実装、または現状とずれる文書。
- **Inference**: 複数の事実からの影響推定。
- **Unresolved**: ユーザーが決める必要があるもの。

## 1. Scope and entry points

対象は apps/soul 特区の、Soul 名（コーディ/Cody）と identity、name、displayName が入力、Soul、
知性契約、UI、発話、ログへどう流れるかである。入口は次のとおり。

- 契約: discussion/reports/ai-cohost-model-identity-inventory/inventory-contract.md:3-24
  （Claude=コーディ、GPT=チャッピーは既知のユーザー希望、系列/個別 model、過去 memory、
  prompt/persona/TTS の同一化は未決）。
- 境界・現況: discussion/_conventions.md、discussion/_map.md、
  discussion/ai-cohost/_map.md:21-25,34-46、discussion/ai-cohost/soul/_map.md:15-24,33-49。
- runtime: apps/soul/agent/src/ears/*（ASR と転写）、src/mind/*（scheduler、prompt、
  orchestrator、memory、brain registry）、src/cockpit/*（SSE/UI）、src/voice/*（TTS）。
- 既存テスト・実験・運用: 各 *.test.mjs、scripts/bench-name-prompt*、
  discussion/ai-cohost/implementation/orchestration/*name*、
  discussion/ai-cohost/operations/pre-stream-checklist.md。

brain registry 全体の再設計と memory の詳細設計は対象外とし、identity との境界・互換性だけを記録する。

## 2. Executive findings

1. **Current fact**: production の Soul 自己名は構造化された設定ではなく、FIRE_SYSTEM_PROMPT
   の先頭文字列 「あなたの名前はコーディ（Cody）です。」に固定されている
   (apps/soul/agent/src/mind/fire-orchestrator.mjs:137-154)。session は brain を替えても同じ
   prompt を受ける (apps/soul/agent/scripts/cockpit.mjs:712-721)。
2. **Current fact**: GPT 系の希望名「チャッピー」は source/docs/tests/config には存在しない。
   rg -n -S 'チャッピー|Chappy|CHAPPY|chappy' apps/soul discussion/ai-cohost は 0 件。
   現在の model/brain 切替は model label の切替であって Soul 名の切替ではない。
3. **Current fact**: 名称は二つの入力経路に複製されている。Whisper 語彙 bias は
   DEFAULT_WHISPER_PROMPT = 「こーでぃー、コーディ。」
   (src/ears/whisper-inference.mjs:40-50)、呼びかけ検出は音声集合
   NAME_VARIANTS_V0 (src/mind/fire-scheduler.mjs:204-218)、コメント本文は別集合
   NAME_VARIANTS_TEXT_V0 (src/mind/fire-scheduler.mjs:185-198) である。
4. **Current fact**: NAME_VARIANTS_V0 は日本語 4 形だけだが、NAME_VARIANTS_TEXT_V0 には
   Cody/cody/CODY もある。音声とコメントで英語呼びかけの対応が非対称である。
5. **Current fact**: transcript の構造化 speaker は "you" | "soul" | "viewer" のみ。
   Soul 名を運ぶ identity フィールドは無く、displayName は viewer のときだけ意味を持つ
   (src/ears/transcript-buffer.mjs:29-38,70-85,147-167)。自然完了時も speaker:"soul"
   と本文だけが追加される (src/mind/fire-orchestrator.mjs:455-464)。
6. **Current fact**: UI の Soul 名は静的な HTML title と header で、brain label は別表示である。
   cockpit.html:6 と ui/header.mjs:43-46 は こーでぃー を直書きし、
   view-logic/health.mjs:89-109 の BRAIN_LABELS は Claude/Codex の model label だけを扱う。
7. **Current fact**: TTS は numeric speaker ID（既定 888753760）で、名前との対応は無い
   (src/voice/tts-client.mjs:27,98-109)。voice/persona の最終決定は S9/persona の人間・製品
   ゲート待ち (discussion/ai-cohost/soul/_map.md:15-18,40-49)。
8. **Historical/stale**: Codex Terra spike は正本 prompt のコピーを保持する
   (scripts/spike-codex-terra.mjs:46-58)。正本変更時に stale になる重複点である。
   運用開示も コーディ(Cody) 前提の Draft
   (operations/pre-stream-checklist.md:1-18,25-38)。

## 3. Current data/control flow

### 音声入力から発話・UI まで

    マイク/ffmpeg → VAD/segmenter → Whisper
      (initial prompt: 「こーでぃー、コーディ。」; form field のみ)
      → transcriptBuffer (speaker="you") / onTranscript
      → fire-scheduler (NAME_VARIANTS_V0 による呼びかけ判定)
      → fire-injection (you/soul/viewer の行を整形)
      → session.ask (FIRE_SYSTEM_PROMPT + 任意の memory)
      → replyText → expression tag 除去 → speechText
      → speakImpl (TTS speaker ID) + player/channel
      → transcriptBuffer append (speaker="soul", text=speechText)
      → onSoulTranscript → SSE transcript (speaker="soul", latencyMs, brain label)
      → cockpit rows (who="soul", latency/brain badge)

入口の配線は src/ears/ear-pipeline.mjs:115-145,181-196、prompt 注入点は
scripts/cockpit.mjs:712-716、応答の kill/NG 検問・発話・Soul append は
src/mind/fire-orchestrator.mjs:333-367,388-465、SSE の唯一の Soul 放送経路は
src/cockpit/cockpit-server.mjs:1277-1308,1319-1333 である。

**重要な境界 (Current fact)**: この経路で コーディ は prompt と scheduler の照合語にしか現れず、
transcript/SSE payload に identity/name は出ない。SSE は toWireEntry の speaker/displayName と
additive な latencyMs/brain を送るだけ (cockpit-server.mjs:531-541,1290-1308)。発話本文が自己名を
含むかどうかは LLM 出力次第であり、構造化 identity の伝播ではない。

### コメント入力（Soul 名と別の displayName）

YouTube message は authorName を displayName として抽出し
(src/chat/innertube.mjs:304-365)、cockpit が speaker:"viewer" とともに buffer/SSE に
append する (src/cockpit/cockpit-server.mjs:1420-1474)。UI と fire injection は
viewer(名前): 本文 を描く (src/cockpit/view-logic/transcript.mjs:30-40,
src/mind/fire-injection.mjs:34-57)。これは外部視聴者 identity であり Soul 名ではない。
memory digest は viewer 名を常に落とす (src/mind/memory.mjs:20-24,60-73,89-99)。

### 記憶・brain の境界

起動時は固定 prompt と memory text を一箇所で合成する (src/mind/memory.mjs:10-19,
scripts/cockpit.mjs:712-716)。registry は id/label/create/credentialPath の頭の契約だけを宣言し
(src/mind/brains.mjs:26-33,41-84)、Soul identity は持たない。

## 4. Exact fixed values and owners

| 値/場所 | 現在値 | 所有 module | 分類 |
|---|---|---|---|
| 自己認識 prompt | あなたの名前はコーディ（Cody）です。 | src/mind/fire-orchestrator.mjs:137-154 (FIRE_SYSTEM_PROMPT) | Current fact; S3 prompt として実装済み |
| Whisper initial prompt | こーでぃー、コーディ。 | src/ears/whisper-inference.mjs:40-50,74-89 (DEFAULT_WHISPER_PROMPT) | Current fact; 語彙 bias のみ |
| 音声 call variants | コーディ/コーディー/コーティ/コーティー | src/mind/fire-scheduler.mjs:204-218 (NAME_VARIANTS_V0) | Current fact; ASR 精度優先の採用集合 |
| コメント call variants | 上記 + Cody/cody/CODY | src/mind/fire-scheduler.mjs:185-198 (NAME_VARIANTS_TEXT_V0) | Current fact; 音声集合とは非対称 |
| Cockpit title | こーでぃー — Soul Cockpit | src/cockpit/cockpit.html:1-6 | Current fact; 静的 UI |
| Cockpit header | h1=こーでぃー | src/cockpit/ui/header.mjs:43-56 | Current fact; 静的 UI |
| transcript speaker | you/soul/viewer（Soul は soul） | src/ears/transcript-buffer.mjs:29-38,70-85 | Current fact; identity ではない |
| viewer displayName | viewer authorName のみ | src/chat/innertube.mjs:304-365, src/cockpit/cockpit-server.mjs:1427-1474 | Current fact; privacy境界あり |
| brain label | Claude (Opus 4.8), Codex (GPT-5.6 Terra/5.5/5.6 Sol) | src/mind/brains.mjs:47-84, src/cockpit/view-logic/health.mjs:89-109 | Current fact; model label、Soul 名ではない |
| TTS speaker | 888753760（numeric） | src/voice/tts-client.mjs:27,98-109 | Current fact; voice identity ではない |
| GPT 系希望名 | チャッピー | source/docs/tests/config に該当なし | Known user decision; 未実装 |

### 関連する accepted/historical 文書

- discussion/ai-cohost/soul/_map.md:15-18,40-49 は自己名「コーディ」を実装済みとし、声・人格・
  S9 は未完了、人間ゲート待ちと分類している (**Accepted map state**)。
- discussion/ai-cohost/implementation/orchestration/s6-planning-inventory.md:7-19,56-61
  は「Claude Code → こーでぃー」と ASR 観測値を記録した (**Historical accepted plan**)。
- discussion/ai-cohost/operations/pre-stream-checklist.md:8-18,25-38 は開示・kill 手順を
  コーディ(Cody) 前提で記載 (**Draft operational artifact; identity 変更時は要更新**)。

## 5. Existing extension points

採用判断ではなく、現実に差し替え可能な seam を列挙する。

- createFireOrchestrator は session と hooks を受けるが、identity 引数は無い
  (src/mind/fire-orchestrator.mjs:184-225)。現状は prompt を session create 側で一度合成する
  (scripts/cockpit.mjs:712-716)ため、identity prompt の導入には create/options または prompt
  composition の拡張が必要になる (**Inference**)。
- createFireScheduler は nameVariants と commentNameVariants を options で受ける
  (src/mind/fire-scheduler.mjs:397-401)。系列ごとの呼びかけ集合を試験できる seam はあるが、
  registry と連動する現行配線は無い。
- Whisper は options.prompt を受ける (src/ears/whisper-inference.mjs:74-89)。これは form field
  の語彙 bias の seam であり、transcript の表示名・identity を変えない。
- speaker:"soul" は既存契約で安定している。toWireEntry/SSE に additive field を足す余地はあるが、
  現在の UI は speakerLabel と brain しか消費しない
  (src/cockpit/view-logic/transcript.mjs:30-40,52-68)。
- BRAIN_LABELS は UI に手書きされた model-label map (src/cockpit/view-logic/health.mjs:89-109)。
  brain id と表示名の seam であり、Soul identity registry の代替ではない。
- TTS の speaker は数字/文字列 ID のみ (src/voice/tts-client.mjs:98-109)。voice の名称結合は
  現行契約に存在しない。

実装方向を考える場合でも、少なくとも prompt、呼びかけ集合、UI/SSE、運用開示を一つの registry へ
寄せる案と、prompt と UI を分離する案には互換性・persona 演出の trade-off がある。ここでは採用しない。

## 6. Persistence and compatibility implications

- **Current fact**: settings/state に Soul identity の項目はない。保存・選択されるのは brain id 等で、
  /api/brain も許可された brain id の切替だけ (src/cockpit/cockpit-server.mjs:1051-1080)。
  browser/local settings と memory file に identity migration は存在しない。
- **Current fact**: transcript の永続形は speaker/displayName/本文で、Soul 名は field として保存されない。
  過去ログを新しい名で表示し直すか、当時の名を snapshot 保持するかは repo から閉じない。
- **Current fact**: memory digest の入力ラベルは soul、viewer 名は秘匿される
  (src/mind/memory.mjs:60-73,89-99)。LLM が本文中に「コーディ」と書いた digest が残る可能性は
  あるが、これは構造化 identity ではない (**Inference**)。
- **Current fact**: brain label は broadcast 時点の current brain を読むため、in-flight 応答と札が稀に
  ずれる注意書きがある (src/cockpit/cockpit-server.mjs:1288-1308)。brain swap と Soul 名を結合する
  場合は同じタイミング問題が生じる (**Inference**)。
- **Historical/stale**: settings-drawer.mjs の一部コメントは Claude/Codex 2択のまま、現 registry は
  4頭である。identity 追加時にこの stale 文書と UI label を同時監査する必要がある。
- **Historical/stale**: Terra spike の inline prompt (scripts/spike-codex-terra.mjs:46-58) は正本と
  同期されない。運用 disclosure、benchmark fixture、S6/S7 wave 文書にも コーディ が残るため、
  過去記録を機械的に rewrite しない互換方針が必要になる。
- **Privacy boundary**: viewer displayName を Soul identity と共用してはならない。memory は名前を落とす
  二重防御を持つ (src/mind/memory.mjs:20-24,60-73,89-99)。

## 7. Tests and verification surfaces

今回、worker を起動しない Node ESM import 方式で次の selected tests を実行し、**360/360 pass**。

| module | pass |
|---|---:|
| src/mind/fire-orchestrator.test.mjs | 66/66 |
| src/mind/fire-scheduler.test.mjs | 58/58 |
| src/ears/whisper-inference.test.mjs | 8/8 |
| src/ears/transcript-buffer.test.mjs | 17/17 |
| src/mind/fire-injection.test.mjs | 10/10 |
| src/cockpit/cockpit-server.test.mjs | 118/118 |
| src/cockpit/cockpit-ui.test.mjs | 39/39 |
| src/cockpit/view-logic/transcript.test.mjs | 5/5 |
| src/mind/memory.test.mjs | 27/27 |
| scripts/bench-name-prompt.test.mjs | 12/12 |

特に、prompt の自己名は fire-orchestrator.test.mjs:49-62、Whisper prompt の form-only 性質と
転写非汚染は whisper-inference.test.mjs:95-159、viewer name 表示/brain badge は
view-logic/transcript.test.mjs と cockpit-ui.test.mjs、memory の viewer 名秘匿は
memory.test.mjs で固定されている。

bench-name-prompt.test.mjs は fixture/合成転写のベンチ構造を検証する。実マイク・実 TTS・実 YouTube
コメントの human sweep は未実施で、discussion/ai-cohost/experiments/name-prompt.md も空のままという
wave 記録である。全体 runner の worker spawn EPERM 問題については別 activity audit の検証限界を継承し、
今回の selected import pass を full-run 成功とは扱わない。

## 8. Risks and ambiguous semantics

- **Unresolved**: identity を model series（Claude/GPT）か個別 model（GPT-5.5 等）に付けるか。
- **Unresolved**: registry-defined か user-editable か。現状の brain registry は model の id/label だけで、
  Soul identity の authority を定めていない。
- **Unresolved**: brain swap 時、次回発話から切替か in-flight 発話も切替か。prompt/session は起動時固定で、
  SSE の brain 札は broadcast 時点である。
- **Unresolved**: prompt 自己認識、persona/キャラクター、TTS voice/speaker、UI title、transcript/SSE/log を
  同じ identity とするか。現状はそれぞれ別の固定値・enum・numeric ID である。
- **Unresolved**: 過去 transcript/memory を当時名 snapshot にするか現在名で再解決するか。
- **Unresolved**: 英語/日本語の呼びかけ variants と、系列ごとの ASR precision/recall・誤爆許容値。
- **Current risk**: 音声集合は英語 Cody を持たず、コメント集合だけ持つ。series ごとに追加すると ASR と
  コメントの false-positive/precision 方針を再検証する必要がある。
- **Current risk**: spike-codex-terra.mjs の重複 prompt が stale になりうる。
- **Product/privacy gate**: pre-stream-checklist.md の AI disclosure は コーディ(Cody) と「コーディの声」
  を明記する。名前・voice を変える場合は配信表示、概要欄、kill 手順、人間説明を更新する必要がある。
- **Gate separation**: map は S8 kill、brain-swap、stream-memory の機械実装と人間/product gate を分離している
  (discussion/ai-cohost/_map.md:34-46, soul/_map.md:21-24,33-49)。名前変更の source が通っても、
  human/privacy/product gate 完了を意味しない。

## 9. Facts closable from repo

repo 事実だけで閉じられる事項は次である。

1. 現在の runtime self-name は コーディ(Cody)、Whisper bias は こーでぃー、コーディ。。
2. 音声 call variants は日本語 4 形、コメント call variants はそれら + Cody 3大小形。
3. GPT 希望名 チャッピー は未実装・未記録。
4. speaker:"soul"、displayName（viewer 専用）、numeric TTS speaker、brain model label は別契約。
5. 固定名は production prompt、ASR prompt、scheduler、UI title/header、operation disclosure、実験 copy に分散。
6. memory digest は viewer 名を落とし、Soul identity field は保存しない。
7. selected worker-free tests は 360/360 pass。実マイク/TTS/YouTube の名前 sweep と S8/brain/memory の人間
   ゲートは別物で未記録。

## 10. Premises requiring user decision

契約の「決めないこと」(inventory-contract.md:16-24)をそのまま判断点として残す。

- Claude/GPT の**系列**名か、GPT-5.5/5.6 のような個別 model 名か。
- identity は registry が管理するか user-editable にするか。
- brain swap の identity 切替時点（即時/in-flight/次回 fire）。
- 過去ログと memory の名前を snapshot 保持するか、現在名へ再解決するか。
- prompt 自己認識、persona、TTS/voice、UI/発話/ログを同一 identity に束ねるか。
- 英語/日本語の呼びかけ variants と、系列ごとの ASR precision/recall・誤爆許容値。
- チャッピーを GPT 系の確定名として採用するか（現時点では Known user decision だが source には未反映）。

## 11. Evidence index and limitations

### Evidence index

- Prompt/Soul: apps/soul/agent/src/mind/fire-orchestrator.mjs:137-154,333-367,388-465
- Ear/ASR: apps/soul/agent/src/ears/whisper-inference.mjs:40-50,74-89、
  apps/soul/agent/src/ears/ear-pipeline.mjs:115-145,181-196
- Name matching: apps/soul/agent/src/mind/fire-scheduler.mjs:185-218,221-277,397-401
- Transcript/injection: apps/soul/agent/src/ears/transcript-buffer.mjs:29-38,70-85,147-167、
  apps/soul/agent/src/mind/fire-injection.mjs:34-57,73-123
- Cockpit/SSE/UI: apps/soul/agent/src/cockpit/cockpit-server.mjs:531-541,714-728,1277-1333,1420-1474、
  src/cockpit/cockpit.html:1-6、src/cockpit/ui/header.mjs:43-56、
  src/cockpit/view-logic/transcript.mjs:30-68、src/cockpit/view-logic/health.mjs:89-109
- Brain/TTS/memory: apps/soul/agent/src/mind/brains.mjs:26-33,41-84、
  apps/soul/agent/src/voice/tts-client.mjs:27,98-109、apps/soul/agent/src/mind/memory.mjs:20-24,60-73,89-99
- Historical/accepted docs: discussion/ai-cohost/soul/_map.md:15-24,33-49、
  discussion/ai-cohost/operations/pre-stream-checklist.md:1-18,25-38、
  apps/soul/agent/scripts/spike-codex-terra.mjs:46-58
- Git fixed-name history: git log --all -S'あなたの名前はコーディ' -- apps/soul → bbd78c7、
  git log --all -S'DEFAULT_WHISPER_PROMPT' -- apps/soul → bd5d184、
  git log --all -S'NAME_VARIANTS_TEXT_V0' -- apps/soul → 1699855。

### Limitations

- 外部 provider の現在仕様、法務文言、TTS voice の聴感、実配信での誤認率は調査していない。
- source/map/report の変更は行っていない（この report のみ作成）。
- selected tests は worker-free import 実行であり、全体 runner の成功・実機 human gate・privacy/product gate の
  完了を主張しない。
- 本文の「必要な拡張」「stale の影響」は明示した **Inference** であり、identity registry の採用案ではない。

### N-02 direct boundary verification (2026-08-08)

統合レビュー指摘「apps/soul を accepted boundary と記すだけで、current boundary violation の
検証結果が無い」に対し、既存 package script の最小 scope を実行した。

| Command | Exit | 結果・意味 |
|---|---:|---|
| pnpm.cmd run check:soul-zone | 0 | scripts/check-soul-zone-boundary.mjs が現行 source **1389 files** を走査し、no 器→魂 imports and no 魂→器 code imports。current source の直接境界 guard は PASS。 |
| pnpm.cmd run check:soul-zone:fixtures | 1 | fixture wrapper の回帰自己テストは失敗。valid を含む全子プロセスで status/output が undefined となったため、spawnSync の実行環境制約と分離する。現行 source の violation を示す結果ではない。 |

fixture wrapper の spawn を介さず、同じ guard を各 fixture root に直接向けた結果は次のとおり。

- node scripts/check-soul-zone-boundary.mjs --root scripts/soul-zone-boundary-fixtures/valid → **exit 0**、2 files scanned、違反なし。
- node scripts/check-soul-zone-boundary.mjs --root .../invalid-vessel-imports-soul → **exit 1**、器→魂 import を検出。
- node scripts/check-soul-zone-boundary.mjs --root .../invalid-soul-imports-vessel → **exit 1**、魂→器 code import を検出。
- node scripts/check-soul-zone-boundary.mjs --root .../invalid-vessel-imports-soul-multiline → **exit 1**、多行器→魂 import を検出。
- node scripts/check-soul-zone-boundary.mjs --root .../invalid-soul-imports-vessel-multiline → **exit 1**、多行魂→器 code import を検出。

従って、current repository boundary の直接 guard は PASS と記録できる。一方、fixture wrapper の
spawnSync 回帰テストは別の環境制約で未 PASS とし、両者を混同しない。
