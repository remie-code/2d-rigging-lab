# C3 UX定義: 生理プロファイル画面(Physiology)

> Status: Accepted(ユーザー合意 2026-07-11)。
> 位置づけ: 閉問題C3([../closed-problem-decomposition.md](../closed-problem-decomposition.md))のwave化前UX定義。設計討議は [../../architecture/c3-gaze-head-posture.md](../../architecture/c3-gaze-head-posture.md)。
> 型の前例: Dynamics Tuneページ(Wave21。per Runtime Export profile・自動保存・即時反映・空状態)。

## 1. 位置と最重要の性質

- Control Windowの左navに `Physiology` ページを一枚追加。置き場は `Mapping / Dynamics Tune` の並び(モデルの振る舞い調整クラスタ)、`Dynamics Tune` の隣。
- **この画面にプレビューボタンは存在しない**。自律ホストの体は常に生きて動いている(C2「体験=無」)ため、**Stageそのものが常時プレビュー**。ツマミを動かすと隣で生きている体の質感がその場で変わる。
- C3のゲート「ツマミで質感が変わる」は、この画面のスライダーを掴んで隣の体の空気が変わるのを見る行為そのものが判定になる。

## 2. 画面構造

```text
+--------------------------------------------------+
|  Physiology                                      |
|                                                  |
|  Blink                                  [Reset]  |
|   Frequency      ----o----                       |
|   Calmness       ------o--   (ばらつきの逆)       |
|   Crispness      ---o-----   (開閉のきびきび)     |
|   Quirk          --o------   (二連の癖)           |
|                                                  |
|  Gaze                                   [Reset]  |
|   Camera Focus   ------o--   (カメラ目線の強さ)   |
|   Restlessness   ---o-----   (よそ見の頻度と幅)   |
|   Dwell          -----o---   (固視の長さ)         |
|                                                  |
|  Head                                   [Reset]  |
|   Sway           ---o-----   (揺らぎの振幅)       |
|   Follow         -----o---   (視線への追従の深さ) |
|                                                  |
|  Posture                                [Reset]  |
|   Drift          --o------                       |
|   Restlessness   --o------   (座り直しの頻度)     |
|                                                  |
|  Speech                                 [Reset]  |
|   Articulation   --o------   (口の作り直しの鋭さ) |
|                                                  |
|  Stage Presence                    [Off | On]    |
|   Strength       -o-------   (既定Off)           |
+--------------------------------------------------+
```

- セクション=振る舞いファミリー(Blink / Gaze / Head / Posture / Speech / Stage Presence)。各セクションに `Reset`(普遍既定値へ)。
- **Speech(C6 Domain E改, §13)**: スライダー1本 `Articulation`。再調音ディップの深さ(口が拍ごとにどれだけ作り直すか)を質感語で調整する。値は器側普遍既定値層(control-channelの発話評価器)のディップ floor へ写像され、発話評価器へ届く(心臓の生理系とは別系統。既定=弱値でちらつきにくい)。トラッキングホストでは他セクション同様、生理不在の空状態②のまま。
- **Stage Presenceのみトグル持ち・既定Off**——実機ゲートでのon/off比較装置を画面に埋めておく(設計討議§5の裁定1/3)。

## 3. 語彙の規律

- **スライダーは全て質感語**。ms・Hz・確率などの工学数字は一切出さない(内部スキーマとの対応は設計討議§6が持つ知識であり、UIの知識ではない)。
- UI語彙は英語(C1 §7.1と同一方針)。

### 3.1 キャプション(ユーザー追加要望 2026-07-11、手動ゲートでの発見)

各スライダーのラベル下に**常時表示の一行キャプション**(小さく淡色)を置く。infoアイコン+ホバー方式は不採用(発見コスト・狙うコスト・一個ずつしか読めない、の三重の負荷。常時表示なら一瞥で全部読める)。規律:

- 質感語のまま説明する(数字非露出の規律維持)。**一行厳守**、「右(またはOn)で何がどうなるか」を必ず含める。
- ライブプレビューが説明として機能しない遅い時間軸のパラメータ(Posture Restlessness等)には、観察時間軸の注記を含める。

| スライダー | キャプション |
|---|---|
| Blink: Frequency | How often the blink comes. Right = more often. |
| Blink: Calmness | Evenness of the blink rhythm. Right = steadier. |
| Blink: Crispness | Speed of close and open. Right = snappier. |
| Blink: Quirk | Chance of a quick double blink. Right = more often. |
| Gaze: Camera Focus | How strongly the gaze returns to the camera. Right = more eye contact. |
| Gaze: Restlessness | How often and how far the eyes wander. Right = busier. |
| Gaze: Dwell | How long the gaze rests in one place. Right = longer. |
| Head: Sway | Size of the idle head motion. Right = larger. |
| Head: Follow | How deeply the head follows big gaze jumps. Right = deeper. |
| Posture: Drift | Slow sway of the body's center. Right = larger. |
| Posture: Restlessness | How often the body re-seats. Right = more often. Takes minutes to observe. |
| Speech: Articulation | How sharply the mouth re-forms between beats. Right = crisper. |
| Stage Presence: Strength | How far the stage position follows posture. Right = farther. |

## 4. 永続化(Dynamics Tune方式そのまま)

- Runtime Export fingerprintごとに `<electron userData(スロット内)>` 配下へ**自動保存(debounce)**。Saveボタンなし。
- Runtime Export成果物には触れない。四層優先順位の三段目(Player側プロファイル補正)がこの画面(C3ではパッケージ宣言が不在のため、実質は普遍既定値への直接補正)。
- 別Runtime Exportへの切替でstaleプロファイルを適用しない(Dynamics Tuneと同じ規律)。

## 5. 無いもの、が設計

- **シード**: 不可視のまま(C2 §5)。
- **生理全体のOFFスイッチ**: 置かない。体に電源スイッチは無い——弱めることはできても殺せない(「読み込まれた身体は生きて生まれる」の帰結)。
- **パラメータ単位のブラケット/エンベロープ編集**: 第二段のEditorの仕事(physiological設計§4)。
- **情動・変調のツマミ**: C5(魂の変調)の領分。本画面のツマミはbaseline層のみ。
- **数値入力欄・グラフ・波形表示**: 質感はStageの体で見る。画面に波形を描いた瞬間、判定の目がグラフに奪われる。

## 6. 空状態(二つ)

1. **Runtime Export未ロード**: 既存流儀の説明文(「生理はRuntime Exportのロード後に動く」)。
2. **トラッキングホストで開いた場合**: 「This host has no physiology; the body is driven by tracking.」の一文のみの説明ページ。navからページを消す(合成差をnavへ波及させる)工事はせず、C1の劣化ページ方式と同扱い(正規解はC4の自律ホストControl UXで一括)。

## 7. C3実装ゲートとの対応

- 人間ゲート(美的): 30秒眺めて「機械のループに見えない」+ 本画面のツマミで質感が変わる。
- 機械ゲート: 生成器fixture(C2方式の拡張: 種+設定→スロット列)、プロファイルのparse/load/save/stale拒否、トラッキング経路の無退行。
