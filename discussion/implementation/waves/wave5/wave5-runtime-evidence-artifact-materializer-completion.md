# Wave 5 Domain D Completion: Runtime Evidence Artifact Materializer

> Wave: `package-persistence-and-operation-log-foundation`
> Domain: `wave5-runtime-evidence-artifact-materializer`
> Main module: `packages/runtime-core`
> 日付: 2026-05-29
> Verdict: `pass`

## 1. 変更ファイル

- `packages/runtime-core/src/runtime-artifact-json.ts`
  - runtime generated artifact 用の JSON serialization と media type を分離。
- `packages/runtime-core/src/runtime-snapshot-artifacts.ts`
  - `RuntimeSnapshotDto` から `runtime/snapshots/*.runtime-snapshot.json` の in-memory artifact を作る helper を追加。
- `packages/runtime-core/src/runtime-state-artifacts.ts`
  - 既存 state ref helper に、`RuntimeStateDto` から `runtime/states/*.runtime-state.json` を作る helper を追加。
- `packages/runtime-core/src/runtime-state-sequence-artifacts.ts`
  - sequence evaluation を states 付きで実行し、`RuntimeStateSequenceArtifact` と `runtime/state-sequences/*.runtime-state-sequence.json` artifact を作る helper を追加。
- `packages/runtime-core/src/runtime-evidence-artifacts.ts`
  - `buildRuntimeEvidence` 結果から snapshot / final state / sequence artifacts を materialize し、generated refs と artifact paths の一致を検査。
- `packages/runtime-core/src/runtime-evidence-artifacts.test.ts`
  - materialized artifact、ref/path一致、sequence states semantics のテストを追加。
- `packages/runtime-core/src/runtime-evidence.ts`
  - sequence ref を materializable な candidate sequence artifact から導出するよう変更。
- `packages/runtime-core/src/dependency-boundary.test.ts`
  - runtime-core production source が filesystem IO を import しない検査を追加。
- `packages/runtime-core/src/index.ts`
  - barrel re-export のみ追加。
- `discussion/implementation/waves/wave5/wave5-runtime-evidence-artifact-materializer-completion.md`
  - この完了報告。

## 2. 実装サマリ

- runtime evidence から package-relative generated artifact entries を in-memory で作る helper を追加した。OS filesystem / package writer / zip writer は呼んでいない。
- snapshot artifact path は `runtime/snapshots/<snapshotId>.runtime-snapshot.json` とし、`generatedRuntimeSnapshotIds` から導ける path と materialized artifact path を一致させた。
- final state artifact path は既存の `createRuntimeStateArtifactRef` を使い、`generatedRuntimeStateRefs` / `finalRuntimeStateRef` と materialized path を一致させた。
- sequence artifact は `evaluateRuntimeStateSequenceArtifact` が `states[0]` initial、`states[i + 1]` post-frame を構築し、`frameCount + 1` と一致しない場合は artifact 化しない。
- `buildRuntimeEvidence` の sequence ref は、candidate sequence artifact を生成できた場合の ref から導出する。ref だけが存在して artifact がない状態を避けた。
- runtime artifact JSON は schema parse 済み DTO を deterministic pretty JSON + trailing newline で返す。

## 3. テストと検証

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/runtime-core/src` | pass。sandbox では `node_modules/.../vitest.mjs` 読み取りが EPERM になったため、外部権限で再実行。6 files / 12 tests pass。 |
| `pnpm typecheck` | pass。 |
| `pnpm check:source` | pass。 |
| `pnpm check:deps` | pass。 |
| `git diff --check -- packages/runtime-core/src discussion/implementation/waves/wave5/wave5-runtime-evidence-artifact-materializer-completion.md` | pass。runtime-core 変更ファイルの LF/CRLF warning のみ。 |
| `rg '@private-2d-rigging-lab/(package-format\|authoring-core\|operation-core\|validator-core)' packages/runtime-core/src -n` | pass。no matches。 |
| `rg -g '!*.test.ts' 'node:fs\|fs/promises\|from "fs"\|from ''fs''' packages/runtime-core/src -n` | pass。production source no matches。 |

## 4. Boundary Checks

- `runtime-core` production source は `contracts` と runtime-core 内部 file のみを使い、`package-format` / `authoring-core` / `operation-core` / `validator-core` を import していない。
- package IO は未実装。artifact は `{ path, mediaType, content, ... }` の in-memory object として返す。
- `contracts` schema 変更は不要だったため、許可範囲外編集や escalation は発生していない。
- dependency boundary test は sibling package import 禁止に加え、production source の filesystem IO import 禁止を検査する。

## 5. Source Organization Notes

- `index.ts` は re-export のみを維持。
- responsibility split:
  - JSON serialization: `runtime-artifact-json.ts`
  - snapshot artifact: `runtime-snapshot-artifacts.ts`
  - state artifact / ref: `runtime-state-artifacts.ts`
  - state sequence artifact: `runtime-state-sequence-artifacts.ts`
  - runtime evidence artifact set: `runtime-evidence-artifacts.ts`
- `runtime-evidence.ts` は evidence assembly の責務を維持し、artifact content 生成は `runtime-evidence-artifacts.ts` へ分離した。
- broad catch-all file は追加していない。

## 6. 残リスク

- `RuntimeSnapshotId` には現時点で専用 artifact ref schema がないため、snapshot artifact path は runtime-core helper の規約として `snapshotId` から導出している。統合 fixture 側で package file set entry と合わせて固定する必要がある。
- `inputFramesHash` は optional のまま。厳密 replay fixture で hash を必須化する場合は、hash policy を別 domain / contract 判断として固定する必要がある。
- sequence artifact は candidate evidence の artifact を返す。baseline sequence artifact は comparison 用 snapshot生成には使うが、現行 `RuntimeEvidenceResult` の generated refs には含めていない。
