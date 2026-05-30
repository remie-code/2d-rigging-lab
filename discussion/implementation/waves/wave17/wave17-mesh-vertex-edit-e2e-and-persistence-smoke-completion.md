# Wave 17 Domain E Completion: mesh vertex edit e2e and persistence smoke

## Verdict

`pass`

## Context Separation Evidence

- Gnome implementation context: `019e78a6-1073-73d0-bcb1-b49ecdda7b7d` (`Gnome the 16th`)
- Review-Sylph context: `019e78ad-5593-7ec1-a68d-6048aea5d34a` (`Sylph the 17th`)
- Orch-Sylph は source implementation files / tests を編集していない。Orch-Sylph の書き込みは、この completion report の分離証跡・統合結果追記のみ。
- Review-Sylph は Gnome とは別コンテキストで、basis documents、scoped diff、新規 E2E source、completion report、独立 verification rerun に基づいてレビューした。

## Review Result

- Review report: `discussion/implementation/reviews/wave17/wave17-mesh-vertex-edit-e2e-and-persistence-smoke-review.md`
- Review verdict: `pass`
- Blocking findings: none
- Needs-fix loop: not required
- Review lanes: Product Workflow / Persistence Review、Test Adequacy Review、UI / Accessibility Smoke Review

Browser-level smoke に `create drawable -> nudge vertex -> preview visual update -> save/load` を追加した。desktop / mobile の両 viewport で、mesh vertex controls の基本 layout、accessible names、vertex row label、preview SVG polygon、browser-local persistence を確認する。

## Changed Files

- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/mesh-vertex-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/layer-controls-smoke.mjs`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-edit-e2e-and-persistence-smoke-completion.md`

## Implementation Summary

- E2E test-id mirror に Domain D の mesh vertex ids と row/button id factories を追加した。
- `mesh-vertex-smoke.mjs` を追加し、generated drawable 作成後に `vtx_wave_15_smoke_drawable_0_0` を `+X` 方向へ 1 canvas unit nudge する smoke を実装した。
- Nudge 後に mesh vertex row が `85, 24` に更新されること、preview SVG polygon points が変わり `85,24` を含むこと、mesh edit status が `moveMeshVertex committed` になることを確認する。
- Preview summary は post-nudge の deterministic state として `2 visible / 2 total` と `0 changes / 0 drawables` を確認する。Base mesh edit の視覚変化自体は preview SVG polygon と mesh vertex label で固定している。
- Save 後の `localStorage` 内 `model/meshes.json` と operation log JSONL を読み、対象 vertex coordinate と `moveMeshVertex` log entry が保存されていることを確認する。
- Load 後も mesh vertex row が `85, 24` を表示することを確認する。
- 既存 layer controls smoke は operation log count の開始値を引数化し、既存 default は 3 のまま維持した。Domain E smoke では mesh nudge 後の 4 entries から layer 操作を継続する。

## Verification Commands / Results

- `node --check apps/editor/e2e/mesh-vertex-smoke.mjs`: pass
- `node --check apps/editor/e2e/smoke-checks.mjs`: pass
- `node --check apps/editor/e2e/layer-controls-smoke.mjs`: pass
- `pnpm.cmd test:e2e`
  - sandbox run: fail。Vite dependency `fdir` を sandbox 内で解決できず `ERR_MODULE_NOT_FOUND`。
  - escalated rerun: pass。desktop / mobile smoke pass。
  - logged screenshot metadata: desktop preview `base64Length=68048`, desktop drawable `base64Length=86504`, mobile preview `base64Length=39172`, mobile drawable `base64Length=48796`。
- `pnpm.cmd typecheck`
  - sandbox run: fail。TypeScript `node_modules/.../typescript/bin/tsc` read が `EPERM`。
  - escalated rerun: pass。root / editor typecheck pass。
- `pnpm.cmd run check:source`: pass。Source organization guard passed.
- `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave17/wave17-mesh-vertex-edit-e2e-and-persistence-smoke-completion.md`: pass。LF/CRLF warning only.
- New-file trailing whitespace check with `Select-String`: pass, no matches.

Review-Sylph independent verification:

- `node --check` for new/modified E2E files: pass.
- `pnpm.cmd run check:source`: pass.
- scoped `git diff --check`: pass, LF/CRLF warnings only.
- `pnpm.cmd typecheck`: sandbox `EPERM`; escalated rerun pass.
- `pnpm.cmd test:e2e`: sandbox Vite `fdir` resolution failure; escalated rerun pass for desktop/mobile smoke.

## Source Organization Notes

- Production `index.ts` は編集していない。
- package source、editor session/workflow/state production source、preview source は編集していない。
- Mesh vertex E2E logic は `mesh-vertex-smoke.mjs` に分離し、既存 `smoke-checks.mjs` は orchestration wiring に留めた。
- `layer-controls-smoke.mjs` は既存 layer scenario の意味を変えず、operation count offset を受け取る小変更のみ。
- 巨大 catch-all source file は追加していない。

## Remaining Risks / User Decision Points

- Preview summary の diff 表示は、現在の preview projection 設計どおり base mesh edit 自体を diff count としては表示しない。Domain E では broad redesign せず、summary の deterministic post-nudge state、preview visual polygon、vertex label、save/load coordinate で smoke oracle を固定した。
- Mesh screenshot は workflow 内で `Page.captureScreenshot` を実行しているが、既存 top-level smoke script は preview / drawable screenshot metadata だけを console に出す。Domain E では script logging scope を広げていない。
- Browser-local persistence の確認であり、OS filesystem / archive import-export は future scope。
- Blocking user decision point はなし。
