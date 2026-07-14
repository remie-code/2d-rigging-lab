# 操縦席UI改定 人間ゲート手順書 — コントロールルーム化（観測/運転/設定の三層 IA・preact+htm no-build）

> Status: 手順確定（2026-07-14, Gnome / Domain D）。**実行はユーザー**（実ブラウザ・実マイク・実器接続を
> 伴うため Gnome / エージェントは実行しない＝規律。機械テストは実ネットワーク・実ブラウザに一切出ていない）。
> ゴール: [../../orchestration/cockpit-redesign-wave-plan.md](../../orchestration/cockpit-redesign-wave-plan.md) §1
> ——操縦席を起動 → **モック（[../../screens/cockpit-redesign.md](../../screens/cockpit-redesign.md) §7）の
> 見た目で立ち上がる** + **現操縦席の全機能が動く**（保存チェックリスト = inventory §2-1〜2-3 を 1 個ずつ）+
> 三層 IA（観測が主役・設定は畳まれ ⚙ で開く・運転バー常駐）+ **二回目以降は観測に直行**。
> 本 wave は**振る舞い保存のリファクタ + IA 再設計 + 外観刷新**（能力 wave ではない）——確認するのは
> 「S1〜S7 で動いていたものが新しい見た目と構造で動き続けること」。

## 0. このゲートで確認すること / しないこと

- **確認する**: 見た目（§2）・導線（§3）・設定層（§4）・運転層（§5）・観測層（§6）。機械テストが構造上
  届かない領域が主対象——**App/Feed/ControlBar/SettingsDrawer の hooks 実挙動**（EventSource 実配線・
  自動スクロール・履歴復元・uptime 刻み・fetch フロー・controlled トグル）は Node の機械テストでは
  実行しておらず（devDep ゼロ規律・linkedom は followup の梯子）、このゲートが唯一の実描画確認
  （domain-b.md §8-1 / domain-c.md §8-5 の正直な限界の穴埋め）。
- **しない**: **実配信・実 YouTube は不要**（wave-plan §5）。今回の改定は UI 層のみで chat 経路のワイヤ
  契約（server test 74 本）は不変＝既存経路の無退行が対象。viewer 行・chat 取得死ゴースト・dead 終端の
  実確認は S7 ゲートで実証済みの経路であり、今回は**任意**（§7 に「実 YouTube を繋ぐ場合」として分離）。
  S7 YouTube 実ゲートの保留も従来どおり別管理。
- 前提の設営は S6 手順書（[../s6/human-gate-procedure.md](../s6/human-gate-procedure.md)）と同じ:
  `npm install` 済み・`/login` サブスク済み・ガード対象環境変数未設定・`vendor/` に whisper 一式 +
  kotoba + silero_vad.onnx・ffmpeg が PATH・AivisSpeech 起動・器（runtime-player）起動 + Channel を開く。
  ※ §1〜§3（起動・見た目・導線）だけなら器・AivisSpeech 無しでも確認できる（Fire 等の結線確認 §4〜§6 で
  全器官が要る）。

## 1. 起動（1 コマンド・ビルド段ゼロ）

1. `npm run cockpit --prefix apps/soul/agent` を実行（**これ 1 発**。ビルド儀式・追加コマンドは無い＝
   制約 (a) 起動信頼性の確認そのもの）。
2. 標準出力の URL（既定 `http://127.0.0.1:8181/`）をブラウザで開く。
3. **画面が立ち上がることを確認**（真っ白のまま止まらない・DevTools コンソールに module 解決エラーが
   無い——vendor/ui/view-logic の静的配信が実ブラウザで解決されている証拠）。

## 2. モック §7 の見た目確認（視覚仕様 = 承認済みモックを正とする）

[../../screens/cockpit-redesign.md](../../screens/cockpit-redesign.md) §7 と §2 の画面図に照らして:

- [ ] **基調**: ダーク。teal（#56d4b0 系）がアイデンティティ色として効いている。
- [ ] **ヘッダ**: 名前「こーでぃー」+ Listening ランプ（発光ドット）+ 一目の健康（whisper/ffmpeg・
      声の出力先）+ 右端に ⚙。
- [ ] **観測フィードが主役**: 画面の縦の大半を占める角丸 14px パネル。上下をヘッダ/運転バーで挟む三層。
- [ ] **運転バー（下端・常駐・細い）**: 左に Fire / Fire+視覚、右に自発トグル（pill）・口数プルダウン
      （控えめ/ふつう/おしゃべり）・KILL（赤枠）。
- [ ] **設定引き出し**: ⚙ で開閉。区画見出し（接続/入出力）・ラベル幅揃え・select は chevron 付き・
      状態は色ドット + 文言。普段は畳まれて見えない。
- [ ] タブの `<title>` は「こーでぃー — Soul Cockpit」。

## 3. 導線（初回自動展開 / 二回目以降は観測直行）

判定式は domain-c.md §5-1（`shouldAutoOpenSettings`）: snapshot の **channel.configured / visionTarget.title /
audioDevice.name / chat.source のどれかが記憶済み、または耳が稼働中（s.device）なら開かない**。全部空の
ときだけ自動展開。これで再現手順が組める:

1. **初回（設定空）の自動展開**: 操縦席プロセスを止め、`apps/soul/agent/cockpit-settings.local.json` を
   退避（例: `cockpit-settings.local.json.bak` へリネーム。消さないこと——後で戻す）→ §1 の起動 →
   ブラウザで開く。
   - [ ] **設定引き出しが開いた状態で立ち上がる**（マイク・器・出力先を埋める導線）。
2. **二回目以降の観測直行**: 設定を 1 つ以上記憶させる（例: §4-1 のマイク Start、または §4-4 の視界
   Set target——判定材料のどれかが snapshot に載ればよい）→ **ブラウザタブを閉じて開き直す**。
   - [ ] **引き出しは閉じたまま観測フィードに直接着地する**（ヘッダに状態・⚙ は閉じたまま）。
   - 確認後、退避した設定ファイルを戻すなら操縦席を止めてからリネームを戻す（実運用の記憶を保つ）。
3. **既知の判定外**（domain-c.md §8-4・受容済み）: **マイクの記憶（lastDevice）だけがあって他が全部空**の
   ケースは snapshot に載らないため自動展開される（マイクだけ設定して耳も起動していない状態は実運用上
   ほぼ無い・気になれば snapshot への lastDevice 追加 = ワイヤ契約変更が要るため本 wave では不可）。
4. 補足: GET /api/state の取得に失敗した場合も開かない（誤展開防止・観測直行が既定）。

## 4. 保存チェックリスト: 設定層（inventory §2-3・⚙ を開いて 1 個ずつ）

全器官（器 + AivisSpeech）を起動してから行う。⚙ で引き出しを開く:

1. **マイク選択 + Start/Stop**:
   - [ ] マイク一覧が並ぶ。**前回使ったマイク（lastDevice）が初期選択されている**（過去に Start した
         ことがある場合）。
   - [ ] Start → ヘッダが `Listening`（発光ドット点灯）・`whisper: up` / `ffmpeg: up`。Start/Stop は
         処理中に両方 disable（busy）→ 復帰。
   - [ ] Stop → `Stopped`（ドット消灯）。
2. **器 Channel（token 秘匿）**:
   - [ ] Channel 欄に器の URL（`ws://127.0.0.1:<port>/channel?token=...`）を入れて Set →
         **入力欄が空になる**（生 URL/token を DOM に残さない・token 秘匿の保存点）。
   - [ ] 状態表示は **redact 済み URL**（token が伏せてある）+ 接続状態。色ドット + 文言
         （connected=緑 / error=赤 / connecting=黄）。接続は初回 Fire 時（§5-1 の後に connected へ）。
3. **声の出力先**:
   - [ ] `Refresh devices` で出力デバイス一覧が更新される。
   - [ ] デバイスを選んで `Set device` → 状態表示が選んだデバイス名になる。次の発話（§5-1 の Fire）が
         **新しいデバイスから鳴る**（適用は常駐プレイヤーのその場再起動 = サーバ側挙動）。
4. **視界（ゲーム窓）**:
   - [ ] `Refresh windows` で起動中ウインドウの一覧が更新される（`タイトル (プロセス名)` 形式）。
   - [ ] 対象を選んで `Set target` → 状態表示が対象タイトルになる。
5. **YouTube chat 欄の非接続時挙動**（実 YouTube を繋がずに確認できる範囲）:
   - [ ] 未接続では状態が `not connected`・**Disconnect ボタンが disabled**（state 駆動の無効化）。
   - [ ] source 欄が空のまま Connect → `enter a stream URL / video ID first` のエラー文言（POST は飛ばない）。
   - [ ] **入力中非復元**: source 欄に適当な文字を打ってから他の設定操作（例: 視界 Set）をする →
         snapshot 再送が起きても**入力途中の文字が上書きされない**（chatSourceEdited の保存点）。
   - [ ] **source 復元**（過去に S7 ゲート等で Connect したことがあり `cockpit-settings.local.json` に
         source が記憶されている場合のみ）: タブを開き直すと source 欄に記憶済みの値が復元されている。
6. **各エラー欄**: 器を止めた状態で Channel Set / 視界 Set 等を押すとそれぞれの行の下に赤いエラー文言が
   出る（欄は行ごとに分離——旧 UI の共用欄で起きた「自発エラーが音声エラーを上書きする」相互汚染は
   構造的に消えている・domain-c.md §8-2）。

## 5. 保存チェックリスト: 運転層（inventory §2-2・下端の運転バー）

1. **Fire**: マイク Start + 何か一言話してから Fire を押す。
   - [ ] 押した瞬間に Fire/Fire+視覚が disable（連打防止）→ soul 表示が `thinking` → `speaking`
         （声が出る）→ `idle` で**ボタンが復帰**する。
   - [ ] 観測フィードに発火マーカー行（`fired (N lines, M chars injected)`）→ soul の返事行（teal）。
2. **503 文言（fire 未結線）**: Channel 未設定の状態（`--channel` なし起動 + Channel 欄未設定・§3-1 の
   設定空状態で確認すると楽）で Fire を押す。
   - [ ] `fire not available (start cockpit with --channel)` が運転バーの note に控えめに出る。
3. **Fire+視覚**: §4-4 で視界を設定した状態で Fire+視覚を押す。
   - [ ] busy→復帰は Fire と同型。観測フィードに**「見た」マーカー行（縮小サムネ付き・
         `saw "タイトル" (WxH, Nms)`）**→ 返事が画面内容に触れる。
   - [ ] 対象窓を閉じて/最小化して押すと `(vision fire: … )` のゴースト行（正直な中止）。
4. **自発トグル ON/OFF**:
   - [ ] 器未結線の起動では pill が disabled + `not available`（null = scheduler 未生成）。
   - [ ] 結線済みで ON → `on`（緑）。しばらく放置すると自発マーカー行（`self-fire (silence)` 等）が刻まれる。
         OFF → 止まる。手動 Fire は自発 OFF でも常に有効。
   - [ ] トグルの checked は **snapshot（サーバ状態）に追従**する。**旧 UI との既知の微差
         （domain-c.md §8-3・改善方向）**: POST 失敗時（例: 器を止めて切り替え）、旧 UI は操作した
         checked が表示に残った（表示とサーバ状態が不整合のまま）が、新 UI は controlled のため
         **checked がサーバ状態へ戻る = 不整合が残らない**。エラー文言は運転バーの control-error に出る。
5. **口数モード（場所のみ・L0 裁定の義務明記）**:
   - [ ] プルダウン（控えめ/ふつう/おしゃべり）は**選択できるが、選択しても挙動は一切変わらない**
         （どこにも送信されない no-op・リロードで「ふつう」に戻る）。**実配線は
         [../s6/s6-followup.md](../s6/s6-followup.md) §12 の将来課題**——「触っても変わらない」は
         仕様であり故障ではない。
6. **KILL（S8 予約）**:
   - [ ] 赤枠 + **disabled（押せない）**。場所だけの予約枠（title に「S8 で実装」）。押せてしまったら FAIL。

## 6. 保存チェックリスト: 観測層（inventory §2-1・行種 9 つ + 計器 + hooks 実挙動）

§4〜§5 の操作で大半の行種が自然に出る。**フィードに出た行を 1 種ずつ照合**する:

- [ ] **行種 1: 転写 you 行**（青）——マイクで話す → 時刻 + `you` + 本文 + **live 行のみ末尾に
      レイテンシ `(N.Ns)`**。
- [ ] **行種 2: speaking 行**——話している最中だけ `······(speaking)`（黄斜体）が出て、転写確定で消える
      （VAD 連動の出現消滅）。
- [ ] **行種 3: ゴースト行**（グレー斜体）——無言に近い発話/雑音で `(discarded)`（破棄の可視化・
      footer 相当の discarded カウンタも増える）。ASR 失敗時は `(asr failed)`。
- [ ] **行種 4: 発火マーカー行**（黄・`fire *`）——§5-1 で確認済み。
- [ ] **行種 5: 演出行**（緑・インデント + ↳ のサブ行）——感情が動く話題を振って Fire → 返事の直後に
      `語 ✓N/✗N`（例 `smile ✓2/✗0`）。
- [ ] **行種 6: 視覚マーカー行**（淡青 + サムネ）——§5-3 で確認済み。
- [ ] **行種 7: barge-in マーカー行**（赤・`barge-in !!`）——こーでぃーが喋っている最中に話しかけて
      声を遮る → `interrupted (X/Y chars spoken, Nms)`（S6 の音響設営が要る）。
- [ ] **行種 8: 自発マーカー行**（淡 teal・`self ~`）——§5-4 で確認済み。fired:false（busy 等で撃てな
      かった要求）は `(self-fire: kind not fired — reason)` のゴースト行。
- [ ] **行種 9: 転写 soul 行**（teal・こーでぃーの返事）——§5-1 で確認済み。
  - ※ **viewer 行（紫）と chat 取得死ゴーストは §7（任意・実 YouTube）**——今回の必須対象外。
- [ ] **計器（フィードパネル下端の .feed-meta）**: usage（Fire 後に `usage: input=N output=M`・
      Fire+視覚後は `usage(vision): …`）・discarded カウンタ・uptime。
- [ ] **uptime 刻み**（hooks 実挙動）: マイク Start 中に **1 秒刻みで進む**・Stop で `00:00:00`。
- [ ] **自動スクロール**（hooks 実挙動・モック §2）: 行が積まれると末尾へ追従する。**上へスクロール
      すると追従が止まり「最新へ ↓」ボタンが出る** → 押すと末尾へ戻って追従再開。
- [ ] **履歴復元**（タブ開き直し）: 転写が数行たまった状態でタブを閉じて開き直す → 過去の転写行が
      復元される（**履歴行にはレイテンシが付かない** = live 行のみの契約）。正本はプロセス側 =
      タブを閉じても魂は死なない。
- [ ] **EventSource 実配線**（hooks 実挙動）: 開き直したタブでもマイクの新しい発話がリアルタイムに
      流れてくる（SSE 再購読が効いている）。

## 7. 任意: 実 YouTube を繋ぐ場合（今回の必須対象外・S7 経路の無退行を体で見たいときだけ）

S7 手順書（[../s7/human-gate-procedure.md](../s7/human-gate-procedure.md)）の設営（テスト配信 +
**マイク Start してから Connect** の鉄則 + ToS グレー開示の了解）をそのまま使う。確認点は S7 と同一:
viewer 行（紫・`viewer(名前)`）・chat 状態の色遷移（connecting/live）・コメント発火（`self-fire (comment)`）・
配信終了後の **dead で Disconnect が無効化**される（snapshot 再送でも誤再有効化しない）・取得死分類の
ゴースト行。chat 経路のワイヤ契約・器官は本 wave で不変（UI 層の結線のみ移植）。

## 8. モックとの既知差分（FAIL ではない・裁定済み）

1. **thinking 表示はフィード行に出ない**: モック §2 には `○ こーでぃー thinking…` 風の行が描かれて
   いるが、保存オラクルの行種 9 つに thinking 行は無く旧実装にも存在しない（新規行種の発明は振る舞い
   保存 wave の職域外・L0 裁定 = domain-b.md §8-5）。**soul の thinking/speaking は運転バー側の
   soul 表示に出る**（旧 UI の fire セクション表示と同位置の意味論）。フィード行化したくなったら
   followup（soul SSE から行を足す追撃・[followup.md](followup.md) §7）。
2. **口数モードは効かない**（§5-5 のとおり仕様・実配線は s6-followup §12）。
3. **KILL は押せない**（§5-6 のとおり S8 予約）。
4. usage/discarded/uptime の計器は旧 UI の fire セクション/footer からフィードパネル内下端
   （.feed-meta）へ集約（三層 IA の裁定・domain-b.md §8-3。違和感があれば CSS のみで移設可能）。

## 9. 完了条件

§2（見た目）・§3（導線）・§4〜§6（保存チェックリスト全項目）が PASS なら人間ゲート合格
（§7 は任意・§8 は差分の了解のみ）。不合格項目が出たら、その項目と再現手順を添えて差し戻すこと
（機械側の固定点: server test 74 本・view-logic fixture・ui 30 本・page 4 本・static-assets 10 本は
全緑済み——このゲートで落ちるものは hooks 実挙動か視覚意匠のどちらか）。
