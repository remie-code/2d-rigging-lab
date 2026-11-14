# 表情・演技資産の配置整理

2026-11-14。[合意した規約](asset-versioning-policy.md)の適用記録。Git履歴は書き換えず、ローカルファイルも削除していない。ユーザーの承認により両リポジトリでコミットし、rigging-labのみpushする。移管先workspace-notesの保存コミットは `cd2535e`（push対象外）。

## モデル側へ移管したもの

従来 `discussion/ai-cohost/concept/` 内にあった `shared-laughter-expression/`、`startled-expression/`、`wry-smile-expression/` の20ファイル（13,730,685 bytes）を、[astra-chan/workspace-notes/expression-references](C:/workspace/remie/rigging/astra-chan/workspace-notes/expression-references/README.md) へ移した。コピー全20ファイルのSHA-256一致を確認し、移管先で今回のファイルだけをstageした。従来の未追跡制作フォルダは追加していない。

生成参照PNG、生成条件、モデルの表情診断と位置合わせの資料を含む。位置合わせHTML/比較PNGは生成手順を確認できなかったため暫定保持。`neutral-r804.png` は確率的画像生成へ渡した固定入力として残した。大量の生成物をモデル側へ移す方針ではない。

rigging-labの議論の画像・記録リンクは新しい正本へ変更し、旧ディレクトリには移管先READMEを置いた。旧パスの互換コピーはローカルに残るが、ignore対象であり編集する正本ではない。移管先の [ASSET-MANAGEMENT.md](C:/workspace/remie/rigging/astra-chan/workspace-notes/ASSET-MANAGEMENT.md) からも同じ規約へ辿れる。

## 生成物の追跡除外

`speech-motion-shared-laughter-v2/` の下記379ファイル、125,460,411 bytesをGitの追跡から外した。定義・再現スクリプト・採用判断・入力hash・検証記録は保持。

| 種別 | 件数 | 今回の確認 |
|---|---:|---|
| frames | 125 | saved-r824とv2定義から再描画し全バイト一致 |
| video-frames | 125 | assemble.pyから再生成し全バイト一致 |
| comparison-frames | 125 | v1/v2双方を再描画しcompare.pyから生成、全バイト一致 |
| viewers.mp4 / gaze-comparison.mp4 | 2 | 再組立て後の全バイト一致 |
| contact-sheet.png / closing-comparison.png | 2 | 再組立て後の全バイト一致 |

再生成はrigging-lab `65cd9e36` の実装・スクリプトと、`C:/workspace/remie/rigging/astra-chan/workspace-notes/shared-laughter-closed-eyes-v1/saved-r824` を使用。モデルは読取のみ。v1/v2のrender.mjsへ `SHARED_LAUGHTER_OUT` を渡し、一時出力先でassemble.pyを実行。比較はcompare.pyの入力/出力先だけを一時パスへ差し替えて実行した。記録は `tmp/asset-retention-check/comparison.json`（非追跡）。再現操作は [v2 README](../ai-cohost/experiments/speech-motion-shared-laughter-v2/README.md) を参照。

モデルsnapshotは外部ローカル保存への依存であり、rigging-labをcloneするだけで再現できるとは保証しない。今回、モデル側の過去snapshot全体をGitへ追加したり、モデルの履歴を再編したりはしていない。snapshotを整理する際はモデルGitからの復元手順を先に整え、唯一の入力を消さない。

## 今回保留した既存成果

他の試作成果16ファイルは今回一括除去していない。これは今後も動画を残すという例外規則ではなく、当時の再現入力・手順の確認待ち。

- `speech-motion-received-v1`: 2ファイル。当時のr335 Exportを現用Exportパスで参照しており、現在のr844をそのまま使えない。当時のExport取得経路を閉じる必要がある。
- `speech-motion-brief-relief-variants-v1`: 5ファイル。旧r804・当時のStage再生経路を固定した再現条件の確認が必要。
- `speech-motion-shared-laughter-v1`: 3ファイル。今回描画は行ったが、保存動画・curves.pngまでの一致確認は未実施。
- `speech-motion-shared-laughter-partner-v1`: 2ファイル、`speech-motion-startled-recoil-v1`: 2ファイル、`speech-motion-wry-headshake-v1`: 2ファイル。保存手順はあるが今回の再現照合の対象外。

実機の挙動を観測したStage検証evidence等は、決定論的なオフライン出力と同一視して除外していない。今回のignoreは確認済みのパスに限定し、原本PNGや必要なfixtureを包括的に隠さない。
