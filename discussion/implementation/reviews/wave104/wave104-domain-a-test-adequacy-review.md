# Wave104 Domain A — Test Adequacy Review

Verdict: **pass**（初回 needs_fix → 修正ループ 1 回目後に blocking 解消を実確認。詳細は末尾「再検証（修正ループ 1 回目後）」を参照。以下の本文は初回レビューの記録として保存）

Reviewer: Review-Sylph (Test Adequacy lane, Domain A / Perception Command Core)
Date: 2026-07-03（初回） / 2026-07-03（再検証）
Basis: `discussion/implementation/orchestration/wave104-plan.md` §3.2 / §3.4 / §6 / §11、補助 basis `discussion/model-authoring/research/evaluation-and-read-path-survey.md`。

## 要約

Domain A のテスト群は 8 項目中 6 項目が実質的で、決定論（バイト列全体比較）・ビュー変換数値正確性（手計算由来）・drawableFocus フレーミング（独立計算）・byteLength 決定論的 reject・空 parameters render・renderView スキーマ/capability/boundary 非緩和は充足を確認した。テストは自分で実行し **authoring-host 37 passed / 9 files**、**ai-interface 101 passed / 16 files** を実確認、報告数と一致する。

しかし **Required test 2（parameterOverrides の変形反映）と Required test 4（sweep セル対応）は「変形が実際に画素/頂点に反映されること」を構造的に検証できていない**。原因は合成 fixture (`createPerceptionFixture`) が **createParameter / editKeyform を一切呼ばず、どのパラメータも drawable の変形に紐付いていない**こと。私は検証プローブ（レビュー後に削除、リポジトリ無改変）で fixture の全 34 パラメータについて min/max 双方を評価し、**どの drawable の頂点・opacity・visibility も一切変化しないこと（ANY_PARAM_CAUSES_CHANGE = false）** を確認した。これにより:

- Required test 2「reflects parameterOverrides in the rendered pixels」は **テスト名が主張する画素反映を一切検証せず、空 override (`parameterOverrides: {}`) でレンダして PNG 非空を assert するだけ**の弱いテスト。§6 の「『エラーが出ない』だけの弱いテストでないか」に明確に該当する。
- Required test 4 の sweep は 4 セルすべて**同一画像**を並べているに過ぎない（パラメータ値の記録は正しいがレンダ結果は恒等）。セル↔パラメータ値の対応表（メタデータ）の正確性は検証されているが、「N 姿勢を合成」という §3.2 コンタクトシートの目的（異なる姿勢が異なる画素を生む）の回帰保護がない。

これは実装バグではない（override は評価器に正しく渡っている＝結線は正しい）。fixture の設計上、変形を起こす入力が一つも存在しないため、知覚コマンドの中核価値「変形を目で見る」を守るテストが成立していないという **テスト充足性の欠落**である。

実行証跡:
- `npx vitest run --root apps/authoring-host` → **37 passed / 9 files**
- `npx vitest run packages/ai-interface`（ルートから）→ **101 passed / 16 files**（既存 88 非退行 + renderView 7 + read-integration 6 = 101）

---

## Required tests 8 項目ごとの判定

### 1. rest pose render golden（決定論 2 回実行バイト一致） — 充足

- `apps/authoring-host/src/perception/render-view-command.test.ts` "renders a deterministic rest-pose PNG (byte-identical across two runs)"（L22-35）: 別インスタンスの fixture を 2 回作って render し、`Buffer.from(bytes).toString("base64")` で **PNG バイト列全体を base64 化して一致**を assert（一部ハッシュや長さだけでない）。同一プロセス内 2 回だが、fixture インスタンスは各回独立生成しており、隠れた共有状態に依存しない。
- ディスク経路の別テスト `perception/render-view-file-output.test.ts` "writes byte-identical PNG bytes across two runs of the same request (on disk)"（L51-71）: 別ディレクトリに 2 回書き出し `bytesA.equals(bytesB)`（Buffer 全体比較）+ PNG signature（L43）検証。
- 判定: 比較はバイト列全体で実質的。**充足**。

### 2. parameterOverrides 指定時の変形反映 render — 未充足（blocking）

- `render-view-command.test.ts` "reflects parameterOverrides in the rendered pixels"（L37-50）は、テスト名と裏腹に **`parameterOverrides: {}`（空）でレンダし、PNG 非空・outputWidth/Height > 0 のみ assert**。rest との差分比較も、override を実際に与えた render も存在しない。
- テスト自身のコメント（L40-42）が「the deformation itself is covered by the sweep/geometry tests」と別テストに委ねているが、後述の通り sweep も画素差分を検証しない。geometry テストは Domain A に存在しない（`ls` で perception 配下のテストは render-view-command / render-view-file-output の 2 本のみ）。
- プローブ結果: fixture の全 34 パラメータ（例 `param_accessory_sway_x` min=-1/max=1）を min/max に振っても評価済み頂点・opacity・visible は不変。fixture に keyform 変形が仕込まれていないため、この fixture では override による画素変化を検証すること自体が不可能。
- 判定: 「変形が実際に画素/頂点に反映されたことを検証」する Required test 2 は**実質未達**。**blocking**。

### 3. drawableFocus フレーミング（bbox 由来 viewport の数値検証） — 充足

- `render-view-command.test.ts` "frames a drawable focus from its evaluated bbox with the given margin (numeric)"（L52-77）: `evaluatePerceptionSnapshot(session)` → `evaluatedDrawableBounds(snapshot, ids.eyeDrawableId)` で評価済み bbox を独立取得し、`marginRatio=0.25` で **expectedMinX = rect.x - rect.width*marginRatio` 等を独立計算**して `resolvePerceptionRenderView` の出力と `toBeCloseTo(…, 6)` 照合。
- オウム返し評価: 期待値の margin 式（L68-71）は実装 `applyMargin`（`view-resolution.ts` L91-101）と同一構造だが、bbox 自体はテスト側で独立に評価器から取得しており、実装の軸取り違え・符号ミス・bbox 源の取り違え（rest 静値の使用等）は検出できる。margin 式そのものは仕様の写経レベルであり許容範囲。
- 判定: 数値検証は独立、期待値は実装出力のオウム返しでない。**充足**。

### 4. sweep → グリッド PNG + サイドカーのセル対応 — 部分充足（blocking）

- `render-view-command.test.ts` "produces a contact sheet + sidecar cell map for a sweep"（L79-121）: steps=4 で columns=2/rows=2、cells 長 4、`outputWidth === columns*cellWidth`、cell 0 の parameterValue = `parameter.min`、cell 3 = `parameter.max`（**graph から独立取得した min/max と `toBeCloseTo(…,6)`**）、cell 0/3 の grid 位置 `{cellIndex, column, row}` を照合。セル↔パラメータ値の**対応表（メタデータ）は数値で正確に検証**されている。
- ただし **各セルの画素が異なることは一切検証していない**。プローブで示した通り、この fixture では sweep の全セルが恒等画像になる。「異なる姿勢を 1 枚に合成」（§3.2）という機能の実効性（変形が cell 間で見える）は回帰保護されていない。
- 判定: メタデータ対応は充足だが、画素合成の実質は未検証。Required test 2 と同根の fixture 限界。**blocking**（2 と併せて 1 件として扱ってよい）。

### 5. サイドカーのスキーマ・ビュー変換値の数値正確性 — 充足

- `render-view-command.test.ts` "records a numerically correct view transform in the sidecar"（L123-159）: `stageViewport{minX:10,minY:20,width:80,height:40}` + `outputWidth:160/outputHeight:40` に対し **pixelsPerStageX = 160/80 = 2、pixelsPerStageY = 40/40 = 1 を手計算で独立導出**（L140-142）。さらにサイドカーの数値だけから `resolveSoftwareRenderView` を再構築し、stage(50,40) → pixel を **`((50-10)*2,(40-20)*1)=(80,20)` と独立計算**（L153-155）、順逆往復も検証。
- スキーマ検証は `render-view-file-output.test.ts` L45-48 で `RenderViewSidecarSchema.parse` + packageRevision/packagePath 照合。
- 判定: pixelsPerStage の期待値は手計算由来、photo↔stage 対応は既知座標で往復検証。オウム返しでない。**充足**。

### 6. 空 parameters パッケージの rest pose render 成立 — 充足

- `render-view-command.test.ts` "renders a rest pose for a package that declares no parameters"（L161-173）: `expect(session.graph.parameters).toHaveLength(0)` で空を明示確認した上で render が例外を投げず PNG 非空を assert。§6 escalate 条件「空 parameters で評価が例外を投げる」の否定を実証。
- 判定: **充足**。

### 7. テクスチャ寸法不整合（byteLength 不一致）の決定論的 reject — 充足

- `render-view-command.test.ts` "rejects a texture whose byteLength does not match its declared dimensions (§3.4)"（L175-191）: `registerTextureWithDimensions(..., {width:8,height:8}, {byteLengthOverride:16})` で寸法宣言 256 bytes に対し 16 bytes を仕込み、`renderPerceptionView` が `TextureResolutionError` を throw することを assert（負例テスト）。
- 決定論性: 実装 `texture-resolution.ts` L115-125 は純関数的な整合検査（`width*height*4 !== byteLength` → 特定 code `byteLengthMismatch` を throw）で、同一入力に対し同一エラーを決定論的に返す。`toThrowError(TextureResolutionError)` はエラー型を固定しており reject の形が決定論的であることを担保。
- 判定: 負例・決定論とも**充足**。

### 8. ai-interface: renderView スキーマ・capability + boundary 非緩和 — 充足

- `packages/ai-interface/src/ai-render-view-command.test.ts`（7 tests）: command name/capability 登録（L33-36）、payload デフォルト（L38-43）、3 framing variant + marginRatio デフォルト 0.1（L45-56）、**sweep steps>=2 の境界（1-step reject を safeParse で確認）**（L58-70）、sidecar/result の schema round-trip（L72-98）、executor capability gate（read → permission_denied / render → not_implemented）（L101-119）。境界・負例を含み実質的。
- boundary 非緩和: `dependency-boundary.test.ts` は **git status で無変更**（`git status --porcelain` に現れず）、`packages/ai-interface/package.json` も **git diff 空**（allowlist 5 依存: contracts/operation-core/runtime-core/validator-core/zod のまま、render-core/render-software 追加なし）。`ai-capability.ts` は `render` を**追加のみ**で既存 enum を緩和していない。実行で dependency-boundary.test.ts 5 tests pass を実確認。
- 判定: **充足**。

---

## 非退行確認

- ai-interface の既存 `.test.ts` は git diff --stat で変更ゼロ（新規追加 `ai-render-view-command.test.ts` / `ai-executor-read-integration.test.ts` のみ untracked）。既存 88 tests（101 − renderView 7 − read-integration 6）は無退行で pass。
- authoring-host の既存テスト（run-authoring-host-command / cli-cross-process / closed-problem-01-smoke 等）も 37 内で全 pass。承認ライフサイクル系（cli-cross-process の dry-run 越えプロセス）も pass。
- 報告数一致: authoring-host 37 / ai-interface 101、いずれも実行結果と一致。

## blocking findings

1. **Required test 2 / 4 が変形反映を構造的に検証できていない（fixture に keyform 変形の紐付けが皆無）。** 根拠: `apps/authoring-host/src/test-support/perception-fixtures.ts` の `createPerceptionFixture` は createParameter/editKeyform を呼ばず、プローブで全 34 パラメータの min/max 双方が全 drawable の頂点・opacity・visible を不変にすること（ANY_PARAM_CAUSES_CHANGE=false）を確認。`render-view-command.test.ts` の "reflects parameterOverrides in the rendered pixels"（L37-50）は空 override で PNG 非空を見るだけ、sweep テスト（L79-121）はセル対応表のみ検証で全セル恒等画像。修正案（いずれか）:
   - (a) fixture にパラメータ駆動の keyform 変形を最低 1 本仕込み（例: eye ドローアブルに warp/keyform を設定し、あるパラメータの min/max で頂点が変わる）、Required test 2 を「rest の render bytes ≠ override 適用時の render bytes」で assert し、Required test 4 sweep を「隣接セルの RGBA8 が異なる」で assert する。
   - (b) fixture 拡張が高コストなら、評価器レベルで「override 適用で該当 drawable の評価済み頂点が変化する」ことを直接 assert するユニットテストを追加し、変形が評価経路を通ることの回帰保護を最低限確保する（画素までは追わずとも「変形が起きる入力」の存在をテスト対象に含める）。
   - 現状のテスト名 "reflects parameterOverrides in the rendered pixels" は検証実態と乖離しており、少なくとも名称・コメントを実態に合わせるべき（誤誘導の解消）。

## non-blocking findings

1. **drawableFocus の margin 式がテストと実装で同一構造**（`render-view-command.test.ts` L68-71 と `view-resolution.ts` L91-101）。bbox 自体は独立取得のため主要バグは検出可能だが、margin 適用の意味論（両側 vs 片側等）を仕様側から独立に固定する assert があるとより堅い。判定に影響なし。

2. **sweep テストが steps=4（columns/rows 各 2）の 1 ケースのみ**。奇数 cell（例 steps=3 → 2x2 で末尾空セル）や非平方数のレイアウト（trailing 透明セル）の回帰保護がない。`contact-sheet.ts` は空セル透明を実装しているがテストで踏んでいない。non-blocking。

## 質問

1. この fixture が変形を持たないのは Domain A 実装時の既知の制約か、それとも見落としか。tutorial-mini seed 由来のパラメータ（プリセット 34 本）はモデルに変形を紐付けない前提なら、Required test 2/4 の充足には fixture 側での keyform 明示追加が必要になる。Orch-Sylph に、blocking findings 修正案 (a)/(b) のどちらを Gnome に委任するか判断を仰ぎたい。
2. Domain C（ref e2e）は空 parameters の ref モデルを使うため sweep を要求しない設計（§3.5）。したがって「変形反映」の実証責任は Domain A の合成 fixture に集中しており、ここで担保しないと wave 全体で変形反映の回帰保護がゼロになる点を明示しておく。

---

## 再検証（修正ループ 1 回目後）

Verdict: **pass**（blocking 1 件を解消確認）
Reviewer: Review-Sylph（Test Adequacy 再検証レーン）
Date: 2026-07-03
再検証スコープ: 初回 blocking（Required test 2/4 が変形反映を構造的に検証していない）の解消のみ。フルレビューの再実施ではない。

### 修正内容の要約（実確認済み）

初回 blocking findings 修正案 (a) が採用された。変更は **2 ファイルのみ**、実装コード（`apps/authoring-host/src/perception/**` の非テスト `.ts`）は無変更（下記スコープ確認参照）。

1. `apps/authoring-host/src/test-support/perception-fixtures.ts`
   - `param_perception_eye_region_opacity`（min=-1 / default=1 / max=1）を `createParameter` で追加（L132-140）。
   - eye / eyeMask 両 drawable の `opacity` プロパティに `editKeyformKey`（`action: "createEnds"`, `interpolation: "linear-1d-v1"`）で opacity keyform を追加。`statePatches` は `min: opacity=0`（完全透明）/ `max: opacity=1`（完全不透明）（L141-153）。両 drawable を束縛する理由（マスク drawable が eye を覆うため draw order に依らず変形を可視化するため）がコメントで明示。
   - `default=max=1` 設計により rest pose（override なし）は opacity=1 に張り付き、keyform 追加前と byte-identical になる（L48-52 / L124-131 のコメント）。
   - `buildPerceptionFixture({ includeOpacityKeyform })` へ分岐化し、`createPerceptionFixture`（keyform あり）と `createEmptyParameterPerceptionFixture`（keyform なし・空 parameters）を実体分離（L70-72 / L182-183）。空 parameters テストは後者を使うようになった。
2. `apps/authoring-host/src/perception/render-view-command.test.ts`
   - Required test 2 を "reflects parameterOverrides in the rendered pixels" として、rest（`parameterOverrides: {}`）render と override（`{ [eyeRegionOpacityParameterId]: -1 }`）render の **PNG バイト列不一致**を `expect(png(overridden.png)).not.toBe(png(rest.png))` で assert（L129-154）。テスト名・コメントが実態と整合。
   - Required test 4 を "renders per-cell deformation into a contact sheet + sidecar cell map for a sweep" へ改名。従来のセル↔パラメータ値メタデータ検証（L213-227）を保持しつつ、テストローカルの最小 PNG デコーダ（`decodePng`, 8-bit RGBA / filter type 0 のみ, L36-91）+ セル切り出し（`extractCellRgba8`, L94-111）で **全隣接セルの RGBA8 領域不一致**を `Buffer.equals(...) === false` で assert（L229-241）。

### 再検証項目ごとの結果と根拠

1. **Blocking 解消（Required test 2/4 の実効化）— 解消確認**
   - Required test 2（L129-154）: rest と override(-1) の PNG バイト列を `.not.toBe()` で不一致 assert。空 override + PNG 非空の弱いテストは解消。**充足**。
   - Required test 4（L183-242）: 隣接セルの RGBA8 バイト列を `.equals(...).toBe(false)` で不一致 assert。全セル恒等画像でメタデータのみ検証だった弱点は解消。**充足**。
   - テスト名・コメント整合: 2 は名称維持だがコメント（L131-134, L150-153）が override→画素差の実態を正確に記述。4 は "renders per-cell deformation ..." へ改名し実態と整合。**整合**。

2. **変形の実効性 — 妥当と判定**
   - opacity keyform（min=opacity0 / max=opacity1）は頂点移動ではないが、レンダラの合成結果（画素の RGBA8）を確実に変える変形であり、「パラメータ値 → 画素の反映」という Required test 2/4 の趣旨を満たす。override=-1（min 張り付き）で eye 領域が完全透明化し、rest（opacity1）と画素が変わる。sweep は min〜max を 4 分割し各セル異なる opacity で描画。
   - この実効性は下記の負の検証で機械的に実証済み（変形を消すと 2 テストが fail する ＝ 変形が画素に反映されている）。

3. **負の検証 — 独自に実証（リポジトリは復元済み）**
   - fixture の keyform `statePatches.min` を `opacity=0` → `opacity=1`（min=max=1、変形消滅）に一時変更してテスト実行 → **強化 2 テストのみが fail**（Required test 2 L153 / Required test 4 L240）、他 5 テストは pass。Gnome 申告（keyform 一時無効化で 2 テストのみ fail）と一致。
   - 変更を元に戻し（`min: opacity=0` に復元）、再実行で render-view-command.test.ts 7/7 pass に復帰することを確認。untracked ファイルのため grep で復元後の内容（L149 `value: 0` / L150 `value: 1`）を確認済み。**リポジトリは元状態に復元済み**。

4. **スコープ逸脱なし — 確認**
   - `git status --porcelain apps/authoring-host/src/perception/` は `?? apps/authoring-host/src/perception/`（ディレクトリ丸ごと untracked＝初回レビュー以降の新規追加物）。perception 配下の実装 `.ts`（contact-sheet / view-resolution / texture-resolution / render-view-command 等）のファイル mtime は 2026-07-02 23:52-23:55 で無変更、テスト（render-view-command.test.ts, mtime 2026-07-03 00:45）と fixture のみが今回の修正対象。実装コード（`src/perception/**` 非テスト）は無変更。tracked ファイル（`git diff --stat`）に perception / test-support 配下の変更は現れず、他 wave の tracked 変更のみ。**申告どおり 2 ファイルに限定、実装コード無変更**。

5. **非退行 — 実確認**
   - `npx vitest run --root apps/authoring-host` → **37 passed / 9 files**（決定論 rest-pose byte-identical テスト L114-127、ディスク byte-identical テスト、texture byteLength reject、空 parameters render を含む全 pass）。
   - `npx vitest run packages/ai-interface`（ルートから）→ **101 passed / 16 files**。
   - 報告数（authoring-host 37 / ai-interface 101）は Gnome 申告および実行結果と一致。決定論テスト（2 回実行バイト一致）が 37 内に含まれ pass。

### 再検証の判定

blocking 1 件は解消。Required test 2/4 はパラメータ→画素の反映を構造的に検証しており、負の検証（変形消滅で当該 2 テストのみ fail）で実効性を機械的に実証した。スコープ逸脱なし、非退行を実確認。**pass**。

（初回 non-blocking findings — margin 式の写経性、sweep レイアウトの単一ケース — は blocking ではなく再検証スコープ外。判定に影響しない。）
