# AI Cohost C6 Wave Plan: 口が話せる(口グループ・タイムライン評価器)

> Objective: `intent.speech`(モーラ契約)で器の口が話す。凸恒等(Σvowel = s = mouth.open)は口グループ評価器の相補式が構造で保証し、時間仮説(undershoot+s縮小+再調音ディップ)が「生きた発話中の口」を普遍既定だけで作る。人間ゲートはユーザー実発話との並置比較。

## 1. Status

- Status: **実装完了(Domain A/B 合格、Domain C 統合)**。機械ゲート(凸恒等・再調音ディップ・undershoot・512拒否・無退行)は実装・検証済み。**最終審=比較ゲートはユーザー人間ゲート待ち**(手順 → [../waves/c6/c6-comparison-gate.md](../waves/c6/c6-comparison-gate.md))。
  - Domain A: 口グループ・タイムライン評価器 + store 統合(3レーンレビュー合格、[../waves/c6/domain-a-report.md](../waves/c6/domain-a-report.md))。
  - Domain B: 契約 `intent.speech`(可変長モーラ列)additive 縦貫 + validation + dispatch + server 配線 + fixture + 参照ドライバ発話シナリオ(3レーンレビュー合格、[../waves/c6/domain-b-report.md](../waves/c6/domain-b-report.md))。
  - Domain C: モノレポ検証(typecheck 0 error / test:unit 904 pass・既知 baseline 2件のみ / check:source 既知 C3 1件のみ / check:soul-zone pass)・無変更確認(physiology・resolver・Editor/schema/lockfile・心臓 seam・apps/soul package.json 不在・role 分岐不在)・docs 更新・比較ゲート手順([../waves/c6/domain-c-report.md](../waves/c6/domain-c-report.md))。
  - **オープン項目(Undine 裁定待ち)**: 後着置換 direction(a)——`setSpeech` 時の口 per-slot 曲線の **delete vs release**(Domain A 報告 §5-5 の裁量、現状 delete で専有)。Domain C は触らず現状維持のまま裁定に委ねる。
- Planning gate: context-check(前提監査)→ inventory(実施済み → [c6-planning-inventory.md](c6-planning-inventory.md)。Verdict `needs_design` → ユーザー裁定で解消、設計討議§7に記録済み。留保:「実際できた結果を見ないと厳密にはわからない」=最終審は比較ゲート)。
- Model Allocation: **L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須**。
- ユーザー裁定(2026-07-11、[../../architecture/c6-mouth-phoneme-timeline.md](../../architecture/c6-mouth-phoneme-timeline.md) §7):
  1. 口グループ・タイムライン評価器の新設(storeの新種エントリ)。
  2. 相補式(単一進行度p: weight_next=p / weight_prev=1−p / s=lerp、値=weight×s → **Σvowel=s=mouth.open 恒等**)。
  3. 調停=後着置換(新しい口駆動が古い口駆動をrelease経由で置換)。
  4. タイムライン長上限=512モーラ、超過は `invalidPayload`(拒否語彙の不増殖)。
  5. attackはpayload非搭載(モーラ間隔から導出)。s縮小係数=普遍既定0.8前後(非露出)。
  6. **再調音ディップ**(設計§3.5): 全モーラ境界でsに短いディップ(〜40%へ30〜50ms)。同母音連続(「のところど」)でも口が拍ごとに動く。
  7. fixtureフレーズ=**「これじっさいのところどうなってるの」**、テストモデル=ユーザー本番Runtime Export(母音リグ保有確認済み)。
- Source of truth(実装前に読む):
  - 本計画。
  - 設計討議: [../../architecture/c6-mouth-phoneme-timeline.md](../../architecture/c6-mouth-phoneme-timeline.md)(モーラ契約・時間仮説・再調音ディップ・比較ゲート・実装裁定§7)
  - 棚卸し: [c6-planning-inventory.md](c6-planning-inventory.md)(コード接地事実+主要ファイル索引)
  - 前提の型: [c5-wave-plan.md](c5-wave-plan.md)(曲線状態機械・契約追加の型・知覚シナリオの教訓)

## 2. Product Goal

この波の後にできること:

- 参照ドライバが `intent.speech`(モーラ列)を一発送ると、器の口が「これじっさいのところどうなってるの」と話す(音は無い。口だけが話す)。
- 同母音連続でも口が拍ごとに動く(再調音ディップ)。発話の終端・切断でC5 releaseにより口が自然に閉じる。
- Σvowel = s = mouth.open が全tickで恒等(機械の性質テスト)。
- C4/C5の既存契約・fixture・シナリオは無変更で動く(additive)。

## 3. 責務境界

### 3.1 この波がやること

- **口グループ・タイムライン評価器**: 相補式・undershoot(attack=モーラ間隔)・s縮小係数・再調音ディップ・後着置換・終端release。storeの新種エントリとして、心臓tickの既存マージseamから毎tick評価される。
- **契約 `intent.speech`**: schema JSON・やり取り例・TS型・validation(モーラ列の形・母音語彙・時刻単調・上限512)・supportedKinds・dispatch。
- **fixture音素列**: 「これじっさいのところどうなってるの」のモーラ列(契約examplesに)。
- **参照ドライバの発話シナリオ**: 知覚シナリオに発話を追加(または発話シナリオを増設。ドライバ内で完結、依存ゼロ維持)。
- **比較ゲート手順の整備**(§7)。

### 3.2 この波がやらないこと(Out of Scope)

- 実物TTS・音声出力・音声同期(S系列)。音素→母音写像(魂側。fixtureは手書きモーラ列)。
- 子音別の閉鎖差(普遍ディップで近似。負けたら契約追加を別途議論)。
- 発話の感情表現(変調)、実測採取路(条件付き追撃のまま)。
- 新画面・UX(なし)。physiology/・リゾルバ・Editor・schema・lockfile変更、新規依存、`pnpm install`、`apps/soul` へのpackage.json。

## 4. 設計要点(棚卸し接地)

- 外周は全部C5資産: 心臓60Hz cadence・マージseam・`snapshot(nowMs)` 毎tick評価・release-to-living-base・releaseAll・smoothstep・additive契約追加の型。
- 新規は評価器の内部数学のみ: モーラ列+現在時刻→6スロット(5母音+mouth.open)の連動値。将来時刻のモーラは評価器内でスケジュール(受信即開始のC5単一目標と違い、タイムラインは時刻表を持つ)。
- 生理は口を産まない(接地済み)ため優先競合なし。release先=口0=閉口。
- 決定論: 評価器は(タイムライン+tick時刻列)の純関数。fixture=モーラ列+tick列→6スロット出力列のgolden+性質テスト(凸恒等・連続性bound導出・ディップの存在・同母音連続の非静止)。

## 5. Wave Strategy

単一のOrch-SylphがDomainを順次実行する(A→B→C)。

| Domain | Work | 順序 |
|---|---|---|
| Domain A | 口グループ・タイムライン評価器(相補式・ディップ・undershoot・後着置換・release統合)+決定論fixture | 先行 |
| Domain B | 契約 `intent.speech`+validation(上限512)+fixture音素列+参照ドライバ発話シナリオ+持続駆動拡張 | Aの後 |
| Domain C | 最終統合: モノレポ検証・無変更確認・docs更新・比較ゲート手順・clean review | 最後 |

## 6. ドメイン別の要点

- **Domain A** (`cohost-c6-mouth-timeline-evaluator`): テスト=凸恒等(全tick性質テスト)・相補式・undershoot(モーラ間隔導出)・再調音ディップ(同母音連続「のところど」で非静止)・s縮小係数・後着置換(タイムライン↔per-slot口インテント)・終端/切断release(閉口)・連続性bound(導出)・決定論golden(フレーズ全体)。Escalate=グループエントリが既存storeマージseamに乗らない場合。
- **Domain B** (`cohost-c6-speech-contract-driver`): テスト=schema/型/validation三者同期・上限512拒否(invalidPayload)・時刻単調検証・supportedKinds・C4/C5契約fixture無変更(additive実証)・ドライバ発話シナリオのタイムライン検証・持続駆動無退行。Escalate=既存拒否語彙で表現できないケース。
- **Domain C** (`cohost-c6-final-integration`): typecheck/対象テスト/既知baseline明示・無変更確認(physiology golden・リゾルバ・Editor/schema/lockfile)・「実装事実に合わせて関連ドキュメントを更新する」・比較ゲート手順・clean review。

## 7. Manual Check Notes(ユーザー人間ゲート——比較法)

1. **並置比較(ゲートの本体)**: トラッキングホストで君自身が「これじっさいのところどうなってるの」を発話(vowel lipsync有効)。自律ホストで同フレーズのfixture音素列を参照ドライバから送る。**並べて見て、(b)が(a)と同種の生き物に見えるか**(同一である必要はない)。
2. **「のところど」の観察**: 同母音連続で口が拍ごとに動くか(再調音ディップの試金石)。
3. **終端**: 発話が終わると口がすっと閉じるか(release)。
4. 途中でドライバをkill→口が閉じて呼吸だけ残るか(一目)。

## 8. Acceptance Criteria

- `intent.speech` の縦貫通(モーラ列→口が話す)。
- **Σvowel = s = mouth.open が全tickで恒等**(機械)。
- 同母音連続で非静止(ディップ)。undershoot・s縮小が実装され普遍既定のみ(露出なし)。
- 上限512拒否・時刻単調検証・拒否語彙の不増殖。
- 後着置換・終端/切断release(閉口)。
- C4/C5後方互換(既存fixture・シナリオ無変更で通過)。physiology純度・golden・リゾルバ・トラッキング経路の無退行。実行時role分岐ゼロ。
- Editor / package-format / Runtime Export schema / lockfile無変更。新規依存なし。`pnpm install` なし。`apps/soul` package.json不在。
- 対象テスト・typecheckパス、または失敗が証拠つきで分類(既知baseline=Wave21 browser-source系2件+check:sourceのC3既存1件)。

## 9. Subagent Contract

C5と同一(必須文言・install禁止・保護対象無変更・role分岐禁止・拒否語彙不増殖・無関係revert禁止・focusedテスト・想定外共有ファイルは報告)+「physiology/・`headless-slot-resolver.ts` 変更禁止(必要ならescalate)」。

## 10. Review Policy

各実装ドメインに3レーンのReview-Sylph(spec/design/test)。blocking観点: 凸恒等の性質テストが全tick対象であること / ディップ・undershoot・縮小係数が普遍既定(露出なし) / 相補式の構造保証(検証コードで代用しない) / C4/C5 fixture無変更 / 連続性bound導出 / physiology純度・golden不変 / 実行時role分岐の不在。

## 11. Orchestration Policy

Implementation Orchestration skillの全規則(C1〜C5と同一)。Orch-Sylph単一、Domain A→B→C順次、成果物は `../waves/c6/` / `../reviews/c6/`。設計に無い判断分岐はescalate。子が未完のままwave gateを通過しない。

## 12. 追撃wave(比較ゲート第一回の結果反映+direction(a)裁定、2026-07-12)

比較ゲート第一回: **不合格=ちらつき**(「同じ母音が続くところで子音の閉鎖ジェスチャの近似が効きすぎ。開閉成分が強すぎてパチパチする」)。direction(a)は**(B)グループre-attack**でユーザー裁定(設計討議§7.1)。

### Domain D: ディップ弱体化+グループre-attack (`cohost-c6-followup-dip-reattack`)

1. **再調音ディップの弱体化**(設計§3.5改定): floor 0.4→**0.7〜0.8目安**、~30ms。「明滅(7〜8Hz)」でなく「拍動」に見える控えめさへ。「のところど」非静止の性質テストは維持(振幅非依存の形に更新可)。関連golden・観測値テストの更新は意図的置換として記録。
2. **グループre-attack(裁定B)**: `setSpeech` 時の口per-slot曲線のdelete専有を、口グループonsetの**現在実効値からの立ち上げ**に置換。同時発生ケース(発話開始時に口per-slot曲線が非0)で連続(導出bound内)になる性質テストを追加。実効値フィードバック(C5案B)の既存機構を使う。
3. 凸恒等・undershoot・C4/C5後方互換・純度等の絶対条件は§8のまま。

レビュー: 2レーン(①spec/設計§3.5改定+§7.1裁定突合 ②test adequacy)。

手動再ゲート(ユーザー): 比較法4項目の再実施——特に「のところど」が**パチパチせず、かつ凍らず**、拍動に見えるか。

### §12補遺: 追撃第一回の不成立(プロセスインシデント、2026-07-12)

Domain D追撃の第一回Orch-Sylphは、走行中に**実際には受領していない結果を主張する**逸脱を起こし(本人の最終報告および事後検証による)、Domain Dを実装しないまま終了した。事後検証(L0): 作業ツリーはクリーン(変更ゼロ)・実装報告/レビューは不存在——**リポジトリへの汚染はゼロ**。当該Orch-Sylphは委任契約外のArtifact公開(一般化ポストモーテム、既定非公開)も行った。処置: 当該コンテキストは再利用せず、新しいOrch-Sylphで再発進。再発防止として委任文に「**子の完了主張は契約成果物ファイルをReadして裏取りしたもののみ有効。ファイルが無ければ結果は存在しない**」を明記(スキルの『契約成果物ファイル=唯一の正式経路』の強調)。

## 13. 追撃第二弾(比較ゲート第二回の結果反映、2026-07-12)

再ゲート結果: 「改善したがまだちらつく。子音の模擬のところ、どのくらい口の形を作り直すかをスライダーで調整できるようにしないか。多分一発でいい値にするのは無理だ」(ユーザー)。→ **再調音の強さを普遍既定値層からPlayer側プロファイル補正層へ昇格**(四層優先順位の設計どおりの使い方。新機構の発明ではない)。

### Domain E: Articulationスライダー+ループ再生 (`cohost-c6-followup2-articulation-slider`)

1. **PhysiologyページにSpeechセクション新設**: スライダー1本 `Articulation`(キャプション: "How sharply the mouth re-forms between beats. Right = crisper.")。左端≈ディップほぼ無し〜右端≈はっきり(現行値は範囲の中に含める)。C3の既存機構(質感語・数字非露出・per-export自動保存・即時反映のconfig seam)を再利用し、値をディップ深さ(floor)へ写像して speech評価器へ届ける。トラッキングホストでは既存の空状態のまま。
2. **参照ドライバに `--loop`**: 発話シナリオをフレーズ繰り返しにする調整用フラグ(依存ゼロ維持)。スライダーを掴みながらその場で探せる。
3. 既定値=現行の弱め値。凸恒等・非静止・連続性boundの性質テストはスライダー全域で成立すること(範囲端の性質テスト)。

レビュー: 2レーン(①spec/UX突合 ②test adequacy)。UX定義([../screens/c3-physiology-profile.md](../screens/c3-physiology-profile.md))にSpeechセクションを追記する(実装事実の反映としてDomain E内で)。

手動再ゲート(ユーザー): `--loop` で喋らせ続けながらArticulationを掴み、**ちらつかず・凍らず・自然に見える位置が範囲内に存在するか**を確認(見つかればその位置で比較法4項目を最終実施)。

### §13補遺: Domain DのEへの統合(ユーザー承認 2026-07-12)

Domain D(§12)は三代のOrch-Sylphが不成立(初代=観測捏造、二代目=観測障害の誠実停止、三代目=同様の停滞疑いでユーザー承認のもと系譜ごと停止。いずれもツリー無傷)。加えて**Articulationスライダー(§13)の登場でDの「ディップ弱体化=いい値探し」はスライダーが飲み込む**(既定を弱値にしてユーザーが実機で探す)ため、**Dの残る実体=グループre-attack(裁定B)をDomain Eに統合**し、一本の統合waveとして実施する。

**統合Domain E(改)のスコープ**: ①グループre-attack(§12項目2逐語) ②Articulationスライダー(§13項目1。既定値=弱値(floor 0.75相当)を範囲内に) ③参照ドライバ `--loop`(§13項目2) ④性質テストはスライダー全域+同時ケース連続性。ゲートも一回: `--loop` で喋らせながらスライダーで「ちらつかず・凍らず」の位置を探し、見つかれば比較法4項目を最終実施。

注記: 直前の再ゲート(「改善したがまだちらつく」)は、Domain D未着地のため**ディップ弱体化前(floor 0.4)のコードに対する観察だった**——「まだちらつく」は当然の結果であり、スライダー方針の妥当性を弱めない(むしろ「一発で決められない」の傍証)。
