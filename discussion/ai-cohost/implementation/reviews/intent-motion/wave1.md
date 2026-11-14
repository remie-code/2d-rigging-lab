# 発話意図モーション Wave 1 独立レビュー

- **第2巡で独立レビュー合格**。初回の二点を修正し、限定再確認を完了した。
- 根拠：[Wave 計画と User Gate](../../orchestration/intent-motion-wave-plan.md)、[Wave 1 契約](../../waves/intent-motion/wave1-contract.md)、Control Channel と Soul の対象差分・新規ファイル。

## 初回指摘と再確認

1. `prepare/start` が区間の識別情報と意図を受け取り、`finalize` が本文と文脈を後から受け取る。判定と本文確定がどちらの順でも、両方が揃った none を一度だけ保存する。次の区間開始後に前区間の二文目を含む本文を確定できることを Soul 試験で、本文確定前にライブ口形が進むことと保存 JSON を WebSocket 統合試験で確認した。
2. 初回は Windows の同一キー並行保存で `rename` が断続的に `EPERM`。修正後は同一プロセス内の同一宛先が一つの書き込みを共有し、以降は完成済み JSON を再利用する。Windows で Soul 対象 4 件を 12 回実行し、48/48 件合格。複数プロセスからの同一宛先への並行書き込みは試験範囲外。

## 適合と試験

- 判定は登録済み三候補と明示的な none から選び、入力は話し手の意図だけ。拒否・不正応答・通信失敗は failure として区別し、none を保存しない。
- Soul 子プロセスから実 WebSocket、Runtime サーバー、オーバーレイ、フレーム合成までを通す統合試験で、遅い判定中にも口形が動き、次区間・割り込み・世代変更後の旧結果を無視することを確認。重複 play は姿勢を変えず、切断後は元の姿勢に戻り、新接続は世代 0 から動く。none の単発記録は意図、本文、場・発話・世代・区間 ID、文脈まで JSON の再読で一致。
- 承認済み yaw80 の Face X −24/30 を ask の −0.8 に移植。統合試験では開始時に従前の姿勢（+3）を維持し、問いかけで −24、視線 −0.52。同時に実 Soul の smile テーブル（口角 0.8、首傾げ 3.6）と口開き・母音 A が有効。自然終了後の待機と次区間での連続リリースを確認。r804 実モデルの表示とユーザー実会話は未検証。
- 独立実行では Runtime 型検査に合格。第2巡は Runtime 関連 3 ファイル 32/32 件に合格し、統合では口形も `openSpeech → appendSpeech → endSpeech` を通過した。Soul-zone（1661 source）と `git diff --check` は合格。source guard は今回無変更の `apps/runtime-player/src/main/physiology/index.ts` の barrel-only 違反で失敗。
- Gnome の報告：Runtime 全 153 ファイル・1026 件、Soul 関連 36 件が一度合格。実 DecisionAPI への制御入力で異なる二表現から receive、自然なためらいを含む二入力から none。独立レビューでは実 API を再実行していない。

## 裁量と残課題

- 180ms の入り、400ms の解放、自然終了後 1500ms の問い待ち、終了が来ない場合の待ち上限は妥当。口とまばたきは既存経路が扱い、重なる首・視線スロットは既存表情が優先される。
- 接続中は世代／区間番号が単調増加する前提。再接続でサービスを作り直す。reset は保留の再生を失効させ、確定待ちの区間は後から記録できるよう保持する。Wave 2 は区間を中断した場合も、得られた本文を渡して finalize する。確定しない区間を放置すると同じ接続の間はメモリに残る。既存キーは再利用できない。古い有効形式の play は wire 上で accepted でも表示されないため、計測では reply と実際の姿勢を区別する。
- 既定の none は Git 対象外の `apps/soul/agent/tmp/speech-intent-none/`。ファイル名は区間キーのハッシュなので、後日読み返す手順では更新日時順に並べ、JSON の `text`、`intent`、`context`、`playbackState` を確認する。現実装の `playbackState` は判定時点の状態であり、音声が聞こえた範囲を表さない。
