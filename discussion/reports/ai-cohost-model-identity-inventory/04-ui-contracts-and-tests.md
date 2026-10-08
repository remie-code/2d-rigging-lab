# AI Cohost model identity inventory — UI / contract / tests

調査日: 2026-08-08 (JST)
所有範囲: Control UI、配信/表示面、contract/schema/API、tests、AI Cohost の accepted docs/maps/AC との回帰面。
状態: **inventory only**。実装案の採用、identity の粒度決定、既存 source/map の変更は行っていない。

## 1. Scope and entry points

### 1.1 入口と検索範囲

- 契約: `discussion/reports/ai-cohost-model-identity-inventory/inventory-contract.md`（本調査の必須契約）。
- 方針/索引: `discussion/_conventions.md`、`discussion/_map.md`、`discussion/ai-cohost/_map.md`、`discussion/ai-cohost/soul/_map.md`。
- 実装特区: `apps/soul/agent/src/{mind,ears,cockpit}`、`apps/soul/agent/scripts/cockpit.mjs`。
- 表示/配信文書: `discussion/ai-cohost/implementation/screens/cockpit-redesign.md`、`discussion/ai-cohost/operations/pre-stream-checklist.md`。
- accepted/current wave: `discussion/ai-cohost/implementation/orchestration/brain-swap-wave-plan.md`、`discussion/ai-cohost/implementation/orchestration/verbosity-vocab-wave-plan.md`、`discussion/ai-cohost/implementation/waves/brain-swap/brain-swap-followup.md`、`discussion/ai-cohost/soul/brain-swap.md`、`discussion/ai-cohost/implementation/s-series-decomposition.md`。
- 回帰検索語: `コーディ`、`Cody`、`チャッピー`、`identity`、`displayName`、`persona`、`brain`、`model`、`provider`。無関係な一般 `name` は網羅しなかった。

### 1.2 対象外

- Runtime Player/Editor の model package identity はこの report の対象外。AI Cohost map 自身も Editor 本体、model-authoring、Runtime Player の既存機能を責務外としている（`discussion/ai-cohost/_map.md:7-12`）。
- 実装、API version の採択、シリーズ対個別モデルの名前割当、TTS/voice の採択は行わない。

### 1.3 用語の分離

この report では、`soul identity` は画面・自己認識・配信開示で呼ばれる存在名（現在は「コーディ」）、`brain` は registry の技術的選択（provider/model ID）、`label` は brain の表示札、と分ける。現在の source はこの三つを同じ schema で表現していない。

## 2. Executive findings

1. **[Current repository fact]** 魂名は `FIRE_SYSTEM_PROMPT` の「コーディ（Cody）」、Whisper の初期 prompt、呼びかけ検出の揺れ集合、Cockpit header、配信開示文に個別固定されている（`apps/soul/agent/src/mind/fire-orchestrator.mjs:144-154`、`apps/soul/agent/src/ears/whisper-inference.mjs:40-49`、`apps/soul/agent/src/mind/fire-scheduler.mjs:183-218`、`apps/soul/agent/src/cockpit/ui/header.mjs:43-56`、`discussion/ai-cohost/operations/pre-stream-checklist.md:6-18`）。
2. **[Current repository fact]** `BRAINS` は `id`、provider/model 用 `label`、`create`、credential path の flat registry であり、`soulName`、`identity`、persona、voice のフィールドはない（`apps/soul/agent/src/mind/brains.mjs:15-33,47-90`）。したがって現行の 4 brain と魂名の対応は wire/schema 上表現されない。
3. **[Known user decision]** inventory 契約は「Claude 系列=`コーディ`、GPT 系列=`チャッピー`を扱えるようにしたい」と記録する。ただし系列単位か個別 model 単位か、user-editable か registry-defined かは未決（`inventory-contract.md:1-3`）。これは採用済み実装契約ではない。
4. **[Accepted/current implementation evidence]** 現行 brain は Claude Opus、GPT-5.6 Terra、GPT-5.5、GPT-5.6 Sol の 4 頭で、速度/品質の最終 human gate は未記録（`discussion/ai-cohost/_map.md:21-22,36-39,55-62,83-86`、`discussion/ai-cohost/soul/_map.md:15-24`）。brain の選択は model choice の accepted wave であり、魂名の変更判断ではない。
5. **[Current repository fact]** Control UI の頭脳 select は `BRAIN_LABELS` から 4 option を作り、`POST /api/brain` に `{brain}` を送る。snapshot は `{brain, credentialHealth}` のみで、魂名は header/フィードの別固定値として流れる（`apps/soul/agent/src/cockpit/ui/settings-drawer.mjs:70-85,205-215,350-368,527-544`、`apps/soul/agent/src/cockpit/ui/app.mjs:70-96`）。
6. **[Current repository fact]** server の API 入力値（4 ID）と UI の label 表は別モジュールへ重複している。`brains.mjs` は registry を唯一の宣言場所と説明する一方、`health.mjs` は同じ labels を手書きし、`cockpit-server.mjs` は 4 ID を手書きする（`apps/soul/agent/src/mind/brains.mjs:41-47`、`apps/soul/agent/src/cockpit/view-logic/health.mjs:89-110`、`apps/soul/agent/src/cockpit/cockpit-server.mjs:1051-1071`）。名前 identity を追加する場合の回帰面が増える構造的事実である。
7. **[Current repository fact]** transcript の latency 札と usage 札は人間名でなく raw brain ID (`claude` 等) を付ける。表示は `(1.5s · claude)`、`usage[claude]: ...` の形で、モデル label への解決も魂名への解決も行わない（`apps/soul/agent/src/cockpit/view-logic/transcript.mjs:52-68`、`apps/soul/agent/src/cockpit/view-logic/usage.mjs:16-28`）。
8. **[Known limitation]** in-flight 応答の transcript/usage 札は broadcast 時点の `brainStatus()` を読むため、切替直前に生成された応答が現在 brain と誤表示され得る。v0 は配信前選択を本線として許容している（`apps/soul/agent/src/cockpit/cockpit-server.mjs:1283-1308,1328-1331`、`discussion/ai-cohost/implementation/waves/brain-swap/brain-swap-followup.md:53-58`）。
9. **[Current repository fact]** 永続化は `brainChoice` という文字列だけで、identity、label snapshot、schema version、migration はない。未知値は起動時に Claude へ fallback する（`apps/soul/agent/src/cockpit/cockpit-settings-store.mjs:34-40,181-186`、`apps/soul/agent/scripts/cockpit.mjs:518-557`）。
10. **[Current tests / gap]** registry、API 4 値、snapshot/SSE additive brain、UI label、header の「こーでぃー」、呼びかけ揺れ、Whisper prompt、settings roundtrip は fixture/assertion で固定される。一方 SettingsDrawer の直接 interaction、identity mapping、a11y の動的状態、in-flight attribution は未固定（`discussion/ai-cohost/implementation/waves/brain-swap/brain-swap-followup.md:59-79`）。
11. **[Accepted docs / gap]** accepted AI Cohost docs/maps には「コーディ」の記述があるが、`discussion/acceptance-criteria` と `discussion/scenarios` への直接検索（`コーディ|Cody|チャッピー`）はヒットなし（2026-08-08 bounded `rg`）。従って現状の魂名は AI Cohost の wave/運用文書と source/test に固定され、MVP AC の直接 requirement oracle にはなっていない。

## 3. Current data/control flow

### 3.1 Brain selection → session

```text
SettingsDrawer
  BRAIN_OPTIONS = Object.keys(BRAIN_LABELS)
  POST /api/brain { brain }
        |
        v
cockpit-server
  4 ID を boundary で検証
  onSetBrain(choice)
        |
        v
cockpit.mjs
  brainChoice を file settings に保存
  currentBrain を更新
  現 session.dispose() → null
        |
        v (次の Fire)
BRAINS[currentBrain]
  create({ systemPrompt: composeSystemPrompt(FIRE_SYSTEM_PROMPT, memory) })
        |
        +--> Claude: native systemPrompt
        +--> Codex: codex-session が初回 turn に system prompt を prefix
```

根拠は `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs:350-368`、`apps/soul/agent/src/cockpit/cockpit-server.mjs:1051-1080`、`apps/soul/agent/scripts/cockpit.mjs:692-721,780-813`、`apps/soul/agent/src/mind/brains.mjs:15-33,47-90`、`apps/soul/agent/src/mind/codex-session.mjs:231-252,324-409`。この経路に identity 値は入っていない。

### 3.2 Soul name → ear/scheduler/prompt/UI

```text
Whisper DEFAULT_WHISPER_PROMPT = "こーでぃー、コーディ。"
        |
        v
transcript (正本は ASR 応答)
        |
        v
fire-scheduler NAME_VARIANTS_V0
  コーディ / コーディー / コーティ / コーティー
        |
        v
FIRE_SYSTEM_PROMPT = "あなたの名前はコーディ（Cody）です。"
        |
        +--> Cockpit h1: こーでぃー
        +--> stream disclosure: コーディ(Cody)
```

Whisper の prompt は request form の語彙 bias だけで、転写バッファ/segmenter/VAD/返却テキストの形を変えない（`apps/soul/agent/src/ears/whisper-inference.mjs:40-49`、`apps/soul/agent/src/ears/whisper-inference.test.mjs:95-99,152-159`）。scheduler は soul speaker を自己呼びかけから除外する（`apps/soul/agent/src/mind/fire-scheduler.test.mjs:109-123,159-165`）。

### 3.3 Brain observability → UI

`cockpit.mjs:807-813` の `brainStatus()` は `{brain, credentialHealth}` を返す。server snapshot はそれを state に載せ、soul transcript と usage SSE に brain ID を additive 付与する（`apps/soul/agent/src/cockpit/cockpit-server.mjs:378-387,468-477,1283-1331`）。`app.mjs` は `settingsFromSnapshot` で `brain` を保持するが、`Header` には渡さず、SettingsDrawer と rows/feed だけに渡す（`apps/soul/agent/src/cockpit/ui/app.mjs:70-96,232-263`）。

## 4. Exact fixed values and owners

| 種別 | 固定値/形 | 現在の owner | 分類と回帰面 |
|---|---|---|---|
| 自己認識 prompt | `あなたの名前はコーディ（Cody）です。` | `FIRE_SYSTEM_PROMPT` | [Repo fact] session 起動時に全 brain へ合成。orchestrator test が `コーディ` を assert（`fire-orchestrator.mjs:147-154`; `fire-orchestrator.test.mjs:60-62`）。 |
| ASR 語彙 prompt | `こーでぃー、コーディ。` | `DEFAULT_WHISPER_PROMPT` | [Repo fact] options.prompt に毎回注入。prompt が結果へ混入しない test（`whisper-inference.mjs:40-49`; test `:95-99,152-159`）。 |
| 音声 call 揺れ | `コーディ`, `コーディー`, `コーティ`, `コーティー` | `NAME_VARIANTS_V0` | [Repo fact] normalize/false-positive policy。実人声採取は未完（`fire-scheduler.mjs:183-218`）。 |
| コメント文字揺れ | Cody/cody/CODY + 日本語4種 + `こーでぃー` | `NAME_VARIANTS_TEXT_V0` | [Repo fact] comment-call matching。`CoDy` 等は未採用（`fire-scheduler.mjs:183-202`; test `fire-scheduler.test.mjs:520-536`）。 |
| Cockpit header | `<h1>こーでぃー</h1>` | `ui/header.mjs` | [Repo fact] brain によらず常時同じ。UI smoke が text include を assert（`header.mjs:43-56`; `cockpit-ui.test.mjs:425-439`）。 |
| Approved visual name | header/teal/soul の「こーでぃー」 | `cockpit-redesign.md` | [Accepted visual/product gate] 2026-07-14 mock approval（`cockpit-redesign.md:21-47,113-123`）。dynamic brain name は spec にない。 |
| Stream disclosure | `AI の相方「コーディ(Cody)」` | pre-stream checklist | [Operational draft] 配信概要欄/voice/checklist/kill text に複数出現（`pre-stream-checklist.md:6-18,23-38`）。 |
| Brain IDs | `claude`, `codex`, `codex-55`, `codex-56-sol` | `BRAINS`/`BRAIN_IDS` | [Repo fact] flat frozen registry（`brains.mjs:41-90`）。 |
| Brain labels | Claude (Opus 4.8); Codex (GPT-5.6 Terra); Codex (GPT-5.5); Codex (GPT-5.6 Sol) | `BRAINS[*].label` + duplicated `BRAIN_LABELS` | [Repo fact] exact labels are tested, but ownership is duplicated (`health.mjs:89-110`; `health.test.mjs:100-118`; `brains.test.mjs:16-39`)。 |
| Brain API input | only four IDs; invalid → `400 {error:"invalid brain"}`; absent hook → 503 | `cockpit-server` | [Repo fact] route boundary hardcodes IDs (`cockpit-server.mjs:1051-1080`)。 |
| Brain snapshot | `brain: { brain: string, credentialHealth: boolean }` or `null` | `brainStatus` → snapshot | [Repo fact] credential is presence-only, no auth contents (`cockpit-server.mjs:378-387`; `cockpit.mjs:807-813`)。 |
| Transcript/usage wire | additive `brain: string|null` | `broadcastSoulTranscript`, `onUsage` | [Repo fact] raw ID at broadcast time; latency/usage old fields remain (`cockpit-server.mjs:1283-1331`)。 |
| Latency display | `(1.5s · claude)` | `view-logic/transcript.mjs` | [Repo fact] raw ID, one decimal rounding; null brain preserves old `(Ns)` (`transcript.mjs:52-68`; test `transcript.test.mjs:41-52`)。 |
| Usage display | `usage(vision)[codex]: input=... output=...` | `view-logic/usage.mjs` | [Repo fact] raw ID; null/absent is backward-compatible (`usage.mjs:16-28`; test `usage.test.mjs:29-47`)。 |
| Persisted selection | JSON key `brainChoice: string|null` | `cockpit-settings-store` | [Repo fact] read-modify-write, malformed/unknown tolerant; no identity/version (`cockpit-settings-store.mjs:181-186`; tests `:574-655`)。 |

## 5. Existing extension points

以下は現在存在する extension seam の棚卸しであり、採択案ではない。

- **Registry seam**: `BRAINS`/`BRAIN_IDS` は frozen flat table。entry shape は `id,label,create,credentialPath` のみ（`brains.mjs:26-33,47-90`）。identity を同じ table で持つか、別 resolver にするかは未決。
- **UI label seam**: `BRAIN_LABELS` → `BRAIN_OPTIONS` → `SettingsSelect` の一方向（`health.mjs:89-110`; `settings-drawer.mjs:70-79`）。`settings-drawer` は registry を import せず label 表だけを読む責務境界を持つ。
- **API seam**: `POST /api/brain` の validation と `brainStatus` injection（`cockpit-server.mjs:378-387,1051-1080`）。route は versionless で、4 ID を server 内に複製する。
- **Session seam**: `ensureFireResources` の `composeSystemPrompt(FIRE_SYSTEM_PROMPT, memory)`（`cockpit.mjs:692-721`）。Claude と Codex の system prompt 経路が異なるため、prompt に identity を含める場合の behavior は model path ごとに観測対象になる。
- **Ear seam**: `DEFAULT_WHISPER_PROMPT` と `options.prompt`（`whisper-inference.mjs:40-49`）。既定 prompt と caller override の境界がある。
- **Call detection seam**: `NAME_VARIANTS_V0` と `NAME_VARIANTS_TEXT_V0`（`fire-scheduler.mjs:183-218,193-202`）。音声とコメントの集合を別に持つため、名前変更時に両者の語彙・false-positive policy が独立して回帰する。
- **Persistence seam**: `getBrainChoice/setBrainChoice` と `createBrainHooks`（`cockpit-settings-store.mjs:181-186`; `cockpit.mjs:518-557`）。未知値を default `claude` に畳む。
- **Observation seam**: `snapshot.brain`、transcript/usage の additive `brain`、純関数 display (`latencyLabel`, `usageNoteText`)（上記 3.3）。identity を観測する既存 field はない。

## 6. Persistence and compatibility implications

### 6.1 現在の保存/復元

- `cockpit-settings.local.json` の brain 関連は `brainChoice` のみ。store は JSON 全体を read-modify-write し、不正 JSON・非文字列は null、書込み失敗は操作を止めない（`cockpit-settings-store.mjs:65-100,181-186`; tests `:628-655`）。
- `createBrainHooks` は remembered value が `BRAIN_IDS` に無ければ `defaultChoice` (`claude`) を返す（`cockpit.mjs:518-557`）。旧/未知 identity の migration や label snapshot はない。
- memory digest は自由文で `FIRE_SYSTEM_PROMPT` と合成され、structured identity metadata を持たない（`apps/soul/agent/src/mind/memory.mjs:18-29,89-140`）。過去 digest に「コーディ」が含まれていても、それが当時名か現在名かを識別する field はない。

### 6.2 Wire/API compatibility

- `snapshot.brain` と SSE `brain` は既存 payload への additive field。`brain` 未注入/null でも UI は従来表示へ劣化する（`app.mjs:90-96`; `transcript.mjs:56-68`; `usage.mjs:16-28`）。
- API route に schema/version field はない。4 値 validation、unknown 400、hook 未注入 503 が現在の boundary 契約（`cockpit-server.mjs:1051-1080`）。
- latency/usage の brain ID は broadcast 時点の current brain。切替中に生成元と札が不一致になる既知近似（`cockpit-server.mjs:1290-1293`; followup `:53-58`）。identity と brain を結合する場合、同じ近似が名前表示にも波及する可能性がある（[Inference]）。
- Codex session は native system prompt ではなく初回 turn prefix、Claude は native system prompt という差がある（`codex-session.mjs:231-252,324-409`; `llm-session.mjs` の create path）。自己認識の prompt 変更は session recreate の境界を越える。

### 6.3 過去表示/ログの意味

現在の feed は viewer にだけ `displayName` を付け、soul は literal speaker (`soul`) で、名前は header/本文の別面である（`view-logic/transcript.mjs:30-41`; `screens/cockpit-redesign.md:21-38`）。過去の transcript 行を新 identity へ再解決する仕組みはない。過去ログ/memory を当時名 snapshot にするか現在名で再解決するかは契約未定である（[Decision pending]）。

## 7. Tests and verification surfaces

### 7.1 現在の fixture/assertion（実装 pass の証拠）

| Surface | 既存 assertion |
|---|---|
| Brain registry | 4 ID、freeze、entry shape、credential path、Codex model/effort（`apps/soul/agent/src/mind/brains.test.mjs:14-39,42-53,56-128`）。 |
| Prompt identity | `FIRE_SYSTEM_PROMPT` が「コーディ」を含む（`apps/soul/agent/src/mind/fire-orchestrator.test.mjs:50-62`）。 |
| ASR prompt | 既定 prompt 注入、server response が正本で prompt 名が text/rawText に混入しない（`apps/soul/agent/src/ears/whisper-inference.test.mjs:95-105,152-159`）。 |
| Voice/text call | 正規化、4 音声揺れ、soul 自己発話除外、OFF/busy gating、コメントの Cody/Japanese variants と false positives（`apps/soul/agent/src/mind/fire-scheduler.test.mjs:96-123,159-190,520-536`）。 |
| UI header | vnode text に `こーでぃー`、health/voice/settings が含まれる（`apps/soul/agent/src/cockpit/cockpit-ui.test.mjs:425-439`）。 |
| UI brain options | `BRAIN_LABELS` 由来の 4 option と表示 text（`cockpit-ui.test.mjs:609-619`; exact labels also `view-logic/health.test.mjs:100-118`）。 |
| API/snapshot/SSE | `/api/brain` 4 値 switching/invalid/503、snapshot brain、transcript latency+brain、usage brain additive と null backward compatibility（`apps/soul/agent/src/cockpit/cockpit-server.test.mjs:2196-2340,2347-2428`）。 |
| Persistence | brainChoice roundtrip/coexistence/corrupt/unwritable（`apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs:574-655`）。 |
| Display logic | raw ID latency and usage format, null compatibility and one-decimal rounding（`apps/soul/agent/src/cockpit/view-logic/transcript.test.mjs:35-52`; `usage.test.mjs:22-47`）。 |

`cockpit-ui.test.mjs:609-619` は当該ファイルの option test。行番号は今後の編集で変わり得るため、assertion の内容は同 test 名と `health.test.mjs:100-118` でも照合できる。

### 7.2 Human/product gates と machine tests の分離

- **[Historical machine evidence]** verbosity/vocab wave は 724/724、コーディ prompt の prompt-only 正本不変を機械テストで閉じたが、`bench-name-prompt.mjs` の実スイープは未実走（`discussion/ai-cohost/soul/_map.md:40-43,50-75`）。
- **[Historical human/product evidence]** 口数/コーディ語彙の human gate は「拾われる」体感まで記録済みだが、幻聴混入率は未測定（同 `soul/_map.md:45-52,71-75`）。
- **[Current pending gate]** brain swap は 4 頭の速度/品質、Claude 無退行、rollout 掃除の最終 human gate が未記録（`discussion/ai-cohost/_map.md:55-62,83-86`; `soul/_map.md:23-24`）。この gate は model choice であり、魂名 identity の human gate ではない。
- **[Current pending gate]** persona/S9 の声・人格・名前の確定時期は user decision（`discussion/ai-cohost/_map.md:62,86`; `soul/_map.md:15-17`）。

### 7.3 2026-08-08 の再実行記録

対象 command（cwd=`apps/soul/agent`、実 SDK/ネットを使わない focused scope）:

```text
node --test src/mind/brains.test.mjs src/mind/fire-scheduler.test.mjs \
  src/mind/fire-orchestrator.test.mjs src/ears/whisper-inference.test.mjs \
  src/cockpit/cockpit-server.test.mjs src/cockpit/cockpit-settings-store.test.mjs \
  src/cockpit/cockpit-ui.test.mjs src/cockpit/view-logic/health.test.mjs \
  src/cockpit/view-logic/transcript.test.mjs src/cockpit/view-logic/usage.test.mjs \
  src/cockpit/view-logic/settings.test.mjs scripts/bench-name-prompt.test.mjs
```

実行結果: **12 test files / 0 pass / 12 fail**。各 file が test runner child process の `spawn EPERM` で開始前に失敗した（tests/date/scope は上記、実装 assertion の failure ではない）。単一 file (`node --test src/mind/brains.test.mjs`) でも同じ `spawn EPERM`。したがって本 report の “current tests” は source 上の fixture/assertion 棚卸しであり、この実行で green を再確認したものではない。

### 7.4 既存テストでは閉じない verification surface

以下は必要な検証面の棚卸しであって、採用した実装手順ではない。

1. 4 brain ID、label、API validation、persisted `brainChoice` が同じ語彙であることの cross-check。現在は registry/health/server が重複 owner。
2. identity 名、Romanization、ASR揺れ、comment-call揺れ、false-positive policy の source/test 一致。
3. Header、SettingsDrawer brain section、feed latency/usage の表示名・technical label・ARIA label/id の関係。現状 `for="brain-select"` と `id="brain-select"` はあるが、動的表示の a11y test はない（`settings-drawer.mjs:72-85,527-544`）。
4. `/api/state`、`POST /api/brain`、SSE transcript/usage の null/unknown/backward compatibility と将来 identity field の unknown handling。
5. brain switch と in-flight response の生成元 attribution。既知の current-brain-at-broadcast 近似を test が明示していない。
6. SettingsDrawer の select change → POST → error → snapshot 適用。直接 interaction test は hooks/no-jsdom 制約で未実施（`brain-swap-followup.md:59-69`）。
7. memory/history/disclosure に過去名を保持するか現在名を解決するか。structured metadata がないため fixture だけでは決まらない。
8. 実マイク ASR と配信表示の human gate。bench は未実走、voice/persona gate は未記録。

## 8. Risks and ambiguous semantics

- **Brain ≠ soul**: `brain` は provider/model 技術 ID、`label` はその札、`コーディ` は現在の魂名。この境界が UI で明示されず、usage/latency は raw ID を表示する（[Inference from source]）。
- **Granularity**: inventory 契約は Claude 系列/ GPT 系列の名前を示すが、Terra/5.5/Sol を別人格にするのか系列で共有するのか未決。
- **Name vocabulary**: 「チャッピー」の日本語・長音・英字・ASR誤認・comment text variants は未定義。現行「コーディ」には採否理由と揺れテストがあるため、単なる UI string 置換では回帰範囲を表せない。
- **Prompt/persona/voice coupling**: current prompt self-recognition は最小の名前 assertion だけで、persona/S9 voice は別 gate。名前変更が prompt、TTS、voice、disclosure の全てを意味するかは未決。
- **UI exposure**: Header は常に `こーでぃー`、brain select は model labels、feed badges は raw IDs。4 brain を選んでも魂名は同じに見えるという一貫性リスク。
- **Owner drift**: `BRAINS[*].label`、`BRAIN_LABELS`、server 4-ID validation が独立しており、identity mapping を複数箇所へ増やすと stale value が起きやすい（[Inference]）。
- **Persisted semantics**: `brainChoice` は schema/version/migration なし。過去設定と future identity の関係は fallback だけで閉じない。
- **History semantics**: transcript は soul literal speaker、memory は自由文。過去の「コーディ」を当時名として固定するか、現在名で再表示するかを判定する metadata がない。
- **In-flight attribution**: brain swap 時の札ズレが既知。identity を同じ broadcast timing から解決すると同じ誤表示が続く可能性が高い（[Inference]）。
- **A11y test gap**: label/id pairing は source にあるが、SettingsDrawer の dynamic interaction と ARIA state の assertion はない。
- **Operational disclosure drift**: pre-stream checklist は Draft の固定文で、model-specific disclosure の accepted requirement ではない。

## 9. Facts closable from repo

以下は現 repository/accepted artifact だけで閉じられる事実である。

1. 現行の自己名固定値は prompt=`コーディ（Cody）`、Whisper=`こーでぃー、コーディ。`、音声揺れ4種、header=`こーでぃー`、配信開示=`コーディ(Cody)`。
2. 現行 brain registry は 4 ID と各 model label を持つが、identity/persona/voice の field は持たない。
3. `/api/brain`、snapshot、SSE、settings store は brain technical ID の契約であり、soul identity の契約ではない。
4. 現行 UI は brain technical label、raw ID badge、固定 soul name を別々に表示する。
5. registry、API、prompt、scheduler、Whisper、UI、settings、SSE の主要回帰 fixture は存在する。
6. SettingsDrawer 直接操作、in-flight attribution、identity mapping、history name semantics の fixture はない。
7. AI Cohost maps/waves/運用文書には「コーディ」が見えるが、MVP `acceptance-criteria`/`scenarios` の直接魂名 requirement は検索上存在しない。
8. 既存 human gate は model choice/quality、Claude 無退行、rollout cleanup、persona/voice 等であり、Claude=コーディ/GPT=チャッピーの mapping gate は未記録。

## 10. Premises requiring user decision

これはユーザー判断点であり、repo fact として閉じない。

1. identity の粒度は系列（Claude/GPT）か個別 model（Opus/Terra/5.5/Sol）か。
2. 名前は registry-defined 固定か、user-editable か。user-editable の場合、ASR/call variants と配信開示を同じ値から生成するか。
3. brain swap は名前を即時切替するか、次の Fire から切替するか。in-flight response を旧名で snapshot 保持するか。
4. transcript/memory/disclosure は当時名を保存するか、現在の name resolver で再表示するか。
5. prompt の自己認識、persona、TTS/voice、header、OBS/配信開示まで一つの identity に含めるか。それとも UI/運用だけ別名を許すか。
6. technical model label/raw ID を latency/usage に残すか、human identity と併記するか。
7. 「チャッピー」の許容表記（長音、英字、かな、ASR誤認、コメント表記）と false-positive の許容水準。
8. identity mapping を model registry の field とするか、別契約・resolver とするか（現行の duplicated label/API owners をどう扱うか）。

## 11. Evidence index and limitations

### 11.1 Primary source index

- Prompt/ear/scheduler: `apps/soul/agent/src/mind/fire-orchestrator.mjs:140-154`; `apps/soul/agent/src/ears/whisper-inference.mjs:40-49`; `apps/soul/agent/src/mind/fire-scheduler.mjs:183-218`。
- Brain registry/session contract: `apps/soul/agent/src/mind/brains.mjs:15-33,41-90`; `apps/soul/agent/scripts/cockpit.mjs:518-557,692-721,780-813`。
- Cockpit API/wire: `apps/soul/agent/src/cockpit/cockpit-server.mjs:378-387,1051-1080,1283-1331`。
- UI: `apps/soul/agent/src/cockpit/ui/header.mjs:43-56`; `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs:70-85,205-215,350-368,527-544`; `apps/soul/agent/src/cockpit/ui/app.mjs:70-96,232-263`。
- Display logic: `apps/soul/agent/src/cockpit/view-logic/health.mjs:89-121`; `transcript.mjs:52-68`; `usage.mjs:16-28`。
- Persistence: `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs:34-40,65-100,181-186`。
- Tests: `apps/soul/agent/src/mind/{brains,fire-orchestrator,fire-scheduler}.test.mjs`; `apps/soul/agent/src/ears/whisper-inference.test.mjs`; `apps/soul/agent/src/cockpit/{cockpit-server,cockpit-settings-store,cockpit-ui}.test.mjs`; `apps/soul/agent/src/cockpit/view-logic/{health,transcript,usage,settings}.test.mjs`。
- Accepted/current docs: `discussion/ai-cohost/_map.md:21-22,36-39,55-62,83-86`; `discussion/ai-cohost/soul/_map.md:15-24`; `discussion/ai-cohost/soul/brain-swap.md:1-4,10,17,67-110`; `discussion/ai-cohost/implementation/orchestration/brain-swap-wave-plan.md:7-53`; `discussion/ai-cohost/implementation/orchestration/verbosity-vocab-wave-plan.md:31-42,65`; `discussion/ai-cohost/implementation/waves/brain-swap/brain-swap-followup.md:53-79`; `discussion/ai-cohost/operations/pre-stream-checklist.md:6-38`; `discussion/ai-cohost/implementation/screens/cockpit-redesign.md:21-47,84-89,113-123`。

### 11.2 Limitations

- `node --test` focused rerun was blocked by environment `spawn EPERM` before file assertions; no green count is claimed here. Historical counts in maps are explicitly labeled historical.
- No real SDK, microphone, Whisper server, TTS, YouTube stream, Electron browser, or screen-reader run was performed.
- `discussion/acceptance-criteria`/`discussion/scenarios` check was a bounded literal search for `コーディ|Cody|チャッピー`; generic `model identity` requirements may still exist but are not soul-name requirements.
- This report does not modify source, tests, maps, contracts, or other reports, and does not resolve the decisions in §10.
