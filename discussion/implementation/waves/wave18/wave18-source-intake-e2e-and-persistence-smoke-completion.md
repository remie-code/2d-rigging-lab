# Wave 18 Domain F 完了報告: Source Intake E2E And Persistence Smoke

## verdict

`pass`

Browser-level smoke で `source intake -> create drawable -> generate mesh -> preview -> save/load` を desktop / mobile の両 viewport で固定した。

## 分離証跡

- 実装担当: Gnome 別コンテキスト
- 実装 agent id: `019e78f6-814b-7ca3-951e-4cd47bbada8f` (`Gnome the 31st`)
- レビュー担当: Review-Sylph 別コンテキスト
- Review-Sylph agent id: `019e78ff-c200-74d3-a412-984f9c239a7d` (`Sylph the 32nd`)
- Review artifact: `discussion/implementation/reviews/wave18/wave18-source-intake-e2e-and-persistence-smoke-review.md`
- Review verdict: `pass`
- 呼び出し元: Orch-Sylph
- Orch-Sylph source 実装: なし。Domain F の source / e2e / report 変更は Gnome context で実施し、review は実装担当とは別の Review-Sylph context で実施した。

## changed files

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/e2e/source-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/mesh-vertex-smoke.mjs`
- `apps/editor/e2e/test-ids.mjs`
- `discussion/implementation/waves/wave18/wave18-source-intake-e2e-and-persistence-smoke-completion.md`

## 実装概要

- `apps/editor/src/app/editor-app.ts` の `onConfirmSourceIntakeDraft` を `workflow.commitSourceIntakeDraft(draft)` に接続し、mounted browser UI submit が import operation commit へ進むようにした。
- `apps/editor/e2e/source-intake-smoke.mjs` を追加し、split PNG manifest path、source asset/layer metadata、cleared rights、provenance metadata を form から入力する smoke helper に分離した。
- E2E は import commit 後に imported source asset row、drawable authoring の imported source selection、operation log、save/load 後の source manifest / provenance / rights / drawable relation を確認する。
- 既存 mesh vertex smoke は source import 分の operation count を受け取れるようにした。layer controls / mesh vertex / preview / AI approval の既存 smoke は同じ desktop/mobile run 内で継続確認した。
- Real PNG decode、texture atlas generation、actual texture rendering は行っていない。E2E fixture は metadata-only source intake として扱っている。

## E2E / a11y / persistence evidence

- Source Intake panel:
  - `Source Intake` heading、form accessible name `Confirm split PNG source intake draft`、layer rows `Split PNG source layer rows`、imported source region `Imported source assets` を browser smoke で確認。
  - `Split PNG manifest path`、`Source asset ID`、`Placement policy`、`Rights status`、`Creator`、`License`、layer `Layer ID` / `Width` label を確認。
- Source import:
  - `src_e2e_split_png_smoke` / `layer_e2e_body` を GUI form から入力。
  - `importSplitPngSourceAsset committed` と operation log type `importSplitPngSourceAsset` を確認。
  - Imported source row に manifest path、source layer、`0 mapped drawables` が表示されることを確認。
- Create drawable / mesh / preview:
  - Source import 後の drawable authoring default source が `src_e2e_split_png_smoke / layer_e2e_body` になることを確認。
  - Existing `createDrawable` / `generateMesh` smoke、preview SVG polygon smoke、mesh vertex nudge smoke、layer controls smoke を同じ run で確認。
- Persistence:
  - Save 後の browser localStorage package file set で `assets/sources/source-manifest.json`、`assets/provenance.json`、`assets/rights.json`、`model/drawables.json`、`operations/log.jsonl` を検査。
  - Source manifest に source asset / layer / `mappedDrawableIds` が残り、rights `cleared` / license、provenance creator/license/transformHistory、created drawable の `sourceAssetId` が残ることを確認。
  - Load 後の UI imported source row で `1 mapped drawable` が復元されることを確認。
  - Reset 後に imported source list が empty に戻ることを確認。

## review results

- Review-Sylph agent id: `019e78ff-c200-74d3-a412-984f9c239a7d` (`Sylph the 32nd`)
- Review artifact: `discussion/implementation/reviews/wave18/wave18-source-intake-e2e-and-persistence-smoke-review.md`
- Review verdict: `pass`
- Blocking findings: なし
- Non-blocking findings: なし
- Gnome fix loop: 不要

## verification commands and results

| Command | Result |
|---|---|
| `pnpm.cmd test:e2e` | sandbox first run failed with Vite dependency resolution `ERR_MODULE_NOT_FOUND`; escalated run reached browser and exposed a scroll-position issue; after E2E helper fix, escalated rerun passed. desktop/mobile smoke passed. |
| `pnpm.cmd typecheck` | sandbox first run failed with TypeScript `node_modules` `EPERM`; escalated rerun passed root + editor typecheck. |
| `pnpm.cmd run check:source` | pass. Source organization guard passed. |
| `git diff --check -- apps/editor/e2e apps/editor/tests fixtures/e2e apps/editor/src/app/editor-app.ts apps/editor/src/ui/source-assets apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/editor-state/editor-test-ids.ts apps/editor/src/styles discussion/implementation/waves/wave18/wave18-source-intake-e2e-and-persistence-smoke-completion.md` | pass; LF/CRLF working-copy warnings only, no whitespace errors. |

E2E screenshot metadata from final pass:

- desktop preview screenshot: `png base64Length=68004`
- desktop drawable screenshot: `png base64Length=85292`
- mobile preview screenshot: `png base64Length=39172`
- mobile drawable screenshot: `png base64Length=47264`

## source organization evidence

- New E2E source-intake logic is isolated in `apps/editor/e2e/source-intake-smoke.mjs`; `smoke-checks.mjs` only orchestrates the helper and adjusted operation counts.
- `apps/editor/e2e/test-ids.mjs` was updated to mirror existing UI source intake test IDs.
- `apps/editor/src/app/editor-app.ts` change is narrow app-level callback wiring only.
- No `index.ts` file was edited by Domain F, and no catch-all source file was introduced.
- `packages/**`, `apps/editor/src/editor-session/**`, and `apps/editor/src/editor-workflow/**` were not edited by this Domain F context.

## remaining risks / user decision points

- Accessibility coverage is smoke-level label/layout verification, not a full accessibility tree audit.
- Browser persistence is localStorage save/load, not OS filesystem or package archive import/export.
- Split PNG intake remains metadata-only. Real PNG bytes, file picker, PNG decode, texture atlas generation, and actual bitmap rendering remain future scope.
- No blocking user decision point remains for Domain F.
