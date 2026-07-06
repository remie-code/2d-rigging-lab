# wave107 最終クリーンレビュー（Domain A+B 合算 / 統合後突合）

> Reviewer: Review-Sylph（Orch-Sylph `wave107-final-integration` からの委任）
> 対象: Domain A + Domain B の合算実装差分（作業ツリー変更 + untracked）
> 判定基準: 設計オラクル `discussion/design/vowel-lipsync-mapping.md` §2〜§4 / `wave107-plan.md` §5-§6
> 方法: Domain 別レビューの結論を鵜呑みにせず、設計文書・対象ソース・差分・テストを独立に読み、母音関連10スイートを自分で再実行して裏取り。

## 判定: **合格**

設計 §2〜§4 の全節が実装に正しく反映され、Required test は全て非 vacuous（具体値 assert・ON/OFF 対で有意）、write scope はコード変更が全て `apps/runtime-player/**` 配下に収束。要修正なし。

---

## 1. 設計適合（§2〜§4・file:line 裏取り）

### §2 方式（分類 + 強度 + ゲート + ヒステリシス）

- **重み付き距離が cos 類似でなく「方向+大きさ」の距離**（§2.2 の核心）: `vowel-lipsync-estimator.ts:395-407` `weightedDistance` はユークリッド距離 `sqrt(Σ((a−b)·w)²)`。方向と大きさを両方見る。cos 類似（正規化して向きだけ見る）ではない。`scoreVowels`（`:233-259`）は live delta `Δ=features−neutral` と各母音 delta `vowel−neutral` の距離で argmax。「え=あの縮小」（向き同一・大きさ差）を距離で分離できる形。**適合**。
- **強度式 `w = d(Δ,中立)/(d(Δ,中立)+d(Δ,最近傍母音))`**: `computeIntensity`（`:265-272`）= `activity/(activity+winnerDistance)` を clamp01。`activity = weightedDistance(delta, zeroDelta)` = `d(Δ,中立)`（delta のノルム、`:256`）、`winnerDistance = distanceByVowel[winner]` = `d(Δ,最近傍母音)`。式に厳密一致、中立近傍で 0・参照近傍で 1 に漸近。**適合**。
- **ゲート**（§2.3）: `estimate`（`:303-308`）で `activity < vowelGateActivityThreshold(0.15)` なら state クリア + `emptyEstimate`。**適合**。
- **ヒステリシス = マージン + 連続 N フレーム**（§2.3）: `updateConfirmedWinner`（`:322-363`）。挑戦者は `currentWinnerDistance − challengerDistance >= vowelHysteresisMargin(0.05)` かつ `candidateStreak >= vowelHysteresisFrames(3)` で初めて勝者交代。マージンと連続フレームの両方を要求。**適合**。
- **per-frame 状態を bodyFollowState 先例に倣う**: `RuntimePlayerVowelLipsyncState`（`:279-364`、class + `reset()`）。`runtime-player-main.ts:270` で1つ生成、モデル切替/再接続で `reset()`（`:291,306,344,354,373`）。**適合**。
- **named constants の実測由来（マジックナンバー禁止）**: 全定数に導出根拠 + `test_data/iFaceMocap/vowels/vowel-captures.json`（2026-07-06）の出所コメント（gate `:83-93`、margin `:95-106`、frames `:108-114`、default refs `:116-186`）。dimension weights は全1（`:64-81`、単位重みで全ラベル分離 margin 0.167 の実測根拠付き）。**適合**。

### §3 スロット設計（5独立スロット + 上流共有推定器）

- **5独立 weight スロット**: `semantic-slot-definitions.ts:137-191` に `mouth-vowel-a/i/u/e/o`（group=mouth、targetAliases=`mouth.vowel.*`、`vowelLabel` 紐付け、sourceKind=`mouth-vowel`）。UI 自動列挙経路に乗る。**適合**。
- **共有推定器のフレーム1回メモ化**: `runtime-parameter-frame.ts:52-68`。`vowelEstimate` を null 初期化、`readVowelEstimate()` が初回だけ `state.estimate()` を呼びメモ化。5スロットは同一結果を読むだけ。**スロットごとに推定器を回していない**。**適合**。
- **相互排他が上流 argmax で構造的に出る（単一 Vowel 非ゼロ）**: `createVowelValue`（`:331-355`）は `estimate.winner !== vowelLabel` なら `null`→parameterId 不発行。勝者のみ発行。スロット独立評価の形式を保ったまま「単一 Vowel 非ゼロ」がリグ契約通り構造で出る。**適合**。
- **strength 意味論（w×strength）**: 勝者 w を `createWeightValue`（`:313-329`）に `activation` として通す。母音 target default=0 → `0+(w−0)×strength = w×strength`。**適合**。

### §3.2 トグル

- **OFF = parameterId 不発行 + 推定器短絡**: `runtime-parameter-frame.ts:79-81` で OFF かつ mouth-vowel スロットは `continue`（parameterValues に載せない、0 発行ではない）。かつ OFF 時 `readVowelEstimate` は一度も呼ばれず `vowelEstimate` は null のまま = 推定器が走らない（短絡・コストゼロ）。**適合**。
- **既定 = 母音ターゲット解決時 ON**: `live-mapping-state.ts:71-78` `isVowelLipsyncEnabled()` = supported かつ `override ?? true`。`isVowelLipsyncSupported()`（`:63-69`）= mouth-vowel スロットで target 解決済み。**適合**。
- **モデル単位 mapping プロファイルへ optional 永続化**: snapshot 生成（`:295-297`）で override が null 以外の時のみ `vowelLipsyncEnabled` を document に含める。読込復元（`:368-369`）は `profile.vowelLipsyncEnabled ?? null`。parser（`model-mapping-profile-parser.ts:84,95-97`）・document 型（`:55`）・slots ビルダー（`model-mapping-profile-slots.ts:43-45`）とも optional。schemaVersion 据え置き。**適合**。
- **置き場 = Mapping ページ mouth グループ近傍**: `mapping-page.tsx:151-157`（Mouth グループ内、`vowelLipsyncSupported` 時のみ表示）。IPC 配線 `model-mapping-bridge-handlers.ts:224-246`（supported チェック→override→reset→save）。**適合**。

### §4 キャリブレーション統合

- **永続形 = 生 blendshape 平均全次元 + 採取メタ**: `input-profile-document.ts:100-108` `InputProfileVowelCalibration` = `samples`（生 blendshape name→mean 全次元）+ `capturedAtIso`/`windowFrameCount`/`windowDurationMs`。8次元縮約ではなく生ベクトル保存（将来の推定器改訂で再較正不要）。**適合**。
- **8次元縮約は境界アダプタが担い、live-mapping 型・参照解決不変**: `input-profile-vowel-references.ts:30-52`。アダプタは推定器の `extractVowelFeatureVector` を**そのまま再利用**して縮約（再実装せず）→ 縮約規則が推定器と**機構的に一致することが保証**される（設計要件の要点）。live-mapping 側追随は import 1行 + 参照解決 1分岐（`runtime-parameter-frame.ts:22, 58-63` の `calibration.vowels === undefined ? default : convert(...)`）に収まる。**適合**。
- **schemaVersion 据え置き・後方互換**: `input-profile-document.ts:3-4` `"runtime-player-input-profiles-v1"` 不変。parser（`input-profile-document-parser.ts:166-218`）は vowels を optional・非致命扱い（欠落=後方互換パス、malformed=drop してプロファイル生存、全6ラベル揃わなければ undefined）。**適合**。
- **窓平均採取（`summarizeSamples` 移植）**: `input-profile-vowel-window.ts:39-95` `summarizeVowelWindow`（sum/min/max/count・round4・name sort）。CLI `tools/capture-vowel-frames.ts:124-171` `summarizeSamples` と集約ロジック機構一致（CLI は生 UDP 文字列、player 版は正規化済み TrackingFrame を集約する差分のみ、コメントで正当化）。**適合**。
- **採取フロー = ウィザードに母音セクション（中立→あ→い→う→え→お）**: `input-profile-calibration-session.ts:156-161` にプロンプト6本（設計順）、`:366-392` `recordVowelWindowSample` が Record ごとに window へ push・`vowelWindowFrameCount(8)` で完了、`:602-628` `createVowelCalibrationSpread` が全ラベル揃った時のみ `vowels` を書く（partial 書込み防止）。母音は既存 range/learnedSign 機構に触れず独立 window buffer で処理（`:317-321` 早期分岐）→ 既存採取フローの状態遷移を壊さない。**適合**。
- **既定参照値 = 実測 JSON バンドル**: `vowel-lipsync-estimator.ts:125-186` `defaultVowelReferenceVectors`（較正未実施のフォールバック、`runtime-parameter-frame.ts:59-60`）。**適合**。

---

## 2. テスト非 vacuous 性（Required test ごと）

### 推定器コア（`vowel-lipsync-estimator.test.ts`、7 tests）
- `classifies each captured vowel mean to its own label and neutral to null`（`:63-70`）: 実データ JSON の各ラベル mean を推定器に食わせ a→a, i→i, u→u, **e→e**, o→o, neutral→null を assert。**「え=あの縮小」を距離が分離すること**の実証（cos 類似なら a と e は同方向で分離不可）。非 vacuous。
- `returns intensity ~1 at vowel mean and 0 at neutral`（`:72-92`）: weight > 0.99（母音）/ = 0（中立）の具体値。
- `holds 'u' at funnel/pucker corner via hysteresis`（`:94-125`）: う確定後に4隅角点を N+2 フレーム与え、生 argmax が o へ 0.017 で反転する隅でも `winner === "u"` 保持。ヒステリシスの実測根拠（funnel 0.31..0.71 / pucker 0.25..0.61）を再現した非トリビアルな assert。
- gate / at-most-one / reset / L-R average 各テストも具体値。**全て非 vacuous**。

### フレーム統合（`runtime-parameter-frame.test.ts`、母音3件）
- `emits only the winning vowel parameter when enabled`（`:338-367`）: ON 側で実データ "a" を与え `nonZero === ["param_mouth_vowel_a"]`・値 > 0.99・負け母音 `toBeUndefined()`。**ON 側で実際に母音を出すこと**を実証（OFF テストと対で意味を持つ）+ 単一 Vowel 非ゼロを構造で確認。
- `does not emit any vowel parameterId when disabled`（`:369-387`）: 同じ "a" フレームで `enabled:false`、全5母音キー `toBeUndefined()`（0 発行でなく不発行）。ON テストと対で非トリビアル。
- `scales winning vowel intensity by per-slot strength`（`:389-425`）: strength 1 と 0.5 で `half ≈ full×0.5`。weight 経路（§3 strength 意味論）の値検証。

### 境界アダプタ（`input-profile-vowel-references.test.ts`、2 tests）
- `reduces raw capture means to the same 8-dim references as Domain A default fixtures`（`:70-88`）: 実データ(`vowel-captures.json`)の生 mean を全次元でアダプタに通し、Domain A `defaultVowelReferenceVectors` と **1e-4 以内一致**を assert。**アダプタが実データで Domain A 既定定数と一致すること**の要件を的確に検証（round4 と L/R 平均の丸めスケール差もコメントで正当化）。
- `applies the L/R-average reduction rule`（`:90-124`）: 非対称 L/R 値の平均を具体値で確認。

### スキーマ roundtrip / 後方互換（`input-profile-document-parser.test.ts` 母音3件）
- vowels 有り verbatim 保存（`:151-171`）/ vowels 無し後方互換（`:173-188`）/ malformed(o 欠落) drop しつつ profile と mouth 生存（`:190-224`）。全て具体値 assert。

### トグル状態（`live-mapping-state.test.ts`、母音4件）
- unsupported→false（`:118-127`）/ 解決時既定 ON（`:129-137`）/ 明示 OFF override（`:139-148`）/ 保存 profile から false 復元（`:150-174`）。§3.2 完全カバー。

### mapping profile store roundtrip（`model-mapping-profile-store.test.ts` 母音2件）
- `vowelLipsyncEnabled:false` 保存→復元（`:97-104`）/ レガシー(フィールド無し)→undefined で状態層が ON 既定化（`:107-126`）。

### 窓平均（`input-profile-vowel-window.test.ts`、4 tests）・ウィザード状態遷移（`input-profile-calibration-session.test.ts`、6 tests）も具体値で green。

**再実行結果（Review-Sylph 自身が実行）**: 母音関連10スイート **62 passed**（`vitest run`、882ms）。全て非 vacuous。

---

## 3. write scope 遵守

- tracked コード変更: `git diff --name-only | grep -vE '^(apps/runtime-player/|discussion/)'` → **該当ゼロ**。全て `apps/runtime-player/**` 配下。
- untracked コード: 母音6ファイル（推定器 + アダプタ + 窓 各 .ts/.test.ts）は全て `apps/runtime-player/src/**`。
- `packages/**`・`apps/editor/**`・`apps/authoring-host/**`・lockfile / 新規外部依存への変更 **ゼロ**。
- preload 契約（`model-mapping-bridge-contract.ts`・`input-profile-bridge-contract.ts`）と validation の変更は全て**追加的**（slot IDs 5本追加・status に `vowelLipsyncSupported`/`vowelLipsyncEnabled` 追加・`setVowelLipsyncEnabled` API 追加・prompt/section キーに vowel 追加）。既存フィールド/API 不変で契約破壊なし。runtime-player 内部契約であり外部公開面ではない。

**遵守**（下記「差分」の tools/ を除きクリーン）。

---

## 4. 裁量判断の妥当性

- **アダプタが推定器の `extractVowelFeatureVector` を再利用**: 縮約規則の二重実装を避け「機構的一致」を型と実行の両面で保証。設計 §4 の要点を最も堅牢に満たす良い判断。
- **母音は full calibration にのみ組込み、section 単独更新（head-position のみ）には母音更新パスを設けない**: 設計 §4 は「既存 prompt 駆動ウィザードに母音セクション追加」で必須の単独追加更新は明記なし。裁量範囲内。
- **dimension weights 全1**: 単位重みで全ラベルが margin 0.167 以上で分離する実測根拠付き（§7 未決の「次元重み初期値」を実測から導出、決め打ちでなく調整可能な named constant として残す設計指示に合致）。
- **gate 0.15 / margin 0.05 / frames 3**: いずれも実測 JSON の具体数値（i 活動 0.318 vs neutral 0.0、う隅の 0.017 反転、60fps ~50ms）から導出しコメント明記。§7 の実装 wave 裁定要件を満たす。
- **`vowelWindowFrameCount = 8`**: 「数回押下で ARKit ジッタを平均化」の人間工学的選択、コメントで根拠明記（§2.3 の funnel/pucker 揺れに言及）。妥当。

いずれも設計の未決事項（§7）を実測から埋める範囲で、設計に無い分岐の独断実装や escalate 漏れは見当たらない。

---

## 5. 差分・残課題

- **`apps/runtime-player/tools/capture-vowel-frames.ts`（untracked、forbidden scope）**: git 履歴なしの untracked ファイル。wave107-plan §5 forbidden scope で「読取りは可」と明記され、設計文書は本ファイルを「実測一次データ（2026-07-06）採取ツール」として wave107 コード実装に**先立って**参照している。委任プロンプトのレビュー対象一覧にも含まれず「wave107 のコード実装対象外」と注記される。したがって **wave107 の write scope 違反ではなく帰属外**。ただしリポジトリに未コミットの untracked ファイルとして残る事実は、Domain C の map/final-report 段階でコミット帰属（この採取ツールをどの作業成果として tracked にするか）を明示すると台帳がクリーンになる。**レビュー判定には影響しない情報事項**。
- 上記以外の残課題: **なし**。
- 既存失敗テスト（`browser-source-server*` 2件・packages 14件）は wave107 変更ゼロで stash baseline 再現の既存不具合と Orch が確認済み。私も母音関連は独立に green を確認。レビュー対象外で相違なし。

---

## 6. 質問

なし。設計 §2〜§4 の全要件が実装・テストで裏取りでき、判断に迷う設計漏れ・独断分岐は検出されなかった。

（唯一の情報事項 = untracked `tools/capture-vowel-frames.ts` のコミット帰属は Domain C closeout の裁量事項として委ねる。合否判定には無関係。）
