# Wave 8 Domain E Completion

> Domain: `wave8-editor-ai-command-host-integration`
> Date: 2026-05-29
> Verdict: `pass`

## 実装結果

- `apps/editor` に test-facing in-process AI command host を追加した。
- editor workflow から `getEditorState` / `getOperationLog` / `dryRunOperation` / `commitOperation` を実行できるようにした。
- AI commit は `operation-core` の generic operation request 経由で処理し、authoring state、package revision、operation log を更新する。
- AI operation provenance は `actor: "ai"` / `surface: "structuredApi"` に限定し、human/gui provenance の AI command は reject する。
- provenance rejection も transcript に記録する。
- load / reset 時に stale approval が残らないよう、workflow session と AI host を再生成する。
- save / load 後も AI operation log entry が保持されることを固定した。

## 変更ファイル

- `apps/editor/package.json`
- `apps/editor/src/ai-command-host/**`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `pnpm-lock.yaml`

## 検証

| Check | Result |
|---|---|
| `pnpm exec vitest run apps/editor/src/ai-command-host apps/editor/src/editor-session apps/editor/src/editor-workflow` | pass |
| `pnpm --filter @private-2d-rigging-lab/editor typecheck` | pass |
| `pnpm check:source` | pass |
| `pnpm check:deps` | pass |

## 残課題

なし。visible AI approval UI と transport adapter は後続 wave の対象。
