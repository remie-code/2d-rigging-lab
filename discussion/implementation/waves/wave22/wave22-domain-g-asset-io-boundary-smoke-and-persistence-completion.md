# Wave 22 Domain G Completion: Asset I/O Boundary Smoke and Persistence

> Target: `wave22-asset-io-boundary-smoke-and-persistence`  
> Wave: 22 `real-asset-io-boundary-foundation`  
> Status: `pass`  
> Date: 2026-05-31

## Status

`pass`.

Browser smoke で binary asset reference / missing bytes / save-load truthfulness を metadata boundary として確認した。PSD structured profile path と split PNG metadata path も同じ smoke 内で確認済み。

Domain G は e2e/smoke と metadata fixture に限定され、file picker、Browser File API import、image decode、actual binary upload、archive import/export、PSD/PNG parser、external dependency、manifest/lockfile change は導入していない。

## Delegation

| Role | Agent | Result |
|---|---|---|
| Gnome implementation | `019e7dad-fd00-7b82-920a-4676a9890835` / Gnome the 14th | `pass` |
| Review-Sylph independent review | `019e7db9-8f97-7282-a161-7dc239ec13ba` / Sylph the 15th | `pass` |

Orch-Sylph は source implementation を行わず、実装は Gnome、独立レビューは Review-Sylph に分離した。

## Changed Files

| Path | Purpose |
|---|---|
| `apps/editor/e2e/asset-io-boundary-smoke.mjs` | Browser-local persistence smoke。metadata-only package fixture を localStorage に seed し、editor の Load saved / Save / reload / Load saved を通して binary refs と source/texture metadata を検証する。 |
| `apps/editor/e2e/smoke-checks.mjs` | 既存 desktop/mobile editor smoke に Domain G smoke を追加し、horizontal overflow check と reset を接続する。 |
| `fixtures/e2e/wave22-asset-io-boundary/package-document.json` | PSD structured profile と split PNG metadata path を含む metadata-only e2e package fixture。missing bytes と storage unsupported の binary refs を含む。 |
| `discussion/implementation/reviews/wave22/wave22-domain-g-asset-io-boundary-smoke-and-persistence-review.md` | Review-Sylph の独立 review report。 |
| `discussion/implementation/waves/wave22/wave22-domain-g-asset-io-boundary-smoke-and-persistence-completion.md` | 本 completion report。 |

## Verification

| Command | Outcome | Notes |
|---|---|---|
| `pnpm.cmd test:e2e` | pass | Orch-Sylph 再実行で desktop/mobile smoke とも pass。`editor-e2e: smoke passed`。 |
| `pnpm.cmd exec vitest run apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-session/session-adapter.test.ts` | pass | sandbox は Vitest 読み取り EPERM。昇格再実行で 4 files / 52 tests pass。 |
| `pnpm.cmd typecheck` | pass | sandbox は TypeScript 読み取り EPERM。昇格再実行で root/editor typecheck pass。 |
| `git diff --check -- apps/editor fixtures/e2e discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22` | pass | LF/CRLF working-copy warning のみ。 |
| `git status --short -uall -- apps/editor/e2e fixtures/e2e discussion/implementation/waves/wave22 discussion/implementation/reviews/wave22 package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json` | pass | Domain G の e2e/fixture/report 変更のみ。dependency manifest / lockfile change なし。 |
| `rg --files fixtures/e2e \| rg -i '\\.(psd\|png\|jpg\|jpeg\|webp\|gif\|wasm\|zip\|bin)$\|sample_model\\.psd'` | pass | no output。実 PSD/PNG/image/WASM/archive/sample fixture file は追加していない。 |
| Forbidden-boundary scan over `apps/editor/e2e` and `fixtures/e2e` | pass with expected hits | Hit は fixture の explicit non-claims、test guard strings、既存 preview smoke の deterministic data URL decode check。Domain G は file picker/import/decode/archive/parser implementation を追加していない。 |

## Pass Evidence

| Required evidence | Result |
|---|---|
| Binary refs survive browser save/load as metadata | `asset-io-boundary-smoke.mjs` が seeded load、browser save 後、browser reload + Load saved 後の 3 点で localStorage の package text を読み、PSD source、PSD texture、split source、split texture の 4 binary refs を完全比較する。 |
| Missing bytes / unsupported storage state is visible and truthful | PSD source/texture は `missing-package-local-bytes-v1; package-local bytes are missing`、split source/texture は `storage-unsupported-v1; current workflow cannot store bytes` を UI row で検証する。あわせて `metadata only; no editor file import or image decode` を検証する。 |
| PSD structured profile metadata path still works | Fixture と smoke が `layered-character-psd-profile-v1`、`wave22-e2e-psd-profile`、structured layer、texture relation、`structured-profile-preferred-v1` を検証する。 |
| Split PNG metadata path still works | Fixture と smoke が `split-png-set-v1`、`split-png-fallback-v1`、split layer、texture metadata、source/texture binary refs を検証する。 |
| No forbidden boundary introduced | No production source changes。No dependency manifest/lockfile diff。No real binary/image fixture files。No file picker, File API import, actual upload, archive import/export, PSD/PNG parser, or image decode implementation. |

## Review Result

Independent Review-Sylph verdict: `pass`.

Findings: blocking / high / medium / low すべてなし。Review-Sylph は basis docs、changed files、current diff/status、guard scans、e2e result を確認し、Domain G が e2e/smoke scope に収まっていることを確認した。

Review artifact:

- `discussion/implementation/reviews/wave22/wave22-domain-g-asset-io-boundary-smoke-and-persistence-review.md`

## Residual Risks

- この smoke は browser-local metadata persistence を確認するものであり、actual binary bytes、digest materialization、archive import/export、filesystem I/O、file picker は future scope のまま。
- Fixture は localStorage seed による metadata-only package document であり、real user file import flow は意図的に扱っていない。
- `fixtures/e2e` の path-like `.psd` / `.texture-bytes` references は metadata strings であり、実ファイル bytes ではない。将来 wave でもこの区別を維持する必要がある。

## Final

Domain G is `pass`. Domain H may proceed.
