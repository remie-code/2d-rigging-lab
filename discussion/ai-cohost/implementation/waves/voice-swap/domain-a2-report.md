# 声の差し替え Wave 2 / Domain A2 — 器の流し込みの安全網 完了報告

> Gnome → Undine(2026-10-18)。計画: [../../orchestration/voice-swap-wave-plan.md](../../orchestration/voice-swap-wave-plan.md) の「Wave 1 からの申し送り」5。前提: [domain-a-report.md](domain-a-report.md) の質問 1 への裁定。コミットはしていない。

## 1. 変更ファイル

すべて `apps/runtime-player/src/main/control-channel/` の中。apps/soul には触れていない。

- `speech-timeline-state.ts`
  - 定数 `RUNTIME_PLAYER_SPEECH_STREAM_STALL_END_MS = 2000` を足した。
  - `SpeechTimelineState` に `stallEndAtMs?`(安全網が効く時刻。絶対時刻)を足した。
  - 評価の終端に 1 分岐を足した。
- `control-channel-overlay-store.ts`
  - append を受理するたびに `stallEndAtMs` を置き直す。
  - 安全網が効いたら、それを状態に書き戻す(`#expireStalledStream`)。
- テスト: `speech-timeline-state.test.ts`(+5)、`control-channel-overlay-store.test.ts`(+7)
- 既存テスト 2 件の時刻だけを動かした: `control-channel-overlay-store.test.ts`、`channel-server.test.ts`(§4 の 1)

## 2. 振る舞い

- **データが尽きた時刻**: 最後のモーラの絶対時刻と、その slice を受理した時刻の、遅いほう。
  - 安全網が効く時刻はこの 2000ms 後。append を受理するたびに置き直す。
  - 続きは先頭が前回の最後より後でなければ受理しないので、この時刻は append のたびに必ず後ろへ動く。安全網より前に届いた append は、必ず発話を続けさせる。
  - 届いた時点ですでに再生位置より過去のモーラしか持たない slice でも、受理した時刻から 2000ms 待つ。
- **評価**: end を待っている間に `nowMs` が `stallEndAtMs` に達したら、その時刻に end を受けたのと同じに扱う。
  - 閉じ始めは、報告の既存規則どおり `max(最後のモーラ + 最後の間隔, end 時刻)` から。そこから 400ms で閉じ、done になる。
  - end と同じく、保持している母音から連続して閉じる。
  - 時刻はこれまでと同じ `nowMs` の時計で扱う。状態と `nowMs` だけで決まる純関数のまま。
- **store**: snapshot / open / append / end の入口で、安全網を状態に書き戻す。
  - 書き戻す中身は `awaitingEnd:false`、`endAtMs = stallEndAtMs`、開いている発話の停止。
  - 評価の側がすでに同じ値を出しているので、書き戻しても出力は変わらない。tick の粒度にも左右されない。
  - 安全網が効いたあとに届いた append / end は無視する(false。server は accepted を返し、出来事は出さない)。
  - 次の open が遅れて届いても、前の発話の end 時刻を後ろへずらさない(閉じかけの口が開き直らない)。
- **intent.speech(糖衣)**: すぐ end するので、安全網は表に出ない。golden は不変。

## 3. テスト結果

- runtime-player の vitest: 142 ファイル、981 件すべて成功(969 → +12)。
- typecheck(`tsc --noEmit`)も成功。
- 新しいテストで固定したこと:
  - 時限で閉じる。end を時限の時刻に送った場合と、すべての tick で `toStrictEqual` が一致する。
  - 時限を過ぎると cursor が消え、遅れた append / end を無視する。
  - 時限前の append で続く。時限は新しいデータから数え直す(過去のモーラだけの slice も含む)。
  - end ありなら従来どおり(Wave 1 の状態の評価と一致)。
  - 決定論。疎な tick、遅れた end、遅れた open でも同じ値になる。
  - 凸恒等式。
  - 糖衣は不変。

## 4. 裁量判断

1. **既存テスト 2 件の時刻を、安全網の窓の中へ動かした。**
   - 該当: store の「holds the last vowel until end arrives」で 5000ms → 1500ms。channel-server の speechStream テストの保持確認で +5000ms → +1500ms。
   - 2 件とも「end が無ければ 5 秒後も開いたまま」を確かめていた。これは今回の裁定で変わる振る舞いそのものなので、時刻を動かすほかなかった。
   - 1500ms は、end を受けた発話ならすでに閉じている時刻(約 680ms 以降)より後で、安全網より前。テストの意図はそのまま残る。
   - golden・凸恒等式・onset の期待値には触れていない。
2. **データが尽きた時刻に「受理時刻」も含めた。**
   - 最後のモーラの時刻だけで数えると、再生に追いつかれたあとで届いた slice は、時限までの残りがほとんどない。
   - それでは「続きが来たら今までどおり続ける」が弱まるので、受理時刻との遅いほうから数えることにした。
3. **`stallEndAtMs` が無い状態では安全網は効かない(評価関数の側)。**
   - store は必ず置くので、実際の器では常に効く。純関数の既存テスト(end を待つ間はずっと保持)もそのまま成り立つ。
4. **安全網が効いた瞬間と同じ時刻に届いた append は、遅れた扱い(`>=`)にした。** 閉じ始めの判定 `e >= releaseStart` と向きを揃えた。

## 5. 残リスク

- 安全網が効いてから次の tick までの間(最大で約 1 フレーム)は、cursor に開いている発話が残る。
  - その間に続きになっていない append が来ると invalidPayload になりうる(続きになっていれば accepted で無視)。実害はない想定。

## 6. 質問

1. 既存テスト 2 件の時刻の変更(§4 の 1)は、「既存テストは変えない」の例外として認めてよいか。
