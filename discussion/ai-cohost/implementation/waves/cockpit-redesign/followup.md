# 操縦席UI改定 followup 台帳

> Status: 台帳確定（2026-07-14, Gnome / Domain D）。本 wave（コントロールルーム化・振る舞い保存の
> リファクタ + IA 再設計 + 外観刷新）で**意図して持ち越した**将来課題と既知受容の記録。
> それぞれ「いつ着手するか」のトリガを明記する（トリガが来るまで寝かせる＝先回り実装はしない）。

## 0. 視覚発火の fire マーカーが「? lines, ? chars」を出す（人間ゲート時にユーザーが発見・回帰でないと確定）

人間ゲートでユーザーが視覚発火時に `fired (? lines, ? chars injected)` を観測。**調査結果=リファクタ回帰ではない**:
旧 cockpit.html:456-457 も一字一句同じ `?` フォールバックを持ち（`d.includedCount != null ? ... : "?"`）、
新 view-logic/markers.mjs:22-24 はその忠実再現（機能同値）。原因は S5 由来の**視覚発火の emit 順序**——
fire-orchestrator が視覚経路で `onFire{accepted:true, vision:true}`（fire-orchestrator.mjs:613/656）を
**注入 counts 確定（:526-527）より前**に emit するため、受理マーカー時点で includedCount/injectedChars が
未定義 → `?` を正直表示。素の Fire（視覚なし・:569）は counts 込みで数字が出る。**S5 からの既存挙動で、
新旧 UI とも同一。** 将来の任意改善候補（S5 領分・低優先）: 視覚発火も counts 確定後に fire マーカーへ
数値を届ける（emit を counts 確定まで遅らせる or 追い emit）。トリガ=`?` が実運用で気になると裁定されたら。

## 1. 口数モードの実配線（→ s6-followup §12 に集約）

運転バーの口数プルダウン（控えめ/ふつう/おしゃべり）は**場所のみ**——選択はローカル state に保持される
だけで、どこにも送信されない no-op（リロードで「ふつう」に戻る・domain-c.md §8-1 の L0 裁定 (c)）。
実配線（自発発火の確率/不応期/予算をモードで束ねて POST + 永続化）は
[../s6/s6-followup.md](../s6/s6-followup.md) **§12「口数（反応確率）の Cockpit 可変化」が正**——
本台帳はポインタのみ持つ（二重管理しない）。UI 側の受け口は `ui/control-bar.mjs` の `verbosity`
state + `VERBOSITY_OPTIONS`（cockpit-ui.test の deepEqual が「実配線までは 3 択固定」の楔・実配線時に
意図的に更新される正しい壊れ方をする）。トリガ: s6-followup §12 の着手。

## 2. KILL スイッチの実装（S8）

運転バーの KILL は**赤枠 + disabled の予約枠のみ**（`ui/control-bar.mjs` KillSwitch・title「S8 で実装」）。
「土台を作る → 安全弁を載せる」の順を画面でも体現する裁定（cockpit-redesign.md §2）。中身（配信の
緊急停止）は S8 の領分。トリガ: S8 wave の発進。

## 3. linkedom 梯子（hooks 実挙動の機械検証が要る時の初 devDep）

本 wave は**純関数化 + devDep ゼロ**を貫いた（inventory §3 L0 決定）。App/Feed/ControlBar/SettingsDrawer
の hooks 本体（EventSource 実配線・自動スクロール・fetch フロー・controlled トグル）は Node で実行して
おらず、人間ゲート（[human-gate.md](human-gate.md) §6）が実描画の確認点。**描画退行が純関数検証を
すり抜けて頻発したら**、その時に linkedom（pure JS・standalone vendor と相性良 = 相対 import 可）の
devDep 初導入を裁定する。駆動口は用意済み: `mount(rootElement, { eventSourceImpl, fetchImpl, nowImpl })`
（ui/app.mjs・注入可能）。トリガ: 人間ゲートで hooks 起因の退行が 2 回以上見つかること。

## 4. 将来の UI 分割方針（認知負債として積み上げない）

現分割は IA 区画ごと（app/header/feed/rows/styles/control-bar/settings-drawer + view-logic 純関数群）。
今後 UI に機能を足すときの規律（inventory §4 L0 決定 5 の継承）:

- **表示文字列・状態導出は view-logic**（preact 非依存・fixture 必須）。コンポーネント内に導出を書かない。
- **タイムラインの新行種は rows.mjs の行レコード**（feedAfterSseEvent の単一経路）に足す。
- コンポーネントが肥大したら**区画内でさらに割る**（例: settings-drawer の区画を接続/入出力の 2 ファイル
  に）。standalone バンドルされるのはサードパーティのみ・うちらの部品は積層させず構造化。
- hooks を使う部品はテスト不能域が広がる——**hooks 非使用の葉部品**（vnode 走査対象）に描画を寄せる。

トリガ: 次に操縦席へ機能を足す wave（S8 KILL が最初の試金石）。

## 5. タイムライン行の保持無制限（domain-b.md §8-10）

旧実装はタイムライン行を無制限に DOM へ積んでいた。挙動保存のため新実装（rows.mjs の feed.rows）も
上限を設けていない。長時間配信でのメモリはブラウザタブの寿命問題として現状と同等（悪化していない）。
上限（例: 直近 N 千行でリングバッファ化）を入れるなら rows.mjs の append 1 箇所で済む。
トリガ: 実配信でタブが重くなる実害の報告。

## 6. lastDevice（マイク記憶）が自動展開判定の材料外（domain-c.md §8-4・既知受容）

初回自動展開の判定（`shouldAutoOpenSettings`）は snapshot に載る 4 設定 + 稼働状態（s.device）で行う。
**マイクの記憶（lastDevice）は snapshot に載らない**（GET /api/devices 応答のみ）ため判定外——
「マイクだけ設定して他が全部空」のユーザーは開き直しでも自動展開される。実運用上ほぼ無い状態
（起動すれば s.device で観測直行）として受容済み。解消には snapshot への lastDevice 追加＝**ワイヤ契約
変更**が要る。トリガ: この誤展開が実運用で煩わしいという体感の報告（その時は server test の 6 設定キー
契約の改定とセットで）。

## 7. thinking のフィード行化（追撃候補）

モック §2 には `○ こーでぃー thinking…` 風のフィード行が描かれているが、保存オラクルの行種 9 つに
thinking 行は無く、**新規行種の発明は振る舞い保存 wave の職域外**として見送り（domain-b.md §8-5・
L0 裁定）。soul の thinking/speaking は運転バーの soul 表示に出る（旧 UI と同位置の意味論）。気になれば
追撃で足せる: soul SSE（app.mjs が既に保持）から rows.mjs に行種を 1 つ足すだけの小変更（thinking 開始で
出現・idle/speaking 遷移で消滅——speaking 行と同型の一時行が素直）。トリガ: 人間ゲート後のユーザー要望。

## 8. レビュー non-blocking の残（記録・単独修正不要）

Domain B/C の design レビュー non-blocking のうち、**Domain D で解消済み**: B-1（header.mjs の
デッドフォールバック → 削除済み）・C-1（SettingsSelect の id 欠落 → id prop 追加で label for 有効化）。
B-2（SSE chatStatus 正規化の非対称）は Domain C で解消済み。**恒久受容として残るもの**（いずれも
挙動保存上の実害なしと裁定済み・再掲のみ）:

- B-3: speaking 行の固定文言が feed.mjs にある（行レコード規律の明示済み例外・fixture 固定済み）。
- B-4: import スモーク単体は副作用ゼロの厳密証明でない（構造テスト + grep で複層担保）。
- C-2: localBusy が両 Fire ボタン共通 disable（旧は押した方のみ・二重 POST の窓を閉じる改善方向の微差）。
- C-3: 自発トグルの checked 復帰は「エラー文言が変化して再 render が起きた場合」に限る（同一文言の
  連続失敗は旧実装と同値の挙動）。
- C-4: SettingsDrawer 初期ロード effect に cancelled ガードなし（常時 mount のため実害経路なし・
  app.mjs init effect との作法の非対称の記録）。
- C-5: CSS 検査テストの一部 regex が書式に敏感（意匠の固定点としては機能・整形時に意図確認が要るだけ）。
