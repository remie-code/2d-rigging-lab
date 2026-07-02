# Wave104 Domain C Report: Measurement + ref e2e

- Domain id: `wave104-measurement-ref-e2e`
- Status: **complete / pass**（レビュー 3 レーン全 pass + 型修正ループ 1 回 + 狭い再検証 pass の確定）
- Orchestrator: Orch-Sylph（opus）/ Implementer: Gnome（opus、同一コンテキスト継続で初回 + §3.4 改訂対応 + 型修正の 3 回）/ Reviewers: Review-Sylph（opus、独立コンテキスト x4 = 初回 3 レーン + 狭い再検証 1）
- Date: 2026-07-03
- Source of truth: [../../orchestration/wave104-plan.md](../../orchestration/wave104-plan.md) §8（§3.3 / §3.4（2026-07-03 改訂含む）/ §3.5 / §3.7 / §10 / §13 併用）
- Dependencies: Domain A（評価アダプタ・bbox ヘルパ）/ Domain B（read 経路）の pass 済み成果を消費

## 1. Bounded 現状確認の結果（Gnome 委任前に Orch-Sylph が確認）

1. **Domain A 公開面**: `apps/authoring-host/src/perception/evaluated-bounds.ts`（`evaluatedDrawableBounds` / `allEvaluatedDrawableBounds` / `evaluatedRigControlBounds` / `unionBounds` / `modelEvaluatedBounds`）と `evaluation-adapter.ts` の `evaluatePerceptionSnapshot`（Runtime Export 非経由、`snapshotDetail:"full"`）が barrel から到達可能で再利用可能。
2. **Domain B の read 統合パターン**: `ai-read-command.ts` の `AiReadCommandHost` optional メソッド + `executeAiReadCommand` の command 分岐 + `AuthoringHostCommandHost` 実装、という同型を `inspectEvaluatedGeometry` に適用可能。CLI は `runAuthoringHostCommand` の `readHost: host` 注入で自動到達。
3. **§8 conditional（格子制御点）の核心事実**: `EvaluatedRigControlDto` は bounds（warp では graph 由来 `domainBounds`）+ transform + opacityMultiplier のみ。評価済みオフセット `WarpLattice2dLocalState.controlPointOffsets` は runtime-core 内部（`EvaluatedRigControlInternal.warpLatticeState`）で計算済みだが DTO 非公開。評価済み絶対格子点 = `restControlPoints[i]`（graph）+ `controlPointOffsets[i]`（評価済み）。→ 選択肢 1（狭い export 追加）が非破壊で実現可能な見込み、と Gnome へ引き渡し。
4. **ref/ の構造**: manifest（packageId=`pkg_editor_workspace`, revision=1844, rights=cleared）、warpLattice2d rig control 実在（restControlPoints・domainBounds あり）、parameters 空（rest のみ、スイープ非要求 = §3.5 通り）、`texture-atlas.json` + per-layer `.raw-rgba` 群。

## 2. 実装成果の要約

### 2.1 `inspectEvaluatedGeometry`（§3.3、capability `read`）

| ファイル | 種別 | 責務 |
|---|---|---|
| `packages/ai-interface/src/ai-measurement-command.ts` / `.test.ts` | 新規 | payload / result スキーマ（純 zod）。対象 = drawable / rigControl 参照列 + `parameterOverrides?` + 頂点フラグ。warp 系は評価済み格子制御点座標を含む |
| `packages/ai-interface/src/ai-read-command.ts` / `ai-command-name.ts` / `ai-capability.ts` / `ai-command-payload.ts` / `ai-command-response-payload.ts` / `ai-command-executor.ts` / `index.ts` | M（C 関連分） | AiCommandName 追加、read 分岐（Domain B の確立パターンと同型）、capability `read` ゲート |
| `apps/authoring-host/src/perception/measurement-command.ts` / `.test.ts` | 新規 | 測量実処理。`evaluatePerceptionSnapshot` を共有（§3.3「同じ経路・同じアダプタ」）し、評価済み bbox / 頂点 / 格子点を解決 |
| `apps/authoring-host/src/authoring-host-command-host.ts` | M（C 関連分） | `AiReadCommandHost.inspectEvaluatedGeometry` 実装（validatePackage の隣） |

### 2.2 §8 conditional の判断: **選択肢 1（runtime-core への狭い export 追加）を採用**

- `packages/runtime-core/src/rig-control-evaluation.ts`（+49 行）: `EvaluatedRigControlDto` に **optional `evaluatedControlPoints`** を追加（warp 系のみ、内部で計算済みの値の公開。評価ロジック・既存フィールドは無変更）。専用テスト `rig-control-evaluated-control-points.test.ts`（3 tests、新規）。
- **判断根拠**: ①評価済みオフセットは内部で計算済みであり、optional field の additive 追加のみで公開できる（評価挙動の変更ゼロ）②clean HEAD 比較で非破壊を実証（runtime-core 既存テストの failed は clean HEAD でも同一の既知先行 2 件のみ — stash 二重確認）③§3.3 の「warp 系 rigControl の格子制御点座標」要求に縮退なしで忠実。縮退代替（選択肢 2）は不要と判定。
- レビューでの独立確認: Spec Compliance レーンが非破壊性（clean HEAD 比較の再確認）を、Test Adequacy レーンがプローブ（export 破壊 → 該当テスト fail → 復元）を実証。

### 2.3 escalate → L0 裁定 → §3.4 改訂 → 検証付き導出（本ドメイン最大の設計イベント）

1. **escalate**: Gnome 初回実装で、ref の per-layer texture **126 個すべて**が明示 `dimensions` を持たず、§3.4（当時: 明示寸法のみ + byteLength 検証）では ref の render が決定論的 reject になると判明。計画 §8 の Escalate 条件「ref のテクスチャ寸法解決が §3.4 で成立しない」に該当し、Orch-Sylph → L0 へ escalate。
2. **L0 裁定（§3.4 改訂、2026-07-03）**: dimensions 欠落は本エディタ産パッケージの一般的性質であり、§3.4 の本質「黙った推定の禁止」を保存したまま解決の梯子を拡張 — ①明示 dimensions（最優先）②**検証付き導出**（パッケージ内の正式境界情報から候補 (w,h) を導出し `byteLength === w*h*4` **厳密一致時のみ**採用。不一致・候補不定は従来通り reject）③採用寸法源種別（declared / derived-verified）をサイドカーに記録。§8 に conditional 追記 2（`texture-resolution.ts` + テストの狭い拡張のみ）。
3. **実装**（`apps/authoring-host/src/perception/texture-resolution.ts` M + `texture-resolution-derivation.test.ts` 新規）: 導出候補源 = **参照 drawable の rest mesh bounds**（bounded 確認による選定。source-manifest は構造的に参照不能、atlas placements は §3.2 のフレーミング前提と衝突するため不採用）。整数検証・曖昧候補 reject・byteLengthMismatch の安全弁付きで、**無検証の寸法採用経路は存在しない**（Spec レーンがコード監査で確認）。
4. **実証**: **ref の 126 per-layer テクスチャ全件が derived-verified で厳密一致解決（126/126、例外ゼロ）**。専用テストが件数固定（`toHaveLength(126)`）で vacuous pass を排除（Test Adequacy レーン確認）。サイドカーの `textureDimensionSources[]`（ai-interface サイドカースキーマへの optional・additive 追加、純 zod、boundary 非緩和）に全件記録。

### 2.4 ref e2e スモークとユーザー目視 gate 成果物

- `apps/authoring-host/src/ref-e2e.test.ts`（新規、4 tests）+ root `package.json` に `test:ref-e2e` script 追加。`ref/` は read-only（stateDirectory は ref 外、**ref/ 無変更を git で実証** — レビュー 2 レーンが独立に `git status ref/` 空を確認）。
- e2e 内容（計画 §8 の 5 項目すべて）: ①CLI load → `validatePackage`（report 取得。**診断は fail 条件にしない**）②rest pose 全体像 + フォーカス 2 枚を render → PNG + サイドカーを `ref-render-gate/` へ ③同一リクエスト 2 回・別ディレクトリ再 render でバイト一致（決定論）④測量スモーク（代表 drawable の bbox 有限値 + 目 drawable が顔 bbox に厳密包含）⑤実行時間の記録（非ブロッキング）。
- **`discussion/model-authoring/experiments/ref-render-gate/` の成果物（ユーザー目視 gate の対象物）**:

| ファイル | 内容 |
|---|---|
| `ref-rest-full.png`（392x1024） | rest pose 全身。view 省略 = 全 drawable 評価済み bounds の union フレーミング。レイヤ順・不透明度・部位配置・欠落の確認用 |
| `ref-face-focus.png`（1024x1013） | 顔領域。`drawableFocus`: `draw_r0_1cea4f6f_5c3cada6_face`、margin 10%。目・眼鏡・眉・口・髪の重なり順の確認用 |
| `ref-eyes-viewport.png`（1024x436） | 両目クローズアップ。明示 stageViewport `{minX:860, minY:385, width:270, height:115}`。虹彩・白目・まつ毛のレイヤリングとマスク挙動の確認用 |
| `*.render-view.json` x3 | 各 PNG のサイドカー（packageRevision=1844 / resolvedView の画像↔stage 変換 / `textureDimensionSources[]` = 126 件全 derived-verified） |
| `ref-measurement-gate.json` | `inspectEvaluatedGeometry` の ref 実測（face / irides-l / eyewhite-r の評価済み bbox 数値） |
| `README.md` | 各 PNG の見どころ・再現コマンド・サイドカーの読み方（画像 px → stage 座標の変換式と操作量翻訳の例）・「判定梯子最上段のユーザー目視 gate 対象物」の明記・derived-verified 注記・**マスクソース通常描画（Wave103 承認済み WebGL2 忠実セマンティクス）の注意書き**（白目/マスク層が見えても renderer 疑義とは限らない） |

### 2.5 変更・追加ファイル一覧（Domain C 分）

| ファイル | 種別 |
|---|---|
| `packages/ai-interface/src/ai-measurement-command.ts` / `.test.ts` | 新規 |
| `packages/ai-interface/src/ai-read-command.ts` ほか barrel / name / capability / payload / executor | M（C 関連分。Domain A/B 変更と共存） |
| `packages/runtime-core/src/rig-control-evaluation.ts` | M（conditional 1: optional `evaluatedControlPoints` のみ +49 行） |
| `packages/runtime-core/src/rig-control-evaluated-control-points.test.ts` | 新規 |
| `apps/authoring-host/src/perception/measurement-command.ts` / `.test.ts` | 新規 |
| `apps/authoring-host/src/perception/texture-resolution.ts` | M（conditional 追記 2: 検証付き導出のみ） |
| `apps/authoring-host/src/perception/texture-resolution-derivation.test.ts` | 新規 |
| `apps/authoring-host/src/authoring-host-command-host.ts` | M（C 関連分） |
| `apps/authoring-host/src/ref-e2e.test.ts` | 新規 |
| ルート `package.json` | M（`test:ref-e2e` script のみ） |
| `discussion/model-authoring/experiments/ref-render-gate/`（PNG x3 + サイドカー x3 + measurement JSON + README） | 新規 |

Forbidden scope 違反ゼロ: ref/ 無変更（git 実証）、新規外部依存 / lockfile 変更なし（lockfile の +12 行は Domain A/B install 由来の承認済み分類 — Design レーンが diff 分類を再確認）、Editor / Player / render-webgl2 / operation-core / validator-core / package-format 挙動変更なし、boundary allowlist 無変更（`contracts / operation-core / runtime-core / validator-core / zod` の 5 本のまま）。

## 3. テスト結果（最終確定値。再検証レーン実測）

| スイート | 結果 | 非退行 |
|---|---|---|
| `apps/authoring-host`（root から `npx vitest run --root apps/authoring-host`） | **51 passed / 0 failed** | Domain A/B 分含む全 pass。51 = A/B までの 37 + Domain C 13 + 型修正ループでの回帰テスト 1 |
| `packages/ai-interface` | **107 passed** | 既存 101 非退行 + measurement schema/dispatch 6。boundary テスト無変更・pass |
| `packages/runtime-core` | 非退行 | 既知先行 2 failed のみ（**clean HEAD 起因を stash 二重確認で実証**）。`evaluatedControlPoints` テスト 3 pass |
| `npx tsc --noEmit`（root） | exit 0 | 維持 |
| `npx tsc --noEmit -p apps/authoring-host/tsconfig.json` | **exit 0**（型修正ループで 10 → 0） | Domain A 時点の達成水準を回復 |
| `node scripts/check-source-organization.mjs` | pass | — |
| `node scripts/check-dependencies.mjs` | 既知先行偽陽性（cmo3 / pnpm-lock line 2486）のみ | Wave104 由来の新規 finding ゼロ |

ref e2e 実行時間: 記録済み（非ブロッキング要件。e2e が validate + render 3 枚 + 決定論再 render + 測量を含めてテストスイート内で完走。詳細はテストログ）。

**ref validatePackage の記録（fail 条件外の重要記録）**: strict プロファイルで `{info:0, warning:0, error:97, blocking:0}`。実運用モデル（配信実証済み）と validator の乖離を示す貴重なデータであり、**97 件の内訳分類は将来課題**（バリデータ/ref 整合の model-authoring トピック候補）。

## 4. レビュー判定と修正ループ（1 回 / 上限 5）

| レーン | 初回判定 | 最終判定 | レポート |
|---|---|---|---|
| Spec Compliance | pass | pass | [../../reviews/wave104/wave104-domain-c-spec-compliance-review.md](../../reviews/wave104/wave104-domain-c-spec-compliance-review.md) |
| Design・Development | pass | pass | [../../reviews/wave104/wave104-domain-c-design-development-review.md](../../reviews/wave104/wave104-domain-c-design-development-review.md) |
| Test Adequacy | pass（non-blocking 2 件） | pass（再検証セクション追記済み） | [../../reviews/wave104/wave104-domain-c-test-adequacy-review.md](../../reviews/wave104/wave104-domain-c-test-adequacy-review.md) |

計画 §10 Domain C 明示確認項目の全達成: ref/ 無変更（git 実証）/ e2e 決定論（レビューが実再現）/ PNG↔サイドカー整合 / README の目視 gate 説明 / 測量数値の非オウム返し（Test Adequacy がプローブで実証: export 破壊 → fail → 完全復元を git で確認）。追加 3 項目（§3.4 改訂遵守・無検証経路の不在と 126/126 再現 / runtime-core export の非破壊性 / sidecar スキーマ追加の boundary 非緩和）も全達成。

### 4.1 型修正ループの経緯（blocking ではなく L0 指示による閉域前回収）

- **発見（Test Adequacy non-blocking #1）**: `typecheck:authoring-host` に型エラー 10 件（全て Domain C 新規ファイル。実装 2 件 = `texture-resolution.ts` の exactOptionalPropertyTypes 下 `binaryAssetRef` 非互換、テスト 8 件 = plain string の branded id 代入）。CI 標準経路（`pnpm check`）は apps/ を型検査しないため通過するが、Domain A 時点で達成されていた app tsc exit 0 を Domain C が退行させていた。
- **L0 裁定**: 閉域前に修正（知覚スタックは閉問題 01 の土台であり型負債を残さない）。あわせて計画 §9 の Domain D 必須チェックに `typecheck:authoring-host` を昇格追記。
- **修正 Gnome（狭いスコープ）**: 実装 2 件はパラメータ型への `| undefined` 明示のみ（実行文・分岐・値は不変の純型変更）、テスト 8 件は `*IdSchema.parse` 適用（assert の削除・緩和ゼロ）。裁量指示の Test Adequacy non-blocking #2 も実施 — 測量コマンド層の非 rest warp 回帰テスト 1 本を追加（min/max keyform set を `editKeyformKey(createEnds)` で構築し、driven 評価格子点 = rest + {5,-3} の全格子点数値一致を assert）。
- **狭い再検証（fresh Review-Sylph）**: 挙動不変・検証強度不変・追加テストの非オウム返し・完了条件（app tsc 10→0 / authoring-host 51 / ai-interface 107 / runtime-core 非退行）を実測確認し **pass 確定**。

### 4.2 レビューレーンからの質問への回答（記録）

- Design・Development レーン質問 1（ドメイン報告書の作成タイミング）: 報告書は全レーン + 再検証の後に Orch-Sylph が作成するのが本 wave の正規順序（本報告書がそれ）。レビュー時点で存在しないのは正常。
- 同質問 2（サイドカー絶対パスのポータビリティ）: 記録に留め、**Domain D への注記**とする（§6 参照）。

## 5. non-blocking findings（全レーン合算）

1. **C-NB-1（記録のみ）**: ref validatePackage strict で error 97 件（§3 参照。内訳分類は将来課題）。
2. **C-NB-2（設計上の注意、非欠陥）**: derived-verified の候補源は「参照 drawable の rest mesh bounds が整数寸法」に依存。非整数 mesh bounds のモデルでは `missingDimensions` reject となる（= 黙って推定しない正しい挙動。§3.4 改訂の不変量は保存）。
3. **C-DEV-N-01（Domain A 所有・記録のみ）**: サイドカーの `packagePath` / `pngPath` がマシン絶対パス。§3.2 の決定論要求（PNG バイト同一）には抵触しないが、別マシン再生成でサイドカー JSON は変わる。→ Domain D への注記。
4. **C-DEV-N-02（品質メモ）**: measurement は `evaluated-bounds.ts` ヘルパを経由せず snapshot 直読み（返す値は同一。§3.3 の必須要件「同じ評価アダプタの共有」は充足。冗長な間接を避けた妥当な選択と分類）。
5. **（解消済み）** Test Adequacy #1（型エラー 10 件）と #2（非 rest warp 回帰の欠如）は型修正ループで両方回収済み。

## 6. Domain D への注記（ドメイン間調整事項）

1. **`typecheck:authoring-host` が必須チェックに昇格**（計画 §9 追記済み。現在 exit 0 — 最終統合での維持確認を）。
2. **サイドカー絶対パス（C-DEV-N-01）**: Domain A 所有の `render-view-sidecar.ts` 設計。ref-render-gate/ 成果物の再生成運用（マシン間ポータビリティ）に関わるため、Domain D の記録・判断対象として引き継ぐ。
3. 共有ファイル（executor / read-command / authoring-host-command-host / package.json）の A+B+C 統合整合の最終確認（従来からの Domain D 管轄）。
4. **ユーザー目視 gate の案内**: wave 完了後、ユーザーに `discussion/model-authoring/experiments/ref-render-gate/` の PNG 3 枚の目視承認を依頼すること（§3.5。wave の技術 gate とは独立）。

## 7. Craft 蒸留候補（model-authoring への実装知見）

- **`addKeyform` の単キー set の罠と `createEnds` の正道**: `addKeyform` は呼び出しごとに別の単キー keyform set を作り、単キー set はパラメータ値に依らず定数適用される（rest にも offset が乗る）。「rest では恒等・driven で変形」という keyform を 1 set に持たせるには `editKeyformKey(createEnds)` で min/max 両キーを構築するのが正道。閉問題 01（眼球移動）で Fable がキーフォームを組む際にそのまま効く知見であり、model-authoring craft への蒸留候補として申し送る。

## 8. 残リスク

- **derived-verified の適用範囲**: 整数 mesh bounds 前提（C-NB-2）。非整数モデルは reject で顕在化する（黙らない）ため安全側だが、将来モデルで reject が頻発する場合は §3.4 の梯子拡張の再検討が要る。
- **ref validator 乖離（error 97 件）**: 内訳未分類。validator の偽陽性か ref の実欠陥かの切り分けは将来トピック。
- **サイドカー絶対パス**: 上記 Domain D 注記のとおり。
- **ユーザー目視 gate は未実施**: 本ドメインは対象物の生成まで。描画正しさの人間判定は wave 外の model-authoring 側 gate（§3.5 / §11）。

## 9. Expected Persistent Artifacts

| Artifact | 状態 |
|---|---|
| 本報告書 | 作成済み |
| `reviews/wave104/wave104-domain-c-{spec-compliance,design-development,test-adequacy}-review.md` | 存在 / 全 pass（Test Adequacy は再検証セクション追記済み） |
| `discussion/model-authoring/experiments/ref-render-gate/`（PNG x3 + サイドカー x3 + measurement JSON + README） | 生成済み（ユーザー目視 gate 対象物） |
