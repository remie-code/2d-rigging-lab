# Mesh Wave 1 Domain C レビュー: 世代切替UI(v6/v7 method トグル + 3プリセット)

> レビュー: Review-Sylph(サブエージェント委任 / Orch-Sylph Mesh Wave 1 Domain C)
> 対象: Gnome 完了レポート [domain-c-report.md](../../waves/mesh-wave1/domain-c-report.md) の実装
> 判定基準: [mesh-wave1-plan.md](../../orchestration/mesh-wave1-plan.md) §7 / ユーザー判断(2026-07-07)
> 実施日: 2026-07-07

---

## 判定: **合格**

自分で確認した差分・自分で実行したテスト結果に基づき、§7 の全要件とユーザー判断がすべて満たされていることを確認した。scope 逸脱なし、新規 tsc エラーなし、対象テスト全 green。Gnome の主張との重大な食い違いはなし(パス表記の軽微な誤りが1件あるが実害なし。§差分・残課題に記載)。

---

## 設計適合(§7 各要件 + ユーザー判断)

### 観点1: 薄さ / 撤去容易性(最重要) — **合格**

method 分岐が本当にトグル section・state・preview 受け渡しの3点に閉じていることを差分と grep で実証した。

- **v7 method 文字列のハードコード分岐がゼロ**: `mesh-tool-inspector.tsx` / `editor-session-context.tsx` の両方を grep したが、`auto-outline-v7-margin-contour` の文字列リテラルは UI/context のどこにも出現しない(選択肢配列 `MESH_GENERATION_METHOD_CHOICES` の単一定義のみ)。method は完全に不透明なデータパラメータとして流れる。
  - inspector 内の method 比較は3箇所のみ: `nextMethod === method`(selectMethod の no-op ガード)、`method === candidate.method`(トグルボタンの active 表示、トグル section 内部)。いずれも v7 固有の枝ではない。
  - context 内には `v7` 参照すら0件。診断カード・apply 経路に method-条件分岐は増えていない。
- **診断/apply/プリセットへの漏れなし**: apply 経路(`editor-session-context.tsx` L1949)は `commitGenerateMesh(..., draft.method, ...)` を既存のまま使い、`draft.method` に選択値が載るだけ。commands 側は既に可変で無変更。provenance は既存 `createMeshPreviewProvenanceId`/`formatMethodProvenanceSuffix` に委譲(v7専用の別カード・別スキーマ新設なし)。
- **撤去容易性の構造検証**: `previewMeshDraft`/`previewMeshDrafts`/`createMeshToolDraft` の `method` 引数は optional で既定 `DEFAULT_MESH_GENERATION_METHOD`。したがって v6削除時は「(a) `MESH_GENERATION_METHOD_CHOICES` から1行削除、(b) inspector の `mesh-tool-generation-toggle` section ブロック撤去」で評価機構が消え、`method` 引数を落とさなくても全 call site が既定 v6 に戻る。消し残る method 依存の枝は存在しない。**この「配列1行 + section 撤去」の撤去容易性を差分から実際に確認した。**

### 観点2: 既定の同一性 — **合格**

- 初期 state: `useState(DEFAULT_MESH_GENERATION_METHOD_CHOICE.method)`(inspector L56-58)。
- `DEFAULT_MESH_GENERATION_METHOD_CHOICE = MESH_GENERATION_METHOD_CHOICES[0]` かつ配列先頭が `auto-outline-v6d-adaptive-contour-constrainautor`(mesh-tool-state.ts)。
- 引数省略時: `previewMeshDraft`/`previewMeshDrafts` の default param が `DEFAULT_MESH_GENERATION_METHOD`(context L1882/L1902)。
- provenance の v7 suffix 非付与: `formatMethodProvenanceSuffix`(mesh-tool-state.ts L256-257)は `method === DEFAULT_MESH_GENERATION_METHOD` のとき `""` を返す。既定トグルで provenance ID に v7 suffix が付かない=既存挙動不変を確認。テスト `mesh-tool-state.test.ts` の既定同一性 assert で固定。

### 観点3: method の実配線 — **合格**

トグルで v7 を選ぶ経路を実配線で追跡: `selectMethod(v7)` → `generatePreviewWithMethod(presetId, v7)` → `previewMeshDraft(id, preset, v7)` → `createMeshToolDraft({ method: v7 })` → `draft.method = input.method`(context L2695) → apply 時 `commitGenerateMesh(..., draft.method, ...)`(L1954)。**途中で DEFAULT に握り潰される箇所はない。** diff で `DEFAULT_MESH_GENERATION_METHOD` 直参照5箇所がすべて `input.method` に差し替わっていることを確認。実生成テスト `mesh-tool-generation-method.test.ts` で `draft.method === "auto-outline-v7-margin-contour"`(fallback ではなく本体生成成功)を assert。

### 観点4: プリセット写像の維持 — **合格**

largeMotion/standard/lowMotion → densityHint high/medium/low の写像は既存 `MESH_GENERATION_PRESETS` を無変更で使用。テストで `qualityMetrics.v6Metrics.preset` が high/medium/low になること、かつ method 不変を assert。enum 変更なし。

### 観点5: scope 遵守 — **合格**

`git status` で Gnome の変更が `apps/editor/src/` 配下の4変更 + 1新規のみであることを確認:
- `packages/**` 無変更(working tree の `packages/authoring-core/*` 変更は Domain A/B 由来、Gnome 着手前から存在)。
- `package.json` / `apps/editor/package.json` / `pnpm-lock.yaml` 無変更。
- 17 method の全露出なし(配列は定数2件)。v7 品質数値 UI 表示なし(preview カードは既存経路のまま、provenance 焼き込みのみ)。preview スキーマ(`model-edit.ts` v6Metrics 枠)無変更。

---

## テスト適合

### Required tests(§7)の実装状況 — すべて実装済み

| Required test | 実装 | ファイル |
|---|---|---|
| トグルで generateMesh payload の method が切り替わる(v7選択→method=v7) | ✓ | `mesh-tool-generation-method.test.ts` |
| v6→method=v6(既定選択で現行 method 維持) | ✓ | 同上 + `DEFAULT_MESH_GENERATION_METHOD` 一致 assert |
| 既定が現行 method のまま | ✓ | `mesh-tool-state.test.ts`(既定同一性)+ generation-method 既定パス |
| プリセット→densityHint(high/medium/low) | ✓ | `mesh-tool-generation-method.test.ts` |
| 既存 mesh-tool テストの無傷 | ✓ | inspector 11件 green |

いずれも意味のある assert(具体値の直接照合)であり、トートロジーではない。

### 自分で実行した結果

対象テスト(`packages/authoring-core` の Domain A/B 変更が working tree に載った現状で実行):

```
mesh-tool-state.test.ts               5 tests ✓
mesh-tool-inspector.test.ts          11 tests ✓
mesh-tool-generation-method.test.ts   3 tests ✓
→ Test Files 3 passed / Tests 19 passed
```

隣接回帰(export化・method引数化の波及確認):

```
editor-session-context-history.test.ts  25 tests ✓
editor-session-commands.test.ts         17 tests ✓
mesh-apply-auto-refit.test.ts            5 tests ✓
→ 47 tests passed
```

すべて green。Gnome のレポートの件数(19 / 47)と一致。

### typecheck / check:source — Gnome 主張を裏取り済み

- `check:source`(`node scripts/check-source-organization.mjs`): `Source organization guard passed.`
- typecheck(`tsc --noEmit -p apps/editor/tsconfig.json`): Gnome の触ったファイルで検出される TS2352 は2件のみ:
  - `mesh-tool-state.test.ts(96,10)` / `mesh-tool-inspector.test.ts(592,10)`。
  - **stash による baseline 検証を自分で実施**: Gnome の変更を stash した pristine 状態で同一エラーが `mesh-tool-state.test.ts(76,10)`(=Gnome の+20行テストブロック挿入で96行目にシフトした同一の `as AuthoringSession` フィクスチャキャスト)/ `mesh-tool-inspector.test.ts(592,10)`(不変)に存在することを確認。**Gnome の新規追加行が原因ではない既存事象**。よって「Gnome の変更ファイルに新規 tsc エラーが増えていない」の gate を満たす。
- editor 全体 tsc の残る赤(viewer-* / diagnostics 等)は既知 baseline 事象で対象外。

---

## 裁量判断(設計未定義を埋めた箇所の妥当性)

1. **`createMeshToolDraft` の export** — **妥当**。Required test「トグルで method が切り替わる」を、React レンダリング無しの薄いユニット seam で担保する最小コスト手段。UI/挙動への影響なし(module-private → export の可視性変更のみ)。context Provider レンダリングのフックテストより明らかに薄く、v6削除時の撤去容易性も損なわない。承認する。
2. **トグルラベル「Current」/「v7」** — **妥当だが要ユーザー確認(下記質問)**。既存 UI ラベルが英語("Large Motion" 等)である慣行に整合させた判断は合理的。ユーザー判断は文言を固定しておらず、評価用の薄い実装なので機能上の問題はない。ただし「Current」は将来 v6 が削除されると意味が反転する語なので、文言確定はユーザーに委ねるべき(実装差し替えは1行)。
3. **preview key に method 追加**(`${drawableId}:${presetId}:${method}`) — **妥当**。同一 drawable/preset で method のみ切替時に auto-preview を再発火させるために必要。key の意味論的正しさを担保しており、副作用なし。
4. **`generatePreviewWithMethod` 基底 + `generatePreview` 委譲 / method 明示引数** — **妥当**。同一レンダー内 setState の stale closure(古い `method`)回避のため method を明示引数で渡す設計は React の正しいパターン。
5. **新規テストファイルを世代切替専用に隔離** — **妥当**。v6削除時にこのファイルを落とすだけで評価テストも消える薄さに整合。

---

## 差分・残課題

**要修正: なし**(判定=合格)。

軽微な指摘(修正不要、記録のみ):

- **Gnome レポート §4 のパス誤記**: 隣接回帰として挙げた `mesh-apply-auto-refit.test.ts` の所在を `apps/editor/src/features/editor-session/` と記載しているが、実ファイルは `.../editor-session/model/mesh-apply-auto-refit.test.ts`。ファイルは実在し 5 tests green を自分で確認済みなので実害なし。同様に新規テスト `mesh-tool-generation-method.test.ts` が `import { createMeshToolDraft } from "./editor-session-context"` かつ `DEFAULT_MESH_GENERATION_METHOD` を `./model/mesh-tool-state` から取っており、配置(`features/editor-session/`)と相対 import は整合。
- **plan §7 と実ファイルのパス表記差異**: plan §7 は `mesh-tool-state.ts` を `apps/editor/src/workspace/panels/` と表記するが実体は `apps/editor/src/features/editor-session/model/`。Gnome は裁量 §6-6 でこれを認識し後者を正として実装済み。委任プロンプトの Allowed scope とも一致しており正しい。plan 側の表記が古いだけで、実装は正しい場所。

---

## 質問(ユーザー判断が要る点)

1. **トグルラベル「Current」/「v7」の文言確定**(裁量判断2)。機能は正しく、差し替えは1行。日本語 UI 文言(例: プリセットの「大きく動く」に揃える)を希望するか、英語短ラベル維持でよいかの確認のみ。「Current」は v6 削除後に意味が反転する点も含めて判断されたい。実装完了済みでブロッカーではない。
