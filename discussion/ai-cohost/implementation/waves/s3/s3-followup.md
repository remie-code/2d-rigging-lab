# S3 follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録開始（2026-07-12, Gnome / S3 Domain B）。台帳の流儀は
> [../s2.5/s2-5-followup.md](../s2.5/s2-5-followup.md) を踏襲。
> 出典: [../../reviews/s3/domain-a-review.md](../../reviews/s3/domain-a-review.md) §3（Domain B への
> 引き継ぎ 4 件）+ [domain-a.md](domain-a.md) §4 質問 + Domain B（[domain-b.md](domain-b.md)）の持ち越し。

## 1. Domain A 引き継ぎのうち S3 内で回収しなかったもの

1. **preflight-fire の npm script 未登録（Q1・裁量: 見送り）**。`preflight-cockpit.mjs` 等の既存
   preflight がすべて未登録（直接 `node scripts/...` 実行）である型を踏襲し、S3 でも登録しない。
   preflight 群をまとめて scripts に載せたくなったら一括で（dependencies 不変・scripts 行追加のみ）。

2. **GET /api/fire の 405 明示化（Q2・裁量: 見送り）**。現状 GET /api/fire は 404（未知ルート扱い）。
   busy 保護は orchestrator の状態機械が担っており機能欠陥ではない。405 にするなら Domain A の
   `cockpit-server.mjs`（S3 Domain B では変更禁止）へのルーティング追加 + テスト 1 ケースが素直。
   S2.5 followup §1-1（409 経路のテスト固定）と同時に Domain A テストを触る wave で回収するのが効率的。

3. **SSE `fire` イベントの accepted:false 集合は busy/ears-not-running/empty-window のまま（Q3・
   裁量: 現状のまま消費）**。empty-reply/error は `diagnostic` イベント（fireEmptyReply/fireError）で
   観測可能で、S3 の操縦席はこれをゴースト行の型で表示した（無言の消失にしない・表示の一貫性も
   ゴースト行に揃う）。発火系イベントを `fire` 一本に集約したくなったら orchestrator の onFire に
   失敗系を足す拡張余地がある（Domain A コード変更を伴うため S3 では見送り）。

4. **遅延 append の観測（Undine 裁定・継続観測中）**。観測項目と記入欄は
   [../../../experiments/s3-summon.md](../../../experiments/s3-summon.md) §3 に設けた（注入順の捻れ・
   窓の遅延感度）。実マイク運転で事象が観測されたら本台帳へ頻度と状況を追記する。恒久回収は
   whisper-inference/client 統合時（S3 スコープ外・s2-followup §4-1 から継承）。

## 2. Domain B の設計判断で S4 以降に効く持ち越し

1. **lazy channel は「接続成功後の切断」を自動回復しない**（`scripts/cockpit.mjs` の
   `createLazyChannel`）。接続失敗（初回 connect の throw）は非キャッシュで次の Fire に再試行するが、
   **一度成功した接続がその後切れた場合**（器の再起動・Channel の Close）はキャッシュが残るため、
   以後の Fire は `(fire error: …)`（sendSpeech の reply timeout 等）に落ち続ける。運用回避は操縦席の
   再起動（Ctrl+C → 再起動）。回収案: sendSpeech 失敗時にキャッシュを破棄して次回 Fire で再接続する
   （数行）——ただし「切断の種類（一時 or 器の意図的 Close）」と S6 barge-in の接続設計に絡むため、
   器との長時間並走の実運用で不便が確認されてからで良い。

2. **`scripts/cockpit.mjs` の main 結線（--channel 時の実配線）に直接の機械テストが無い**。
   注入可能な純関数部分（`parseCockpitArgs` / `createLazyChannel`）は `scripts/cockpit.test.mjs` で
   固定したが、main の実配線（createLlmSession + createFireOrchestrator + server の組み立て）は
   実 SDK spawn を伴うためテストしない（S2.5 followup §1-5 の起動スクリプト系と同種）。担保は
   `--channel` 未指定経路の実起動確認（EOF clean exit・domain-b.md 機械ゲート）+ 人間ゲート。

3. **発火 reason 表示（fire-note）は次のイベントまで残る**。非受理 reason（busy 等）の控えめ表示は
   自動では消えず、次の Fire 成功（またはページ再読込）でクリアされる。診断面としては「最後に
   起きたこと」が残る方が有用と判断（消したくなったら数秒フェードを足す・数行）。

4. **soul 行はタブ開き直しの履歴復元でも描ける**（`GET /api/state` の transcripts[] に speaker が
   載る・Domain A の toWireEntry 修正済み）が、**発火マーカー行は復元されない**（fire イベントは
   SSE の transient であり正本に無い）。マーカーの永続化が要るなら「発火履歴」をサーバ状態に足す
   設計討議から（S3 では YAGNI・soul 行自体が発火の痕跡として残る）。

5. **既存テスト名の含意ズレ（cockpit-page.test.mjs）**。`apps/soul/agent/src/cockpit/cockpit-page.test.mjs`
   の既存ケース名「diagnostic asrFailure adds a ghost row; other diagnostic types do not」は、S3 で
   fireEmptyReply/fireError もゴースト行を出すようになり名前の含意と実装がズレた。assert は
   asrFailure 分岐の存在確認のみでテストは正当に通過しており（既存テスト変更禁止の規律により
   S3 では名前も触らない）、次に cockpit-page.test.mjs を触る wave でテスト名の更新を推奨。
   出典: [domain-b.md](domain-b.md) §4-1・[../../reviews/s3/domain-b-review-spec.md](../../reviews/s3/domain-b-review-spec.md) §8-2・
   [../../reviews/s3/domain-b-review-test.md](../../reviews/s3/domain-b-review-test.md) §5-2。

## 3. S3 追撃 wave（domain-c・2026-07-12, Gnome）の持ち越し

出典: [domain-c.md](domain-c.md)（soul 行二重表示の修正 + Channel URL の操縦席入力）。

1. **音声出力デバイスのノブ（どのスピーカーに出すか）は S8 の音声ルーティング設計時に正式対応**。
   現状、魂の声の再生先スピーカーは OS 既定デバイス固定（`src/voice/audio-player.mjs` の
   PowerShell `SoundPlayer`）で、操縦席から出力先を選べない。配信では「AI の声を仮想オーディオ
   ケーブル / 特定の出力に回す」要求が出るが、これは入力（マイク選択）と対の**出力ルーティング**
   であり、S8（音声ルーティング / キルスイッチ等の運用面設計）でマイク選択と同格のノブとして
   まとめて設計する。domain-c では入力側（マイク・Channel URL）の運用面 UI に留め、出力ノブは
   足さない（YAGNI・器の口の同期と実スピーカー出力は別軸で、S8 の設計討議が要る）。

2. **soul 転写の二重放送バグは fake pipeline では再現しなかった**（`makeFakePipeline` が
   `buffer.onAppend` を購読しない設計のため）。domain-c で実 ear-pipeline の onAppend→onTranscript
   契約を再現する専用 pipeline double を新規テストに用意し、回数を固定した（修正前 2・修正後 1）。
   既存 `makeFakePipeline` は多数の既存テストが共有するため変更しなかった。将来 fake の onAppend
   購読が要る別テストが増えたら、共有 double 化を検討（今は専用 double を局所に置くのが安全）。

3. **Channel URL 入力時の Fire ボタン gating は UI に足さなかった**（既存 cockpit-page.test の
   `applySoulState` の `btn-fire.disabled = st !== "idle"` がピン留めされており、既存テスト変更禁止の
   規律に抵触するため）。URL 未設定で Fire しても sendSpeech 前に session.ask で弾き（spawn せず）
   `(fire error: Channel URL is not set …)` のゴースト行で明示する（無言の失敗にしない）。UI で
   ボタン自体を disable したくなったら、`applySoulState` の当該行を触る wave でテスト名/内容も
   合わせて更新するのが素直。
