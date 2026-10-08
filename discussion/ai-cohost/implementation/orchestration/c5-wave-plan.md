# AI Cohost C5 Wave Plan: 合成が正しい(曲線状態機械)

> Objective: チャネルの駆動が「跳ねる」から「演じる」に変わる。`intent.envelope` で表情ピークが滑らかに立ち上がり減衰し、あらゆる遷移(re-attack・失効・切断)が現在の実効値から曲線で繋がり、魂を殺すと表情がすっと解けて呼吸だけが残る。Stage Presenceは合成後の実効body信号に追従する。人間ゲートはC4参照ドライバの実駆動プロファイルで実施。

## 1. Status

- Status: **完全閉鎖(2026-07-11)**。実装(Domain A〜D+追撃G)+レビュー全合格+**人間ゲート合格**: 第一回で不連続を検出→診断(曲線機械シロ・原因=setの即ステップ+証人シナリオの圧縮値)→追撃G(set既定ease-in 100ms+知覚シナリオ)→**再ゲートで「滑らかに動く」、立ち上がり・符号反転re-attack・魂殺し・dip再観察の4点全クリア(ユーザー実施)**。decay意味論(peak→0+release blend)はdip非問題により現状維持で確定(c5-followup項目1解消)。追撃Gの意図的置換スコープ拡張(heart-overlay 2テスト)はL0承認済み。持ち越し: c5-followup残項目(acceptedイベントのkind表示等、C6以降 or 実物の魂の日)。(初稿Status: Ready to launch。)
- Planning gate: context-check(前提監査)→ inventory(実施済み → [c5-planning-inventory.md](c5-planning-inventory.md)。Verdict `needs_design` → ユーザー裁定4件で解消、設計討議§7に記録済み)。
- Model Allocation: **L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須**。
- ユーザー裁定(2026-07-11、[../../architecture/c5-composition-and-envelopes.md](../../architecture/c5-composition-and-envelopes.md) §7):
  1. 実効値経路=案B(心臓が前tickの `resolvedActivations` を保持・供給)。
  2. release=動く基底へのblend(1→0)、既定400ms(普遍既定・非露出)。
  3. set/envelopeは単一のスロット曲線状態機械に内部統合(契約は2 kindのまま)。
  4. 拒否は既存列挙に畳む(新コード無し)。
  - 命名規律: 器内部の曲線側はcurve系(`slot-curve-state` 等)、「envelope」は封筒側に譲る。
- Source of truth(実装前に読む):
  - 本計画。
  - 設計討議: [../../architecture/c5-composition-and-envelopes.md](../../architecture/c5-composition-and-envelopes.md)(裁定3件+派生2原則+実装裁定4件)
  - 棚卸し: [c5-planning-inventory.md](c5-planning-inventory.md)(コード接地事実+主要ファイル索引)
  - 契約の型: [../../architecture/c4-control-channel-v0.md](../../architecture/c4-control-channel-v0.md)(additive kind追加・hello supportedKinds)
  - 前提の型: [c4-wave-plan.md](c4-wave-plan.md)

## 2. Product Goal

この波の後にできること:

- 参照ドライバ(魂)が `intent.envelope` を一発送ると、器が60Hzで attack→sustain→decay を描く。カーブは普遍既定(C3 smoothstep流儀)。
- すべての遷移が連続: re-attackは現在の実効値から、`intent.set` の失効も切断も既定releaseで生きた基底へ滑らかに解ける。**スナップはどこにも存在しない**。
- 魂(参照ドライバ)をkillすると、表情が解けて呼吸・瞬き・視線だけが残る——「魂を殺してもキャラが息をしている」の完成形。
- Stage Presence(On時)はチャネルがbodyを動かしたときも画面位置が追従する。
- C4の既存契約・fixture・参照ドライバの旧シナリオは無変更で動き続ける(additive extensionの実証)。

## 3. 責務境界

### 3.1 この波がやること

- **スロット曲線状態機械**: C4のオーバーレイstoreを「静的値+失効時刻」から「時間発展する曲線状態(attack/sustain/decay/release、開始時刻、起点値)」へ進化。setは退化エンベロープとして同一機械に統合(裁定3)。
- **実効値フィードバック**: 心臓が前tickの `resolvedActivations` を保持し、re-attack起点・release起点として曲線機械に供給(裁定1)。評価点(マージseam)は動かさない。
- **release一般化**: 失効・切断の即時スナップ(C4)を、動く基底へのblend release(既定400ms)に置換(裁定2)。切断時は全スロット同時release。C4のスナップ固定テストは意図的置換。
- **契約追加**: `intent.envelope`(schema JSON・examples・TS型・validation・supportedKinds・dispatch分岐)。拒否は既存列挙(裁定4)。
- **Stage Presence入力差し替え**: snapshotを純生成器値からマージ後 `resolvedActivations` へ(設計§1裁定1。C3のstrength凸ゲイン手当ては入力出所非依存で維持)。
- **参照ドライバのシナリオ拡張**: エンベロープ送信(表情ピーク・重ねがけ・途中kill)を含む実駆動プロファイル。持続駆動テストの拡張。

### 3.2 この波がやらないこと(Out of Scope)

- 変調payload(繰延済み。情動語彙は魂/persona期)。音素タイムライン(C6。ただし曲線機構はC6が再利用できる形に切る=設計§6)。
- 新しい画面・UX(なし。Channelページの既存イベント/オーバーレイ表示に乗る)。
- カーブ形状・release時間の露出(普遍既定)。
- Editor / package-format / Runtime Export schema / lockfile変更、新規依存、`pnpm install`。`apps/soul` へのpackage.json追加。
- physiology/配下・`headless-slot-resolver.ts` の変更(原則禁止。必要ならescalate)。

## 4. 設計要点(棚卸し接地)

- 評価点はC4の心臓tickマージseam(`autonomous-frame-heart.ts` のoverlay provider)のまま。storeがtickごとに「現在時刻での曲線評価値」を返す形へ。
- 曲線数学はC3 blink生成器(close/hold/open+smoothstep)の写経。発明しない。
- release blend: `effective = lerp(livingBase(t), curveValue(t), w(t))`、w: 1→0。基底は凍結しない(終端スナップの再生産を防ぐ)。
- 命名: 曲線側モジュール/型はcurve系。契約kindは `intent.envelope`。
- 連続性テストのbound: 各インテントのパラメータから導出した理論最大傾き×tick間隔+ε の性質テスト(マジックナンバー禁止)。
- C4後方互換の機械実証: C4の契約fixture・参照ドライバ旧シナリオ・既存テスト(スナップ固定を除く)が無変更で通ること。

## 5. Wave Strategy

単一のOrch-SylphがDomainを順次実行する(A→B→C→D)。

| Domain | Work | 順序 |
|---|---|---|
| Domain A | スロット曲線状態機械+実効値フィードバック+release一般化(主コスト) | 先行 |
| Domain B | 契約 `intent.envelope`+dispatch+参照ドライバのシナリオ拡張+持続駆動テスト拡張 | Aの後(曲線機械の契約に依存) |
| Domain C | Stage Presence入力差し替え(snapshot→resolvedActivations) | Bの後(実効値経路が固まってから) |
| Domain D | 最終統合: モノレポ検証、docs/maps更新、人間ゲート手順、clean review | 最後 |

## 6. ドメイン別の要点

- **Domain A** (`cohost-c5-slot-curve-engine`): テスト=決定論fixture(インテント列+tick列→出力列)・連続性の性質テスト(導出bound、re-attack/失効/切断すべての遷移点で)・releaseが生きた基底に収束(基底が動くケースで終端スナップ無し)・setの退化エンベロープ化(C4のset挙動の外面互換: TTL中の値は同じ、失効時のみsnap→release差分)・切断→全スロット同時release・C4スナップ固定テストの意図的置換(置換理由をテストコメントでなく報告に記録)。Escalate=実効値フィードバックが心臓構造に乗らない場合。
- **Domain B** (`cohost-c5-envelope-contract-driver`): テスト=schema/型/validationの三者同期・supportedKinds告知・dispatch・不正値の既存列挙拒否・**C4契約fixture/旧シナリオの無変更通過(additive実証)**・拡張シナリオの持続駆動(エンベロープ込みでフレーム停滞なし・RTT維持)。Escalate=既存列挙で表現できない拒否ケースが出た場合(新コード追加はユーザー裁定事項)。
- **Domain C** (`cohost-c5-stage-presence-effective`): テスト=チャネルがbodyを駆動したときStage transformが追従・チャネル無しでは従来等価(C3ゲート挙動の無退行)・二重適用手当て(strength凸ゲイン)維持。Escalate=snapshot移動が他の消費者に波及する場合。
- **Domain D** (`cohost-c5-final-integration`): モノレポ検証(typecheck/対象テスト/既知baseline明示)・無変更確認(physiology golden・リゾルバ・Editor/schema/lockfile)・「実装事実に合わせて関連ドキュメントを更新する」・人間ゲート手順(§7)・clean review。

## 7. Manual Check Notes(ユーザー人間ゲート——C5の合否の本体)

**参照ドライバの実駆動プロファイルで判定する**(振り付けfixture一発は不可。閉問題分解の改定済みゲート):

1. 自律ホスト起動→Channel Open→拡張シナリオの参照ドライバを起動。
2. **表情ピークの観察**: エンベロープ・インテントで頭・視線が滑らかに立ち上がり、保持し、減衰するか。「跳ねる」でなく「演じる」に見えるか。
3. **重ねがけの観察**: 同一スロットへの連続インテントで途切れ・スナップが出ないか(re-attackの連続性)。
4. **魂殺しの観察(ゲートの目玉)**: エンベロープの途中でドライバをkill→**表情がすっと解けて(既定release)、呼吸・瞬き・視線だけが残る**か。どこにもスナップが無いか。
5. Stage Presence Onでチャネルがbodyを動かしたとき画面位置が追従するか(C4の非結合が解消されたか)。
6. トラッキングホスト無退行の一目。

## 8. Acceptance Criteria

- `intent.envelope` の縦貫通(送信→曲線描画→減衰→基底)。
- 連続性: すべての遷移点(attack開始・re-attack・失効・切断)で導出bound内(機械)+目視でスナップ無し(人間)。
- release: 動く基底への収束、既定400ms、set失効も同機構。切断→全スロットrelease→「息をしている」。
- set/envelopeが単一曲線状態機械(内部)、契約は2 kind(外面)。
- C4後方互換: 既存契約fixture・旧シナリオ・既存テスト(スナップ固定の意図的置換を除く)が無変更で通る。
- Stage Presenceが実効body信号に追従。C3挙動の無退行。
- physiology純度・golden全種・リゾルバ・トラッキング経路の無退行。実行時role分岐ゼロ。
- 命名規律(内部curve系)遵守。拒否列挙の増殖なし。
- Editor / package-format / Runtime Export schema / lockfile無変更。新規依存なし。`pnpm install` なし。
- 対象テスト・typecheckパス、または失敗が証拠つきで分類(既知baseline=Wave21 browser-source系)。

## 9. Subagent Contract

- `pnpm install` 禁止(回避工作も禁止)。`apps/soul` にpackage.json・依存を置かない。lockfile無変更は機械確認対象。
- Editorソース・package-format・Runtime Export schema・`headless-slot-resolver.ts`・`physiology/`配下の変更禁止(必要ならescalate)。
- 実行時role分岐禁止。rendererへtoken以外の秘匿・シード・rawスロットを流さない。
- C1〜C4の成果(スロット基盤・生理層・チャネル契約・特区・方向ルール検査)を退行させない。既存wave群(Wave10-23)を退行させない。
- 拒否コード列挙に新コードを足さない(必要に見えたらescalate=ユーザー裁定事項)。
- 無関係変更をrevertしない。決定論的な箇所にfocusedテスト。想定外の共有ファイルは触る前に報告。

## 10. Review Policy

各実装ドメインに3レーンのReview-Sylph(別subagent、統合禁止): ①spec(本計画+設計討議§1-§7突合) ②design/development ③test adequacy。

blocking観点: 連続性テストのboundが導出であること(マジックナンバー不可) / releaseが基底凍結でないこと / set統合の外面互換 / C4契約fixture・旧シナリオの無変更通過 / physiology純度・golden不変 / Stage二重適用手当て維持 / 命名規律 / 実行時role分岐の不在 / 拒否列挙の不増殖。

## 11. Orchestration Policy

Implementation Orchestration skill の全規則に従う(C1〜C4と同一: ネスト分離 / 在席ポーリング / 閉域 / モデル明示 / ループ上限5 / 早期脱出 / 必須文言)。

- L0(Undine): 計画・裁定・最終判定。実装しない。
- Orch-Sylph: 単一。Domain A→B→C→Dを順次。実装はGnome、レビューは3レーンReview-Sylphへ委譲。成果物は `../waves/c5/` / `../reviews/c5/`。
- 設計に無い判断分岐は実装で埋めずescalate。子が未完のままwave gateを通過しない。

## 12. 追撃wave(人間ゲート第一回の結果反映、2026-07-11)

人間ゲート第一回: release=合格(「滑らかに動いているように見える」)、dip=気にならない(再観察)、**不合格=動きの不連続**。診断([c5-choppiness-investigation.md](c5-choppiness-investigation.md))で曲線機械はシロ(実波形計測で毎tick再評価・全位相連続を確認)、原因は①setの即ステップ(設計の自己矛盾)+②証人シナリオのテスト用圧縮値、と確定。

### Domain G: setのease-in+知覚シナリオ (`cohost-c5-followup-ease-in-perceptual-scenario`)

1. **setの既定attack≈100ms(ease-in)**(ユーザー裁定=設計討議§7裁定3改定): `slot-curve-state` のset退化エンベロープのattackを0→既定100msへ。TTL・release挙動は不変。「set=即時適用」を固定していた既存テストは意図的置換(置換理由を報告に記録)。連続性boundテストはattack 100msの導出boundで通ること。
2. **参照ドライバに人間ゲート用の知覚シナリオを追加**: envelope主体・attack 200〜400ms・現実的な間合い(表情ピーク→重ねがけ→body持続→kill)。機械テスト用の圧縮シナリオは既存のまま残す(選択方法はCLI引数等、ドライバ内で完結)。持続駆動の機械テストは圧縮シナリオのまま(flaky回避)。
3. ゲート手順の更新(人間ゲートは知覚シナリオで回す旨)。

テスト: set ease-inの曲線fixture更新・連続性bound(導出)・C4契約fixture無変更(契約の形は不変)・知覚シナリオのタイムライン検証(ドライバ単体)・既存圧縮シナリオの持続駆動テスト無退行。

レビュー: 2レーン(①spec/設計§7改定突合 ②test adequacy)。小規模追撃のためレーンを絞る(C3 Domain Fの先例)。

手動再ゲート(ユーザー): 知覚シナリオで§7の6項目を再実施(特に: 立ち上がりが「ぬるっ」と見えるか・魂殺し・dip再観察)。
