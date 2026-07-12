# S4 follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録開始（2026-07-13, Gnome / S4 Domain B）。台帳の流儀は
> [../s3/s3-followup.md](../s3/s3-followup.md) を踏襲。
> 出典: [domain-a.md](domain-a.md) §9 質問 + [domain-b.md](domain-b.md) の持ち越し +
> [../../orchestration/s4-planning-inventory.md](../../orchestration/s4-planning-inventory.md) §3
> （四層昇格の道・眉・Player 質感）+ [../../architecture/conversation-pipeline-direction.md](../../architecture/conversation-pipeline-direction.md)。

## 1. Domain A §9 質問のうち **人間ゲート後**に確定するもの（実機の見え方待ち）

いずれも「配線は済み・実機で見て裁定」の性質。人間ゲート手順書
[human-gate-procedure.md](human-gate-procedure.md) §7「見るときの注意」+
[../../../experiments/s4-expressions.md](../../../experiments/s4-expressions.md) §4 の記入欄で観測 →
逆・不自然だった語のみ `src/mind/expression-table.mjs` の該当行を直す（数値はここ 1 箇所）。

1. **`nod` の単峰近似が頷きに見えるか（domain-a §9 質問 1）**。v0 は ADS 単峰＝「顎を下げて 2s 保持して
   戻す」。「下げっぱなし」に見えたら (a) `nod` だけ sustain を帯下限 2000ms のまま decay を短くする微調整、
   (b) 多峰演出（S5+）へ送る、のどちらか。人間ゲートで見てから裁定。
2. **head/gaze/body の符号がリグ依存で未確定（domain-a §9 質問 2）**。特に `nod`(head-vertical -0.35) と
   `surprised`(head-vertical +0.3) が意図どおり逆向きに出るか。逆なら該当行 peak の符号反転（1 行）。
   `eye-blink-*` は 0=開/1=閉 確定で曖昧さ無し。
3. **`look-camera` 単独発火の見え方（domain-a §9 質問 3）**。gaze/head を peak 0（正面復帰）にしているため
   直前に `look-away` が無い単独 `look-camera` は body-z 前傾のみ可視。意図どおりだが実機での体感を記録。

## 2. 昇格・拡張の道（設計に予約済み・将来 wave）

1. **翻訳層の写像先をパッケージ宣言層へ昇格（inventory §3-2 の四層の道）**。v0 は写像先を Editor
   デフォルトパラメータに限定した帰結として、演出表は**エコシステム普遍**（リグ固有でない）。四層の
   昇格の道: **①普遍既定値（魂の演出表・v0＝現在）→ ②パッケージ宣言（このモデルの smile の深さ等・
   モデル同梱の宣言）→ ③Player 側プロファイル補正 → ④変調（将来）**。②以降は「モデルごとに表情の
   質感を宣言/補正する」段で、器（パッケージ）側の契約拡張を伴うため魂単独では進めない。今は①で
   固定（数値は `expression-table.mjs` 1 箇所）。
2. **Player 側の質感スライダー（②〜③の入口）**。演出の「強さ・速さ・溜め」をエンドユーザー（配信者）が
   Player で調整するノブ。魂側の**強さ係数**（`expressionIntensity`・全 peak 一括スケール・既定 1.0）は
   v0 で口を開けたが、Player 側の per-model / per-slot な質感補正は器の領分。**操縦席には調整 UI を
   置かない裁定**（運用面は CLI/設定限定）に沿い、S4 では魂の係数オプションのみ（配線は §3-3 参照）。
3. **眉（brow）は固有 Issue（器の契約拡張 wave）**。現契約 16 スロットに眉の独立スロットが無い（眉は
   目の blink と別軸の表情要素）。眉を演出語彙に足すには**器側の semantic slot 追加＝契約拡張**が要る
   ため、魂単独の wave では扱えない。眉が欲しくなったら「器の契約に brow スロットを足す wave」を
   別途起こす（C4/C5 契約 JSON に触るため魂の特区外・S4 スコープ外）。
4. **タグ位置同期（v0 は発話開始一括・position は保持のみ）**。パーサは `event.position`（元 replyText 内の
   タグ開始文字位置）を保持するが、v0 は**発話開始で envelope を一括送出**しタグ位置に同期しない。実 SDK
   観測（[../../../experiments/s4-expressions.md](../../../experiments/s4-expressions.md) §1）では
   **1 応答 = タグ 1 個・位置は全て文中（冒頭相槌の直後）**だったため、一括送出で体感上は自然
   （返事の頭で表情が始まる）。位置同期の価値が出るのは **1 応答に複数タグが順に出る**ようになってから
   （例: 驚き→頷き）。その時は position を発話の音素/時間へ写像して逐次 sendEnvelope する（S5+）。
   多タグ応答の実挙動（envelope の重ね合わせ）は今回未観測（§3-2）。

## 3. Domain B の設計判断で S4 以降に効く持ち越し

1. **既存テスト名の含意ズレ（cockpit-page.test.mjs・S3 followup §1-5 の継続）**。既存ケース名
   「diagnostic asrFailure adds a ghost row; **other diagnostic types do not**」は、S3 で
   fireEmptyReply/fireError、S4 で expressionUnknownTag もゴースト行を出すようになり、名前の「other
   types do not」の含意と実装がさらにズレた。当該 assert は asrFailure 分岐の存在確認のみでテストは
   正当に通過しており（**既存テスト変更禁止**の規律により S4 でも名前を触らない）、次に当該既存
   ケースを触る wave で名前を実態（「asrFailure adds a ghost row」等）へ更新するのを推奨。S4 の新規
   ゴースト行テストは別ケース（expressionUnknownTag 専用）として追加済み。
2. **多タグ応答の実挙動が未観測**。observe-expressions.mjs の 5 ask はすべて 1 応答 = タグ 1 個だった
   （感情語彙とタグの 1:1 対応が素直に出た）。**複数語が同一応答に順に出た場合**の envelope 重ね合わせ
   （同じスロットに複数語が触れる・時間差で発火する）は実機/追加観測で確認する余地がある。パーサ・
   翻訳層・orchestrator は複数 events を出現順に処理する配線済み（fixture テストで固定）だが、実 LLM が
   多タグを吐く頻度と、その時の見え方は未観測。
3. **envelope accepted 率（実器での受理）は未計測**。observe-expressions.mjs は翻訳層まで（payload 生成の
   成功・診断 0）を確認したが、実チャネル/実器への送出と accepted は人間ゲートの領分
   （[../../../experiments/s4-expressions.md](../../../experiments/s4-expressions.md) §4）。部分適用
   （一部スロット rejected）の実発生頻度は実器運用で観測されたら本台帳へ追記する。
4. **強さ係数（expressionIntensity）の CLI フラグ配線は未実施**。orchestrator オプションとして口は
   開いている（既定 1.0）が、`scripts/cockpit.mjs` への `--expression-intensity` 等の配線は S4 では
   足さなかった（実機で「強すぎ/弱すぎ」が確認されてから・操縦席 UI には置かない裁定）。必要になったら
   `parseCockpitArgs` に 1 フラグ足して `createFireOrchestrator({ expressionIntensity })` へ渡すだけ
   （数行・fire-window-min 等の既存フラグと同型）。

## 4. 本 wave で回収済み（Domain A §9 の申し送りのうち Domain B で閉じたもの）

- **cockpit main 結線（domain-a §9 質問 5）**: `cockpit-server.mjs` の fireOrchestratorFactory hooks に
  `onExpression: (info) => broadcast("expression", info)` を追加。`scripts/cockpit.mjs` の factory は
  `...hooks` を spread するため本番結線に自動で届く（追加改修不要）。SSE `expression` イベント +
  操縦席の演出イベント行 + 未知タグのゴースト行まで結線済み（[domain-b.md](domain-b.md)）。
- **実 SDK でのタグ実出現の確認（wave 計画 §3 Domain B）**: 5/5・未知タグ 0 で観測済み
  （[../../../experiments/s4-expressions.md](../../../experiments/s4-expressions.md)）。
