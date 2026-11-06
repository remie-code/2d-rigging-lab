# 咳払いの聞き取り実験(段階 1): ドメイン報告

> Orch-Sylph の最終報告を Undine が書き写したもの(Orch-Sylph はハーネスに報告ファイルの書き込みを拒まれ、本文で返した)。Gnome の報告 [gnome-report.md](gnome-report.md)、レビュー [../../reviews/cough-experiment/review.md](../../reviews/cough-experiment/review.md)。

- 判定: **pass**(1 周目・blocking なし)。
- 機械ゲート: `node --test` 2320 → 2345 件すべて pass(Orch-Sylph と Undine が走らせた。Review-Sylph の申告 2396 件は数え違いとみて扱わない)。`pnpm run check:soul-zone` pass。依存・lockfile の変更なし。
- 本番の耳は変えていない(`src/ears/**` のテスト以外・`src/cockpit/**`・`package.json`・lockfile に差分なし。Review-Sylph が確認)。

## 作ったもの(`apps/soul/agent/`)

- 新規: `scripts/cough-experiment.mjs`(親・CLI)、`scripts/cough-experiment-worker.mjs`(実験の子の入口。sherpa を読むのはここだけ)、`scripts/cough-experiment-worker-core.mjs`、`scripts/cough-experiment-lib.mjs`、テスト 3 本、`src/test-support/fake-cough-experiment.mjs`。
- 変更: `scripts/fetch-local-stt-models.mjs`(`--only ced-tiny` を足した。既定で取るものは変えない)とそのテスト、`src/ears/local-stt/no-sherpa-in-parent.test.mjs`(sherpa を読んでよい入口に実験の子を足し、道具の親が読まないことを確かめる側にも足した)、`.gitignore`(`/cough-experiments/`)。
- 作り: 親は本番の `createEarPipeline` をそのまま使う(VAD・区切り・余白は本番の既定)。差し替えるのは子の注入口だけ。子は本番の `createLocalSttWorkerCore` で文字起こしし、同じ音を 0 で 5 秒にのばして CED-tiny int8 で判定し、数だけ返す。
- 合図: 4 種類 × 10 回を混ぜた順(`--seed` で再現)。区間が来なければ 8 秒で「区間なし」。複数の区間は全部その合図の印で記録。進むのは、話していない・結果が全部来た・1.5 秒静か、がそろったとき(30 秒で必ず進む)。Ctrl+C でそれまでの分を残して終わる。
- 記録: `apps/soul/agent/cough-experiments/<日時>.jsonl`(git に入らない)。値は文字・数・null だけで、音は入らない(テストあり)。
- マイク: 操縦席の設定の `lastDevice`(`--device` で変えられる。設定を読むのは CLI として走らせたときだけ)。

## コマンド(リポジトリの根から)

- モデルを取る: `node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only ced-tiny`(`--dry-run` で表示だけ)。アーカイブ `sherpa-onnx-ced-tiny-audio-tagging-2024-04-19.tar.bz2` は約 28.5MB(中の int8 モデルは約 6MB)。置き場 `apps/soul/agent/vendor/models/ced-tiny-audio-tagging-2024-04-19-int8/`。
- 道具: `node apps/soul/agent/scripts/cough-experiment.mjs`(`--device`・`--per-kind`・`--seed`・`--out-dir`・`--models-dir`)。モデルが無ければ取り方を 1 行出して終了コード 1。

## 残課題(non-blocking・試作の範囲として受け入れ)

1. 合図と結果を区間の終わりの時刻で突き合わせるため、ずれる稀なケースでは 30 秒待ち、その合図の記録が残らないことがある。
2. 共有の取得スクリプトが実験の lib から `CED_TINY_MODEL_LAYOUT` を読む。段階 2 で置き場を整理する。
3. 子からの判定の結果を 1 件分の受け口で受けている(文字起こしが 1 件ずつ順に進むことに頼る。今はそのとおり)。

## 質問と Undine の扱い

1. hotwords: 道具は `roles/` を読まず、設定ファイルの hotwords だけを使う。→ 合図(咳払い・「うん」など)への影響は小さいので、このままとする(Undine)。
2. アーカイブの中のフォルダ名・ファイル名は推定。違えば取得は「archive did not contain」で止まる。→ 最初の取得で確かめる。
3. 本物で未確認: Windows で Ctrl+C のあと子が落ちた扱いにならずに終わるか、`compute` に topK 527 で全部の種類が返るか。→ 最初に走らせたときに見る。
