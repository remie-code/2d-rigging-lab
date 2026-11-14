# 発話モーションからステージの上下動を指定する

2026-11-11、ユーザーが計画作成・起動を指示。既存 `codex/intent-motion` ブランチ上で継続。先行する意図モーション実装・議論の未コミット差分を保持する。Orch以下はすべて **GPT-6.1 Sol (`gpt-6.1-sol`)**。

## 1. 合意とUser Gate

制作する発話モーションに、チャッピー全体のステージ上の上下移動を添えられるようにする。まず安堵の演技で利用するための機能追加。普段のStage Presenceをオフにしていても、発話で指定した上下動は使える。既存の左右移動・拡縮を有効にする必要はない。

- 頭や姿勢を動かすモデル内の変形と、モデル全体を上下させる表示変換を区別する。
- 上下動は手動で配置した表示位置を基準とし、配置設定自体を書き換えない。
- 頭・姿勢・口パクと併存し、発話モーションと同じ時間軸で扱う。音声開始の待機条件を増やさない。
- 発話終了、割込み、kill、切断、世代変更によって上下位置が残留しない。古い要求の遅着で新しい発話を動かさない。
- Native StageとOBS Browser Sourceの両方に反映する。表示サイズが違う場合の座標の意味も明示して検証する。
- 上下指定がない既存モーションの見え方を変えない。普段の自動的な上下揺れを今回増やすことは合意していない。
- 機械確認用の短い上下動を作るが、完成した「安堵」を登録・自動選択させるところまでは含めない。笑みの表情差分やモデル造形変更も今回の範囲外。
- **ユーザーが普段使う `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` を更新し、Stage Presenceオフでも指定した上下動が見える確認手順と再現可能な入力を渡す。** portable exeも既存のdist:win手順で生成する。
- 機械・実表示確認の完了と、ユーザーが実機で見て判断するゲートを区別する。その後、⑪安堵の見え方の議論・制作へ戻る。

## 2. 根拠と既存状態

- [未対応意図の15系統と制作方針](../../concept/speech-motion-candidate-families.md): 笑み追加は後にし、⑪安堵、次候補⑥驚いて引く。上下動を今回の制作手段に加える。
- [先行意図モーション計画](intent-motion-wave-plan.md)、[Wave 1接続契約](../waves/intent-motion/wave1-contract.md)、[Wave 2完了](../waves/intent-motion/wave2-completion.md): 自由意図→DecisionAPI→プリセット/none記録、音声優先、世代・区間によるライフサイクル。
- Sylphの読み取り調査: 現行Stage Presenceは合成後body-xからX移動、body-zから倍率を生成。既定Off、強さは生理プロファイルに保存。Stage用Y/回転・演技ごとの独立表示指定はない。現行interest/askのbody入力もStage Presence On時は追従対象。
- 主な調査入口: `apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts`、`main/presence/stage-presence-drive.ts`、`main/stage-motion/stage-motion-transform.ts`、`stage-motion-transport.ts`、`main/control-channel/speech-motion-state.ts`、`control-channel-overlay-store.ts`、`contract/speech-motion-presets.json`。担当は現物を確認してbasisに根拠を記す。
- 既存の手動pan/zoom、カメラ由来のStage Motion、自律由来のStage Presenceを混同しない。今回の演技用上下動は既存Presenceの有効・無効から独立する。
- 実モデルは `C:/workspace/remie/rigging/astra-chan/exports/astra-chan-runtime` r804。読み取り利用。外部モデル・音声・秘密情報をGit管理へ投入しない。

## 3. 1 Wave内の順序

同じOrchが依存する作業を順に管理する。共有契約を先に固め、独立レビューを一人へまとめる簡易オーケストレーション。

### A. 上下指定と表示への接続

1. 既存の発話モーション定義・制御契約・フレーム合成・Stage出力を限定調査し、演技用Yの所有、座標の単位・符号・範囲、基準位置との合成、指定省略時の互換性をbasisに記録する。
2. パラメータ命名・単位などの技術選択は担当が根拠とともに決める。既存スロットを無理に再解釈してモデル変形を混ぜない。ユーザー価値の新たな判断が必要になればrootへ戻す。
3. 発話モーションから独立した演技用Yを指定し、Native Stage/Browser Sourceの両表示へ接続する。

### B. ライフサイクルと共存

1. 開始、次区間、自然終了、割込み/kill、切断、世代変更、再接続を既存の意図モーション経路へ接続する。
2. 指定のない既存モーション、Stage Presence On/Off、手動配置/zoom、既存X/拡縮、口・頭・視線との共存を確認する。
3. 解放先は演技用オフセットのない基準表示。ユーザーが配置を変えた場合も古い基準へ戻さない。解除の連続性を確認する。

### C. 実表示・パッケージ・引き渡し

1. 制御された上下動あり/なしの入力を用意し、実WebSocket→既存発話モーション再生→Stage表示を通して確認。テスト専用入力を製品の意味候補レジストリへ恒久登録しない。
2. r804で実際の見え方を画像/動画として確認する。NativeとBrowser Sourceのどちらを実表示で観測し、どれをテストだけで確認したかを正直に分ける。本物の配信やマイクを開始しない。
3. 関連required checks、独立レビューと限定修正を完了後、dist:winの既存手順でパッケージ化。win-unpacked/portableの実体と最新コードの包含を確認する。実exeを起動する場合は検証専用の隔離プロファイル・プロセスで行う。
4. ユーザーが普段のexeでStage Presenceをオフにしても上下指定を見られる再現手順を用意する。スクリプトで制御する場合も準備まで担当が行い、ユーザーへコード作成を転嫁しない。

## 4. 検証・レビュー

- 新規上下トラックの有無、範囲/不正入力、合成後の表示、基準配置、Presence On/Off、両出力、開始・終了・中断・遅着・切断/再接続を対象に必要な単体/統合試験を行う。
- 既存の発話/モーション/Stage経路を通す証拠を取得する。独立した計算関数だけの合格を実表示の合格としない。
- source guardの既存 `physiology/index.ts` 違反など、既知失敗と新規回帰を区別する。通過後の理由なき全件再実行はしない。
- Review-Sylph一人がbasis・変更・試験・実表示証拠・配布物を照合。修正後は対象を絞って再確認、最大5巡。広い再設計や未合意の体験変更へ広がる場合は早めにrootへ戻す。

## 5. 委譲・所有

Undineは計画、上位map、User Gate、進捗と報告を保持する。source/tests/domain差分には直接入らない。

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

- 全階層で `[subagent-call] 呼び出し元: ...` を付ける。**全員GPT-6.1 Sol**、新規contextに必要なbasisを渡す。
- Gnomeにsource/modulesと実行証拠の所有を明記。他者の既存差分がある共有workspaceであり、revert/無断整形しないことを伝える。
- root所有: 本計画、`orchestration/_map.md`、`implementation/_map.md`。
- Orch所有: `waves/stage-vertical-motion/` のbasis/completion/human-gateとmap。Review所有: `reviews/stage-vertical-motion/` とmap。
- branch checkout/commit/merge/pushは今回行わない。外部モデルや現在の本物のアプリ/配信設定を変更・終了しない。
- パッケージの上書きはユーザー承認済み。稼働中でロックされる場合は他のアプリを強制終了せず状況を報告する。Windowsの削除/moveでは絶対パスを確認し同じシェルで処理する。

## 6. 状態

| 項目 | 状態 | 入口 |
|---|---|---|
| 1 Wave実装・検証 | 機械ゲート合格 | [完了報告](../waves/stage-vertical-motion/completion.md) |
| 独立レビュー | 初回指摘修正・独立確認後合格 | [レビュー](../reviews/stage-vertical-motion/review.md) |
| パッケージ更新 | win-unpacked・portable更新、両版の隔離起動と上下動確認済み | [配布物証拠](../waves/stage-vertical-motion/completion.md) |
| ユーザー実表示確認 | 未実施・確認待ち | [本人確認手順](../waves/stage-vertical-motion/human-gate.md) |

受領結果: 独立試験40ファイル372件、製品Fire killからの実WS cancel/上下解除、Runtime型検査・依存境界・Soul zone/fixtureは合格。source guardは基点から不変の `physiology/index.ts` 違反1件。保存した確認用演技を実WSで再生し、r804/Presence OffでNative 600×720、Browser Source 850×900を順次確認。現在の手動位置から上90px、下65px、基準復帰を観測し、上下指定なしでは既存位置/zoom不変。独立Reviewerとrootが比較画像を目視した。portableの起動時ASARとwin-unpacked、ASAR内mainと現行buildの一致を確認済み。本人の普段の設定・OBSアプリ内・実会話の確認、完成した安堵モーションの制作は別に残る。

確認後に⑪安堵の制作議論へ戻る。上下機能の確認を安堵モーションの完成と呼ばない。

最終Orch受領: Runtime Player全1055件、両型検査・契約検証も合格。検証専用アプリ・Chrome・ローカルサーバーを終了し、一時プロファイル3個を削除済み。通常のアプリ・配信環境には変更なし。
