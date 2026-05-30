# Wave 16 Final Report

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Status: `pass`
> Completion state: `Completed / implementation-proven`
> Date: 2026-05-30

## Verdict

`pass`.

Wave 16 は、Wave 15 で作成可能になった複数 drawable を editor 上で最小 layer として扱う vertical slice を完了した。`setDrawOrder` と `setRuntimeVisibility` が operation / runtime evidence / editor workflow / UI / persistence / E2E で一貫して通り、final integration verification も pass した。

## What Is Implemented

- `setDrawOrder` / `setRuntimeVisibility` operation handlers が登録され、dry-run / commit / precondition diagnostics / model diff を持つ。
- Authoring graph の drawable `baseDrawOrder`、draw-order entries、stable order、runtime visibility が deterministic に更新される。
- Runtime graph conversion、runtime snapshot、runtime diff dedicated fields、validation report、operation result evidence、operation log evidence が draw order / visibility changes を観測できる。
- Editor session / workflow に runtime visibility toggle、explicit set、layer move up/down action が追加された。
- Editor view model は ordered drawable layer list、visibility state、move enabled state、last layer operation label を提供する。
- Drawable list UI に hide/show と move up/down controls が追加され、app shell から workflow actions に接続された。
- Browser E2E は create drawable -> hide -> show -> move up/down -> final hide -> save/load を desktop / mobile で確認する。
- `current-capability-map.md` を Wave 16 完了状態に更新した。

## Domain Results

| Domain | Result | Evidence |
|---|---|---|
| A. drawable layer operation foundation | pass | [completion](wave16-drawable-layer-operation-foundation-completion.md), [review](../../reviews/wave16/wave16-drawable-layer-operation-foundation-review.md) |
| B. drawable layer runtime / evidence regression | pass | [completion](wave16-drawable-layer-runtime-evidence-regression-completion.md), [review](../../reviews/wave16/wave16-drawable-layer-runtime-evidence-regression-review.md) |
| C. editor layer workflow state | pass | [completion](wave16-editor-layer-workflow-state-completion.md), [review](../../reviews/wave16/wave16-editor-layer-workflow-state-review.md) |
| D. editor layer controls UI | pass | [completion](wave16-editor-layer-controls-ui-completion.md), [review](../../reviews/wave16/wave16-editor-layer-controls-ui-review.md) |
| E. layer controls e2e and persistence smoke | pass | [completion](wave16-layer-controls-e2e-and-persistence-smoke-completion.md), [review](../../reviews/wave16/wave16-layer-controls-e2e-and-persistence-smoke-review.md) |
| F. integration review and final report | pass | [completion](wave16-integration-review-and-final-report-completion.md), [review](../../reviews/wave16/wave16-integration-review-and-final-report-review.md) |

## Final Verification Results

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd typecheck` | pass after sandbox escalation | 通常sandboxでは TypeScript 読み取りEPERM。エスカレーション再実行で root/editor typecheck pass。 |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd test:e2e` | pass after sandbox escalation | 通常sandboxでは Vite `fdir` 解決で失敗。エスカレーション再実行で desktop / mobile smoke pass。 |
| Focused Wave16 Vitest suite | pass after sandbox escalation | 11 files / 65 tests。Authoring、operation、runtime evidence、editor session/workflow/state、UIを確認。 |
| `pnpm.cmd test:unit` | pass after sandbox escalation | 78 files / 385 tests。 |
| `git diff --check -- <Wave16 scope>` | pass | LF/CRLF warnings only。whitespace errorなし。 |

E2E screenshot metadata:

- desktop preview screenshot: `png base64Length=68052`
- desktop drawable screenshot: `png base64Length=94292`
- mobile preview screenshot: `png base64Length=39172`
- mobile drawable screenshot: `png base64Length=41240`

## Capability Now Proven

Wave 16 完了後、editor は rights-clean generated drawable / deterministic mesh を作成したうえで、drawable layer controls として次を証明できる。

- GUI から drawable を hide/show できる。
- GUI から drawable の layer order を move up/down で変更できる。
- 変更は operation log、model diff、runtime snapshot、runtime diff、validation evidence、package file set に残る。
- Embedded preview summary / visual は runtime projection と整合する。
- Save/load 後も draw order と runtime visibility が復元される。
- Desktop / mobile E2E smoke で同じ workflow が確認されている。

## Residual Risks

- Wave 16 は最小 up/down controls と runtime visibility toggle に限定している。full layer tree、drag-and-drop reorder、opacity editor、mask/clipping、texture/part authoring、mesh editing は future scope。
- Accessibility evidence は smoke-level であり、完全な accessibility tree audit ではない。
- E2E runner は既存 preview/drawable screenshot metadata を出すが、layer専用 screenshot metadata の標準ログ追加は行っていない。
- Browser-local persistence の確認であり、OS filesystem / archive import/export はまだ future work。

## User-Decision Points

None blocking for Wave 16 completion.

## Next-Wave Recommendation

Wave 17 は、Wave 15-16 の drawable authoring / layer controls を足場に、次のいずれかへ進めるのが自然。

1. rights-clean asset / texture / part flow。
2. mesh editing または canvas上の直接編集。
3. mask / clipping workflow。
4. opacity editor または full layer tree。
5. rig control / dynamics authoring workflow。
6. standalone private viewer / renderer adapter。
7. project import/export beyond browser-local persistence。
