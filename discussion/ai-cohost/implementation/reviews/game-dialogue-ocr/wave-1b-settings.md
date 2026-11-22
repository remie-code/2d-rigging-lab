# Wave 1B 配信設定の独立レビュー

## 修正後の判定

合格。保存応答と SSE の逆順、設定画面を閉じた後の配信開始という初回指摘二件を再レビューした。

- 成功応答の完全な snapshot は API に残る。画面では新規の設定 POST 応答から配信設定とその版だけを取得し、SSE などですでに適用した版より古ければ無視する。遅れた STT 応答で後から受けた OCR の値や場の表示が戻らないことは、応答を遅らせた回帰テストで確認した。[マージと保存処理](../../../../../apps/soul/agent/src/cockpit/ui/app.mjs#L149)・[逆順のテスト](../../../../../apps/soul/agent/src/cockpit/cockpit-ui.test.mjs#L409)
- 保存中フラグを App が持つため、設定画面を閉じてもメインと設定画面の開始を抑止する。メインのハンドラーも ref で即時にガードし、保存の成功・失敗とも `finally` で解除する。Discord の開始にも適用される。Discord への参加が先に場を開くと、閉場中に限る STT 保存の遅着要求が 409 になるため、STT 保存中の抑止には理由がある。OCR 保存中にも Discord の開始を待たせるのは両設定で開始制御を共通化した裁量で、OCR の保存経路自体は Discord の開始と競合しない。Discord の個別設定や既存の場への操作は同フラグで制限されない。[共有する保存状態](../../../../../apps/soul/agent/src/cockpit/ui/app.mjs#L368)・[開始ガード](../../../../../apps/soul/agent/src/cockpit/ui/app.mjs#L423)・[ゲートの回帰テスト](../../../../../apps/soul/agent/src/cockpit/cockpit-ui-settings.test.mjs#L358)
- 後述のコマンドに `--test-reporter=tap` を加えて再実行し、10ファイル587件が成功した。対象の `git diff --check -- apps/soul/agent/src/cockpit apps/soul/agent/scripts/cockpit-stream.test.mjs` も成功した。さらに一時フォルダー内で、設定ファイルの親に当たる場所を通常ファイルにして二つの設定 POST を実行した。どちらも 500 を返し、次の `GET /api/state` で設定値と版の維持を確認した。実ブラウザー操作は未実施。
- 版番号の初期値はサーバーの起動時刻。ページを開いたまま時刻が巻き戻ってサーバーを再起動すると、新しい起動の版を古いものとして扱う余地がある。通常の起動・再表示は確認済みで、この条件は残課題とする。[版の初期化](../../../../../apps/soul/agent/src/cockpit/cockpit-server.mjs#L1047)

## 初回判定

修正要。隔離した設定ファイルで Haas-ja の復元と OCR オフの保存を確認した。設定の成功応答と SSE が前後する場合に表示が巻き戻る。また、設定保存中でも設定画面を閉じると、メイン画面から配信を開始できる。

## 指摘

1. **設定の成功応答が新しい表示を上書きする。** 二つの設定操作は並行して送信でき、それぞれの成功応答が取得時点の完全な snapshot を返す。SSE と POST 応答を受信順に同じ表示へ適用するため、後から届いた古い応答でも全設定が更新される。再現には設定画面を開き、Haas-ja 保存の HTTP 応答だけをブラウザー側のネットワーク制御で保留する。続いて OCR をオフにし、オフの成功応答と SSE を受け取ってから保留中の STT 応答を返す。OCR の保存値はオフだが、後続の状態通知まで表示はオンに戻る。コードから確認した順序で、既存 UI テストはソースの形を確認するためこの順序を試さない。[サーバー](../../../../../apps/soul/agent/src/cockpit/cockpit-server.mjs#L3095)・[保存ハンドラー](../../../../../apps/soul/agent/src/cockpit/ui/settings-drawer.mjs#L661)・[状態の適用](../../../../../apps/soul/agent/src/cockpit/ui/app.mjs#L236)
2. **設定画面を閉じると、保存完了前に別経路で配信を開始できる。** 保存中に無効になるのは設定画面の開始ボタン。閉じる操作を経由したメイン画面の開始には同じ条件がない。STT のサーバー側待機は先に到着して受理された設定要求を対象にする。再現には、Haas-ja を選んで設定 POST の送信を保留し、設定画面を閉じてメイン画面で配信を開始してから保留を解除する。旧方式で開始し、遅着した設定要求は 409 で断られる。OCR も遅着した要求を待たずに開始する。実際の OCR 開始時の扱いは Wave 2 で確認する。保存失敗後に従来の値で開始できるという判断と、保存が保留中の開始制御は分けて扱える。[モーダルの開始ボタン](../../../../../apps/soul/agent/src/cockpit/ui/settings-drawer.mjs#L1248)・[メイン画面の開始](../../../../../apps/soul/agent/src/cockpit/ui/app.mjs#L389)・[サーバー側の待機と制限](../../../../../apps/soul/agent/src/cockpit/cockpit-server.mjs#L2132)

## 確認結果

- **Haas-ja の保存と起動方式。** 一時 JSON に選択を保存して開始せずにサーバーを閉じ、次の生成で選択を再取得する。起動時に方式を省略してもパイプラインの引数が `haas` となり、閉場して再生成した三回目も同じ引数になる。通常 CLI の起動コードが同じストアとフックを使い、実パイプラインが Haas 用クライアントを選ぶことを静的に照合した。実マイクと Haas モデルによる認識実行は未確認。[再起動テスト](../../../../../apps/soul/agent/src/cockpit/cockpit-server.test.mjs#L3732)・[本番起動の結線](../../../../../apps/soul/agent/src/cockpit/startup/run-cockpit.mjs#L1082)・[Haas の選択](../../../../../apps/soul/agent/src/ears/ear-pipeline.mjs#L231)
- **Discord と配信の区別。** Discord の場で配信設定は `haas`、現在の方式と耳に渡す方式は `elevenlabs` になる。配信設定の保存が Discord の方式を変えないこともテストで確認した。方式省略の開始に加え、従来の開始 API 二つと body の方式指定も残る。[Discord テスト](../../../../../apps/soul/agent/src/cockpit/cockpit-server-discord-d.test.mjs#L376)・[設定と現在方式の状態](../../../../../apps/soul/agent/src/cockpit/cockpit-server.mjs#L1599)・[HTTP ルーティング](../../../../../apps/soul/agent/src/cockpit/http/cockpit-http-server.mjs#L9)
- **OCR の既定と窓の独立。** 一時 JSON で初回オン、オフの保存と次回復元、窓の選択・変更・解除、再オンを確認した。保存経路は窓の設定や既存の一枚撮影経路を呼び出さない。実ウィンドウで OCR オフのまま一枚撮影する確認は Wave 2 に残る。[OCR テスト](../../../../../apps/soul/agent/src/cockpit/cockpit-server.test.mjs#L3781)・[保存キー](../../../../../apps/soul/agent/src/cockpit/cockpit-settings-store.mjs#L341)・[既存の撮影結線](../../../../../apps/soul/agent/src/cockpit/startup/run-cockpit.mjs#L932)
- **保存失敗。** ファイルの書き込み例外を HTTP 500 にしてサーバー内の設定値を維持する。UI は保留値を外してサーバーの表示値へ戻す分岐を持つ。HTTP 500 と実ブラウザー上の復帰を一続きに試した証拠は今回の差分にない。先行する二件の修正後に、成功・失敗・逆順の表示をまとめて再確認する。[サーバー](../../../../../apps/soul/agent/src/cockpit/cockpit-server.mjs#L3095)・[画面](../../../../../apps/soul/agent/src/cockpit/ui/settings-drawer.mjs#L661)

## 再検証コマンド

`apps/soul/agent` で実行。Node v24.19.0 で10ファイル585件が成功した。テストの HTTP はローカルのループバック、追加の永続化テストは一時ディレクトリを使用する。初回の制限付き実行ではループバックへの接続が `EACCES` となったため、ループバックの許可を得て再実行した。普段の設定ファイルは操作していない。

```powershell
node --test scripts/cockpit-stream.test.mjs scripts/cockpit.test.mjs src/cockpit/cockpit-server.test.mjs src/cockpit/cockpit-server-discord-d.test.mjs src/cockpit/cockpit-ui.test.mjs src/cockpit/cockpit-ui-settings.test.mjs src/cockpit/cockpit-ui-discord-g.test.mjs src/cockpit/cockpit-settings-store.test.mjs src/cockpit/view-logic/settings.test.mjs src/cockpit/cockpit-settings-store-discord-d.test.mjs
```
