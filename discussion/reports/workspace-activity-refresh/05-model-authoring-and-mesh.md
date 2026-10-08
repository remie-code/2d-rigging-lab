# Workspace Activity Refresh — Model Authoring / Mesh Generation

監査日: 2026-08-08。監査契約は [audit-contract.md](audit-contract.md) に従い、現在の source/test/Git と、Wave 記録・実験 artifact を区別した。基準 commit は `3c3669e`、現行 `HEAD` は `af5839452f0968a005cb6cd13c62b714aa4e6d4e`（直近の discussion map refresh）。

## 1. Scope / inspected entry points

### Topic maps

- [model-authoring/_map.md](../../model-authoring/_map.md)、[closed-problems/_map.md](../../model-authoring/closed-problems/_map.md)、[craft/_map.md](../../model-authoring/craft/_map.md)
- [mesh-generation/_map.md](../../mesh-generation/_map.md)、[mesh-generation/implementation/_map.md](../../mesh-generation/implementation/_map.md)
- Wave 103/104/105/107/108/109 の各 `implementation/waves/*/_map.md` と final/domain/review report

### Current source and artifacts

- `apps/authoring-host/src/{run-authoring-host-command.ts,perception/*}`
- `packages/authoring-core/src/{mesh-generation*.ts,texture-atlas-content-rect.ts}`
- `packages/render-software/src/{render-scene-to-png.ts,raster/texture-sampler.ts,software-renderer.ts}`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts` と method tests
- `discussion/model-authoring/experiments/ref-render-gate/` の PNG/sidecar/measurement artifact

render-performance topic と、描画性能全般のベンチマークは非対象とした。

## 2. Executive summary

1. Model Authoring の装備（authoring-host、決定論 software renderer、`renderView`、測量、`validatePackage`）は Wave103–105 の repository evidence では final pass。これは人間・実機 gate の完了を意味しない（[model-authoring/_map.md](../../model-authoring/_map.md)）。
2. Fable の閉問題 01–19、craft 二周目（房の層座標系、前髪3帯、目/眉の弦の項、眼球Y）、craft/09・10 の三周目追試は通過済み。次の閉問題（旧「02」を含む）の自動予約は廃止され、次 scope は user decision である。
3. Wave107 の vowel implementation は historical Runtime Player evidence。現在の母音 semantics は Wave22/23 が所有し、実モデル+iFacialMocap の発話 gate（遷移、閉口ゼロ、ちらつき、ON/OFF、strength）が未確認である。
4. Mesh の現行既定は `auto-outline-v6d-adaptive-contour-constrainautor`、v7 `auto-outline-v7-margin-contour` は比較用 toggle。v7 blocked 時には v6D へ fallback し、provenance に v7 の試行を残す（[mesh-generation.ts:144-151,1058-1134](../../../packages/authoring-core/src/mesh-generation.ts)）。v6/v7 の品質 hold と v6削除/Wave2 は未決である。
5. Wave108 の transparent-margin / `contentInset` / content-subrect `uvRect` / LINEAR sampling / export-atlas-runtime 契約は実装・テスト evidence で pass。Wave109 は non-zero inset preflight を共有 helper に統合したが、wave final integration artifact は存在せず、map も partial evidence と明記する。
6. 現行 ref-render-gate は 126 texture 全件 `derived-verified` を sidecar に記録しているが、PNG bytes は `45d2734`（2026-07-26）で置換された。2026-07-03 の人間承認は旧 artifact に対する historical approval であり、post-45d bytes の再認証が必要である。README の表には `392x1024` の古い寸法が残り、現行 sidecar/PNG は `389x1024`。
7. sidecar の `packagePath`/`pngPath` は machine-absolute。byte determinism の issue ではなく、strict-ref/sidecar portability の受入れ条件として unresolved である。
8. 今回の fresh checks は root `typecheck` と `check:deps` が pass、`check:source` は無関係な既存の `apps/runtime-player/src/main/physiology/index.ts` barrel violation で fail。対象 test の vitest は Windows の esbuild `spawn EPERM` で collection 前に停止した。

## 3. What was built or investigated

### Model Authoring / Fable

- `runAuthoringHostCommand` は package 内 state directory を拒否し、renderView は non-mutating の PNG+sidecar command として package revision/transcript を変更しない（[run-authoring-host-command.ts:62-77](../../../apps/authoring-host/src/run-authoring-host-command.ts)）。dry-run の機械承認だけが transcript-wrapped policy に記録される（同:152-182）。
- Wave104 orchestration は live `AuthoringSession` → perception snapshot → `RenderScene` → PNG。variant selection は一度解決され、base/sweep とも同じ gated snapshot を使い、sidecar に resolved selection と texture dimension source を記録する（[render-view-command.ts:23-33,53-111,120-181](../../../apps/authoring-host/src/perception/render-view-command.ts)）。
- measurement も同じ snapshot path を使い、visible flag を返す（[measurement-command.ts:18-21,37-48,75-77,103-105](../../../apps/authoring-host/src/perception/measurement-command.ts)）。variant gate は `base visible AND predicate` を snapshot レベルで適用し、render/measurement/framing が同じ visibility world を共有する（[evaluation-adapter.ts:29-38,92-127](../../../apps/authoring-host/src/perception/evaluation-adapter.ts)）。
- `renderSceneToPng`/software sampler は決定論 RGBA8/PNG と premultiplied LINEAR+CLAMP_TO_EDGE を実装し、透明 padding による fringe を避ける（[render-scene-to-png.ts:21-34](../../../packages/render-software/src/render-scene-to-png.ts), [texture-sampler.ts:20-24,101-115](../../../packages/render-software/src/raster/texture-sampler.ts)）。
- 閉問題/craft は repository map 上で一周目・二周目を完了としている。これは Fable 実験とユーザー目視の historical record を含むが、次 scope、strict-ref 97 errors の分類、sidecar portability、PNG 再認証は別の判断点である。

### Mesh / texture-atlas contract

- `createGeneratedMeshForDrawable` は v7 と複数の v6 backend を明示 dispatch し、v6D adaptive が現行 fallback/default の起点である（[mesh-generation.ts:117-237](../../../packages/authoring-core/src/mesh-generation.ts)）。v7 の pixel-space backend は v6 file を import せず、diagnostics は provenance-only。blocked 時は v6D chain に接続される（[mesh-generation-v7-margin-contour.ts:2-16,221-225,273-277](../../../packages/authoring-core/src/mesh-generation-v7-margin-contour.ts)）。
- Editor の method surface は v6D を first/default とし v7 を thin comparison toggle に限定する。v6 deletion は UI/choice の単一箇所で撤去可能だが、quality criteria/toggle lifetime が決まるまで削除しない（[mesh-tool-state.ts:70-97](../../../apps/editor/src/features/editor-session/model/mesh-tool-state.ts)）。
- Wave108 Option E は生成 UV を非 clamp、size-dependent transparent padding、per-layer `contentInset`、atlas `uvRect` を採用。`deriveContentSubRectUv` が inset を pixel space から normalized subrect に変換する（[texture-atlas-content-rect.ts:45-68](../../../packages/authoring-core/src/texture-atlas-content-rect.ts)）。Wave108 tests は混在サイズ、透明 gutter、cross-bleed 不在、determinism を記録する。
- Wave109 は stale preflight を同じ helper に寄せ、non-zero `contentInset` を再現可能にした。これは specialized authoring-core follow-up であり、Wave102 Editor mainline を reopen しない。

## 4. Current repository state

### Map state judgment

| Map | 判定 | 根拠 / caveat |
|---|---|---|
| `model-authoring/_map.md` | Current | 01–19/craft complete と PNG/strict-ref/vowel/user gates を分離して記載 |
| `model-authoring/closed-problems/_map.md` | Current | 01–19 の結果と no-automatic-cp02 を indexed |
| `model-authoring/craft/_map.md` | Current | second cycle と 09/10 retry、conductor 状態を indexed |
| `mesh-generation/_map.md` | Current | v6D default/v7 toggle、quality hold、W108/109 residuals を反映 |
| `mesh-generation/implementation/_map.md` | Current living index | Wave1–1.3 pass と Wave2 hold。historical metrics は dated evidence |
| Wave103/104/105/107/108 maps | Intentionally historical indexes | closeout status は当時の記録。post-45d PNG、W22/23、Wave109 follow-up を current truth として再解釈しない |
| Wave109 map | Current partial-evidence index | Domain A/report-level pass と Git `899cb2e` を記載するが final integration report はない |

対象 source/map paths は `git status --short -- apps/authoring-host packages/render-software packages/authoring-core apps/editor/src discussion/model-authoring discussion/mesh-generation discussion/implementation/waves/wave103 discussion/implementation/waves/wave104 discussion/implementation/waves/wave105 discussion/implementation/waves/wave107 discussion/implementation/waves/wave108 discussion/implementation/waves/wave109` で変更なし。worktree 全体には他エージェント由来の editor test-result、agent config、`discussion/expo.zip` 等の変更があり、本 report の対象外である。

## 5. Accepted decisions and boundaries

- Private 2D Rigging Lab / Prototype の4トラック分離を維持し、Editor mainline はユーザー決定で Wave102 停止。W103–109 は bounded specialized evidence とする。
- Codex/Fable は deterministic authoring API を人間同等に操作する。host は one-shot CLI、承認は dry-run の機械ゲート、render は live session から直接行い Runtime Export を必須にしない。
- Renderer は pure TypeScript software rasterizer。WebGL2 parity は契約上の対象だが、本監査は render performance を評価しない。
- Mesh は v6D adaptive default + v7 comparison toggle。v6 retention/deletion と Wave2 の再開は品質基準・toggle lifetime の user decision 後に限る。
- Wave108 Option E は non-clamped generation UV、透明 margin/gutter、`contentInset`→content-subrect `uvRect`、LINEAR sampling。`atlasUvs` の hard range validation は overshoot 契約を壊すため追加しない accepted boundary。
- `atlasRuntime` を canonical preview/export/runtime path とし、padded `original` preview の inset/shrink は別 follow-up。contentInset schema 重複と sourceRect contract dependency は残債である。

## 6. Verification and experiment evidence

### Fresh commands (2026-08-08)

| Command | Result | Interpretation |
|---|---|---|
| `pnpm.cmd typecheck` | PASS (root `tsc --noEmit`) | current type surface green |
| `pnpm.cmd run check:deps` | PASS | dependency guard green |
| `pnpm.cmd run check:source` | FAIL | unrelated existing `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint` |
| `pnpm.cmd exec vitest run apps/authoring-host/src packages/render-software/src packages/authoring-core/src/texture-atlas-content-rect.test.ts packages/authoring-core/src/texture-atlas-transparent-gutter.test.ts packages/authoring-core/src/runtime-export-assembly.test.ts` | BLOCKED before collection: Windows esbuild `spawn EPERM` while bundling root `vitest.config.ts` | no test pass/fail claim from this invocation |

### Recorded wave/test evidence (historical)

- Wave103 final report: authoring-host 8 tests and render-software 33 tests; deterministic RenderScene→RGBA8→PNG; root/app typecheck and source checks recorded pass.
- Wave104 final report: 126/126 texture dimensions `derived-verified`, four ref e2e tests, deterministic PNG/sidecar; visual gate was outside technical wave gate.
- Wave105 final report: 40 files / 241 tests pass; variant snapshot gate and Default outfit ref regeneration; current bytes still require post-45d confirmation.
- Wave107 final report: vowel tests 62 pass; device gate remains. Runtime-player closeout records pre-existing failures only, not a live-device acceptance.
- Wave108 map/report: packages 241 files / 1492 tests, source/deps/typecheck green; atlasRuntime visual observation recorded outside wave. Wave109 Domain A report: authoring-core 41 files / 317 tests and packages 242 files / 1500 tests, typecheck green; map intentionally lacks final integration closeout.

### PNG/sidecar observation

Current `discussion/model-authoring/experiments/ref-render-gate/` sidecars all report package revision `1844`, 126 textures, and `derived-verified=126`; dimensions are eyes `1024x436`, face `1024x1013`, rest `389x1024`. `packagePath` and `pngPath` are absolute (`C:/workspace/...`). The README still has a table entry `392x1024`, while its prose and current artifact use `389x1024`. This is an artifact/documentation mismatch, not evidence that rendering is wrong. The PNG replacement is linked to `45d2734`; the historical 2026-07-03 approval must not be inherited automatically.

## 7. Historical progression / turning points

1. 2026-07-02 — Wave103 added authoring-host one-shot operations, dry-run approval, and deterministic software rasterizer; model-authoring equipment started.
2. 2026-07-03 — Wave104 added live-session renderView, framing, contact sheets, measurement, validatePackage, and strict texture-dimension derivation. A human visual approval was recorded for then-current PNGs.
3. 2026-07-05 — Wave105 made variant visibility a snapshot-level gate shared by eye/tape/framing; Default outfit PNGs were regenerated.
4. 2026-07-06/07-17 — closed problems 01–19 and craft second-cycle/third-run evidence completed; this is Fable/craft progress, not automatic authorization for a new scope.
5. 2026-07-06 onward — Wave107 vowel mapping/calibration completed in code; later Wave22/23 changed current mouth-open semantics (`w` → `s`) and still require real-device speech confirmation.
6. 2026-07-09/10 — Wave108 Option E established transparent margin, non-clamped UV, contentInset and uvRect contract; Wave108 closeout was historical and user-gated.
7. 2026-07-14 — Git `899cb2e` recorded Wave109 shared-helper preflight reconciliation for non-zero inset; no wave-level final integration report was added.
8. 2026-07-26 — Git `45d2734` replaced the three ref PNG bytes; this created the post-45d re-certification gate.
9. 2026-08-08 — `af58394` refreshed discussion maps; current truth now explicitly separates repository facts from human/device/user gates.

## 8. Open gates, debts, and uncertainties

### User / human / device gates

- Re-certify current post-`45d2734` PNG bytes (or explicitly reject equivalence with the 2026-07-03 approval).
- Decide strict-ref 97-error classification and sidecar portability acceptance; absolute paths are not portable by default.
- Run Wave107→Wave22/23 on the real model with iFacialMocap and five vowels, checking transition, neutral zero, flicker/jitter, toggle, and strength.
- Set v6/v7 quality criteria and toggle lifetime, then decide whether v6 deletion/Wave2 is authorized.
- Decide whether Wave108 atlasRuntime observation is formal acceptance; separately resolve GPU/pixel parity, Canvas2D sunset, and original-preview inset behavior.
- Select next closed-problem/craft scope; do not infer `closed problem 02` from history.

### Repository/documentation debt

- Correct or explicitly supersede the stale `392x1024` README table entry after ownership/user acceptance is clear; do not silently change it in this audit.
- Wave109 has pass-level implementation/review evidence but no final integration report.
- Wave108 noted a future hard-fail guard for stale `.js` shadows; current `check:source` failure is a different physiology barrel violation.
- `contentInset` schema is duplicated across package-format and operation-core; sourceRect contract remains a dependency for future atlas changes.

## 9. Candidate next work (facts-derived; no recommendation)

- A user-owned acceptance pass over current ref PNG bytes and sidecar portability.
- A real-device vowel pass using Wave22/23 semantics, with results linked back to Wave107 historical evidence.
- A quality-hold decision record for v6/v7 retention, toggle lifetime, and possible Wave2/v6 deletion.
- A formal atlasRuntime/GPU/pixel/Canvas sunset acceptance record, plus an explicit decision on `original` preview.
- A Wave109 final integration report if wave-level closeout is required; otherwise retain the partial-evidence status.
- A selected next Fable closed problem after user scope choice.

## 10. Evidence index

| Evidence | Path / commit / command | Result used |
|---|---|---|
| Audit rules | `discussion/reports/workspace-activity-refresh/audit-contract.md` | Required sectioning and evidence taxonomy |
| Current topic state | `discussion/model-authoring/_map.md`, `closed-problems/_map.md`, `craft/_map.md`, `discussion/mesh-generation/_map.md`, `mesh-generation/implementation/_map.md` | Equipment/craft complete; gates and v6/v7 hold |
| Host behavior | `apps/authoring-host/src/run-authoring-host-command.ts:62-77,152-182`; `perception/render-view-command.ts:23-181`; `measurement-command.ts:18-105`; `evaluation-adapter.ts:29-127` | State isolation, non-mutating render, shared snapshot |
| Raster behavior | `packages/render-software/src/render-scene-to-png.ts`; `raster/texture-sampler.ts:20-24,101-115` | Deterministic PNG and premultiplied LINEAR sampling |
| Mesh dispatch/fallback | `packages/authoring-core/src/mesh-generation.ts:117-237,1058-1134`; `mesh-generation-v7-margin-contour.ts:2-16,221-277`; `apps/editor/.../mesh-tool-state.ts:70-97` | v6D default, v7 comparison, fallback provenance |
| Atlas contract | `packages/authoring-core/src/texture-atlas-content-rect.ts:45-68`; Wave108 transparent-gutter tests; Wave109 Domain A report | Non-clamped UV, inset→uvRect, preflight reconciliation |
| Wave chronology | Wave103/104/105/107/108/109 maps and final/domain reports | Historical pass evidence, residual gates |
| PNG/sidecar | `discussion/model-authoring/experiments/ref-render-gate/*`; Git `45d2734` | 126 derived-verified textures; post-45d bytes and absolute paths unresolved |
| Fresh checks | `pnpm.cmd typecheck`; `pnpm.cmd run check:deps`; `pnpm.cmd run check:source`; targeted `pnpm.cmd exec vitest run ...` | pass/pass/unrelated fail/EPERM collection block |
| Map refresh | Git `af5839452f0968a005cb6cd13c62b714aa4e6d4e` | Current map wording used as entry point; no source edits |

## 11. Limitations

- No human visual re-approval, real-device iFacialMocap speech run, GPU/pixel parity run, Canvas2D sunset check, or legal/portability acceptance was performed.
- The targeted Vitest command did not reach collection because Windows esbuild returned `spawn EPERM`; it is not evidence of a production/test regression.
- Wave counts and closeout statuses are historical reports, not rerun evidence. They are retained with their dates and caveats.
- Render performance, FPS/CPU/GPU benchmarking, and optional C7 two-model load were intentionally outside this report.
- The README dimension mismatch and absolute sidecar paths were observed but not edited under the single-report ownership rule.
