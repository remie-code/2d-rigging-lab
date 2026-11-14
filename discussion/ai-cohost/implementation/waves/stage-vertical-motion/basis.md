# 発話モーションの Stage Y: 実装 basis

[合意済み Wave](../../orchestration/stage-vertical-motion-wave-plan.md) の §1 を体験の基準とする。Stage Presence の設定値と Window State の手動配置は保存・表示の基準として従来どおり扱う。

- 現物: `control-channel/speech-motion-state.ts` は owner/generation/section で開始・再生・終了・解除を制御し、同じ時刻を使う pose sampler に180ms進入・400ms解除がある。`control-channel-overlay-store.ts` の snapshot は現在この値と口・粗い overlay を合成し、`role-composition/autonomous-frame-heart.ts` がモデル slot 解決前に受け取る。Yは独立出力として同じsnapshot/tickで取り出し、モデルslot、汎用slot API、診断上のモデルslot、base/previous activationの数値空間に混ぜない。
- 現物: `stage-motion-runtime.ts` の autonomous drive は Presence Off でNative overrideをnullにし、Browserにはbaseを渡す。`stage-motion-transform.ts` は現行 pan.y を変更しない。Yは既存合成後の `pan.y + stageYOffsetPx` に足す。縦軸が下向きの `stage-viewport-px-v1` の論理ピクセル、負が上、正が下。モデル倍率や出力サイズで乗算しない。同じpxだけ移動するため異なるビューポートでは画面に占める割合が異なる。レンダラーの `stage-view-transform.ts` も pan を zoom とは別に加算する。Y非ゼロではOffでもnative overrideを使い、ゼロ/省略へ収束したら従来のnullまたはPresence有効時のtransformへ戻る。カメラ由来のStage Motionは従来どおり。
- 制作入力は `intent.motion` の play へ任意の `stageY` キーフレーム列を加える。単独再生および既存presetと同時指定を許し、どちらも欠ける play は不正。単位は相対ミリ秒と上記論理pxの [tMs, yPx]。先頭はt=0、以降は厳密増加、整数時刻0〜10000ms、1〜64点、変位は有限かつ±200px。定義を共有できるなら Runtime Player の既存presetにも任意の stageY を置ける構造にする（今回は製品候補に追加しない）。明示入力があれば優先する。begin/end/cancel に stageY を指定できない。payloadスキーマと実行時検証を一致させ、不正値は無視して再生するのではなく拒否する。
- 同じ受理済み play の開始時刻・補間基準を用い、任意終点に達した後は自然解除する。既存presetの表情・頭・姿勢のend/hold挙動は維持しつつ、Yは早いend/cancel/kill・新しいsection/generation・所有接続の切断で、その時点のYから既存400msの滑らかな解除を開始する。hard clearは即時ゼロでもよい。明示的再生が連続する場合は最新Yから進入し、解放ターゲットは常にゼロ（現在の手動配置は表示合成時に読む）。古い要求・古い接続が新しいYを上書きしない。音声開始/ストリームに新しい待機や必須項目を入れない。
- テスト: スキーマとWS受理/拒否、既存preset互換と共存、Presence Off/On・手動pan/zoom変更・両出力、開始・終端・次区間・割込・kill・切断/再接続・遅着。実モデルr804の隔離プロファイルで実WSから再現し、両表示の画像/動画、配布2種の更新・最新bundleとsmokeを記録する。機械結果と本人の見え方確認を分ける。

- 保存した演技定義を既存 play に通す再利用の証拠を残す。Runtime Player presetの形を制作先として整え、テスト用の保存済み入力から既存preset併用で送信して実表示を観測する。時刻の厳密増加は契約に記述し、実行時検証で強制する。
