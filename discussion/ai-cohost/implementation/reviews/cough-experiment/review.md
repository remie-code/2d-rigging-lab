# レビュー: 咳払いの聞き取り実験（段階 1）の試作の道具

- ループ: 1
- 判定: **合格**（blocking なし）

## 仕様適合（計画 §3）
1. 流れ: OK。`createEarPipeline`（本番の VAD・区切り・preRoll・silencePad）に `segmenter`/`vad` を上書きせず、`stt.engine="zipformer"`、`localStt*` は設定の値のまま、`client.workerPath/workerArgs/forkImpl` で子だけ実験用に差し替え。子は `createLocalSttWorkerCore`（本番の中身）をそのまま使い AudioTagging を外側に足す。マイクは `lastDevice`＋`normalizeDevice`（dshow なら `audio=`）。設定ファイルを読むのは `isMain` 内だけ。
2. 判定: OK。`padToDuration` で前後に同量の 0 を足して 5 秒（80000 サンプル）、文字数に関係なく全区間を判定。topK はラベル表の行数（527）。番号 0/47/48 で引く。
3. 合図: OK。4 種×10 回を Fisher-Yates、`[n/40]` 表示、説明あり、区間なし（cueTimeout 8s）、複数区間は全て同じ印、speechStart 時点の合図に結びつけて endMs で突き合わせ、Ctrl+C で残す（2 回目は exit 130）。
4. 記録: OK。欄は cue/cueLabel/round/seq/outcome/text/chars/durationMs/speech/cough/throatClearing/topLabel/topProb/reason/at。`appendFileSync` で 1 件ずつ書くので中断しても残る。
5. まとめ: OK。種類ごとの文字内訳と 3 確率の最小・中央・最大（偶数個は平均）。
6. モデル: OK。CED-tiny 欠如・Zipformer 欠如・マイク未決定はそれぞれ 1 行で止まる（耳もファイルも作らない）。取得スクリプトに `--only ced-tiny` を追加。
7. テスト: OK。のばし方・合図順・記録形・まとめ・区間なし/複数・モデル無し・Ctrl+C・子の落下・音を書かないこと・args を網羅。

## 本番の耳が変わっていないこと
- `git diff` で `src/ears/**`（テスト以外）・`src/cockpit/**`・`package.json`・各 lockfile に差分なし（差分は no-sherpa-in-parent.test.mjs のみ）。
- `fetch-local-stt-models.mjs` を一行ずつ確認: 既定（`--only` なし）の対象は Parakeet/Zipformer のまま（ced-tiny は `only` に明示されたときだけ plan に載る）。URL・展開先・ファイル名・tmp 接頭辞（`soul-zipformer-`）・ログ文言（`zipformer: アーカイブを取得中…`）・tar の呼び方・例外メッセージは同じ。ZIPFORMER_* の定数は export 維持。既存テストは弱められておらず追加のみ（既定のプランが `["parakeet","zipformer"]` であることを新テストで固定）。

## 守ること（§2）
- 親で sherpa を読まない: 親（cough-experiment.mjs・lib・worker-core）に sherpa の import 無し。`no-sherpa-in-parent.test.mjs` は PARENT_MODULES に 3 ファイル追加、静的走査の入口に cough-experiment.mjs 追加、実験の子の入口に辿れないことを assert、sherpa を読むファイルの許可は本番の子と実験の子の 2 つだけ（`sort` 比較で厳密）。検査は弱まっていない。
- 声を保存しない: 音の書き出し経路なし（結果は文字・数・null のみ、テストが欄とファイル < 4KB、置き場にJSONLのみを確認。子から親へも tags は `sanitizeTagMessage` で数と短い文字列だけ通す）。`git check-ignore -v apps/soul/agent/cough-experiments/x.jsonl` → `.gitignore:78:/cough-experiments/` で無視される。
- 実データ: テストは `mkdtemp`（OS の一時）と偽物のみ。`cockpit-settings.local.json`・memories・roles・session-usage・fire-diagnostics・memory-backups・.env は参照なし。本物の ffmpeg・fork・fetch・`vendor/models` も使わない（existsImpl 注入、`/fake-models`）。
- 依存・lockfile 変更なし。

## テスト結果
- `apps/soul/agent` で `node --test`: tests 2396 / pass 2396 / fail 0（申告 2345 と件数が違う。下の質問）。関係する 5 ファイルのみでは 33 / 33 pass。
- `pnpm run check:soul-zone`: pass（1636 files, 違反なし）。

## 裁量判断（注記）
- 合図のあと「話していない・結果が全部来た・1.5 秒静か」で次へ、上限 30 秒、tick 100ms。
- 結果は 1 回 1 ファイル `cough-experiments/<日時>.jsonl`、`wx` で上書きしない。
- 失敗（asrFailure/emptyCut/asrSkipped/asrDropped）も `outcome:"failed"` で記録、空文字の捨てられた行も区間として数える。
- 説明のあと Enter 待ち（実行時のみ）。

## 差分・残課題
- non-blocking: 突き合わせの endMs が耳の転写の endMs とずれた場合（リングの端で切り詰められる稀なケース）、その合図の `pending` が減らず maxCueMs（30 秒）まで次へ進まない。試作で稀なので許容、気になるなら onSegment の fallback で最古の pending を 1 つ減らす。
- non-blocking: 共有の取得スクリプトが実験の lib（`cough-experiment-lib.mjs`）から `CED_TINY_MODEL_LAYOUT` を import している。段階 2 で本番化するとき置き場を整理するとよい。
- non-blocking: 子が result の前に送る tags は 1 件スロットで受けており、耳の転写が直列である前提に依存（現状は成り立つ）。

## 質問
- `node --test` の総数が 2396 で、土台 2320＋新規（約 25）の申告 2345 より約 51 件多い。未コミットのうちこのタスク外のテスト（別作業のファイル）が数に入っているかは未確認（git status 上は本件以外の新規テストファイルは見当たらない）。全件 pass なので判定には影響させていない。
