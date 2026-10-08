# wave107 Final Integration Report（母音リップシンク写像スロット + キャリブレーション統合）

- ドメイン: Domain C `wave107-final-integration`（Final Integration / Clean Review / Map Closeout）
- オーケストレーター: Orch-Sylph（呼び出し元: Undine）
- 設計オラクル: `discussion/design/vowel-lipsync-mapping.md`（§2〜§4）
- wave 計画: `discussion/implementation/orchestration/wave107-plan.md`（§7 が本ドメイン仕様）
- 状態: **final complete / clean review pass**（実機ユーザー gate 待ち）

## 1. 結論（一文）

wave107（母音あいうえおリップシンク: 写像層の nearest-reference 推定スロット5本 + ON/OFF トグル + キャリブレーション統合）は Domain A+B 合算差分の独立クリーンレビューを合格。モノレポ全体 typecheck green・母音関連10スイート62テスト全 green。母音起因の失敗ゼロ・既存挙動無傷。残る既存失敗（runtime-player 2件 / packages 14件）は wave107 変更ゼロで clean HEAD stash baseline に同一再現する pre-existing 不具合で、帰属は wave107 外（→ §4 診断、§5 L0 エスカレーション）。実装差分は発生せず（Gnome 再委譲不要）。コミットはユーザーフロー（本ドメインは commit しない）。

## 2. 実装サマリ（Domain A + B）

### Domain A（`wave107-vowel-core`）: 推定器コア + 5スロット + トグル

- **推定器**（新規 `apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts`）: 特徴8次元（jawOpen/mouthFunnel/mouthPucker/mouthClose + mouthSmile/Stretch/LowerDown/UpperUp の L/R 平均）の中立差分 → 重み付きユークリッド距離の最近傍 argmax（cos 類似不可の実測根拠を距離ベースで解決）→ 強度 `w = d(Δ,中立)/(d(Δ,中立)+d(Δ,最近傍母音))` → ゲート（活動量 < 0.15 で全母音抑制）+ ヒステリシス（マージン 0.05 + 連続3フレーム）。純関数 + `RuntimePlayerVowelLipsyncState`（per-frame 状態、bodyFollowState 先例）。全定数は実測 JSON 由来の named constant。
- **5独立 weight スロット** `mouth-vowel-a/i/u/e/o`（group=mouth、targetAliases=`mouth.vowel.*`）。相互排他は上流の共有推定器（`runtime-parameter-frame.ts` でフレーム1回メモ化）+ argmax で構造的に担保。1スロット=1parameterId の既存契約不変、単一 Vowel 非ゼロがリグ契約通り構造で出る。
- **ON/OFF トグル**（§3.2）: OFF = 母音 parameterId **不発行**（0 発行ではない）+ 推定器短絡。既定 = 母音ターゲット解決時 ON。モデル単位 mapping プロファイルへ optional 永続化（schemaVersion 据え置き）。新規 IPC チャネル `setVowelLipsyncEnabled`。UI は Mapping ページ Mouth グループ先頭（supported 時のみ表示）。
- Gnome レポート: `domain-a-gnome-report.md` / レビュー: `../../reviews/wave107/domain-a-vowel-core.md`（合格・ループ1）

### Domain B（`wave107-vowel-calibration`）: キャリブレーション統合

- **永続スキーマ**（`input-profile-document.ts` の `InputProfileVowelCalibration`）: 生 blendshape 平均ベクトル全次元 6ラベル + 採取メタ（`capturedAtIso`/`windowFrameCount`/`windowDurationMs` optional）。schemaVersion 据え置き（`runtime-player-input-profiles-v1`）。
- **境界アダプタ**（新規 `input-profile-vowel-references.ts`）: 生ベクトル → 8次元縮約 `VowelReferenceVectors`。推定器の `extractVowelFeatureVector` を**そのまま再利用**して縮約規則を推定器と機構的に一致。live-mapping 側の型・参照解決は追随1行 + import のみ。
- **窓平均採取**（新規 `input-profile-vowel-window.ts`）: `capture-vowel-frames.ts` の `summarizeSamples` を正規化済み `TrackingFrame` 版に移植（mean/min/max/count・round4）。
- **ウィザード母音セクション**: 中立→あ→い→う→え→お。Record 押下ごとに窓へ加算し 8 フレームで完了。full calibration にのみ組込み（section-status/missing-only の既存挙動を保護）。パーサは vowels を optional・非致命扱い（欠落=後方互換、malformed=drop してプロファイル生存）。
- Gnome レポート: `domain-b-gnome-report.md` / ドメイン報告: `domain-b-report.md` / レビュー: `../../reviews/wave107/domain-b-vowel-calibration.md`（合格・ループ1）

### クリーンレビュー（Domain C）

- 独立 Review-Sylph（opus）が Domain A+B 合算差分を設計 §2〜§4 に照らし突合。Domain 別レビュー結論に依存せず、設計文書・全対象ソース・差分・テストを自読 + 母音関連10スイートを自ら再実行して裏取り。
- **判定: 合格**（要修正なし）。file:line 裏取りで全節適合、Required test 全て非 vacuous、write scope クリーン（全変更が `apps/runtime-player/**` 配下、`packages/**`・editor・authoring-host・lockfile 変更ゼロ）。
- レビューレポート: `../../reviews/wave107/final-clean-review.md`

## 3. テスト集計

| スイート | 結果 | 母音起因の失敗 |
|---|---|---|
| root typecheck（`tsc --noEmit`） | **green**（exit 0） | 0 |
| runtime-player typecheck（`tsc --noEmit -p tsconfig.json`） | **green**（exit 0） | 0 |
| runtime-player 全体（`vitest run`、93 files） | 469 passed / **2 failed** | **0**（失敗2件は既存不具合、§4） |
| packages 全体（`vitest run packages`、232 files） | 1406 passed / **14 failed** | **0**（失敗14件は既存不具合、§4） |
| 母音関連10スイート（下記） | **62 passed / 0 failed** | — |

母音関連10スイート: `vowel-lipsync-estimator.test.ts`(7) / `runtime-parameter-frame.test.ts`(母音3) / `input-profile-vowel-references.test.ts`(2) / `input-profile-vowel-window.test.ts`(4) / `input-profile-document-parser.test.ts`(母音3) / `input-profile-calibration-session.test.ts`(母音6) / `input-profile-store.test.ts`(母音2) / `live-mapping-state.test.ts`(母音4) / `model-mapping-profile-store.test.ts`(母音2) / `runtime-export-auto-mapping.test.ts`(更新3)。

## 4. 除外した既存失敗の診断（修正 op 未発行 → L0 エスカレーション）

wave107 のコード変更はすべて `apps/runtime-player/**` + `discussion/**` に閉じ、`packages/**` は Forbidden scope で変更ゼロ。以下の失敗はいずれも wave107 の全変更を `git stash -u` した clean HEAD（`ee038e84`）で同一に再現することを実測確認済み。**帰属は wave107 外の pre-existing 不具合**（wave106 final report の pre-existing 台帳 P1/P4 と連続）。修正は in-flight のユーザー作業の可能性があるため op を発行せず、診断結果を L0 へエスカレーションする。

### 除外A: runtime-player 2件（`effectiveDynamicsTuning: null` 期待値ずれ）

- 対象: `src/main/broadcast-source/browser-source-server.test.ts:150`（`toStrictEqual`）/ `src/stage/browser-source/browser-source-server-message.test.ts:216`（`toStrictEqual`）
- 失敗内容: 実装（`getStatus()` / `readBrowserSourceRuntimeExportResponse` の not-loaded shape）が `effectiveDynamicsTuning: null` を含めて返すのに、テスト側の期待オブジェクトにこのキーが無い（`…(5)` vs `…(4)`）。
- **根本原因（git 特定）**: コミット `4627bbd3`（2026-07-02「playerでの物理演算調整機能」= wave21 dynamics-tuning）で、`browser-source-server.ts`（`getStatus`）と `browser-source-server-message.ts`（レスポンスパーサ）に `effectiveDynamicsTuning` フィールドが追加された。**同コミットは上記2テストファイルを一切変更していない**（stat に不在。触ったのは session.test / stage-client.test 等の別テスト）。`4627bbd3~1`（親）の当該テストにも既にキーは無かった → **このコミットで初めて赤化**。両テストは working-tree 変更なしのクリーンコミット済み。
- **判定**: テスト側の期待値が古い（**実装退行ではない**。`effectiveDynamicsTuning: null` の出力は wave21 dynamics-tuning 機能として意図的で正しい）。**帰属 = wave21 dynamics-tuning のテスト期待値更新漏れ**。wave106 final report で P4 として既に既知掃き出し済み。
- **修正指針（L0 裁定用）**: 両テストの `toStrictEqual` 期待オブジェクトに `effectiveDynamicsTuning: null` を1行追加すれば green。1行×2ファイルの純テスト修正でソース変更不要。

### 除外B: packages 14件（fixture/contract 系）

- 対象13ファイル: `operation-core`(8) / `runtime-core`(2) / `validator-core`(3)。代表: `wave30-tutorial-mini-model-contract-fixtures.test.ts`（`op_tutorial_create_parameter_mouth_open` が `duplicateParameter: param_mouth_open already exists` で reject）、`warp-lattice-diagnostics.test.ts`、`runtime-grid2d-keyform-fixture.test.ts` ほか。
- **判定**: `packages/**` は git working-tree 変更ゼロ（wave107 は物理的に無関与）。clean HEAD stash baseline で同一再現。**wave106 final report の P1 台帳（packages 赤14、tutorial/variants/keyform 系）と連続する既存不具合**。wave107 とは別ドメイン（写像層 vs バリデータ/オペレーションレシピ fixture）。
- **帰属**: wave106 以前から継続する in-flight 由来の pre-existing。wave107 では新規赤ゼロ。

**エスカレーション要旨（L0 → ユーザー）**: 除外A（player 2件）は 1 行×2 ファイルの純テスト期待値更新で解消可能な確定不具合（帰属 wave21）。除外B（packages 14件）は wave106 台帳 P1 の継続で、fixture レシピ側の別 wave 対応が要る。いずれも wave107 の合否には無関係で、実機 gate も阻害しない。修正着手は in-flight 作業との衝突回避のためユーザー判断に委ねる。

## 5. ユーザー gate 手順（実機確認・wave 外）

設計 §5 検証2 / wave107-plan §7 の通り、以下は実機での目視ゲート（player を起動して確認）。

1. **player 起動 + 母音 rigging 済みモデルロード**: `param_mouth_vowel_a/i/u/e/o` を持つエクスポート済みモデル（cp17 リグ契約）を runtime-player でロードし、iFacialMocap 入力を接続。
2. **母音発話**: 「あ・い・う・え・お」を順に発話し、口形に応じて対応する母音変形のみが出る（単一 Vowel 非ゼロ）ことを目視。特に「え」（あの縮小）が「あ」に誤分類されないこと。
3. **ちらつき無し**: 「う」保持中に funnel/pucker が揺れても母音がちらつかない（ヒステリシスの効き）。口を閉じた中立で全母音がゼロ（ゲート）。
4. **トグル**: Mapping ページ Mouth グループ先頭の母音リップシンク ON/OFF トグルで、OFF 時に口の開閉のみ（母音変形が完全に消える）、ON 時に母音が戻ることを確認。設定がモデル単位に永続化され再ロードで維持されること。
5. **strength**: 各母音スロットの strength スライダで効き幅が変わる（0 で当該母音無効化）ことを確認。
6.（任意）**キャリブレーション**: 入力プロファイルの較正ウィザードで母音セクション（中立→あ→い→う→え→お、各 Record 8回）を実施し、保存後に再起動なしで採取した参照が推定に反映されること。

## 6. コミット帰属メモ（ユーザーフロー用・合否無関係）

Domain C は commit しない（コミットはユーザーのフロー）。台帳をクリーンに保つための情報事項:

- **untracked のコード成果物**: 母音6ファイル（`vowel-lipsync-estimator.{ts,test.ts}` / `input-profile-vowel-references.{ts,test.ts}` / `input-profile-vowel-window.{ts,test.ts}`）は wave107 の正規成果物。
- **untracked の採取ツール/データ**: `apps/runtime-player/tools/`（`capture-vowel-frames.ts`）と `test_data/iFaceMocap/vowels/`（`vowel-captures.json`）は設計 §5/§6 で採取ツール・実測一次データとして明記。wave107-plan §5 で「読取り可」の forbidden scope 帰属外だが、テストフィクスチャの出所であり、コミット時にどの作業成果として tracked にするか明示すると台帳がクリーン（Review-Sylph 情報事項）。
- **untracked の設計/計画/調査**: `discussion/design/vowel-lipsync-mapping.md`（本 wave で Status 更新）・`discussion/implementation/orchestration/wave107-plan.md`・`discussion/implementation/reviews/wave107/`・`discussion/implementation/waves/wave107/`・`discussion/model-authoring/research/player-*-survey.md`。
- **wave107 外の混入差分**: `git diff` に `discussion/model-authoring/craft/*`・`design/_map.md` の一部（craft 系）が混じるが、これらは wave107 コード実装対象外の別作業（model-authoring 側）由来。wave107 帰属外。

## 7. サブエージェント閉域（SKILL.md 規則5）

- Review-Sylph（final clean review、agentId `a033a82224508c2c9`、opus）: 完了成果物 `final-clean-review.md` を返済し完了通知受領済み。`TaskStop` は所有権エラー（親 agentId 相違）で明示停止不可 → 完了済みゾンビ表示は衛生問題のみ（作業ツリー影響なし）。L0/ユーザーが UI から掃除可能な agentId として列挙: **`a033a82224508c2c9`**。
- 実装差分ゼロにつき Gnome 起動なし。

## 8. 判定

**pass**（final complete / clean review pass）。母音起因の新規失敗ゼロ・既存挙動無傷。実機ユーザー gate（§5）待ち。除外した既存失敗の診断は §4 で L0 へエスカレーション。
