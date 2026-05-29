# Wave 5 Domain B Completion: Authoring Package Document Adapter Foundation

> Wave: `package-persistence-and-operation-log-foundation`
> Domain: `wave5-authoring-package-document-adapter-foundation`
> Main module: `packages/authoring-core`
> 日付: 2026-05-29
> Verdict: `pass`

## 1. 変更ファイル

- `packages/authoring-core/src/to-package-document.ts`
  - `AuthoringSession` と base `PackageDocumentDto` から保存用 `PackageDocumentDto` を再構成する public adapter を追加。
- `packages/authoring-core/src/package-document-manifest.ts`
  - base manifest metadata を保持し、`packageRevision` と `updatedAt` だけを session / options から反映する責務ファイルを追加。
- `packages/authoring-core/src/package-document-model-files.ts`
  - session graph から model files を再構成する責務ファイルを追加。
- `packages/authoring-core/src/package-document-assets.ts`
  - session graph の source assets / provenance / rights を asset files に戻す責務ファイルを追加。
- `packages/authoring-core/src/package-document-adapter.test.ts`
  - minimal fixture roundtrip、parameter 追加後の document 反映、manifest metadata 保持、public barrel export を検証。
- `packages/authoring-core/src/index.ts`
  - public barrel として package document adapter 関連ファイルを re-export。

## 2. 実装サマリ

- `toPackageDocument(session, baseDocument, options)` を追加した。
- adapter は base `PackageDocumentDto` を受け取り、base manifest の `packageId` / `createdAt` / `schemaVersions` / `evaluatorVersions` / `rightsSummary` / `provenanceSummary` を保持する。
- `manifest.packageRevision` は `session.packageRevision`、`manifest.updatedAt` は `options.updatedAt` または現在時刻から反映する。
- model body は `session.graph` の parts / drawables / meshes / parameters / keyforms / rig controls / dynamics / masks / draw order / stable order を使って再構成する。
- assets body は `session.graph.sourceAssets` / `provenanceRecords` / `rightsRecords` から再構成する。
- 返却直前に `PackageDocumentSchema.parse` を通して、package-format public API の DTO として固定する。
- package file 書き込みは行っていない。
- `session.dirty` や undo/redo などの editor-only dirty state は package document に入れていない。

## 3. テストと検証

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/authoring-core/src/package-document-adapter.test.ts` | pass。sandbox EPERM 後、権限外実行で 1 file / 4 tests pass。 |
| `pnpm exec vitest run packages/authoring-core/src` | pass。sandbox EPERM 後、権限外実行で 4 files / 10 tests pass。 |
| `pnpm typecheck` | fail。sandbox EPERM 後、権限外実行。失敗箇所は `packages/runtime-core/src/runtime-state-sequence-artifacts.ts(111,48)` の `label: string | undefined` と `exactOptionalPropertyTypes` の不一致。Domain B 許可範囲外の parallel domain 変更のため未修正。 |
| `pnpm check:source` | pass。 |
| `pnpm check:deps` | pass。 |
| `git diff --check -- packages/authoring-core/src discussion/implementation/waves/wave5/wave5-authoring-package-document-adapter-foundation-completion.md` | pass。`packages/authoring-core/src/index.ts` の LF/CRLF warning のみ。 |

## 4. Boundary Checks

- `authoring-core` から `package-format` public API の `PackageDocumentDto` / `PackageDocumentSchema` を利用した。package-format schema は変更していない。
- `operation-core` / `runtime-core` / `validator-core` / `contracts` / `fixtures` / `apps` / `pnpm-lock.yaml` は編集していない。
- package file set writer、OS filesystem、zip writer、browser save adapter は実装していない。
- `authoring-core` の dependency boundary test は pass し、operation-core / validator-core への forbidden import は追加していない。
- `runtime-core` import は既存 runtime graph adapter 許可ファイルに限定されたまま。

## 5. Source Organization Notes

- `index.ts` は re-export のみを維持。
- manifest / model files / assets / top-level adapter を別ファイルに分けた。
- テストは `package-document-adapter.test.ts` に集約した。対象 adapter の統合的な振る舞いを見るための小さな責務テストであり、production logic は含めていない。
- broad catch-all file は追加していない。

## 6. 残リスク

- `packageRevision` の increment 自体は operation-core Domain A の責務であり、この adapter は現在の `session.packageRevision` を保存 DTO に反映するだけ。
- `updatedAt` の clock 注入は `options.updatedAt` に留めた。operation lifecycle からの統合時は commit 時刻を渡す想定。
- manifest の rights/provenance summary は base manifest を保持する。source asset count などの再計算が必要になった場合は package-format / validator 側の方針と合わせて別 domain で扱う必要がある。
