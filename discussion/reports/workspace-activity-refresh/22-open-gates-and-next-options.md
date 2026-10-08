# Workspace activity refresh — Open gates and next options

基準日: 2026-08-08 (Asia/Tokyo)。`audit-contract.md` と一次報告 `01`–`10` を読み、未決事項だけを統合した。これは候補と依存関係の索引であり、優先順位・製品判断・scope変更を決めない。各行の owner は、最初に未決を記録した一次報告（または同報告が指す topic）である。

## 1. Scope / inspected entry points

- 契約: `discussion/reports/workspace-activity-refresh/audit-contract.md`（必須11節、current/historical/experiment/human/legal の分離、調査のみ、単一report）。
- 一次報告: `01-product-policy.md`、`02-editor-current-capabilities.md`、`03-editor-development-history.md`、`04-runtime-player-and-broadcast.md`、`05-model-authoring-and-mesh.md`、`06-render-dynamics-performance.md`、`07-electron-distribution-repo-health.md`、`08-ai-cohost-and-soul.md`、`09-expo-public-surfaces-archives.md`、`10-git-timeline-worktree.md`。
- 共通境界: `discussion/_conventions.md`、`discussion/_map.md`。報告自身の pass は製品・人間・実機・法務受入に昇格させず、Wave記録は current truth として再利用しない。

## 2. Executive summary

1. 未決は、user/product、human/device、legal/rights、technical debt、optional experiment、external acceptance の6分類に整理できる。重複しうる項目（例: Expo表示権と外部受理）は、判断を行う主体が明確になる分類へ置いた。
2. Private 2D Rigging Lab / Prototype と4トラック分離、Cubism/SDK/Core除外、deterministic authoring、`dynamics-file-v3`、Wave102 Editor mainline stop、W103–109 specialized 境界、`apps/soul`特区は accepted boundary であり、未決候補として再提案しない（01:66–75、03:80–87、08:132–141）。
3. 実装上の赤は Editor package typecheck、Editor stale unit assertion、PSD Electron E2E の stale precondition、`check:source` barrel violation、strict-ref/sidecar portability、Wave109 closeout欠落など。これらは製品方針の未決とは別の technical debt である（02:121–129、05:122–127、07:102–110）。
4. 実端末・OBS・GPU/pixel・vowel・PNG再認証・AI safety/privacy・Expo proof print は、機械テストや focused pass が残っていても未完了である（04:116–123、05:115–120、06:132–142、08:132–154、09:169–188）。
5. 権利・ToS・外部受理は、リポジトリ内のポリシーや生成物の存在だけでは完了しない。Demo/Proposal/Expo の preflight、rights manifest、disclaimer、受理通知、Cubism archive 再開許可は別主体の判断を要する（01:108–119、09:169–178）。
6. C7二体負荷、GPU/readPixels、Player deep profiler、real-model-003 は optional/conditional。明示的な再開依頼、対象環境、計測権限がない限り、既存の視覚閉鎖やsynthetic測定から自動再開しない（04:127–130、06:139–151、08:118–119）。
7. Windows の `spawn EPERM`、fixture harness の子プロセス制約、外部サービス・実機未接続は環境/検証制約であり、対応する source failure と混同しない（01:119、04:158–161、05:155–159、07:104–110、08:188–190）。
8. 次の候補は並列に選択可能な論点として記録し、依存関係と必要な authority/decision を明記する。ここでは優先順位を付けない。

## 3. What was built or investigated

- **Product/policy (01):** Private prototype、4トラック、AC/Scenario と implementation semantics の責務分離、Product Preflight、Demo/Rights/IP boundary、Dynamics v3 の受入意味論を照合した。未決は Domain-09 traceability、Demo/Proposal/Future subset、archive restart、AI human/product gate である（01:104–119）。
- **Editor/history (02–03):** Electron authoring-to-viewer、明示承認付き PSD scaffold、WebGL2/Canvas fallback、mesh/rig/keyform/variant/export、Wave102 stop と W103–109 specialized historyを source/map/report へ照合した。実装 pass は visual/device acceptance ではない（02:18–25、03:104–125）。
- **Runtime Player (04):** Runtime Export、Browser Source loopback/token、Native Stage、iFacialMocap、W21 Dynamics Tune、W22/W23 vowel mapping、lifecycle と lightweight metrics を確認した。W21 Domain C、実機/OBS、vowel-rig は未閉鎖（04:116–130）。
- **Model authoring/mesh/render (05–06):** authoring-host/software rasterizer、post-`45d2734` PNG、strict-ref、v6D/v7、Option E/contentInset/uvRect、AtlasRuntime visual、dynamics v3、GPU/pixel/Canvas2D sunset、性能計測境界を確認した（05:115–127、06:132–142）。
- **Electron/repo health (07,10):** WS1–WS4/packaging、Editor typecheck/unit/E2E、source/deps/soul guards、metadata/dead branches、Git/worktreeの一時的E2E churnを確認した。E2E生成物は復元済みで、timeline自身はPASS（07:102–120、10:93–101）。
- **AI Cohost/Soul (08):** C1–C7、S1–S8、brain registry、stream-memory、reading/interjection、`apps/soul`特区と README/JSDoc stale を確認した。S8/brain/memory/persona は human/運用 gate 待ち（08:132–154）。
- **Expo/public/archive (09):** 6 HTML/6 A2 PDFの存在を検証し、受理通知、proof print、rights manifest、Demo/Proposal preflight、archive境界を確認した（09:169–188）。

## 4. Current repository state and accepted boundaries

### Current facts

- HEAD は `af5839452f0968a005cb6cd13c62b714aa4e6d4e`。最後の活動は map/report refresh で、Git timeline は implementation burst 後の gate tracking と記録する（10:15–23、10:91–101）。
- Root typecheck、Runtime Player typecheck/unit、focused package tests、Electron renderer build 等の局所 pass がある一方、Editor package typecheck/unit、source guard、PSD E2E は別結果である（02:92–100、07:102–110）。
- Expoのファイル/ページ幾何は検証済みだが、外部受理・表示権・印刷品質は検証されていない（09:37–43、09:169–178）。

### Accepted decisions / boundaries（再判断しない）

- Private 2D Rigging Lab / Prototype と Private Prototype、Streaming Demo Surface、Live2D Feature Proposal、Future Public Clean Subset の4トラックを分離する（01:18–24、09:120–124）。
- Cubism形式/SDK/Core/既存モデル/第三者素材の互換・解析・再構築を現行scopeに入れない。historical archive は current implementation/acceptance oracle ではない（01:20、09:72–76）。
- `dynamics-file-v3`/`worldFrameChainV1` を current owner とし、Wave81 scalar/additive 文言を current semantics に戻さない（01:21–22、02:85、06:121–127）。
- Wave102 を Editor mainline planning stop、W103–109 を bounded specialized evidence とする。後続 commitやpartial reportだけで再開しない（03:80–87、03:121–125）。
- Editor/authoring は deterministic explicit operation、`apps/soul` のみ LLM/perception/ASR/TTS を許す特区とする（01:66–75、08:1–2、08:132–141）。
- Browser Source、Product Preflight、Option E/contentInset/uvRect、v6D default/v7 toggle等の設計境界は、下記の未決受入を閉じるまで維持する（04:63–72、05:115–127、06:134–142）。

## 5. Open gates and debts by classification

### A. User / product decisions

| 未決項目 | 依存関係 | 必要な権限・判断 | 原典 owner / evidence |
|---|---|---|---|
| Domain-09 の profile-v2 / `dynamics-file-v3` cardinality を AC/Scenarioへどう追跡表示するか。旧 one-output/scalar 文言を歴史的要求として残すかも含む。 | Accepted v3 design、current package/runtime source、Domain-09 AC/Scenario本文の差分照合。 | Product/requirements owner が traceability 表現を決め、AC/Scenario編集権を承認。 | 01-product-policy:108、02:141、01 owner。
| Live2D Proposal の最初の機能テーマ、提出先、公開範囲、draft/review scope。 | Demo-safe material、rights/provenance preflight、proposal template。 | User/product owner と提出先の権限者が target/scope を決定。 | 01:110、09:40,190–198。
| Future Public Clean Subset を作るか、その scope/rights/dependency/display boundary。 | Private prototype と別の dependency/rights review。 | User/product owner による着手判断。不要なら現MVP外を維持。 | 01:111,126、09:120–124。
| v6D/v7 mesh quality criteria、comparison toggle lifetime、v6 deletion/Wave2、Canvas2D sunset/fallback product behavior、AtlasRuntime/`original` previewの扱い。 | 実画像/GPU/pixel/AtlasRuntime evidence と model-authoring quality hold。 | Human quality owner が acceptance criteria、toggle/deletion、fallback寿命を決定。 | 02:128,142–143、05:118–120、06:134–136,150。
| Warp Bezier `storedNotEvaluatedV0` を維持するか runtime evaluation を設計するか。 | package contract と editor authoring needs。 | Design/product owner が semantics追加または現状維持を承認。 | 02:129,153。
| Wave102後の Editor mainline を再認可するか、specialized trackを維持するか。W109をwave-level finalに昇格するか partialで保持するか。 | W103–109 map/source/Git、外部 visual/device evidence、依存topicの残債。 | User/implementation owner が mainline再開・closeout形式を明示承認。 | 03:121–125、02:144。
| Model-authoring の次 closed-problem/craft scope（旧「02」を履歴から自動選択しない）。 | PNG再認証、strict-ref/sidecar portability、現行 craft evidence。 | User が次scopeを選択。 | 05:120,136。
| AI persona/S9 voice、verbosity/behavior の最終製品基準。body/rig要件を model-authoringへ渡すか。 | S8/brain/memoryの運用確認と model-authoring interface。 | Product/user owner が voice/persona/引き渡し要件を決定。 | 01:113,128、08:139,161。

### B. Human / device gates

| 未決項目 | 依存関係 | 必要な権限・判断 | 原典 owner / evidence |
|---|---|---|---|
| Runtime Export + iFacialMocap の実機接続、UDP start/stream、near/far calibration、head/eye/mouth mapping。 | Target phone/host、real Runtime Export/model、network access。 | Device operator と product owner の実機受入記録。 | 04:118,134。
| W21 Domain C の persistence/reset/isolation/restart/reopen/save-failure/artifact immutability。 | Runtime Export、profile storage、Native/Browser Stage、再起動可能な packaged/dev環境。 | Runtime Player owner と human operator。 | 04:120,134。
| Browser Source/OBS の alpha/WebGL2/model parity、30/60/custom FPS、Stage Motion、cadence/subjective smoothness。 | Real Browser Source URL/model、OBS/CEF、provenance-complete capture。 | Device/OBS operator。OBS automation/source creationは未提供で別実行権限が必要。 | 04:121,137、06:135,138。
| Packaged/dev Electron Control/Stage lifecycle、OS/taskbar close/reopen、quit flush/recovery、slot/userData。 | Built portable/dev package、OS access、workspace/Electron E2E precondition修復。 | Electron owner と human GUI tester。 | 04:122,136、07:109,120。
| W22/W23 five-vowel real model gate（閉口zero、transition、`え` parasitism、`う` jitter、ON/OFF/strength、unsmoothed step の受容）。 | Real iFacialMocap、mapped vowel rig/model、current W22/W23 semantics。 | Runtime/model owner と human speech tester。 | 04:123,135、05:117,132。
| Current post-`45d2734` PNG bytesの再認証、sidecar portability/absolute path受入。 | Current 126 PNG/sidecar、旧2026-07-03 approvalとの同値性確認。 | Model-authoring quality owner/human visual reviewer。 | 05:115–116,131、10:42。
| AtlasRuntime margin/cross-bleed/LINEAR edge AA、GPU/readPixels parity、Canvas2D retained overlay/sunsetの実画像確認。 | Declared target GPU/browser、atlas/export/runtime fixture、pixel oracle protocol。 | Render/quality owner の実機・視覚受入。 | 02:128,150、06:134–142,146。
| AI S8 kill/restore/no-regression、brain 4頭比較/Claude no-regression/rollout cleanup、stream-memory privacy/OFF/auto-load/manual update。 | AHK/hotkey、real TTS/mic、credentials/sidecar、ファイル削除・次回起動環境。 | AI operator と privacy/product owner の human/運用 sign-off。 | 08:136–138,158–160。

### C. Legal / rights gates

| 未決項目 | 依存関係 | 必要な権限・判断 | 原典 owner / evidence |
|---|---|---|---|
| Streaming Demo の rights-clean fixture/capture scene、provenance metadata、redaction、最終 disclaimer/UI、allow/block preflight。 | Demo policy、rights/IP policy、対象 asset の license/permission、capture output。 | Rights/legal reviewer と product owner。policyだけで法的安全を宣言しない。 | 01:109,118,124、09:64,169–176。
| Expo 14 PNG、asset/name/live-screen の display/redistribution permission と rights manifest。 | 各assetの provenance/license、human reviewer、公開範囲。 | Rights owner/event organizerの許諾。repository内にmanifest/acceptanceは未記録。 | 09:41,102,156–159,175,194。
| Proposal 添付物の rights/preflight/redaction と提出先の公開許可。 | Proposal target/scope決定、Demo-safe capture、template review。 | Proposal submitter と rights/legal reviewer。 | 01:110,125、09:40,176,196。
| S7 unofficial innertube の ToS/法務/製品採用、実配信アカウント/ネット継続性。 | 最新公式ToS/運用条件、実アカウント、disclosure/pre-stream checklist。 | Legal/product owner と配信運用者。 | 08:140,163,188。
| Cubism/旧性能 archive の再利用・公開・実験再開。 | Separate permission/legal/scope review、current owner routing。archiveをoracleにしない。 | Rights/legal owner と user scope decision。 | 01:112,127、09:72,178,198。

### D. Technical debt / evidence debt

| 未決項目 | 依存関係 | 必要な権限・判断 | 原典 owner / evidence |
|---|---|---|---|
| Editor package typecheck（一次報告の集計は21 errors / 23 error lines）と4件の stale `diagnostics-jump-actions` assertion。 | Current source/tsconfig、現行 route (`workspace`) と test expectation。 | Editor code/test owner。件数差は再実行時に確定し、product gateと分離。 | 02:94,125–126、07:105,117。
| PSD Electron E2E の Create/Open Workspace 前提、native picker/temp-dir injection、timeout後の11 tests status。 | E2E helper、Electron build、deterministic fixture/picker。 | Electron/E2E owner。timeoutをpass/failへ推測しない。 | 02:127,149、07:104,116,140。
| `check:source` の `apps/runtime-player/src/main/physiology/index.ts` barrel violation。 | Source guard policy、現行barrel intent。 | Runtime Player/source-organization owner が修正または意図的再分類を決める。 | 01:119、07:106,118。
| Editor portable dead branches、package `description`/`author` metadata warning。 | Editor feature scope（lower bundle dormancyはaccepted）、packaging metadata policy。 | Electron/product owner。削除・追加は別changeとして承認。 | 07:107–108,119。
| strict-ref 97 errors、absolute `packagePath`/`pngPath`、stale `392x1024` README。 | Current PNG/sidecar dimensions、portability policy、human visual re-certification。 | Model-authoring owner が分類・portable形式・docs correctionを決定。 | 05:116,124,159。
| Wave109 final integration artifact欠落、`contentInset` schema重複、sourceRect dependency。 | Wave-level closeout方針、package-format/operation-core owners。 | Implementation owner がfinal report追加かpartial保持、schema責務を決定。 | 05:125,127,135。
| Runtime Player UDP application-level acknowledgement/TCP、capture provenance不足、未測定 Player hypotheses。 | 明示的なtransport/performance再開scope、target network/hardware。 | Runtime owner がfuture scope/experimentを開く判断。自動で機能追加しない。 | 04:127–129、06:140–142。
| AI README/JSDoc の依存・verbosity/KILL・brain 2択・endpoint数 stale。 | Source (`package.json`, registry, endpoint)を正とする docs audit。 | Soul owner がdocs update waveを承認。READMEの数字差をbehavior failureと断定しない。 | 08:143–148,162。
| Historical wording/index asymmetry（W101 Planned見出し、W51–55 purge、W56 abandoned、W109 partial等）。 | Leaf final/review、Git chronology、current maps。 | Documentation/map owner が time-qualified wording を保守。 | 03:104–115,121–125、10:95–101。

### E. Optional experiments (conditional, not a recommendation)

| 候補 | 依存関係 | 必要な権限・判断 | 原典 owner / evidence |
|---|---|---|---|
| C7 two-instance CPU/GPU/FPS/OBS capture。 | Named hardware/browser/OBS、capture protocol、C7を性能gate化する再開依頼。 | Userが明示的に再開し、性能実験の target/retention を許可。 | 04:130,138、06:139,147、08:119。
| WebGL2 `readPixels`/pixel oracle と AtlasRuntime/Canvas2D parity experiment。 | Real GPU/browser、mask/AA fixture、Option E/contentInset contract。 | Render owner が実機試験と比較基準を承認。 | 06:134–146。
| Player internal profilerで `getState` parse/clone/index/mask cost を測る。 | Explicit performance regression/request、developer/test-only boundary。 | Runtime owner が deep profilerを再開する authority を持つ。product Control/Browser Sourceへ再露出しない。 | 06:140,148。
| real-model-003 / 新ベンチ。 | Regressionまたは明示 request、モデル/測定protocol。synthetic改善だけでは依存を満たさない。 | Performance owner/user が新 measurement scope を承認。 | 06:141,151。
| Soul 53-file runnerを worker spawn可能環境で再実行。 | Windows/Node child-process権限、既存 worker-free 389/389結果。 | 実行環境管理者。全体passへ自動昇格しない。 | 08:154,164,188–190。

### F. External acceptance / operations

| 未決項目 | 依存関係 | 必要な権限・判断 | 原典 owner / evidence |
|---|---|---|---|
| Expo個別 acceptance notice / submission status。 | Event system/inbox/portalへのアクセス。workbench noteは外部事実ではない。 | Organizerまたは提出者の正式確認。 | 09:37,110,173,192。
| Acceptance後のA2 physical proof print（panel ②/③ 約88/64 dpi）とreadability record。 | Formal acceptance、印刷設備、real-size human inspection。 | Event/print operator と展示責任者。 | 09:38,174,193。
| Demo/Proposal の公開・提出レビュー、disclaimer配置、preflight artifactの外部受容。 | Rights/legal gate、選択したtarget/scope、generated evidence。 | Product owner、rights reviewer、提出先 reviewer。 | 01:109–110,124–125、09:40,176,196。
| Human GUI/PSD review、Runtime Player/OBS/device observation の外部/運用受入記録。 | Technical debt修復後の実機手順、target model/device、operator availability。 | 各topic owner と実行者の正式 sign-off。 | 02:133–137、04:118–123、07:109–120。

## 6. Known reds vs environment / verification constraints

### Known reds (repository or evidence debt; owner correction required)

- Editor package-local typecheck is red（一次報告の集計表記は `23 error lines` と `21 errors` で異なる）。Editor unit は `diagnostics-jump-actions` の4 stale expectationsが失敗（02:94,125–126、07:105）。件数差は追加の再監査対象だが、いずれも package debt の存在を変えない。
- PSD Electron E2E helper は workspace/native picker precondition を欠き、timeout時に11テストの最終結果を確定できない（02:127、07:104,140）。
- `check:source` は physiology barrel violation で fail（01:119、07:106）。
- strict-ref 97 errors、absolute sidecar paths、README dimension mismatch、Wave109 final integration欠落、`contentInset` schema重複は未解消の evidence/documentation debt（05:116,124–127）。
- Electron portable dead branches と metadata warning、Soul README/JSDoc/endpoint count stale は非ブロッキングの hygiene debt（07:107–108、08:143–147）。
- Human/product/legal gates（実機、rights、Expo受理等）はコード赤ではないが、該当トラックの受入をブロックする未完了証拠である（01:108–118、09:169–178）。

### Environment / verification constraints (not source reds)

- Windows esbuild/Vitest/Electron child-process `spawn EPERM` は sandbox/実行環境制約。Runtime Player等の escalated rerun pass と区別する（04:158–161、05:155–156、07:104–110）。
- `check-soul-zone-boundary-fixtures.mjs` の child-process spawn limitation は、直接 source guard PASS と分ける（01:119）。
- Soul `npm test` の53-file worker runner起動不能は、worker-free import 389/389 と別の環境制約である（08:154,164,188–190）。
- 外部Web/event/portal、iPhone/iFacialMocap、OBS/CEF、GPU/readPixels、実印刷をこのrefreshで再実行していない。これは「未検証」であり、失敗を意味しない（04:158–160、06:197–200、09:219–221）。
- 並行E2Eで一時生成された `apps/editor/test-results/**` は所有者が復元済みで、Git timeline report は durable finding なしの PASS としている（10:12–13、10:122–123）。

## 7. Candidate next work — dependency/authority ledger (no priority)

下表は上記候補を実行可能な単位へ言い換えたもの。「依存」は前提条件、「authority/decision」は着手または受入を許可できる主体であり、順序や推奨度を示さない。

| Candidate work | Dependencies | Required authority / decision | Completion evidence (not assumed) |
|---|---|---|---|
| Domain-09 traceability record | v3 design/source、旧AC/Scenario diff | Requirements/product ownerの表現承認 | AC/Scenarioとv3 semanticsのリンク/レビュー記録 |
| Demo-safe fixture/capture/preflight | rights/provenance、fixture、disclaimer範囲 | Rights/legal + product owner | allow/block report、redaction、reviewer、capture scope |
| Proposal target/draft/review | target/scope、preflighted material | User/product + proposal submitter/recipient | target-specific draft と review artifact |
| Future Public Clean Subset（必要時のみ） | separate scope/rights/dependency review | Userの着手判断 | standalone scope/rights review |
| Real Runtime Player/W21/W22/W23/OBS/device pass | real model/device/OBS、packaged lifecycle | Runtime/model owner + device operator | dated manual/device checklist、parity/reset/vowel observations |
| PNG re-cert / sidecar portability | current post-45d bytes、portable path policy | Model-authoring quality owner | current-byte approval/rejection、portable sidecar evidence |
| Mesh/render/Atlas/GPU/Canvas decision | declared GPU target、pixel fixture、v6/v7 criteria | Render/quality owner | pixel/visual report、quality/toggle/sunset decision |
| Editor/Electron debt repair | current source/tsconfig、E2E fixture precondition | Editor/Electron/runtime source owners | typecheck/unit/E2E/guard rerun with final counts |
| Wave109 closeout/schema ownership | wave closeout policy、package owners | Implementation owner | final integration report or explicit partial-evidence decision |
| AI S8/brain/memory/persona acceptance | real TTS/mic/credentials/privacy operation | AI operator + product/privacy owner | safety, no-regression, privacy, voice/persona sign-off |
| Expo acceptance/proof print/rights | external acceptance, print access, asset permission | Event organizer/submitter + rights/print owner | acceptance notice, proof-print readability, rights manifest |
| Cubism archive review | permission/legal/scope review | Rights/legal + user scope owner | dated restart decision; historical label retained |
| Optional C7/profiler/real-model-003 experiments | explicit reopen request, target hardware/protocol | User/performance owner | objective capture with provenance; no product re-exposure |

## 8. Evidence index

| Source | Evidence used |
|---|---|
| `audit-contract.md:1–5` | 分離規則、必須11節、調査のみ、historical/current/acceptance 境界 |
| `01-product-policy.md:104–129` | product/legal gates、Preflight非昇格、fixture harness制約、候補 |
| `02-editor-current-capabilities.md:121–154` | Editor debts、human/device/product gates、W102/Bezier/mesh decisions |
| `03-editor-development-history.md:104–125` | W51–55/W56/W101/W109 historical asymmetry、W102 stop候補 |
| `04-runtime-player-and-broadcast.md:116–138` | Runtime Player human/device gates、transport debt、candidate checks |
| `05-model-authoring-and-mesh.md:115–136` | PNG/strict-ref/vowel/v6-v7/Atlas/W109/craft gates |
| `06-render-dynamics-performance.md:132–151` | GPU/pixel/Atlas/Canvas/C7/profiler/real-model optional boundaries |
| `07-electron-distribution-repo-health.md:102–120` | E2E/typecheck/source/dead branch/metadata red and candidate repairs |
| `08-ai-cohost-and-soul.md:132–164` | S8/brain/memory/persona/ToS/stale docs/EPERM |
| `09-expo-public-surfaces-archives.md:169–198` | Expo acceptance/proof print/rights/demo/proposal/archive gates |
| `10-git-timeline-worktree.md:93–101,122–123` | root unresolved index、候補入口、transient E2E churn closure |

## 9. Limitations

- 本reportは01–10の一次記録を統合したもので、新しいsource/test/browser/device/OBS/legal/external verificationは実施していない。
- 一次報告間でEditor error countが `23 error lines` と `21 errors` に揺れるため、数字を統合せず両方を記録した。修正担当は再実行で確定する。
- 未決項目は受入主体・依存・候補として整理しただけで、優先順位、採否、Wave再開、scope、legal conclusion を決めていない。
- Historical Wave、focused pass、synthetic measurement、workbench noteは、current product/human/legal/external acceptanceへ昇格させていない。
- 外部受理・権利・ToS、実機/印刷/GPU/OBS/AI運用の未検証は、障害の存在ではなく検証欠如として扱った。

## 10. Final review

**Verdict: PASS（0 report-blocking findings、0 report-nonblocking correction findings、0 semantic contradictions）。** Open-gate rows are 39 in total（A user/product 8、B human/device 8、C legal/rights 5、D technical debt 9、E optional experiment 5、F external acceptance 4）；これは各trackの未完了状態であり、本reportの不備件数ではない。Known-red groups は6、environment/verification constraints は5として §6 に分離した。

未決gateはトラック別に owner/依存/authority を保持し、accepted decision と candidate、known red と environment constraint、historical evidence と current fact を分離した。Technical debt・human/device・legal/external gate の未完了は、各受入に対する open gate であって、この統合reportの不備ではない。
