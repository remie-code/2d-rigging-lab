# 外部演技資産 Wave 1 の契約

[受け入れ基準](wave1-basis.md) · [2 Wave計画](../../orchestration/external-motion-assets-wave-plan.md)

## 読み込みと接続

Playerはアプリ起動時に有効なElectron `userData` の `speech-motions` を走査する。スロット指定時はリダイレクト後のuserDataを使う。通常版とportableも同じ解決規則を使う。診断に実際の絶対パスを出し、Wave 2は通常の起動手順と隔離起動からそれぞれ解決先を確認する。初期資産は配布作業で配置する。ランタイムが初回起動や再起動で作成・補充する処理は設けない。

現用自律ホストの配置先は `C:/Users/remie/AppData/Roaming/@private-2d-rigging-lab/runtime-player/slots/autonomous-default/speech-motions`。プロファイルを指定した起動では `autonomous-default` の部分が指定スロット名になる。

起動時の絶対パスと検査結果は、同じスロットの `ai-cohost-fire-diagnostics/runtime-player/control-channel.jsonl` に `speech_motion.assets` として記録される。

フォルダ直下のJSONを読み、演技単位で検証する。無効なファイルはファイルと理由が分かる診断に残し、当該演技を候補と再生解決の両方から外す。ID重複は曖昧なため重複した演技をすべて除外する。フォルダがない場合や有効資産がない場合は空のsnapshotを使用する。候補・意味選択の経路には旧静的登録へのフォールバックを設けない。

Playerの起動snapshotが権威になる。同じデータから `server.hello` の演技説明・対象・ペアとPlayerの再生解決を作る。接続先変更・切断・再接続時には現在の接続世代を使う。旧世代の候補と判定結果を新接続に転用しない。helloの候補が未入手、空または不正の場合、該当発話は演技を見送り、音声の開始や進行は独立に処理する。Playerの能力に依存する判定は再生要求時に行う。

## 演技とクリップ

ルートは `version: 1`、`id`、`description`、`targets`、`clips`。対象語彙は既存の `partner`、`game`、`viewers`。`targets` の値は同じファイル内のclip ID。未制作対象は参照を置かない。同じclipを複数対象に使える。演技IDは `none` を予約する。ファイル名からIDは決まらない。ソースツリーの配布元は `apps/runtime-player/assets/speech-motions`。実際にロードするフォルダは前節の場所。

`server.hello.payload.speechMotions` は `performances`（ID→説明）、`attentionTargets`（ID→説明）、`pairs`（`performanceId` と `attentionTargetId`）を持つ。Soulは選んだ2つのIDを送信し、Playerは自身のsnapshotでローカルclipを解決する。

パラメータの操作はモデル実値の時間曲線か固定値。指定のないパラメータは通常制御に任せる。視線、まぶた、表情の競合抑制も同じ直接指定で表す。曲線や固定に使用するIDと値から能力を検査し、欠落・値域不足・宣言された既定値不一致のいずれでも部分再生をしない。標準の姿勢値は符号を含む実値、表情用weightは通常0・最大1。モデルの造形と値の意味はモデル側で維持する。音声口パク用パラメータを演技で上書きしない。

クリップの `tracks` はモデルパラメータIDから `[時刻ms, 値]` の列への辞書。`fixed` はモデルパラメータIDから固定値への辞書。`defaults` を置くと、指定したパラメータのモデル既定値を照合する。同じIDに曲線と固定値を併記できない。各曲線は0msから始め、時刻は厳密に昇順で `durationMs` の範囲内。値は有限とし、実行時にモデルの値域を確認する。曲線補正後の出力もモデル値域内に収める。モデルで書き込み可能な外部入力に限り、既存mouth groupの割り当て先は再生要求時に拒否する。独立の口形状を演技で使う場合は、音声口パクとの見え方をモデル側で確認する。

Stageは明示Y（viewport px）と明示拡縮（倍率）を曲線で記述でき、Presence Offでも適用する。初期演技に必要な横・奥行きのPresence入力は別の任意のトラックとして供給し、通常のPresence On/Offと強さのもとで合成する。これは旧body slotのカメラ入力を移すための操作値で、モデルパラメータ解決には使わない。

`stage.y` は−200〜200px、`stage.scale` は0.1〜10倍、`stage.horizontal` と `stage.depth` は−1〜1のPresence入力。各軸は接続補正後もこの範囲に収める。`stageYLeadIn` はYを先行接続にし、`stageScaleLinear` は拡縮曲線の線形補間、`stageScaleEntryMs` は拡縮の原時計接続時間を1〜400msで指定する。明示Yと拡縮の複数点曲線は最後のキーが終端で、1点のみならクリップの曲線時計で `durationMs` まで保持する。原時計の開始補正は曲線終端までに完了する。クリップの `hold` はモデルパラメータとPresence入力に適用し、明示Yと拡縮は各曲線の終端から通常制御に戻る。

時間曲線は開始接続、完走、終端保持、中断時の共通解除を使う。旧slotの開始接続は曲線を180ms遅らせて現在姿勢から入る。旧モデル値の開始接続は原時計を維持し、最大400msで初期差分を減衰させる。目の固定はデータで明示する。既存のaskは終端を音声終了まで保持し、終了後1500msで解除を開始する。安全な開放上限と次区間・切断時の解除を維持する。通常発話終了は演技の完走を許し、解除は現在値から通常制御へ戻す。

`entry: "lead-in"` は曲線の時計を始める前に180msで開始姿勢へ接続する。`entry: "preserve-clock"` は曲線の時計を直ちに始め、現在姿勢との差を400msで減衰させる。通常は五次smoothstepで補間する。`hold.ms` は終端保持時間。`hold.untilSpeechEnd: true` のときはアニメーション終端と発話終了の遅い方から数える。発話終了が届かない場合に備え、終端から30秒で解除を開始する。通常制御への解除は400ms。

## Wave 2の移行

`apps/runtime-player/assets/speech-motions` に安堵の3クリップを演技ファイル1つとして追加し、採用済みの苦笑を画面・視聴者で共有する演技ファイルとして追加する。既存モデル値曲線とStage Yをコピーし、各クリップの終端時刻、必要な既定値、固定制御を指定する。口の静止値は音声口パク用の制御へ重ねない。既存の組み合わせをすべて外部配置で確認後、旧登録データを参照する `legacyMotionFixture` と旧preset IDの実行経路を整理する。旧キャプチャ手順は移行または履歴扱いとし、Stage Y単体の診断入口と区別する。
