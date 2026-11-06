# レビューレポート: 咳払いの落とし(段階 2)Domain A
- ループ: 1
- 判定: 合格(blocking なし)

## §4 A の合格の条件(1〜8)
1. 子: 適合。`local-stt-worker-core.mjs` の `initTagger`(作れなくても fatal にせず ready に enabled:false+理由)・`transcribe` の `shouldTagTranscript`(1 以上かつ上限以下のみ判定、他は tagged:false/speech:null)・`tagSpeech`(失敗は null)。固定: worker-core 判定の 8 テスト(作る/5 秒にのばす/上限超え・空は compute を呼ばない/maxChars 0/CED 無し/作れず fatal にしない/compute 失敗は speech null/文字起こし失敗)。`no-sherpa-in-parent.test.mjs` は audio-tagging.mjs を親側リストに足しただけ(sherpa import なし)・通る。
2. 親: 適合。`ear-pipeline.mjs` `coughSpeechToDrop`(線 0・null・非有限・上限超えは null、`speech < 線` のみ落とす=線ちょうどは通す)→ `transcribeAndAppend` で正本に積む前に `dropCough`。`useLocal` のときだけ評価なので whisper/ElevenLabs は不変。固定: 「coughSpeechToDrop」「ear-pipeline(local・咳) 落とす/境界」「(whisper・ElevenLabs)」。
3. SSE: 適合。`cockpit-server.mjs` の `buffer.onDiscard` で reason が cough のときだけ `text` と `speech` を追加、blank は従来の形。`transcript-buffer.mjs` の `discard()` が discarded を数える。固定: cockpit-server-cough.test「咳の SSE discard…」、transcript-buffer「discard(cough)/不正入力」。形は `{startMs,endMs,reason:"cough",appended,discarded,text,speech}`(確定。Domain B に渡してよい)。
4. 文字の漏れ: 適合。診断 `transcriptDiscarded`(cough)は text/speech なし、`audioTaggingOff` は engine と決まった 4 語の reason のみ(`audioTaggingOffCause`)。警告は固定文。追加の `console.*`/`process.std*` は差分になし。`onDiscard` の購読者は cockpit の SSE と実験の道具(実験は従来から text を扱う実験専用)だけ。固定: cockpit-server-cough.test の「配信の耳…」「落とした文字の行き先」(ソース走査)、ear-pipeline「判定なしでも Start は成功…」(診断に文言・パスなし)。
5. モデルが無いとき: 適合。`planAudioTagging` は CED 無しなら init に載せず判定なしで ready(Start 失敗なし)。警告は `warnCoughFilterOff`(`coughFilterOffWarned` を `openVenueTranscript` で戻す=場ごと 1 回、共有 handleDiagnostic なので Discord 2 人でも 1 回)。not-configured/disabled は警告しない。固定: 「判定なし: Start は成功・警告は場ごとに 1 回…」「Discord(2 人) 判定なしでも警告は 1 回」。
6. 設定: 適合。`localSttCoughMaxChars`(整数 0〜10・既定 4)/`localSttCoughSpeechThreshold`(0〜1・既定 0.1)を `getLocalStt` と `normalizeLocalSttSettings`(範囲外は既定)に追加、画面の設定には出さない。耳が Start ごとに読み、`audioTaggingMaxChars` を子へ。固定: settings-store・engines のテスト、ear-pipeline「文字数の上限と線が子の係へ」、cough テスト「設定は Start ごとに読まれて…」。
7. 取得: 適合。`planLocalSttModelFetch` は `only` 無し/空で CED-tiny も含み、`--only ced-tiny` は残る。置き場は `src/ears/local-stt/audio-tagging.mjs`、実験 lib は re-export・取得スクリプトもそこを import。実験テスト通る。固定: fetch-local-stt-models.test(旧「--only のときだけ」のテストは新仕様に書き換え=妥当)、audio-tagging.test「実験の lib は…re-export」。
8. Discord: 適合。`speakerTranscriptMouth` は `...buffer` を展開するので `discard` が通り(差分なし)、discard は名前・id を受けない。固定: 「Discord(2 人・人ごとの本物の耳)…誰の咳かは載せない」。

## §2 細部・§5 守ること
- §2-1: `countChars` は実験と同一関数(lib は re-export)。2: `padToDuration` で余白込み pcm を 0 で 5 秒。3: 比較は親、数えて判定は子、上限は init。4: discarded・SSE・(ゴースト行の元の SSE)が揃う。5: 文字と確率は SSE のみ。6: 警告は場で 1 回・英語 1 行・文字や名前なし(detail は取得コマンドのみ)。7: audio-tagging.mjs は sherpa を import せず向きは正しい。8: 設定名・範囲・既定戻り適合。
- §5: package.json/pnpm-lock.yaml/stream-wording-pin・venue-wording は差分・未追跡とも無し。新テストは一時ディレクトリ(mkdtemp)の設定ファイルを使い、本物の `cockpit-settings.local.json` や CED/vendor/models の実物は読まず、偽の sherpa・偽の client/Discord のみ。sherpa の import は子の入口だけ。
- 実験の道具は `coughMaxChars:0`・`coughSpeechThreshold:0` を明示して段階 1 の挙動を保つ(妥当)。

## テスト結果(自分で走らせた件数)
- `apps/soul/agent` で `node --test`: tests 2382 / pass 2382 / fail 0 / cancelled 0 / skipped 0。
- リポジトリの根で `pnpm run check:soul-zone`: pass(1639 files, exit 0)。
- 既存 deepEqual の書き換え(settings-store 3 か所・client 2 か所・engines 1 か所・fetch 旧テスト差し替え)は新しいキー/フィールド追加に伴うもので、検証を弱めていない。

## 裁量判断(許容)
- 正本に `discard()` の口を足す方式(診断変換でなく)。
- 親でも `shouldTagTranscript` を再確認して上限超えは通す側に倒す(子との二重防御)。
- 判定なしの警告は `model-not-found`/`failed-to-load` の 2 文言のみ、source にエンジン名。

## 差分・残課題
- blocking: なし。
- 非 blocking:
  - 警告のフラグは場(`openVenueTranscript`)単位なので、同じ場の中で耳を Start/Stop し直しても再警告しない(計画の「場ごとに 1 回」どおり)。
  - 既定で CED 未取得の環境では Start のたびに場の最初の 1 回、警告が出る(仕様どおり。取得で消える)。

## 質問
- なし。
