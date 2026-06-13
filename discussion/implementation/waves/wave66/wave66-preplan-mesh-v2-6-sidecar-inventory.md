# Wave66 Preplan Inventory: Mesh auto-outline-v2.6 Soft Apron Sidecar

- Status: pass
- Scope: read-only delegated inventory
- Purpose: Wave66の本線であるCanvas Evaluationと独立に、Mesh V2.6をsidecarとして実装できるか棚卸する。

## 1. 根拠

- [auto-outline-v2.6 Soft Apron](../../../design/mesh-generation/auto-outline-v2-6-soft-apron.md)
- [auto-outline-v2.5 Soft Boundary](../../../design/mesh-generation/auto-outline-v2-5-soft-boundary.md)
- [Mesh Tool Component](../../../design/screen-design/components/mesh-tool.md)
- [Canvas Evaluation Pipeline v0](../../../design/canvas-evaluation/canvas-evaluation-pipeline-v0.md)

## 2. 主要事実

- V2.5のheadless実装は `packages/authoring-core/src/mesh-outline-v2-5-soft-boundary-generation.ts` にある。
- algorithm routingは `packages/authoring-core/src/mesh-generation.ts` にある。
- metricsは `packages/authoring-core/src/mesh-quality-metrics.ts` にある。
- operation payload / method schemaは `packages/operation-core/src/payloads/model-edit.ts` と `packages/operation-core/src/operations/generate-mesh.ts` に関係する。
- Editor preset wiringはalgorithm選択ではなくdensity hint中心である。
- Editor preview / apply は現時点でV2.5を明示的に呼ぶ経路を持つ。
- Canvas Evaluation本線はmeshDraftを評価入力として扱うだけで、mesh algorithm詳細へ依存しない。

## 3. 推奨境界

V2.6はWave66のsidecar domainとして扱う。

推奨:

- `auto-outline-v2.6-soft-apron` を明示methodとして追加する。
- V2.5をdefaultとして残す。
- V2.6を比較可能なheadless methodとして実装する。
- Editor default切替はWave66内の必須にしない。
- Canvas renderer / Canvas evaluationには触らない。

想定touch scope:

- `packages/authoring-core/src/mesh-outline-v2-6-soft-apron-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- focused package tests

## 4. テスト観点

必要なheadless tests:

- same inputでdeterministic output。
- V2.6 method / source / metricsが報告される。
- V2.5相当の内部密度を保つ。
- V2.5よりboundary / apron coverageが増える。
- V3のような大きなenvelopeにならない。
- outer apronがDrawable boundsまたは許容範囲を大きく逸脱しない。
- boundary-to-interior long edgeがtarget edge length比で抑制される。
- high valence fan集中が悪化しない。
- triangle count増加がV2.5から大きく増えすぎない。
- fallback reason / quality summary が operation provenance に残る。

Editor / E2E tests:

- algorithm selectorを追加しない限り不要。
- Editor defaultがV2.5のままであることは既存editor default testで守る。

## 5. 未解決だがWave66内で方針を切る事項

- method id:
  - 推奨: `auto-outline-v2.6-soft-apron`
- fallback chain:
  - 推奨: `v2.6 -> v2.5 -> v2 -> v1 -> bounds-grid`
- metrics shape:
  - 推奨: V2.6専用metricsを足すか、V2.5 metricsを互換拡張する。実装者判断でよいがalgorithm idは明確に分ける。
- apron ratio / ring count:
  - 推奨: docの比率範囲からpresetごとに初期値を切り、テストで過剰密度と過剰envelopeを抑える。
- gap refill:
  - 推奨: 初回はlocal / boundedに限る。全体包絡へ戻してはいけない。

