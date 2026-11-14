# Wave 1 の契約と根拠

判断の出典は [ユーザー合意を含む Wave 計画](../../orchestration/intent-motion-wave-plan.md)。

## 区間と判定

一つの入力は、本人が付けた自由記述の意図、その意図が対応する本文、区間を識別する情報、発話・世代・場を識別する情報、および会話文脈を結びつける。Wave 2 の逐次発話側で音声 job と対応を取れるよう、意図と本文は区間単位で保持する。

DecisionAPI は自由記述の意図を登録済み候補または明示的な `none` に対応づける。選択時は意図と本文の一致を評価しない。拒否、失敗、中断を `none` と区別する。初期の三候補は自由記述の意図だけを入力にする。分類に必要な情報を候補の説明と意図に絞り、本文と会話文脈は読み返し用に保持する実装判断である。

Soul の接続点は `apps/soul/agent/src/mind/speech-intent-motion.mjs` の `createSpeechIntentMotion({ channel, judge?, recordNone? })`。区間の識別情報は `{sceneId, utteranceId, generation, sectionId, sectionIndex, intent}`。発話側はタグから識別情報を組み立てて `prepare(section)` で判定を先行させ、最初の音声開始通知で `start(section)`、区間最後の音声の自然終了または割り込みで `finish(section, { interrupted })` を呼ぶ。`start` は `{ begin, playback }` を同期で返し、音声は二つの Promise の確定を待たず進める。古い区間への開始は `null` になる。

本文が逐次生成されるときは、最初の音声を先に進め、意図区間が閉じた時点で `finalize(section, { text, context })` に区間全体を渡す。意図区間に複数文がある場合も同じ識別情報を使う。判定と本文のどちらが先に確定しても、両方が揃った `none` のみ記録する。保存結果は `{kind: "saved", path}`、保存失敗は `{kind: "failure", reason}`、保存対象外は `null`。

Control Channel の接続に一つの controller を対応させ、同一接続上で `(generation, sectionIndex)` を単調に進める。場や再生経路の破棄には `reset()` を使う。同一接続を利用する次の場でもキーを進める。リセットは登録済み区間を停止する。発話側は終了した世代から届いた未登録の区間を `prepare` や `start` へ渡す前に除く。再接続時は controller を作り直す。中断・未再生の区間も、実際に取得できた本文と文脈を `finalize` へ渡す。

## 姿勢の根拠

承認済みの r804 向け yaw80 試作の `definition.json` を初期数値の根拠とする。リポジトリ内の作業コピーは `tmp/speech-motion/sequence-yaw80/`。試作では、軽い頷き、画面左にいる相方へ注意を向ける転向、相方へ向けた問いと待ち姿勢の順に動く。Face X の最大偏位は −24（可動域 30 の 80%）。初期候補と動作定義は登録側で対応させ、発話を生成する側の意図語彙を制限しない。

## ライブ制御と記録

ライブ側で開始姿勢を引き継ぎ、次の姿勢に連続してつなぐ。発話モーションの軸と既存口形・表情の軸を分ける。古い世代や区間の結果、重複、切断後の要求によって現在の区間が上書きされないようにする。

Control Channel の `intent.motion` は `begin`、`play`、`end`、`cancel` で構成する。接続内で `generation` と `sectionIndex` によって区間を順序づけ、`play` は現在区間で一度だけ受理し、`presetId` を適用する。次の `begin` で以前の動きを解放する。問いかけの自然終了は有限の待ち姿勢を許容する。中断・破棄・切断は待ち姿勢を解除する。競合する軸は既存表情を優先し、口とまばたきは既存の経路が扱う。

`none` では当該意図のモーションを再生せず、意図の原文と対応本文、会話文脈および識別子を永続化する。実際の区間を復元して後日の共同制作に使えることを検証する。

## 検証範囲

制御した区間入力から送信、受信、ライブ合成と、`none` の永続化・再読を確認する。既存の代表的な笑顔と口形が再生されている間にも、意図による頭・視線の変化が現れることを確認する。リポジトリ内の機械試験と、r804 を使う目視確認は分けて扱う。実会話ゲートは Wave 2 結線後にユーザーが実施する。

## 未対応の一件を読み返す

既定保存先は `apps/soul/agent/tmp/speech-intent-none/`。会話が終わった後、リポジトリ直下の PowerShell から、最新の一件を開く。

```powershell
$entry = Get-ChildItem apps/soul/agent/tmp/speech-intent-none -Filter *.json |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($entry) { Get-Content -LiteralPath $entry.FullName -Raw -Encoding utf8 }
```

`intent` で本人が添えた意図、`text` で対応する発話区間、`context` で会話の流れを一緒に読む。`playbackState` で記録時点の再生状態を確認する。実際の会話と区間を結ぶには `sceneId`、`utteranceId`、`sectionId` を使う。読み返した一件から「その言い方でどんな動きがあると伝わるか」を話し合い、必要なら同じ動きを使える他の意図も探す。Wave 1 の統合試験は一時ディレクトリを使うため、通常の保存先に実会話の記録が現れるのは Wave 2 結線後。
