# Workspace Activity Refresh — Current-State Integration

> 基準日: 2026-08-08 (Asia/Tokyo)。調査時 `HEAD=af5839452f0968a005cb6cd13c62b714aa4e6d4e` (`docs: refresh discussion maps`)。一次報告 `01`–`10` と `audit-contract.md` を主入力に、重複を除いて「実装済み」「検証済み」「停止/進行中」「外部未確認」を分離した統合である。source、test、map、既存report、生成物は変更していない。

## 1. Scope / inspected entry points

- 必須入力: `discussion/reports/workspace-activity-refresh/audit-contract.md`、一次報告 `01-product-policy.md` ～ `10-git-timeline-worktree.md`。
- 統合対象: product/scope、Editor能力・開発史、Runtime Player/broadcast、model-authoring/mesh、render/dynamics/performance、Electron/distribution、AI-cohost/Soul、Expo/public/archive、Git/worktree。
- 一次報告間の差分（Editor typecheck error count、Runtime Player build の再実行範囲など）は原典へ無制限に戻らず、報告が示す証拠種別と限定を併記して裁定した。
- このreportだけを `apply_patch` で作成した。stage/commitは行っていない。

## 2. Executive summary

1. **製品の正:** `Private 2D Rigging Lab / Prototype` と `Private Authoring-to-Viewer Prototype` が主目的で、Private Prototype / Streaming Demo Surface / Live2D Feature Proposal / Future Public Clean Subset の4トラックを分離する。Cubism形式・SDK/Core・既存Cubismモデル・第三者素材の互換/解析/再構築は現行境界外（01）。
2. **Editorの現行能力:** Electron authoring-to-viewer shell、PSDの明示承認付きmaterialized layer取り込み、Part/Drawable・mesh・Rotation/Warp・parameter/keyform・mask/visibility・variant、WebGL2/Canvas2D境界、Diagnostics、Atlas、Viewer、Runtime Exportのsource経路が存在する（02）。実装存在はvisual/device/product受入ではない。
3. **Editor計画境界:** Wave102がEditor mainlineのaccepted planning stop。W103–109はauthoring-host、dynamics-v3、Runtime Player lipsync、mesh/render/export契約のbounded specialized evidenceであり、後続commitの存在だけではmainlineを再開しない（01,03,05,06）。
4. **Runtime Player:** Electron Control + transparent model-only Stage、Runtime Export、loopback tokenized Browser Source、Native Stage fallback、iFacialMocap UDP、sanitized parameter frames、W22/W23 vowel mappingまで実装されている。typecheckと140 files/925 testsはpassだが、real device/OBS/packaged lifecycle/W21 Domain C/real speech gatesは未確認（04,07）。
5. **Model/mesh/render/dynamics:** authoring-host/software rasterizer/measurement/validationと閉問題01–19・craft cyclesはrepository evidence上pass。v6D default + v7 comparison toggleの品質hold、post-`45d2734` PNG再認証、strict-ref/sidecar portability、W108/109 atlas/contentInset/uvRect契約のvisual/device gateは未完了（05,06）。`dynamics-file-v3`/`worldFrameChainV1`は現行意味論であり、Wave81 v2はhistorical（01,06）。
6. **性能/描画:** Editor Perf Wave2はEditor interaction scopeでaccepted close、Runtime Player W13–19のcache/compiled fast path/diagnostics/cadenceはimplementation pass。GPU/readPixels/pixel parity、Canvas2D sunset、AtlasRuntime visual、optional C7二体負荷は未計測・未裁定。Product deep profilerは再導入しない（04,06）。
7. **Electron/repo health:** Editor WS1–WS4とelectron-builder portable packagingは完了。Editor renderer buildはescalated runでpassだが、package typecheck（一次報告間で21–23 error linesの差）、unitの4 stale navigation assertions、PSD E2E timeout、portable dead branch、metadata warning、source guardのbarrel violationは残債（07,02）。
8. **AI/Soul:** C1–C7の器は閉鎖、S1–S8とreading/interjection/brain/stream-memoryは実装・機械evidenceが進行/完了。S8 kill、brain運用、memory privacy/OFF、persona/S9 voice、S7 innertube ToS/運用はhuman/product/legal gate。LLM/知覚は`apps/soul`特区内のみ許可（08,01）。
9. **Expo/public/archive:** 6 HTML + 6 A2 one-page PDFはrepo artifactとして完成。採択/公開許諾はexternal-unverified、proof print/rights manifest/demo preflight/proposal targetは未確認。Cubism/旧性能資料はhistorical archiveで、現行ownerではない（09,01）。
10. **現在地のGit:** branch `feature/2d-rigging-eco-system`、local remote比較は4 ahead/0 behind、最新commitはmap/report refresh。Git上にHEAD後のproduct/source commitはなく、共有worktreeの並行audit/config/zipは製品活動と混同しない（10）。

## 3. What was built or investigated

### Product, contracts, and boundaries

- Root/concept/AC/scenario、Demo/Proposal Hygiene、source-of-truth policy、Product Preflight（10 categories、`pass` と `not_evaluated`/`not_supported` を区別）を現行の責務分離として確認した（01）。
- Editor/repoはsemantic PSD分類、proposal生成、auto-rigging、LLM/provider埋込みを行わず、外部Codex/LLMからの明示operationをdeterministic API・dry-run・diff・validation・approval・evidenceで受ける（01,02）。
- `dynamics-file-v3` は world-frame Verlet chain、segment N≥1、multiple outputs、`worldFrameChainV1`、RuntimeState/sequence evidenceを持つ破壊的置換として実装されている。AC/scenario本文の旧scalar/one-output wordingはtraceability gate（01,06）。

### Editor authoring-to-viewer surface

- Electron shell/routes、workspace filesystem bridge、PSD planner/commit、ordered Part/Drawable tree、mesh/rig/keyform/dynamics editors、Canvas evaluation/projection、WebGL2→Canvas2D fallback、Diagnostics、single-page Skyline atlas、Variants、Viewer、Runtime Export taskをsource上で確認した（02,07）。
- PSDはcap/metadata/digest/review/explicit approval/materialized bytesまでで、raw parser object永続化、semantic recognition、Photoshop compositing、initial auto-grid、Cubism importは境界外（02）。
- Runtime Exportはpreflight後にpicked directory artifactを出すが、browser picker/external player parityは未検証。Variants/Atlas/Diagnosticsのfocused passはvisual/product gateと分離する（02,06）。

### Runtime Player and broadcast

- Runtime Export loader/workflow、Native Stage lifecycle、Browser Source loopback HTTP/WS token gate、latest-wins/resync、sanitized frames、iFacialMocap UDP/parser/normalizer、Tracking/Autonomous Host composition、Stage Motion/Variant/Dynamics Tune、W22/W23 lipsyncを統合的に確認した（04）。
- Browser Sourceはprimary broadcast path、Native Stageはlocal preview/fallback。raw tracking、private diagnostics/path、Control-only stateはbroadcast境界を越えない（04）。

### Model authoring, mesh, rendering, performance

- Wave103–105 authoring-host/software rasterizer/perception/measurement/validatePackage、閉問題01–19/craft二周目・三周目追試、Wave107 historical vowel mapping、Wave108 Option E、Wave109 shared `contentInset`→`uvRect` preflightを照合した（05）。
- Current mesh routeは`auto-outline-v6d-adaptive-contour-constrainautor`、v7 `margin-contour`はcomparison toggle/fallback provenance。AtlasはSkyline default、shelf read compatibility。WebGL2/Canvas2D、software LINEAR/premultiplied sampling、dynamics v3、Editor Perf Wave2、Player W13–19を別証拠クラスとして整理した（05,06）。

### Electron, AI/Soul, Expo, and Git

- Electron WS1–WS4/packagingと残債、AI C/S/Soul特区、S7実配信/reading/interjection、brain registry/memory、Expo 6面成果物・PDF geometry・archive current-owner境界、HEAD/branch/worktreeを統合した（07–10）。

## 4. Current repository state

| 領域 | 現在の実装・証拠 | 状態の読み方 |
|---|---|---|
| Product policy | Private baseline、4 tracks、Cubism exclusion、deterministic operation boundary、Demo/Proposal rights/preflight policy | Accepted decision。未決のscope/legal/product gateとは別 |
| Editor source | Electron shell/routes、bounded PSD import、authoring surfaces、Canvas/WebGL2 fallback、Viewer/Variants/Atlas/Diagnostics/Runtime Export | Implemented repository fact。visual/device/external parityは未確認 |
| Editor verification | Electron renderer build pass（escalated）、focused package 211 tests pass、root typecheck pass。Editor package typecheck fail（21–23 error linesという報告差）、unitは4 stale navigation failures | Mixed current evidence。E2E PSD runはworkspace/picker precondition不足でtimeout、最終summaryなし |
| Editor history | W0–102 mainline history、W51–55 purge/Git-history-only、W56 abandoned、W57 React reset、W103–109 specialized indexes | Wave evidence。W102 stopはplanning boundaryであり、source不在の主張ではない |
| Dynamics | Source/package/runtime-coreは`dynamics-file-v3`/`worldFrameChainV1`、Wave106 focused pass | Current semantics + implementation evidence。render-performance/product acceptanceではない |
| Render/atlas/mesh | WebGL2 primary、Canvas2D fallback、Skyline default、Option E/contentInset/uvRect contract、v6D default/v7 toggle | Technical implementation evidence。GPU/pixel/AtlasRuntime/v6-v7 quality gate open |
| Editor performance | Perf Wave2 accepted for Editor interaction scope。real/synthetic measurements exist; Node does not cover GPU submit/mask/browser compositor | Scoped close, not universal FPS/product claim |
| Runtime Player | Typecheck 0, 140 files/925 tests pass; build pass is recorded by 07 while 04 reports no build/pack rerun in its bounded check | Deterministic implementation evidence; real iFacialMocap/OBS/packaged/lifecycle/vowel gates open |
| Model authoring | W103–105 evidence pass; closed problems/craft cycles complete; Wave107 historical; W109 partial | Implementation/history evidence; PNG recertification, portability, next scope and speech gate open |
| Electron/distribution | WS1–WS4 + portable x64 packaging complete; artifact/config present | Packaging implementation fact; typecheck/unit/E2E/source-guard/dead-branch/metadata and GUI gates open |
| AI/Soul | C1–C7 closed; S1–S8 code and reading/interjection evidence; 4-brain registry and memory implementation | Machine evidence/current source. S8/brain/memory/persona/privacy/ToS gates open; `apps/soul` exception only |
| Expo/demo/proposal | 6 HTML + 6 A2 PDFs; policy/template maps current; no generated preflight/rights/proposal-review artifacts | Local artifacts complete; acceptance/publication/rights/proof-print/target external or human unverified |
| Research archives | Cubism/old performance/deformer/viewer/runtime reports intentionally historical; `rights-risk-cleanup` is current legal/scope entry | Archive evidence, not implementation/acceptance oracle |
| Git/worktree | HEAD `af58394`, branch ahead 4/0 local remote; no staged/conflict state at capture; concurrent reports/config/zip are non-product | Timeline/current repository fact; no tests or source changes from report 10 |

## 5. Accepted decisions and boundaries

- Private Prototype + four-track separation; MVP is authoring-to-viewer, not a public compatibility ecosystem.
- Cubism SDK/Core, Cubism file/model compatibility, existing model analysis, and third-party material ingestion/reconstruction remain excluded.
- AC/scenario own requirements and pass/fail oracle; design/module/source own implementation semantics; test/review own evidence form; historical reports are not current oracle.
- Dynamics v3/world-frame chain replaces Wave81 scalar/additive v2; Wave106 is semantics/schema evidence, not performance acceptance.
- Editor mainline planning stops at Wave102. W103–109 remain separately indexed specialized evidence and do not reopen mainline without explicit user decision.
- Editor/repo deterministic operation boundary and `apps/soul`-only LLM/perception exception remain fixed; soul/器 code imports are prohibited.
- Runtime Player Browser Source loopback token transport is primary broadcast path; Native Stage is local fallback; raw tracking/private diagnostics/deep profiler do not cross product boundary.
- Editor Perf Wave2 closes only the scoped Editor interaction work; Player W13–19 closes implementation fast-path/diagnostics/cadence work, not universal 60 FPS.
- v6D technical/default route + v7 comparison toggle, Skyline default + shelf read compatibility, and Wave108/109 Option E/contentInset/uvRect contracts are accepted technical boundaries; quality/visual/device gates remain separate.
- Electron portable deprecation is Editor feature-layer scope; lower dormant bundles remain test/contract foundations. WS1–WS4 and packaging completion does not close quality/human gates.
- Expo artifact completion is local repository fact only. Acceptance, proof print, display rights, and proposal/public scope require external or human evidence.

## 6. Verification and experiment evidence

| Evidence class | Command / recorded result | Meaning and boundary |
|---|---|---|
| Root/package | `pnpm.cmd typecheck` PASS; focused package tests 16 files/211 pass; `check:deps` PASS; soul-zone guard PASS on 1,389 files | Deterministic current checks; no product/human acceptance |
| Source guard | `check:source` FAIL on existing `apps/runtime-player/src/main/physiology/index.ts` barrel violation | Repository health debt, unrelated to Electron packaging |
| Editor | `electron:build` PASS on escalated run; package typecheck FAIL with report counts 21–23; unit 62 files with 4 stale `import`→`workspace` expectations; PSD E2E timeout | Mixed implementation evidence; E2E has no final Playwright summary |
| Runtime Player | Typecheck PASS; 140 files/925 tests PASS; build PASS is recorded in report 07, while report 04 did not rerun build/pack in its bounded check | Current deterministic evidence; no GUI/OBS/device/packaged acceptance |
| Model/mesh | Root typecheck/check:deps PASS; targeted Vitest collection blocked by Windows esbuild `spawn EPERM`; Wave103–109 historical pass counts retained | No fresh test pass claim from blocked invocation; human visual/PNG/device gates open |
| AI/Soul | Full `npm test` blocked before assertions by worker `spawn EPERM`; worker-free imports 389/389 PASS; S7 30-min live and reading/interjection 1h40 observations recorded | Selected module evidence and bounded observations; S8/brain/memory/privacy/ToS human gates open |
| Render/perf | Editor real-model/synthetic measurements and Player W13–19 objective captures recorded; no new GPU/readPixels/C7 benchmark | Scoped experiment evidence, not universal FPS or product acceptance |
| Expo | 6 HTML + 6 PDFs; all A2 CSS and PDF one-page/MediaBox checks pass; 14 PNG assets, no rights manifest; no external query | File/geometry evidence only; acceptance/proof print/rights external-unverified |
| Git/worktree | HEAD `af58394`; local remote comparison `4 0`; no staged/conflict entries; transient E2E output restored in report 10 | Current repository/timeline fact; no source/product commit after map refresh |

### Evidence hierarchy used

Current source/test/package and latest accepted decision outrank historical wave prose. Implementation/review pass, focused tests, synthetic measurement, and local file existence are not human/device/visual/legal/external acceptance. Where primary reports differ, the integration retains the discrepancy instead of inventing a normalized count.

## 7. Historical progression / turning points

| Period | Turning point | Current interpretation |
|---|---|---|
| 2026-05 | Concept/convention reset (`129e292`, `121da75`) | Private baseline, external-memory structure, and source-of-truth separation established |
| W0–50 | Contract-first Editor vertical slice | package/runtime/operation/evidence, AI deterministic surface, PSD/dynamics/mesh/preflight bounded capabilities accumulated |
| `99a31c8` / W51–57 | Purge → abandoned W56 → React W57 reset | W51–55 remain Git-history-only; W57 is the accepted post-reset Editor foundation |
| W58–71 | Concrete Editor/Canvas/mesh/deformer/WebGL2 reconstruction | v6D lineage became technical default; visual/pixel gates remained separate |
| W72–92 | Authoring → Viewer/Diagnostics/Atlas/Runtime Export | Cross-surface semantics and export/preflight surfaces implemented |
| W93–102 (`d2e7b7e`) | history/perf/variants/Skyline; Wave102 planning stop | Mainline stop is accepted; not a claim that later source activity is absent |
| 2026-07-02–14 | W103–109 specialized tracks, Dynamics v3, Option E, uvRect/contentInset | Specialized evidence; W109 remains partial without wave-level final closeout |
| 2026-06-20–08 | Runtime Player W1–23 | Broadcast/input/lifecycle/lipsync path implemented; real-device/OBS/product gates remain |
| 2026-07-10–19 | AI C1–C7, S1–S8, reading/brain/memory | Vessel and soul code progressed; human safety/privacy/ToS/persona gates remain |
| 2026-07-08–10 | Electron WS1–WS4 + packaging | Migration/distribution implementation complete; quality/debt/GUI gates remain |
| 2026-07-25–26 | Expo six-panel production and freeze | Local artifacts complete; external acceptance/proof-print/rights remain |
| 2026-08-08 (`af58394`) | Discussion map/workspace refresh | Current entry points refreshed; no product/source commit follows HEAD |

## 8. Open gates, debts, and uncertainties

### Human / device / external / legal / product gates

- Domain-09 AC/scenario traceability for `dynamics-file-v3` cardinality and legacy scalar wording.
- Runtime Player real iFacialMocap calibration/parity, W20 packaged lifecycle, W21 Domain C persistence/reset/isolation, W22/23 real speech/vowel behavior, OBS/CEF/alpha/WebGL2/model parity and subjective smoothness.
- Model-authoring post-`45d2734` PNG re-certification, strict-ref 97-error classification, sidecar portability, next closed-problem scope, and W107→W22/23 real-model vowel pass.
- v6D/v7 quality criteria/toggle lifetime/v6 deletion/Wave2; Wave108 atlasRuntime visual acceptance; GPU/readPixels/pixel parity; Canvas2D sunset; original inset behavior.
- Optional C7 two-instance CPU/GPU/FPS capture (no target/authorization/current benchmark).
- Electron PSD E2E workspace/native-picker precondition, GUI smoke, package typecheck/unit debt timing, portable dead branches, metadata warning, and source-guard barrel violation disposition.
- AI S8 kill/no-regression, brain speed/quality/rollout cleanup, stream-memory privacy/save/load/OFF/manual update, persona/S9 voice, S7 innertube ToS/operational adoption, AI disclosure.
- Expo external acceptance, real-size proof print, display/asset rights/provenance, Demo preflight/disclaimer, first Proposal target/review, and Cubism/archive permission/legal/scope restart.

### Current implementation/evidence debts (not product failures)

- Editor package typecheck and 4 diagnostics stale assertions are current quality debt; report counts differ (21 vs 23 error lines) and were not normalized by a new run.
- PSD E2E timed out before a final summary; source helper lacks the current workspace-open/native-picker precondition.
- `check:source` fails an existing Runtime Player physiology barrel rule; this is separate from Electron build and runtime tests.
- Soul full worker test runner and model/mesh targeted Vitest were blocked by Windows `spawn EPERM`; worker-free or historical evidence must not be called full-suite acceptance.
- README/cockpit stale endpoint/brain/verbosity wording, Expo stale headers/title, `389x1024` vs README `392x1024`, absolute sidecar paths, and contentInset schema duplication are documentation/contract debts, not runtime failures by themselves.
- Wave109 has Domain A report/review and post-wave commit evidence but no wave-level final integration/clean review artifact; retain partial status.

### Uncertainties / evidence limits

- Local Git remote comparison uses existing ref only; no fetch was performed.
- Historical wave pass counts and commit subjects are not rerun current truth. Runtime Player build status differs by report scope (recorded pass in 07, not rerun in 04); no GUI/packaged acceptance follows.
- Expo acceptance/permission, AI privacy/ToS, real device/OBS/vowel, GPU/pixel, and human visual evidence were not rerun.

## 9. Candidate next work (facts-derived; no recommendation)

1. User-owned Domain-09 traceability decision and corresponding AC/scenario wording update.
2. Editor quality-debt pass: classify typecheck counts, repair diagnostics expectations, fix PSD E2E workspace/native-picker preconditions, then rerun GUI/E2E separately.
3. Runtime Player manual matrix: W11 calibration, W20 lifecycle, W21 persistence/isolation, W22/23 real vowel speech, OBS/Browser Source parity and provenance-complete cadence capture.
4. Model/mesh acceptance matrix: post-`45d2734` PNG/sidecar review, v6D/v7 quality hold, Wave108 atlasRuntime/GPU/pixel/Canvas/original gates, and a user-selected next closed problem.
5. Render/performance evidence only if explicitly opened: declared-target GPU/readPixels or C7 two-instance capture; keep deep profiler developer/test-only.
6. Electron residuals: source barrel decision, portable dead branch/metadata handling, package typecheck/unit debt, PSD E2E precondition, GUI/packaging smoke.
7. AI human/product/legal matrix: S8 kill, brain, memory privacy/OFF, persona/S9, S7 ToS/disclosure/operations; full runner rerun only in an environment where spawn restrictions are removed.
8. Expo/demo/proposal/archive: external acceptance/proof print, rights/provenance/preflight evidence, first proposal target, and permission/legal/scope review before any archive restart.
9. Keep Wave102 mainline stop, W51–55 Git-history-only, W109 partial, dated historical reports, and current-owner map routing explicit in future integration updates.

## 10. Evidence index

| Primary report | Integrated evidence |
|---|---|
| `01-product-policy.md` | Private baseline/4 tracks, Cubism boundary, dynamics v3 semantics, deterministic automation, Product Preflight, policy gates, turning-point commits. |
| `02-editor-current-capabilities.md` | Current Editor routes/import/mesh/rig/keyform/dynamics/Canvas/Diagnostics/Atlas/Variants/Viewer/Runtime Export; 211 focused tests, build pass, package type/unit mixed. |
| `03-editor-development-history.md` | W0–109 historical phases, W51–57 reset, W102 stop, W103–109 specialized evidence, W109 partial and map inventory. |
| `04-runtime-player-and-broadcast.md` | Runtime Player source boundary, Browser Source/Native Stage, iFacialMocap, W21–23 gates, 925 tests, objective cadence logs. |
| `05-model-authoring-and-mesh.md` | W103–109 authoring/mesh evidence, closed problems/craft, v6D/v7 hold, PNG/sidecar gates, fresh check limitations. |
| `06-render-dynamics-performance.md` | Canvas/WebGL2/Canvas2D, Atlas/Option E/uvRect, dynamics v3, Perf Wave2, Player W13–19, C7 and GPU/pixel limits. |
| `07-electron-distribution-repo-health.md` | WS1–WS4/packaging, Editor build/type/unit/E2E, Runtime Player comparison, guards, dead branches, worktree integrity. |
| `08-ai-cohost-and-soul.md` | C1–C7/S1–S8, `apps/soul` exception, 4-brain/memory/reading evidence, worker-free 389/389, human/privacy/ToS gates. |
| `09-expo-public-surfaces-archives.md` | 6 HTML + 6 PDF artifact verification, acceptance/proof-print/rights/preflight/proposal gates, historical archive routing. |
| `10-git-timeline-worktree.md` | HEAD/branch/remote/staging/worktree, map-refresh activity, transient E2E restoration, Git turning points and timeline inference. |

Additional evidence paths and command outputs remain in the linked primary reports; this integration does not duplicate wave-level details.

## 11. Limitations

- This is an integration of bounded primary reports, not a fresh full-repo/source/test/device/web audit. No new product decision, scope change, or gate closure was made.
- Primary reports contain intentionally different command scopes and one Editor typecheck count discrepancy (21 vs 23); the integration preserves the discrepancy rather than inventing a normalized number.
- Historical wave/review passes, focused tests, synthetic measurements, local artifacts, and commit subjects are not equivalent to human/device/visual/legal/external acceptance.
- Windows child-process `spawn EPERM` blocked some full or targeted runners; worker-free/escalated evidence is labeled separately. No external Expo acceptance, rights, ToS, real-device, OBS, GPU/pixel, speech, or GUI smoke was performed.
- Shared-worktree parallel files and generated artifacts were not reverted. Ownership is limited to this report.
