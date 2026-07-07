# Mesh Wave 1 Domain C 完了レポート: 世代切替UI(v6/v7 method トグル + 3プリセット)

> Status: Implemented(2026-07-07)
> Domain id: `mesh-wave1-generation-ui`
> 実装: Gnome(サブエージェント委任 / Orch-Sylph Mesh Wave 1 Domain C)
> 設計の正: [mesh-wave1-plan.md](../../orchestration/mesh-wave1-plan.md) §7 / ユーザー判断(2026-07-07)

---

## 1. 契約前提の確認(実装前 grep)

- v7 method ID `auto-outline-v7-margin-contour` は `packages/authoring-core/src/mesh-generation-contract.ts` に実在(L148 method IDs / L179 candidate)。
- `GENERATED_MESH_PREVIEW_COMMIT_METHOD_IDS`(L217-227)に v7 が `...V7_MESH_GENERATION_METHOD_IDS` 経由で含まれ、`GeneratedMeshPreviewCommitMethod`(L229-230)に v7 が乗ることを確認。
- 現行既定 `auto-outline-v6d-adaptive-contour-constrainautor`(L122)も同 enum に含有。
- ディスパッチャ側 v7 分岐(`mesh-generation.ts` L18/1065/1126)は Domain B が配線済みで、v7 生成が実際に成功(下記テストで v7 draft が生成される=fallback ではなく本体出力)することを確認。

→ **契約・型・ディスパッチャすべて充足。実装可能と判断し着手。escalate 不要。**

## 2. 変更/作成ファイル一覧(リポジトリ相対)

変更:
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts` — method 選択肢配列 `MESH_GENERATION_METHOD_CHOICES` と `DEFAULT_MESH_GENERATION_METHOD_CHOICE` を新設(既定定数の周辺)。
- `apps/editor/src/features/editor-session/editor-session-context.tsx` — `previewMeshDraft`/`previewMeshDrafts` に optional `method` 引数を追加、`createMeshToolDraft` を `method` 入力化(内部の `DEFAULT_MESH_GENERATION_METHOD` 参照5箇所を `input.method` へ差し替え)。`createMeshToolDraft` をテスト用に `export`。
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx` — 世代トグル UI section と `method` 選択 state・`selectMethod` ハンドラを追加。preview 呼び出し3経路(auto-preview effect / preset / regenerate)に method を受け渡し。
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts` — 選択肢配列の契約テストを追加。

作成:
- `apps/editor/src/features/editor-session/mesh-tool-generation-method.test.ts` — method 焼き込みとプリセット→densityHint 写像のエンドツーエンド配線テスト(新規)。

**`packages/**` は一切変更していない。package.json / lockfile 無変更。**

## 3. 実装の要点(薄さの担保)

### トグルの構造 / method 選択肢配列の場所
- 選択肢は **定数2件の配列** `MESH_GENERATION_METHOD_CHOICES`(`mesh-tool-state.ts`)に1箇所定義。各要素は `{ method, label }`。
  - `[0]` = `auto-outline-v6d-adaptive-contour-constrainautor`(label "Current")= **既定・先頭**
  - `[1]` = `auto-outline-v7-margin-contour`(label "v7")
- `DEFAULT_MESH_GENERATION_METHOD_CHOICE = MESH_GENERATION_METHOD_CHOICES[0]`。初期選択・未操作時のフォールバックはこの先頭を指す。
- 既定の同一性: `DEFAULT_MESH_GENERATION_METHOD_CHOICE.method === DEFAULT_MESH_GENERATION_METHOD` をテストで固定。これにより既定トグルが既存の provenance 挙動(v6=suffix 無し)を保つ。

### method 分岐を UI 全体に散らさない
- method 依存は「トグル UI section 1ブロック(`data-testid="mesh-tool-generation-toggle"`)+ `method` state + preview 呼び出しへの受け渡し」に閉じている。
- 診断カード・apply ロジック・プリセットロジックには method 依存の枝を**増やしていない**(既存の `draft.method` 表示は元から存在する経路をそのまま使用)。
- provenance への v7 焼き込みは既存 `createMeshPreviewProvenanceId`/`formatMethodProvenanceSuffix`(既定と異なる method のとき suffix 付与)に委譲。v7 専用の別診断カード・別スキーマは新設していない。
- payload への波及: `previewMeshDraft(method)` → `createMeshToolDraft({ method })` → `draft.method`。apply 時は既存 `commitGenerateMesh(..., draft.method, ...)` がそのまま v7 を payload の method に載せる(commands 側は既に可変化済みのため無変更)。

### v6削除時に何を消せば評価機構が消えるか
1. `mesh-tool-inspector.tsx` の `mesh-tool-generation-toggle` section ブロックを撤去(コメントで明示済み)。
2. `mesh-tool-state.ts` の `MESH_GENERATION_METHOD_CHOICES` から不要行を消す(v7 単独運用なら配列を畳む / v6 廃止なら v6 行削除)。
3. インスペクタの `method` state・`selectMethod`・`generatePreviewWithMethod` を撤去し `previewMeshDraft` 呼び出しの method 引数を落とす(引数は optional 既定=現行 method なので、外しても既定挙動に戻る)。

配線の中心が3ファイルの限定箇所に閉じており、UI 全体への散在はない。

## 4. テスト結果

### 追加/更新テストの内容
- `mesh-tool-state.test.ts`:
  - `MESH_GENERATION_METHOD_CHOICES` が `[v6d-adaptive, v7]` の順で先頭=既定であること、`DEFAULT_MESH_GENERATION_METHOD_CHOICE` が先頭かつ現行 method と一致すること、v7 選択時 provenance ID に v7 トークンが乗ることを assert。
- `mesh-tool-generation-method.test.ts`(新規、実生成ハーネス使用):
  - **v7 を選ぶと `draft.method === "auto-outline-v7-margin-contour"`**(v7 本体生成が成功=fallback ではない)。
  - **既定(v6)を選ぶと `draft.method === "auto-outline-v6d-adaptive-contour-constrainautor"` のまま**、`DEFAULT_MESH_GENERATION_METHOD` と一致。
  - **プリセット largeMotion/standard/lowMotion → densityHint high/medium/low** に写像され、method は不変(既存挙動維持確認)。

### 実行結果(mesh-tool 系)
```
apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts        5 tests  ✓
apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts               11 tests  ✓
apps/editor/src/features/editor-session/mesh-tool-generation-method.test.ts  3 tests  ✓
Test Files 3 passed / Tests 19 passed
```
- 既定(初回描画・未操作時)が現行 method のまま: `mesh-tool-state.test.ts` の既定同一性 + `mesh-tool-generation-method.test.ts` の既定パスで担保。
- 既存 mesh-tool テスト無傷: inspector 11件(既存)全 green。
- 隣接する context/commands 回帰も確認: `editor-session-context-history.test.ts`(25)/ `editor-session-commands.test.ts` / `mesh-apply-auto-refit.test.ts` = 計47 tests 全 green(`createMeshToolDraft` の export 化・method 引数化による波及なし)。

## 5. typecheck / check:source

- **typecheck(`apps/editor` 単位, `tsc --noEmit -p apps/editor/tsconfig.json`)**: 私の変更した3ソースファイル(`editor-session-context.tsx` / `mesh-tool-inspector.tsx` / `mesh-tool-state.ts`)および新規テスト `mesh-tool-generation-method.test.ts` は**エラー0**。
  - 残る editor 全体の tsc エラーは**すべて pristine baseline に存在する既存事象**(`viewer-render-source.*` / `viewer-runtime-screen.tsx` / `viewer-variant-selection.test.ts` / `editor-diagnostics-state.ts` / `parameter-bar.test.ts` 等の exactOptionalPropertyTypes・brand 型など)。私の変更前後で新規 tsc エラーは増えていない(stash による差分確認済み)。
  - 唯一「私の触ったファイル」で出るのは `mesh-tool-state.test.ts` と `mesh-tool-inspector.test.ts` の既存 `as AuthoringSession` キャスト起因 TS2352 だが、これは**私の追加行ではなく元からあるフィクスチャキャスト**で、stash 検証で baseline に同一エラーが存在することを確認済み(裁量判断 §6 参照)。
- **check:source(`node scripts/check-source-organization.mjs`)**: `Source organization guard passed.`(pass)。

## 6. 裁量判断(設計未定義を合理的に埋めた箇所)

1. **`createMeshToolDraft` の export**: method 焼き込みの配線をレンダリング無しでユニット検証する薄い seam として module-private 関数を `export`。UI/挙動への影響なし。Required tests(トグルで method が切り替わる)を最小コストで担保するための選択。
2. **トグルラベル**: 「Current」/「v7」。UI の言語慣行(既存 UI ラベルは英語: "Standard"/"Large Motion" 等)に合わせ英語短ラベルとした。「現行既定 ⇔ v7」の2択を最小語で表す意図。ユーザー判断は文言を固定していないため裁量で決定。
3. **preview key に method を含める**: 既存 `createPreviewKey(drawableId, presetId)` に method を追加(`${drawableId}:${presetId}:${method}`)。同一 drawable/preset で method だけ変えたとき auto-preview が再発火するために必要。
4. **状態パスの命名**: `generatePreviewWithMethod(preset, method)` を基底とし `generatePreview(preset)` がそれに委譲。`selectMethod` の同一レンダー内 setState スタール(古い `method` closure)回避のため、method を明示引数で渡す形にした。
5. **新規テストファイル配置**: `apps/editor/src/features/editor-session/mesh-tool-generation-method.test.ts`。世代切替という関心を単独ファイルに隔離し、v6削除時にこのファイル(または v7 ケース)を落とすだけで評価テストも消える薄さを維持。
6. **plan §7 のパス表記差異**: plan §7 Allowed scope は `apps/editor/src/workspace/panels/mesh-tool-state.ts` と表記するが、実ファイルは `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`(委任プロンプトの Allowed scope・現状配線節と一致)。後者を正として実装。

## 7. 質問・blocker

- **blocker: なし。** 契約・型・ディスパッチャすべて充足しており実装を完遂した。
- **質問(軽微・確認のみ、実装は完了済み)**:
  1. トグルラベル「Current」/「v7」で問題ないか(裁量 §6-2)。日本語 UI 慣行や「大きく動く/標準/…」のような日本語文言に揃える意図があれば差し替え可能。ただしプリセット文言は既存 UI が英語("Large Motion" 等)なので英語で統一した。
  2. `createMeshToolDraft` の export(裁量 §6-1)は薄い実装を保つための最小 seam。レビューで「context 内部関数を export したくない」判断があれば、代替として context Provider を render するフックテストへ差し替え可能(コスト増)。現状はより薄い方を選択。

## 8. 新規依存・lockfile の無変更(明示)

- `git status` 上、`package.json` / `pnpm-lock.yaml` / lockfile 類の変更は**ゼロ**。
- 新規外部依存の追加なし。`pnpm install` は**未実行**。
- 私の書き込みは `apps/editor/src` 配下の4ファイル変更 + 1ファイル新規のみ(Allowed scope 内)。`packages/**` への書き込みは行っていない(working tree 上の `packages/authoring-core/*` の変更は Domain A/B 由来で、本ドメイン着手時点で既に存在)。
