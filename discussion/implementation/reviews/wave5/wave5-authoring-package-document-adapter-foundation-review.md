# Wave 5 Domain B Review: Authoring Package Document Adapter Foundation

> Review target: `wave5-authoring-package-document-adapter-foundation`
> 対象 completion: `discussion/implementation/waves/wave5/wave5-authoring-package-document-adapter-foundation-completion.md`
> Review lane: Design / Development Compliance Review, Test Adequacy Review
> Reviewer: Review-Sylph
> Date: 2026-05-29

## Findings

### Blocking

なし。

### Warning

なし。

## Verdict

`pass`。

Domain B の実装は、Wave 5 plan の `authoring-core` 責務に収まっている。`AuthoringSession` から保存用 `PackageDocumentDto` を再構成し、返却直前に `PackageDocumentSchema.parse` を通しているため、package-format public API の DTO として固定されている。

## Design / Development Compliance Review

- package-format public API 利用: `packages/authoring-core/src/to-package-document.ts:1`-`4` で `PackageDocumentSchema` / `PackageDocumentDto` を public package から import し、`packages/authoring-core/src/to-package-document.ts:16`-`25` で adapter の返却値を `PackageDocumentSchema.parse` に通している。
- manifest metadata: `packages/authoring-core/src/package-document-manifest.ts:13`-`17` は base manifest を clone したうえで、`packageRevision` を `session.packageRevision`、`updatedAt` を options/current time から反映している。base の `packageId`、`createdAt`、schema/evaluator versions、rights/provenance summary などは保持される。
- model files: `packages/authoring-core/src/package-document-model-files.ts:9`-`49` は graph / drawables / meshes / parameters / keyforms / rig controls / dynamics / masks / draw order を `session.graph` から再構成している。parameter と stable order は `packages/authoring-core/src/package-document-model-files.ts:10`-`17`、`packages/authoring-core/src/package-document-model-files.ts:26`-`29` に反映経路がある。
- assets: `packages/authoring-core/src/package-document-assets.ts:8`-`20` は source assets / provenance / rights を `session.graph` から戻しており、package file writer や filesystem IO は production code に入っていない。
- editor-only dirty state: production adapter は top-level object を `manifest` / `model` / `assets` だけで構成しており、`session.dirty` や `authoringRevision` を spread していない。`packages/authoring-core/src/package-document-model-files.ts:52`-`54` は base package の optional `editorState` を保持するだけで、session dirty state 由来ではない。
- Forbidden dependency: `authoring-core/src` に `operation-core` / `validator-core` / UI / renderer への新規 import は確認されなかった。fixture read の `node:fs` は `packages/authoring-core/src/package-document-adapter.test.ts:1` の test-only import。
- Source organization: `packages/authoring-core/src/index.ts:1`-`16` は re-export のみで、barrel-only policy を満たしている。production logic は manifest/model/assets/top-level adapter に分割されており、catch-all file は追加されていない。

## Test Adequacy Review

- minimal fixture roundtrip と schema parse は `packages/authoring-core/src/package-document-adapter.test.ts:21`-`34` で確認されている。
- parameter 追加後の parameter / stable order / package revision / updatedAt 反映は `packages/authoring-core/src/package-document-adapter.test.ts:36`-`55` で確認されている。
- base manifest metadata と assets provenance/rights の保持は `packages/authoring-core/src/package-document-adapter.test.ts:57`-`79` で確認されている。
- public barrel export は `packages/authoring-core/src/package-document-adapter.test.ts:81`-`83` で確認されている。

## Verification

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src` | pass。sandbox 内は node_modules read の `EPERM`、権限外実行で 4 files / 10 tests pass。 |
| `pnpm.cmd typecheck` | pass。sandbox 内は TypeScript binary read の `EPERM`、権限外実行で pass。 |
| `git diff --check -- packages/authoring-core/src discussion/implementation/waves/wave5/wave5-authoring-package-document-adapter-foundation-completion.md` | pass。`packages/authoring-core/src/index.ts` の LF/CRLF warning のみ。 |

## Source Organization Notes

- `index.ts` は public barrel としてのみ変更されている。
- helper files は `package-document-manifest.ts`、`package-document-model-files.ts`、`package-document-assets.ts` に責務分割されている。
- `package-document-adapter.test.ts` は adapter の小さな統合テストとして許容範囲。production logic を test file に持ち込んでいない。

## Residual Risks

- `session.dirty` / `authoringRevision` の非直列化は実装構造上は明確だが、テストでは「dirty session を保存しても DTO/JSON に dirty が存在しない」という負例 assertion までは置いていない。次に dirty state 周辺の session field が増える場合は、明示的な負例テストを追加するとよい。
- completion report の `pnpm typecheck` 結果は、レビュー時点の worktree では pass に変わっている。並列 domain 側の修正が入った後の状態と見られるため、Domain B の source issue ではない。
