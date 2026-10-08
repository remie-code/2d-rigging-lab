# Workspace Activity Refresh — History Integration

基準日: 2026-08-08 (Asia/Tokyo)。現在の `HEAD` は `af5839452f0968a005cb6cd13c62b714aa4e6d4e` (`docs: refresh discussion maps`)。本報告は `workspace-activity-refresh/audit-contract.md`、`discussion/_conventions.md`、`discussion/_map.md` を先に読み、一次報告 `01-product-policy.md` 〜 `10-git-timeline-worktree.md` を主入力として、活動を意味のあるフェーズへ圧縮した統合である。既存 map/source/test/report は変更していない。

## 1. Scope / inspected entry points

一次報告の担当範囲を重複なく統合した。

- Product / policy / requirements / demo / proposal: `01-product-policy.md`
- Editor 現行能力: `02-editor-current-capabilities.md`
- Editor 開発史・W0–109: `03-editor-development-history.md`
- Runtime Player / Browser Source / OBS: `04-runtime-player-and-broadcast.md`
- Model-authoring / mesh / authoring-host: `05-model-authoring-and-mesh.md`
- Render / dynamics / atlas / performance: `06-render-dynamics-performance.md`
- Electron / packaging / repository health: `07-electron-distribution-repo-health.md`
- AI Cohost / `apps/soul`: `08-ai-cohost-and-soul.md`
- Expo / public surfaces / research archives: `09-expo-public-surfaces-archives.md`
- Git chronology / branch / worktree: `10-git-timeline-worktree.md`

current repository fact、accepted user/design decision、historical evidence、experiment/manual observation、inference、unresolved human/device/legal gateを混同しない。Wave report の `pass` はその時点の実装・レビュー証拠としてのみ扱い、製品・視覚・実機・法務受入とは分離した。

## 2. Executive summary

1. **出発点は契約先行だった。** 2026-05 の Private Prototype への方針転換と source-of-truth / operation / evidence 規約が、その後の Editor・Runtime・AI 境界を決めた（`129e292`、`121da75`、`01-product-policy.md` §2, §5）。
2. **Editor は contract-first の vertical slice から再構成された。** 初期実装で package/DTO/validator/operation/persistence と明示的な authoring loop を作り、PSD・AI・dynamics は deterministic operation/approval/evidence の境界内に置いた（`03-editor-development-history.md` §3, §7）。
3. **W51–57 は機能追加ではなく履歴の断層である。** W51–55 は purge/Git-history-only、W56 は abandoned、W57 React foundation が reset 後の基盤になった。W58以後を旧GUIの連続として読まない（`99a31c8`、`03-editor-development-history.md` §3 D/E）。
4. **Editor mainline の計画停止と後続コード活動は両立する。** `d2e7b7e` (2026-06-24) は W102 到達の技術的節目、root map は後日のユーザー決定を 2026-07-02 の mainline planning stop と記録する。W103–109 は bounded specialized evidence であり、存在だけでは mainline 再開を意味しない（`02-editor-current-capabilities.md` §5、`03-editor-development-history.md` §4-5）。
5. **停止後は複数トラックが並行した。** authoring-host/model craft、Runtime Player/dynamics/lipsync、mesh/render/atlas/perf、Electron migration、AI Cohost/Soul、Expo が別 owner・別 gate で進み、後続 commit は一つの「Editor再開」系列ではない。
6. **Runtime Player は配信の別製品面として成熟した。** Browser Source loopback HTTP/WS を主経路、Native Stage をローカル fallback とし、W13–19 の fast path/cadence/diagnostics、W22/23 の vowel semantics を実装した。現行 package typecheck と 140 files / 925 tests は緑だが、OBS/iFacialMocap/real vowel/device gate は未完（`04-runtime-player-and-broadcast.md` §2, §7-8）。
7. **Model/mesh/render/perf は技術契約と人間品質を分離した。** authoring-host 装備、v6d default + v7 comparison、Skyline/Option E、Dynamics v3、Editor Perf Wave 2 は実装・測定 evidence がある一方、PNG再認証、v6/v7品質、GPU/pixel、AtlasRuntime、C7負荷は未裁定（`05-model-authoring-and-mesh.md` §2、`06-render-dynamics-performance.md` §2）。
8. **Electron/AI/Expo は完了した器と残る運用 gateを併記する。** Electron WS1–WS4/packaging は実装済みだが Editor typecheck/unit/E2E debt が残る。C1–C7/S1–S8 と `apps/soul` 特区は実装済みだが safety/brain/memory/persona の human gate が残る。Expo は6面HTML+6面A2 PDFが完成したが採択・権利・試し刷りは外部未検証（`07-electron-distribution-repo-health.md` §2、`08-ai-cohost-and-soul.md` §2、`09-expo-public-surfaces-archives.md` §2）。
9. **2026-08-08 の最新活動は実装ではなく map refresh である。** `af58394` は162 files、+6,138/−437のdocumentation/map commitで、直近の製品/source commitではない。Git上で以後の製品活動がないことは、外部・未コミット活動がないことを証明しない（`10-git-timeline-worktree.md` §2, §7）。

## 3. What was built or investigated

### 3.1 契約・製品境界

Private 2D Rigging Lab / Prototype を主目的とし、Private Prototype、Streaming Demo Surface、Live2D Feature Proposal、Future Public Clean Subset の4トラックを分離した。Cubism形式/SDK/Core/既存モデル/第三者素材の互換・解析・変換は対象外で、AC/scenario は要求・合否、design/module contract は実装意味論、test/review は証拠、reports は歴史・リスク文脈を担当する。この役割分担が、後の `dynamics-file-v3`、Demo preflight、AI特区、Expoの公開境界を一つの製品仕様へ混ぜないための基礎になった（`01-product-policy.md` §2-5）。

### 3.2 Editor capability と開発経路

現行 Editor は Electron の authoring-to-viewer prototype で、workspace gate、PSDの明示承認付き scaffold/materialization、Part/Drawable tree、mesh、Rotation/Warp、parameters/keyforms、mask/visibility/variant、Diagnostics、Skyline Atlas、Viewer、Runtime Export の route を持つ。Canvas は `CanvasEvaluatedScene` → RenderScene → WebGL2 primary / Canvas2D fallback の境界で、Dynamics は `dynamics-file-v3` / `worldFrameChainV1` を owner とする。これは source の現行能力であり、GPU/pixel、visual UX、外部 player parity、human acceptance を自動的に閉じない（`02-editor-current-capabilities.md` §2-4）。

### 3.3 Runtime Player / broadcast

Runtime Export directory を検証して Control/Native Stage/Browser Source へ fan-outし、raw tracking ではなく sanitized parameter frames を越境させる。Browser Source は tokenized loopback HTTP/WebSocket の accepted primary path、Native Stage は local preview/fallback。iFacialMocap UDP、Stage Motion、Variant、runtime-only Dynamics Tune、compiled evaluator、latest-wins/rAF、lightweight diagnostics、W22/23 lipsync は source/test evidence にあるが、実端末・OBS・実モデルの受入は別 gate である（`04-runtime-player-and-broadcast.md` §3-4, §6）。

### 3.4 Model-authoring / mesh / render / performance

Wave103–105 の authoring-host は one-shot CLI、dry-run approval、live-session render/measurement/validate、pure TypeScript software rasterizer を揃えた。Fable closed problems 01–19 と craft second cycle/third-run は完了記録があるが、次 scope は自動予約されない。Mesh の current technical route は v6d adaptive default + v7 comparison toggle、Wave108/109 は非clamp UV、transparent margin、`contentInset`→`uvRect`、LINEAR と preflight helper を接続した。Render 側では Canvas evaluation/WebGL2 foundation、Skyline、Dynamics v3、Editor Perf Wave 2 と Runtime Player W13–19 の性能基盤を照合した（`05-model-authoring-and-mesh.md` §3-5、`06-render-dynamics-performance.md` §2-7）。

### 3.5 Electron / AI / Expo

Electron は shell → node:fs/IPC → Web retirement/E2E → electron-builder portable x64 の順で WS1–WS4 を閉じた。AI Cohost は C1–C7 の器を閉じ、S1–S8、brain-swap、reading/interjection、stream-memory を `apps/soul` の独立 package へ積み上げた。Expo は成果物ベースに絞り、6つのHTMLと6つのA2 PDFを凍結した。いずれも実装/成果物の存在と human/legal/device gate を別に記録する（`07-electron-distribution-repo-health.md` §3-5、`08-ai-cohost-and-soul.md` §3-5、`09-expo-public-surfaces-archives.md` §2-6）。

## 4. Current repository state

### Repository facts

| 領域 | 現在の事実 | 読み方 |
|---|---|---|
| Git/worktree | branch `feature/2d-rigging-eco-system`、HEAD `af58394`、local `origin` 比較 `4 ahead / 0 behind`、staged/conflictなし（取得時点） | remote fetch結果ではなく既存local refとの比較。 |
| Product contract | Private baseline/4 tracks、Cubism non-compat、source-of-truth分離 | accepted policy; current implementationの完了宣言ではない。 |
| Editor | Electron routes、PSD bounded import、mesh/rig/keyform/dynamics/atlas/variant/viewer/export が source に存在 | capability fact; GPU/visual/device gateは未閉鎖。 |
| Runtime Player | Electron Control+Stage、Browser Source primary、typecheck exit 0、140 files / 925 tests pass | deterministic evidence; OBS/iFacialMocap/real vowel acceptanceは別。 |
| Model/mesh | authoring-host装備、v6d default/v7 toggle、Wave108/109 contract、PNG/sidecar artifact | implementation/experiment evidence; current PNG approvalとquality holdは別。 |
| Render/perf | WebGL2 primary/Canvas2D fallback、Skyline、dynamics v3、Editor Perf Wave2 close、Player W13–19 fast path | Node/synthetic/manual evidenceはGPU/60fps guaranteeではない。 |
| Electron | build/packaging artifactあり、Runtime Player build green; Editor package typecheck は red（`02` は **23 error lines**、`07` は **21 diagnostics/errors** と別集計で記録）、unit 4 stale failures、PSD E2E precondition debt | 件数差は測定・集計表現の差であり、共通の current conclusion は「Editor typecheck red」。migration capability complete と repo quality debt を分離。 |
| AI/Soul | C1–C7/S1–S8 code、4-brain registry、memory/kill/interjectionの器 | S8 kill、brain, memory, persona/voice, ToS/privacy gateは未完。 |
| Expo/archive | 6 HTML + 6 A2 PDF、historical reportsはcurrent ownerへrouting | acceptance/display rights/proof printは外部未検証。 |

### Worktree ownership

`10-git-timeline-worktree.md` が記録した `.codex/agents/*` の変更、context-check skill、`discussion/expo.zip`、並行refresh reportsは既存/別担当の変更である。E2E中間生成物はElectron ownerが復元し、最終確認では `apps/editor/test-results` に残留なし。今回の所有ファイル以外を編集・stage・commitしていない。

## 5. Accepted decisions and boundaries

1. **Product:** Private Prototypeを主対象とし、Demo/Proposal/Public subset/Expoを別trackにする。Demo/Proposal/Expoに内部形式・互換・法的安全性を持ち込まない。
2. **Source of truth:** AC/scenario = requirement/acceptance、design/module contract = implementation semantics、tests/reviews = evidence、research/reports = historical/risk context。古いreportやWave plan見出しを現行仕様に昇格しない。
3. **Editor planning:** `d2e7b7e` は W102 到達の技術的節目、root mapが記録する 2026-07-02 の決定は Editor mainline planning stop。W103–109 は specialized evidenceとして扱う。
4. **Runtime:** Browser Source loopback/WSがbroadcast primary、Native Stageがlocal fallback。product deep profilerを再公開せず、W21/22/23の手動・実機 gateをsource passと分離する。
5. **Dynamics/render:** `dynamics-file-v3` world-frame chainはW81-era scalar/additive設計を置換した現行semantics。Wave108 Option E/Wave109 helper、Skyline、WebGL2 foundationは技術契約であり、mesh qualityやGPU/pixel acceptanceの勝敗ではない。
6. **Mesh/model:** v6d default + v7 comparison toggle、Fable authoring host deterministic path、closed problems complete。v6 deletion/Wave2、PNG再認証、次closed-problemはuser gate/decision。
7. **Electron:** WS1–WS4/packagingは実装完了。Editor typecheck/unit/E2E、source guard、portable dead branch、metadata warningは別のquality/debtとして残る。
8. **AI:** `apps/soul`だけがLLM/知覚特区。器↔魂のコードimportは禁止し、契約越しに接続する。C/S implementation passとS8/brain/memory/persona human gateを分離する。
9. **Expo/archive:** HTML/PDF完成はrepo fact。採択、display rights、proof print、Cubism archive restartは外部/法務/ユーザー判断で、repoから推定しない。

## 6. Verification and experiment evidence

### Refresh / current checks recorded by primary reports

- Root `typecheck`、dependency guard、soul-zone guardはpass。`check:source`は既存 `apps/runtime-player/src/main/physiology/index.ts` barrel違反でfail（Electron不具合とは別）。
- Editor focused package testsは16 files / 211 tests pass、Electron renderer buildはpass。Editor package typecheckは red（`02-editor-current-capabilities.md` が23 error lines、`07-electron-distribution-repo-health.md` が21 diagnostics/errorsとして記録し、同一実行の粒度差を示す）、unitは62 files中1 fileが4件失敗、PSD E2Eはworkspace/native-picker前提不足でtimeout。root package suite、Runtime Player typecheck/unit（140 files / 925 tests）は別に緑。
- Soulの通常 `npm test` はworker `spawn EPERM`でassertion前に停止したが、worker-free import方式は選択10 module 389/389 pass。full-suite passへ昇格しない。
- Model/mesh refreshはroot typecheck/deps pass、source guardは上記barrel違反、対象VitestはWindows esbuild `spawn EPERM`でcollection前に停止。Wave103–109の既存report countsはhistorical evidence。

### Measurements / artifact checks

- Editor real-model-002 は92 evaluations、127.2 ms/eval、`artworkBoundsAndAssembly` 75.8%、`deformerVertex` 17%、WebGL mesh uploads 1,610 / `bufferData` 3,220。Perf Wave2 synthetic後はmedium 1.782 ms、heavy 20.329 ms、rigHeavy 10.616 msまで改善したが、Node harnessはGPU/mask/submitを測らない。
- Runtime Player logsはNative applied/render 50.4、Browser Source 40.1/56.7などの観測を記録するが、platform/OBS provenance、subjective smoothness、universal 60fpsを証明しない。C7二体負荷は未計測。
- Expoは6 HTML・6 PDF・14 PNG、HTML A2 CSS、PDF各1 page/MediaBox A2相当を検証。acceptance、rights manifest、proof print、public permissionは未検証。
- Git reviewはHEAD scope 162 files、+6,138/−437、staged/conflictなしを確認。これはdocumentation/map refreshの事実であり、製品実装の追加を意味しない。

## 7. Historical progression / turning points

### Phase timeline (Wave lists are intentionally compressed)

| Phase / approximate date | Major anchors | What changed | Parallelism / boundary |
|---|---|---|---|
| 1. Concept and convention baseline (2026-05-25–06-06) | `8e6fb4f`, `f3af512`, `755e751`, `129e292` (05-27), `121da75` (05-28), Codex policy record (06-06) | Public-ecosystem assumptions were replaced by Private Prototype; source-of-truth, deterministic operation, evidence, demo/proposal hygiene were externalized. | Product policy led; no later implementation claim is inferred from this phase. |
| 2. Contract-first Editor vertical slice (early Editor history) | `8304709`→`7782ada`; initial contract/operation/persistence reports | Package/DTO/validator/runtime evidence, explicit operation/approval, save/load and first authoring loop were established. | Editor was the mainline; AI input remained dry-run/approval only. |
| 3. Runtime/AI/PSD/dynamics expansion (middle Editor history) | `a2c114c`→`c9933fd`; `cacbe58`→`b9c7ec6`; orchestration records for the early runtime/PSD periods | Keyform/runtime preview, drawable/mesh, PSD bounded import, Minimum Open Dynamics, Viewer, rig/mask/tree and explicit evidence grew around the contract-first core. | Semantic inference, auto-rigging, Cubism compatibility and external transport stayed out of scope. |
| 4. Intake/preflight then reset (later middle history) | `0f66aef`→`c705918`; purge `99a31c8`; abandoned W56; React foundation `ae02025` and follow-ups | Byte intake, preflight, portable/storage boundaries and explicit PSD leaf/group/subtree import were explored; W51–55 were then purged, W56 abandoned, and W57 became a new React foundation. | This is a discontinuity, not a linear UI migration. |
| 5. Rebuilt Editor surface and authoring-to-viewer loop | `43c1c30`→`73bd313`, `49a0510`, `6b38eeb`, `16294d4` and the W58–92 evidence set | Canvas/Parts/Mesh/Deformer/Keyform/Viewer/Dynamics/Diagnostics/Atlas/Workspace/Runtime Export accumulated. Mesh candidate exploration converged toward v6D lineage; Editor meanings were carried to Viewer/Export. | WebGL/pixel/device gates remained separate from implementation pass. |
| 6. Mainline hardening and stop (W93–102 period) | history/perf/variant/atlas evidence; `d2e7b7e` (06-24) | Binary history pressure, nested Warp, atlas cache, idle/perf instrumentation, Variant/Expression/Viewer and Skyline/`baseVisible` were consolidated. `d2e7b7e` records W102 technical arrival; root map records explicit planning stop on 2026-07-02. | The stop is a planning/product boundary, not a claim that later commits cannot touch Editor files. |
| 7. Specialized tracks and parallel activity (2026-07-02–07-26) | see stream table below | Authoring-host/model craft, Runtime Player/dynamics/lipsync, mesh/render/atlas/perf, Electron, AI/Soul and Expo each advanced under separate evidence/gates. | Post-102 commits must be classified by path/scope, not merged into one implicit Editor mainline. |
| 8. Documentation/map refresh (2026-08-08) | `af58394` | Current owners, historical evidence, current gates and worktree boundaries were re-indexed. | Documentation activity; no product/source commit follows in local history. |

### Phase 7 parallel stream table

| Stream | Major commits / dates | Activity and turning point |
|---|---|---|
| Model-authoring / authoring-host | `2f80ca0` (07-02), `6645c2f` + `1f07270` (07-03), craft through 07-17, `45d2734` (07-26) | Render/measurement/validate equipment and Fable closed-problem/craft evidence matured. Post-45d PNG bytes require separate human re-certification. |
| Dynamics / Runtime Player | `356959c` (07-05), `19006ac` (07-06), `d9801d0` (07-12) | Dynamics v3 replaced additive/scalar history; W22/23 vowel semantics and current 925-test baseline were repaired. Real-device gates remain. |
| Mesh / render / atlas / perf | `04e24cd` (07-07), `70485f4` (07-10), `8640d12` (07-12), `899cb2e` (07-14), plus Perf Wave2/Player W13–19 evidence | v6/v7 comparison, Option E non-clamp/contentInset/LINEAR, PSD remap, shared `uvRect` preflight, and cadence/perf work converged without reopening mainline planning. |
| Electron / distribution | `d9f3f1d`, `4dde084`, `e9113ab`, `d1b2348` (07-08), `2ef467f` (07-10) | WS1 shell, WS2 fs/IPC, WS3/4 Web retirement + `_electron`, portable packaging and icon were closed; package debt remains independent. |
| AI Cohost / Soul | `140fb63` (07-11), `8bcc1aa` (07-12), `307a923` (07-18), `a5e2d07` (07-19) | C4 boundary/`apps/soul` special zone, C7 vessel closure, reading/interjection and stream-memory were added. Safety/privacy/brain/persona human gates remain. |
| Expo / public surfaces | `a3335f1` (07-25), `0a89c45`, `1ed12b2`, `cd693ea`, `3c3669e` (07-26) | Outcome-centered basis, six HTML/A2 PDF surfaces, wording pass and obsolete-draft removal froze the exhibit pending acceptance/proof print. |

## 8. Open gates, debts, and uncertainties

- **Product/traceability:** Domain-09 AC/scenario still need a user-owned decision on how to show Dynamics v3/profile-v2 cardinality without changing requirement ownership. Demo rights-clean fixture, final disclaimer/UI wording, preflight evidence, proposal target, Future Public Clean Subset and Cubism archive restart remain open.
- **Editor/render:** Editor typecheck and stale Diagnostics assertion; PSD/Electron E2E workspace/picker precondition; real WebGL/readPixels/pixel parity; Canvas2D sunset; AtlasRuntime visual; Runtime Export external-player parity; Warp Bezier runtime semantics.
- **Performance:** Editor synthetic/real measurements do not cover GPU/mask/compositor. C7 two-instance load is an unmeasured optional experiment; no product deep profiler or universal 60fps contract is accepted.
- **Runtime Player:** W21 Domain C persistence/reset/isolation/artifact checks, packaged lifecycle smoke, OBS/Browser Source provenance/alpha/WebGL2/model parity, iFacialMocap and W22/23 vowel-rig checks remain device/product gates.
- **Model/mesh:** post-`45d2734` PNG approval, sidecar portability/strict-ref errors, next closed-problem scope, v6/v7 quality/toggle/Wave2 decision, GPU/pixel/Canvas sunset and formal Wave108 acceptance remain unresolved.
- **Electron/repo health:** Editor typecheck red（一次報告の測定表現は23 error lines / 21 diagnostics-errorsで一致しないが、赤判定は一致）、four stale unit expectations、PSD E2E timeout、physiology barrel `check:source` failure、portable dead branches and packaging metadata warning are separate debt decisions.
- **AI/Soul:** S8 kill/restore/no-regression, brain-swap rollout/quality, stream-memory privacy/OFF/auto-load, persona/S9 voice, YouTube innertube ToS/product adoption and AI disclosure remain human/legal/operations gates. `apps/soul` exception does not relax the external boundary for other paths.
- **Expo/archive:** individual acceptance, proof-print readability, display rights/asset provenance, public wording and any Cubism archive restart permission are external or legal state, not inferable from files.
- **History/index:** W51–55 are intentional Git-history-only loss, W56 has no standalone final, W101 plan headers can say Planned while leaf closeout is pass, and W109 has Domain-A partial evidence without wave-level final integration. These are evidence-shape caveats, not missing implementation claims.

## 9. Candidate next work (facts-derived, not recommendations)

1. Record whether the Wave102 planning stop remains the desired product boundary and how W103–109 specialized evidence should be indexed relative to it.
2. Update Domain-09 traceability after user agreement, keeping AC/scenario requirements separate from Dynamics v3/module semantics.
3. Run the explicitly documented human/device/legal gates by owner: Runtime Player, model/mesh/render, Electron GUI/E2E, AI safety/privacy/operations and Expo acceptance/rights/proof print.
4. Classify Editor quality debt (typecheck/unit/E2E/source guard), without treating package capability presence as acceptance.
5. Decide whether to produce formal closeout evidence for Wave109 and AtlasRuntime/GPU/pixel checks, or retain partial/historical indexes.
6. If needed, refresh stale README/header/plan prose and archive links only after the owning policy/design decision; do not infer new product scope from historical reports.

## 10. Evidence index

| Evidence | Role in this integration |
|---|---|
| `workspace-activity-refresh/audit-contract.md` | Required sections, evidence taxonomy, no-edit/no-commit rule, historical/current separation. |
| `01-product-policy.md` | Product baseline, four tracks, source-of-truth policy, Dynamics v3 boundary, policy turning points and product gates. |
| `02-editor-current-capabilities.md` | Current Editor routes, PSD/Canvas/mesh/rig/dynamics/atlas/Viewer/export capabilities and focused verification. |
| `03-editor-development-history.md` | Compressed W0–109 development periods, reset, v6D, mainline stop and specialized evidence interpretation. |
| `04-runtime-player-and-broadcast.md` | Browser Source/Native Stage architecture, W13–23 progression, 925-test baseline, objective captures and real-device gates. |
| `05-model-authoring-and-mesh.md` | Authoring-host/craft status, v6/v7, Option E/Wave109, PNG/sidecar gate, model/mesh chronology. |
| `06-render-dynamics-performance.md` | Current render/dynamics/atlas contracts, Editor/Player measurements, deep-profile boundary and GPU/device gates. |
| `07-electron-distribution-repo-health.md` | Electron WS1–WS4/packaging history, command results, E2E/typecheck/unit/source debt and worktree integrity. |
| `08-ai-cohost-and-soul.md` | C1–C7/S1–S8 progression, `apps/soul` special zone, brain/memory/reading and safety/privacy gates. |
| `09-expo-public-surfaces-archives.md` | Six-sheet/PDF production, four-track public boundaries, archive ownership and external/rights gates. |
| `10-git-timeline-worktree.md` | HEAD/branch/worktree facts, commit chronology, map-refresh activity inference and final restoration check. |
| `git show -s --format='%h %ad %s' --date=short <major commit>` | Date/subject verification for `129e292`, `d2e7b7e`, `356959c`, `140fb63`, `8bcc1aa`, `04e24cd`, `d9f3f1d`, `70485f4`, `8640d12`, `899cb2e`, `307a923`, `a5e2d07`, `45d2734`, `3c3669e`, `af58394`. |
| Current source/test/command evidence cited by §§3–6 | Repository facts and experiment results; not substituted for human/device/legal acceptance. |

## 11. Limitations

- This is a synthesis of the ten primary reports, not a new full-repository implementation audit. No source, test, map, config, browser, GPU, device, OBS, external service or legal system was rerun by this integration agent.
- Historical commit subjects, Wave reports and review counts are evidence snapshots. Current source and latest accepted decisions take precedence for repository facts; implementation pass never implies human acceptance.
- `d2e7b7e` (2026-06-24 technical W102 arrival) and the root map's 2026-07-02 user planning-stop record are intentionally retained as different event types, not collapsed into one date.
- `af58394` is documentation/map refresh; the local remote comparison is against an existing ref and no fetch was performed. The absence of later product commits does not prove absence of external or uncommitted work.
- Worktree artifacts from parallel agents are preserved and interpreted by owner; this report does not claim ownership of `.codex/**`, `discussion/expo.zip`, or other reports.

## 12. Final consistency review

| Check | Result | Note |
|---|---|---|
| Current vs historical | **PASS** | Wave ranges are compressed; W51–55 purge, W56 abandoned, W101 planned-header, W109 partial and post-102 specialized evidence are time-qualified. |
| Implementation vs human/device/legal gate | **PASS** | Runtime Player, model/mesh/render, Electron, AI and Expo gates are listed separately from source/test pass. |
| Accepted decision vs inference | **PASS** | Wave102 stop, four-track boundary, Browser Source primary, `apps/soul` exception and non-compat policy are cited as recorded decisions; “activity moved to docs” is labeled Git-based inference. |
| Date/commit ordering | **PASS** | Major commits are ordered by the primary reports and Git subjects; W102 technical milestone vs July user stop is explicitly reconciled. |
| Topic coverage | **PASS** | Runtime, Model, Mesh, Perf, Electron, AI/Soul, Expo/archive and product policy are all represented, including parallel ownership. |
| Remaining corrections | **NEEDS FIX (nonblocking, owner-directed)** | Future map/prose updates may be needed for stale headers, W109 closeout shape, source debt and human gates; no correction is authorized by this report. |

**Overall integration verdict: PASS with nonblocking owner-directed follow-ups.**
