# Wave 5 Domain D Review: Runtime Evidence Artifact Materializer

> Review target: `wave5-runtime-evidence-artifact-materializer`
> Reviewer: Review-Sylph / clean context
> 日付: 2026-05-29
> Verdict: `pass`（non-blocking finding あり）

## Findings

### Blocking

なし。

### Non-blocking

1. `packages/runtime-core/src/dependency-boundary.test.ts:11` の forbidden sibling import 検査は bare package import だけを検出し、`@private-2d-rigging-lab/package-format/...` のような subpath import を検出できない。現時点の production source に forbidden sibling import は見つからなかったが、Wave 5 plan が求める runtime-core isolation の regression test としては少し弱い。`(?:$|/)` まで含めて package subpath も拒否する形に広げるとよい。

2. Snapshot artifact は path 重複時に後続 artifact を黙って捨てる実装になっている（`packages/runtime-core/src/runtime-snapshot-artifacts.ts:46`, `packages/runtime-core/src/runtime-snapshot-artifacts.ts:50`）。一方、generated snapshot IDs も `Set` で重複排除される（`packages/runtime-core/src/runtime-evidence.ts:115`, `packages/runtime-core/src/runtime-evidence.ts:240`）。現在の default evidence では baseline/candidate frame index が分かれるため通るが、同じ `snapshotId` で内容が異なる snapshot が来た場合の失敗検出がない。次の fixture で同一 frame の before/after snapshot を扱うなら、ID 衝突を避けるか、重複 path で内容差分がある場合は throw するテストを足すのが安全。

## Design / Development Compliance Review

runtime-core の責務範囲に収まっている。artifact helper は in-memory の `{ path, mediaType, content }` を返すだけで、package writer / filesystem writer / zip writer は呼んでいない。

- Snapshot path は `runtime/snapshots/*.runtime-snapshot.json`（`packages/runtime-core/src/runtime-snapshot-artifacts.ts:13`, `packages/runtime-core/src/runtime-snapshot-artifacts.ts:26`）。
- State path は `runtime/states/*.runtime-state.json`（`packages/runtime-core/src/runtime-state-artifacts.ts:46`）。
- Sequence path は `runtime/state-sequences/*.runtime-state-sequence.json`（`packages/runtime-core/src/runtime-state-artifacts.ts:53`）。
- materializer は generated snapshot/state/sequence refs に対応する artifact path を検査しており、不一致は throw する（`packages/runtime-core/src/runtime-evidence-artifacts.ts:94`, `packages/runtime-core/src/runtime-evidence-artifacts.ts:103`, `packages/runtime-core/src/runtime-evidence-artifacts.ts:109`, `packages/runtime-core/src/runtime-evidence-artifacts.ts:115`）。
- sequence artifact は `states` を initial から開始し、各 frame evaluation 後に `states.push(currentState)` している（`packages/runtime-core/src/runtime-state-sequence-artifacts.ts:93`）。`states.length === frameCount + 1` も明示的に検査される（`packages/runtime-core/src/runtime-state-sequence-artifacts.ts:144`）。
- `index.ts` は re-export のみで、barrel-only を維持している（`packages/runtime-core/src/index.ts:1`-`packages/runtime-core/src/index.ts:16`）。

Production source の forbidden sibling import / fs import は追加確認で no matches。test file の `node:fs` 利用は dependency-boundary test 自身の検査実装であり、production source IO ではない。

## Test Adequacy Review

Domain D の主契約は概ねテストされている。

- ref/path 一致、snapshot artifact、final state artifact、sequence artifact materialization は `packages/runtime-core/src/runtime-evidence-artifacts.test.ts:29` で検査されている。
- sequence の `states[0]` initial / `states[i + 1]` post-frame は `packages/runtime-core/src/runtime-evidence-artifacts.test.ts:69` で複数 frame に対して検査されている。
- existing runtime evidence refs の schema-validity は `packages/runtime-core/src/runtime-evidence.test.ts:65` 以降で検査されている。
- dependency boundary と production source fs import 禁止は `packages/runtime-core/src/dependency-boundary.test.ts:8` と `packages/runtime-core/src/dependency-boundary.test.ts:24` に追加されている。

残る test gap は上記 findings の通り、subpath import regression と snapshot ID/path collision の扱い。

## Verification

- `pnpm.cmd exec vitest run packages/runtime-core/src`: pass。sandbox では `node_modules` 読み取りが EPERM になったため外部権限で再実行。6 files / 12 tests pass。
- `pnpm.cmd typecheck`: pass。sandbox では TypeScript の `node_modules` 読み取りが EPERM になったため外部権限で再実行。
- `git diff --check -- packages/runtime-core/src discussion/implementation/waves/wave5/wave5-runtime-evidence-artifact-materializer-completion.md`: pass。LF/CRLF warning のみ。
- `rg -n -g '!*.test.ts' '@private-2d-rigging-lab/(package-format|authoring-core|operation-core|validator-core)' packages/runtime-core/src`: no matches。
- `rg -n -g '!*.test.ts' 'from "node:fs"|from "node:fs/promises"|from "fs"|from "fs/promises"|from ''node:fs''|from ''node:fs/promises''|from ''fs''|from ''fs/promises''' packages/runtime-core/src`: no matches。

## Source Organization Notes

責務分割は妥当。

- JSON serialization: `runtime-artifact-json.ts`
- snapshot artifact: `runtime-snapshot-artifacts.ts`
- state artifact/ref: `runtime-state-artifacts.ts`
- state sequence artifact: `runtime-state-sequence-artifacts.ts`
- evidence artifact set/alignment: `runtime-evidence-artifacts.ts`

catch-all file や `index.ts` 実装肥大化は見つからなかった。

## Residual Risks

- Snapshot artifact ref schema はまだ contracts 側に専用定義がなく、snapshot ID から runtime-core helper が path を導出している。統合 fixture で package file set entry と同じ規約として固定する必要がある。
- `inputFramesHash` は optional のまま。厳密 replay fixture で必須にするなら、hash policy の契約判断が別途必要。
- baseline sequence artifact は `RuntimeEvidenceResult.generatedRuntimeStateSequenceRefs` には含まれていない。現状は candidate generated evidence としては一貫しているが、before/after 両方の replay artifact を保存する要求が出た場合は API 拡張が必要。
