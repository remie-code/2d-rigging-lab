# Gaze Target Map

> ai-cohost/[decisions](../_map.md) の子トピック。AI(コーディ/チャッピー)が配信画面の**どこを見るか**(視線注視先)を決める調査・実験の入口地図。

## 1. Scope

- 目的: 画面上の注視先を決め、Live2D の目線(`eyeball.x/y`)の**見た目の演出**に使う。発話・実況内容の注目対象とは切り離す(ユーザー確認 2026-10-12)。
- 位置付け: [C3 視線設計](../../architecture/c3-gaze-head-posture.md)(サッカード+固視、現在の注視先はカメラ)の注視先を画面上に置けるかの下調べ。
- 第一候補の手段: OpenAI Decisions API の choice 問いで画面グリッドのマスを選ばせる。
- 段階: 1枚絵で成立性 → 1秒ごとの連続画像でぶれの調査 → 本命のストリーム。

## 2. Directory Map

| Path | Role | Status |
|---|---|---|
| [experiments/](experiments/) | 実験のプロトコルと観測結果 | Created |

## 3. Key Files

| Path | Content |
|---|---|
| [../research/openai-decisions-api.md](../research/openai-decisions-api.md) | Decisions API の公式事実、未公開の制約、サブスク枠との関係(decisions/ 共有) |
| [experiments/01-single-frame-grid.md](experiments/01-single-frame-grid.md) | マルギット戦1枚絵で 4x3 / 16x9 グリッドを各3回。答えは3回とも完全一致、4x3=r1c2(conf .2)、16x9=r4c8(conf .05) |
| [experiments/02-transcript-context.md](experiments/02-transcript-context.md) | 同画像に発言「聖杯瓶あと何個だっけ？」を添える。4x3 は左列へ移動(最上位は左上HUD、聖杯瓶の左下は2位)、16x9 はほぼ平坦。「アイテム欄見たい」では 4x3 が左下 r2c0 に届く(.36、隣 r2c1 .33) |
| [experiments/03-support-role-question.md](experiments/03-support-role-question.md) | 問いをサポート役視点に変更。マルギットのマスへ強く集中(conf .83)。発言「死んだか…生きてる」でも HP バー/自キャラへは動かない |
| [experiments/04-off-center-and-flask-retry.md](experiments/04-off-center-and-flask-retry.md) | 装備画面(対象が端)で「これ重量どうなってんだ？」→ 右端の装備重量 r1c3 へ(.39)。発言なしは中央寄り。聖杯瓶は新問いでも外れる |

## 4. Decisions (2026-10-12、ユーザー合意)

- 意味ラベル(ボス/HPバー等)の choice は採らない: 対象がシーンごとに変わるため。
- score(横/縦の順序段階)は採らない: 確率加重平均が二峰の間の何もない場所を指す。
- グリッドの位置は**選択肢の説明に文字で置く**。画像には格子線等を描かない(引っ張られるため)。
- 問い: 「ゲーム配信をしている配信者がこのゲーム画面を見たときに見ている場所はどこか？」
- 何が「良い」かはまだ決めない。まず何枚か試して傾向を見る。繰り返し回数はその都度決める。
- 同一入力への答えは決定的に見える(01)ため、各条件1回呼びで進める(ユーザー合意 2026-10-12)。

## 5. Hygiene

- APIキー・著作権上問題のありうる素材(ゲーム画面等)はリポジトリに入れない。画像と生の結果は `tmp/gaze-target/`(gitignore)に置く。
- キーは `apps/soul/agent/.env.decisions.local` の `OPENAI_DECISIONS_API_KEY`(gitignore)。`OPENAI_API_KEY` は env-guard が拒否するため使わない。
- 実験コードは特区憲章に従い `apps/soul/agent/scripts/` に置く。

## 6. Conclusion (2026-10-12、ユーザー判断)

- 視線はある程度推定できる(4x3 程度の粒度、発言で動かせる)。
- 同一入力への答えが決定的なため、連続画像(1秒間隔)のぶれ調査は行わない。

## 6.1 Next Actions

- 本トピックの実験は一区切り。次の主題は [../reaction-trigger/](../reaction-trigger/_map.md)。

## 7. Unresolved Questions

- choice の選択肢数の上限は公式未記載(144択は通ることを 01 で確認)。
- 画像の内部解像度・detail 指定の有無は公式未記載(16x9 のマスを見分けられるか)。
- 「良い」視線の評価基準。
