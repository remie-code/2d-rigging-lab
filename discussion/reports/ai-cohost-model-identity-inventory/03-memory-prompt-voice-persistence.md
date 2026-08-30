# AI Cohost model identity inventory: memory / prompt / voice persistence

> 種別: 実装前 inventory（採用判断ではない）。`inventory-contract.md` の既知判断、未決質問、current/historical/inference の分離に従う。
> 調査日: 2026-08-08。対象は `apps/soul` 特区内の runtime と、brain-swap / stream-memory の accepted artifact。

## 1. Scope and entry points

調査した入口と責務は次のとおり。

| 領域 | 一次入口 | 見た責務 |
|---|---|---|
| brain registry | `apps/soul/agent/src/mind/brains.mjs:15-32,47-90` | brain id/label/model/create/credential の宣言。identity/name/voice は宣言しない |
| Claude / Codex session | `apps/soul/agent/src/mind/llm-session.mjs:20-29,43-49,145-197` / `codex-session.mjs:9-45,230-269,322-460` | system prompt、セッション履歴、rollout、戻り値 |
| Fire / persona | `apps/soul/agent/src/mind/fire-orchestrator.mjs:134-154,333-367,455-465` | 固定自己名、直近会話注入、speechText の正本記録 |
| live transcript | `apps/soul/agent/src/ears/transcript-buffer.mjs:3-16,29-47,70-92,147-180` / `fire-injection.mjs:43-58,73-123` | 話者・viewer displayName、窓と注入整形 |
| stream-memory | `apps/soul/agent/src/mind/memory.mjs:10-34,83-140,144-178,181-253` / `scripts/cockpit.mjs:780-887,1000-1016` | viewer 名除去、使い捨て digest、timestamp md、起動時再搭載、brain の解決時点 |
| cockpit persistence/wire | `cockpit-settings-store.mjs:34-41,65-93,181-195` / `cockpit-server.mjs:530-582,1283-1331` | brainChoice/memoryEnabled、snapshot/SSE の brain 表示 |
| TTS / playback | `tts-client.mjs:5-10,25-27,94-110,120-167` / `speak.mjs:31-51,74-125` / `audio-player.mjs:165-184,221-230,265-328` | numeric speaker、WAV temp、出力 device。voice 名や brain 連携はない |
| fixed name surfaces | `fire-scheduler.mjs:183-218` / `whisper-inference.mjs:40-50,68-90` / `cockpit/ui/header.mjs:43-55` / `cockpit.html:1-6` | 呼びかけ、ASR語彙、UI表示の固定値 |

参照した正本は [`discussion/ai-cohost/soul/brain-swap.md`](../../ai-cohost/soul/brain-swap.md)、[`stream-memory.md`](../../ai-cohost/soul/stream-memory.md)、各 wave plan、およびこの inventory の [`inventory-contract.md`](./inventory-contract.md) である。

## 2. Executive findings

### Current repository facts

1. **brain identity と soul identity は別物のまま**。`BRAINS` の entry は `id/label/create/credentialPath` だけで、自己名、persona、TTS speaker、provider/model の identity bundle は持たない (`brains.mjs:26-32,47-83`)。
2. **自己名は全 brain 共通の固定「コーディ（Cody）」**。Fire の system prompt (`fire-orchestrator.mjs:147-154`)、ASR initial prompt (`whisper-inference.mjs:41-50`)、呼びかけ matcher (`fire-scheduler.mjs:204-218`)、cockpit の title/header (`cockpit.html:6`, `ui/header.mjs:43-55`) に個別に現れる。GPT 系を「チャッピー」にする mapping は現 repo に存在しない。
3. **brain の帰属は runtime で動的解決され、transcript/memory 本文には snapshot されない**。`cockpit.mjs` は `currentBrain` で session と digest brain を解決する (`scripts/cockpit.mjs:692-721,780-825`)。soul transcript/usage SSE は broadcast 時の `brainStatus()` を読むだけで、実際に ask した brain とズレ得ることをコードが明記する (`cockpit-server.mjs:1286-1308,1328-1331`)。
4. **system prompt は session 生成時 snapshot**。Claude は SDK `systemPrompt` として query に渡し、`persistSession:false` (`llm-session.mjs:186-197`)。Codex は `systemPrompt` を first turn の入力先頭へ一度だけ前置し、以降は Thread の継続履歴に依存する (`codex-session.mjs:230-269`)。brain/name を後から変えても、session を dispose→再生成しない限り既存 prompt は変わらない。
5. **stream-memory の digest は生成時 brain を動的に選ぶが、code-managed brain/name metadata は保存しない**。viewer `displayName` は整形段階で落とし、禁止指示も二重化される (`memory.mjs:20-34,60-99`)。ファイル名は `startedAtMs` 由来の `.md` のみ (`memory.mjs:144-178`)。同一 session の checkpoint/manual/SIGINT は同じファイルを上書きする (`scripts/cockpit.mjs:815-835,1000-1016`)。
6. **TTS/voice は brain identity と未接続**。AivisSpeech は numeric `speaker`（既定 `888753760`）だけを query/synthesis に送り (`tts-client.mjs:25-27,94-110,120-167`)、cockpit の永続設定は音声出力デバイス名であって TTS speaker ではない (`cockpit-settings-store.mjs:14-16,65-93`)。voice 名、persona、brain→voice mapping はない。
7. **privacy boundary は provider 間で非対称**。Claude は SDK の disk session を無効化している (`llm-session.mjs:186-195`)。Codex は SDK 経由では rollout 永続化を無効化できず、sidecar 台帳の自 thread ID 完全一致だけを dispose/startup sweep で削除し、本文を読まない (`codex-session.mjs:36-45,108-150,187-200`)。live transcript/SSE と Fire input は viewer 名を保持する一方、memory digest は除去する (`cockpit-server.mjs:530-541`, `fire-injection.mjs:43-58`, `memory.mjs:60-99`)。

### Accepted / historical / inference の境界

- **契約上の既知 user decision**: Claude 系=`コーディ`、GPT 系=`チャッピー`を希望する（`inventory-contract.md:7-13`）。これは mapping の採用済み実装ではない。
- **accepted behavior**: brain swap は「頭だけを差し替え、耳・声・転写・安全弁は共通」とする (`brain-swap.md:7-18`)。stream-memory は自動で直近 3 件、viewer 名を保存せず、ローカル md、session 生成時注入、digest は使い捨てという裁定 (`stream-memory.md:14-25`)。
- **historical evidence**: `apps/soul/README.md:400-405` は brain 選択を Claude/Codex の旧 2 択で記述するが、現行 registry は 4 entry (`brains.mjs:47-83`)。旧 README の 2 択を current truth として扱わない。
- **inference**: identity を導入するなら prompt/UI/ASR/scheduler/TTS/observability の複数 surface を同期する必要がある。ただし系列単位・model 単位・user-editable/registry-defined、過去記録の表示規則は repo からは閉じない。

## 3. Current data/control flow

### 3.1 Fire / prompt / transcript / wire

```text
transcriptBuffer (in-memory, you/soul/viewer + viewer displayName)
  └─ fire-injection: appendedAtMs の直近窓・maxChars、viewer(name) を描画
       └─ session.ask（session 作成時に FIRE_SYSTEM_PROMPT [+ memory] を固定）
            └─ parseExpressionTags → speechText
                 ├─ speak(TTS numeric speaker → WAV temp → player)
                 └─ buffer.append(speaker=soul, speechText のみ)
                      └─ SSE transcript（brain は broadcast 時 currentBrain）
```

Fire の ask/response で `replyText` から表情 tag を剥がし、`speechText` だけを会話ログへ追記する (`fire-orchestrator.mjs:333-367,455-465`)。視覚画像は transcript/memory の正本や SSE history へは積まない (`fire-orchestrator.mjs:54-65`)。Claude は画像を in-memory で渡し、Codex adapter だけは `local_image` bridge のため OS temp に短命ファイルを書いて finally で削除する (`codex-session.mjs:28-34,240-269,428-438`)。したがって soul transcript の過去 entry に brain/model/name/voice provenance は無い。

観測ログも identity の完全な正本ではない。cockpit の `session_init` stderr JSON は Claude session の `model/apiKeySource/tools` だけを出し brain id/name/voice は出さない (`scripts/cockpit.mjs:712-721`)。CLI の `utterance` JSON は usage/TTFT/ask/E2E/channel RTT/timeline/WAV 長だけで、brain/name/speaker は出さない (`src/cli/cli.mjs:101-112`)。Cockpit SSE の usage/transcript だけが current brain id を additive に載せるが、in-flight mismatch は既述の通りである。

### 3.2 Brain selection / session lifetime

`cockpit-settings.local.json` は `brainChoice` 文字列を保存するだけで、設定 store は「無くても起動できる補助」であり正本ではない (`cockpit-settings-store.mjs:34-41,49-51,181-195`)。起動時に `currentBrain` を解決し、Fire resource 作成時に `BRAINS[currentBrain]` を引く (`scripts/cockpit.mjs:692-721`)。`POST /api/brain` は選択を保存し、現 session を dispose→null、次回 Fire で新 brain を作る (`scripts/cockpit.mjs:780-802`)。

### 3.3 Stream-memory

```text
server.getTranscript() (全量)
  └─ formatTranscriptForDigest（viewer displayName 除去）
       └─ BRAINS[currentBrain].create({systemPrompt: DIGEST_GENERATION_INSTRUCTION})
            └─ ask 一発 → dispose
                 └─ memories/<startedAtMs-derived>.md（brain/name metadata 無し）

起動/ON切替:
  memories/*.md の新しい順で最大 3 件
    └─ composeSystemPrompt(FIRE_SYSTEM_PROMPT, memoryText)
         └─ 次に生成する session の固定 prompt
```

`memoryEnabled` OFF は注入・生成・checkpoint を停止し、ON へ戻すと md を再読込して session を再生成する (`scripts/cockpit.mjs:837-887`)。記憶本文は editable/deletable な local asset として `.gitignore` 対象 (`apps/soul/agent/.gitignore:37-41`)。

### 3.4 Snapshot vs dynamic resolution

| データ/表示 | 現行解決 | brain/name の過去帰属 |
|---|---|---|
| Claude system prompt | session 生成時 snapshot (`llm-session.mjs:186-197`) | session 内は固定。再生成しない限り旧名を保持 |
| Codex system prompt | first turn の入力に一度前置 (`codex-session.mjs:240-269`) | Thread rollout の内部履歴に依存。外部 transcript へは出ない |
| `currentBrain`/`brainChoice` | 起動時/POST で current を動的解決 (`scripts/cockpit.mjs:780-813`) | setting は id のみ。旧 brain の履歴は追跡不能 |
| soul transcript SSE | broadcast 時の `brainStatus()` (`cockpit-server.mjs:1295-1308`) | in-flight 切替時に実生成 brain と mismatch し得る（コード注記あり） |
| usage SSE | usage 通知時の `brainStatus()` (`cockpit-server.mjs:1328-1331`) | 同じ mismatch 可能性 |
| transcript buffer entry | `seq/start/end/text/speaker/displayName/appendedAtMs` (`transcript-buffer.mjs:70-92,161-169`) | brain/model/name/voice field 無し。履歴再解決も無い |
| memory digest file | record 時の `currentBrain` で生成 (`scripts/cockpit.mjs:818-825`) | filename/body に brain/name/voice metadata 無し |
| TTS | 発話ごとの `speaker` 数値 (`speak.mjs:74-77`) | transcript/voice record に speaker/model provenance 無し |

## 4. Exact fixed values and owners

| 固定値/表現 | 現値 | owner / evidence |
|---|---|---|
| Fire self-name | `あなたの名前はコーディ（Cody）です。` | `fire-orchestrator.mjs:147-154`（global `FIRE_SYSTEM_PROMPT`） |
| audio-call variants | `コーディ/コーディー/コーティ/コーティー` | `fire-scheduler.mjs:204-218` (`NAME_VARIANTS_V0`) |
| text-call variants | Cody/cody/CODY + 日本語 variants | `fire-scheduler.mjs:183-202` (`NAME_VARIANTS_TEXT_V0`) |
| Whisper lexical bias | `こーでぃー、コーディ。` | `whisper-inference.mjs:40-50` (`DEFAULT_WHISPER_PROMPT`) |
| cockpit visible name | `こーでぃー` | `cockpit/ui/header.mjs:43-55`, `cockpit.html:1-6` |
| brain registry | `claude`→Claude (Opus 4.8), `codex`→GPT-5.6 Terra, `codex-55`→GPT-5.5, `codex-56-sol`→GPT-5.6 Sol | `brains.mjs:47-83`（id/label/model wrapper。identity name なし） |
| Claude default session | model `claude-opus-4-8`, `persistSession:false`, `tools:[]` | `llm-session.mjs:20-24,43-49,186-197` |
| Codex default session | model `gpt-5.6-terra`, effort `none`, rollout path `~/.codex/sessions` | `codex-session.mjs:36-45,68-84` |
| TTS speaker | numeric default `888753760` | `tts-client.mjs:25-27,94-110` |
| memory | latest 3 md, digest ≤1500-char instruction, no viewer name/PII | `memory.mjs:43-47,89-99`, `stream-memory.md:18-25` |
| settings persistence | `brainChoice`, `memoryEnabled`; no soul name/persona/TTS speaker | `cockpit-settings-store.mjs:34-41,87-93,181-195` |

## 5. Existing extension points

成立可能な拡張点（採用は未決）:

- `BrainEntry` に identity metadata を足し、`create(options)` へ prompt/voice の解決結果を渡す方向。ただし現 typedef は四項目だけで、registry と UI の labels は別箇所にも直書きされる (`brains.mjs:26-32`, `view-logic/health.mjs:90-99`)。
- `FIRE_SYSTEM_PROMPT` と memory の合成は `composeSystemPrompt` の一箇所 (`memory.mjs:237-253`)。session 作成時 snapshot を保つ方向、または brain/name 解決をこの境界で行う方向がある。
- `cockpit-settings-store` は read-modify-write の新キー追加を許す (`cockpit-settings-store.mjs:98-116`)。brainChoice 以外の name/voice 設定を永続化する余地はあるが、settings は正本ではない。
- `cockpit-server` の snapshot/SSE は additive field を載せられる。既存 transcript entry は immutable なため、旧 entry の欠落 field を `null` とする互換路が必要になる (`cockpit-server.mjs:530-582,1295-1308`)。
- scheduler は `nameVariants`/`commentNameVariants` を options で注入でき (`fire-scheduler.mjs:397-401,462-466`)、Whisper も `options.prompt` を受ける (`whisper-inference.mjs:68-90`)。これらは固定値の置換口であり、brain identity の一元化を既に実装しているわけではない。
- `speak` は `tts`、`ttsBaseUrl`、`speaker` を deps で差し替えられる (`speak.mjs:31-44,74-77`)。voice registry/brain mapping は未実装。

## 6. Persistence and compatibility implications

### 6.1 Historical attribution

- transcript buffer はプロセス内 append-only で、エントリに brain/model/name/voice が無い (`transcript-buffer.mjs:3-16,70-92`)。過去発話を後から「当時の名前」で表示する snapshot も、現在名で再解決する処理も存在しない。
- memory md は timestamp だけを filename にし、code-managed model/name metadata を付けない (`memory.mjs:144-178`)。LLM が本文中へ書いた文字列とは区別される。よって同じ md が Claude/Codex のどちらで生成されたか、また当時どの soul 名だったかは repo の構造だけでは復元できない。
- Codex rollout は会話入力（system prompt を含む）が provider 側ファイルへ自動保存されるが、filename は thread id であり、当該 brain の ledger 以外の provenance field は本コードが管理しない (`codex-session.mjs:36-45,103-150`)。dispose/startup sweep 失敗時や crash 間は残留し得る（削除は best-effort）。

### 6.2 Migration / compatibility risks

- `コーディ` の置換だけでは不十分。Fire prompt、ASR prompt、音声/コメント matcher、UI header/title、tests、README の旧 2-choice 記述が別々に固定されている。1 箇所だけを変えると「呼びかけは旧名、自己認識は新名、UI は別名」の drift になる。
- session prompt は生成時 snapshot、brainChoice/SSE は dynamic である。名前を runtime 変更できる仕様にすると、in-flight ask、既存 Thread、次の Fire の境界を明示しない限り混在する。
- transcript/SSE/memory に provenance field を追加する場合、過去 entry/file は null/unknown のままになる。歴史本文の文字列を機械的に rewrite すると、実際の発話を改変し得るため別の互換リスクになる。
- TTS speaker は現在 numeric CLI/cockpit 引数のみで、settings に保存されない。restart 後に同じ brain/name と同じ声が再現される契約はない。
- `writeTempWav` は OS temp に `soul-agent-*/*.wav` を書く (`audio-player.mjs:165-184`) が、本実装の `speak`/player dispose はその WAV/dir の削除を行わない (`speak.mjs:99-125`, `audio-player.mjs:299-328`)。gitignore の `*.wav`/`recordings/` は repo 成果物を防ぐだけで、OS temp の retention を保証しない。
- 永続的な音声 recording の writer は runtime に無く、`.gitignore` は zone 内の `*.wav/*.pcm/*.raw/recordings/` を成果物から除外する (`apps/soul/agent/.gitignore:18-25`)。したがって「録音を brain/name 付きで保存する」経路は現 repo では閉じていないが、発話用の OS temp WAV は別途残留し得る。

### 6.3 Privacy boundary (current)

- viewer `displayName` は live transcript/SSE と Fire input には残る (`cockpit-server.mjs:530-541`, `fire-injection.mjs:43-58`)。memory digest の format と instruction では落とす (`memory.mjs:20-24,60-99`)。
- Codex は viewer を含み得る Fire input を rollout に保存し、配信後に自分の thread ID のみ掃除する。Claude は `persistSession:false` で provider-side session file を使わない (`llm-session.mjs:186-197`, `codex-session.mjs:36-45`)。両者の privacy semantics は同一ではない。
- viewer 名は耳未起動時の `chatBufferAbsent` 診断の `reason` にも渡される (`cockpit-server.mjs:1453-1459`)。これは UI/SSE 診断経路であり memory md ではないが、名前を含む runtime surface として境界を確認すべきである。視覚入力の Codex bridge は本文を保存する機能ではないが、短命 OS temp を使う点は別の retention surface である (`codex-session.mjs:28-45,240-269`)。
- memory md/ledger/settings は `.gitignore` の local asset で、現 working tree には `memories/` が存在しない。local settings/ledger は存在し得るため、報告では秘密値を再掲しない。

## 7. Tests and verification surfaces

既存テストが固定している範囲:

- registry の四 ID、label、credential path と Codex model wrapper: `apps/soul/agent/src/mind/brains.test.mjs:16-39,93-128`。
- Claude systemPrompt/model/options、`persistSession:false` 相当の query option: `apps/soul/agent/src/mind/llm-session.test.mjs:107-129`。
- digest の viewer 名除去、禁止指示、使い捨て create→ask→dispose、timestamp 同一ファイル上書き、compose ON/OFF: `apps/soul/agent/src/mind/memory.test.mjs:28-74,104-160,178-193,339-364`。
- Fire system prompt が自己名を含むこと、expression parser 後の speechText-only 記録: `apps/soul/agent/src/mind/fire-orchestrator.test.mjs:49-62` および同ファイルの Fire 縦検証。
- Whisper default prompt injection: `apps/soul/agent/src/ears/whisper-inference.test.mjs:95-110`。
- brain snapshot/POST と memory endpoint/status: `apps/soul/agent/src/cockpit/cockpit-server.test.mjs:2229-2250,2794-2860`。
- TTS client speaker query/synthesis と WAV temp の生成: `apps/soul/agent/src/voice/tts-client.test.mjs:101-130,148-164`、`audio-player.test.mjs:48-57`。

未固定の検証面:

- brain ごとの soul name/persona/voice mapping、名前変更時の prompt snapshot、in-flight 応答の provenance snapshot。
- transcript/memory file の brain/model/name metadata、旧 entry/file の `unknown` 互換表示。
- TTS speaker の restart persistence、WAV temp の cleanup/retention。
- viewer name が runtime SSE/diagnostic から provider input/disk rollout へ流れる境界の end-to-end 計測。

## 8. Risks and ambiguous semantics

1. **identity 粒度**: Claude/GPT 系列、4 registry 行、provider/model のどこに名前を結び付けるかは未決。
2. **name source of truth**: registry-defined、settings-defined、user-editable のどれかは未決。現行 registry は identity を持たず、settings も brainChoice のみ。
3. **snapshot vs dynamic**: in-flight ask、既存 Codex Thread、SSE、memory digest、過去 transcript を「生成時の名前/brain」で保つか「現在値」で再解決するかは未決。現行は prompt が snapshot、wire attribution が dynamic という混在。
4. **persona scope**: Fire prompt の自己認識、ASR lexical bias、呼びかけ matcher、UI 表示まで soul identity に含めるかは未決。現行は同じ固定名を複数 owner が個別に保持する。
5. **voice scope**: numeric Aivis speaker を identity の一部にするか、voice は全 brain 共通のままにするかは未決。現行 TTS は brain を知らない。
6. **historical rewrite**: 名前を過去 transcript/memory に注入して表示する実装は、実際の発話本文を改変し得る。snapshot field の additive 追加と本文 rewrite は別問題。
7. **privacy/retention**: Codex rollout の provider-side retention と OS temp WAV の残留は、Claude/memory の現行境界とは別の retention surface。法務・権利の採否はこの inventory では判断しない。
8. **documentation drift**: README の旧 2 択記述 (`apps/soul/README.md:400-405`) と現行 4 registry の差は、identity mapping 実装時に誤った owner を参照するリスク。

## 9. Facts closable from repo

- 現行の soul 名は `コーディ（Cody）`、呼びかけ/ASR/UI にも同系の固定値がある。
- GPT 系 brain の選択肢は現行コードで 3 行（Terra/5.5/Sol）存在するが、`チャッピー` の文字列・mapping・prompt は無い。
- `BRAINS` entry、settings、TranscriptEntry、memory `.md`、TTS return はいずれも brain/name/voice を一体で保存しない。
- system prompt は session 作成時に固定され、brain switch/memory toggle は session dispose→次回 Fire 再生成で反映される。
- soul transcript/usage の SSE brain は broadcast 時 current 値で、in-flight mismatch はコードコメントで既知・v0 運用（配信前選択）では許容扱い。
- memory は全量 transcript の one-shot digest、viewer 名除去、timestamp-only md、起動時最新 3 件の system prompt 合成である。
- Claude は `persistSession:false`、Codex は rollout 自動永続＋自分の thread ID だけの best-effort 掃除である。
- TTS speaker は numeric で、speaker/name/brain の persistence は無い。WAV は OS temp に作られ、現行経路では明示削除されない。
- source/test/accepted artifact から、identity の採用単位、過去履歴の表示規則、voice/persona を identity に含めるかは閉じない。

## 10. Premises requiring user decision

採用案ではなく、次工程で明示的に決める必要がある前提:

1. `チャッピー` を GPT 系列全体に適用するか、`codex` の各 model 行（Terra/5.5/Sol）に個別名を持たせるか。
2. 名前の source of truth を registry に置くか、user-editable settings にするか。既存 settings 失敗時の fallback も含む。
3. brain/name switch を配信前限定にするか、live/in-flight で切り替えるか。切替時に旧 session の prompt/Thread をどこで閉じるか。
4. transcript/SSE/usage/memory digest に「生成した brain/name」を snapshot 保存するか、現在値で表示するか。旧データの `unknown` 表示を許容するか。
5. Fire self-recognition、Whisper bias、呼びかけ matcher、UI header/title、persona wording を同じ identity に含めるか、固定共通語彙として残すか。
6. TTS speaker/voice を identity に含めるか。含める場合、numeric speaker と名前の registry、settings persistence、restart/in-flight semantics を決めるか。
7. Codex rollout の provider-side retention と OS temp WAV の cleanup を privacy boundary として許容するか、追加の cleanup/disable 要件を置くか。
8. viewer displayName の live prompt/SSE/diagnostic 露出を現状維持するか。memory だけ匿名化する現行境界を identity migration 後も維持するか。

## 11. Evidence index and limitations

### Evidence index

- Identity and model registry: `apps/soul/agent/src/mind/brains.mjs:15-32,47-90`; tests `src/mind/brains.test.mjs:16-39,93-128`.
- Session prompt/persistence: `src/mind/llm-session.mjs:20-29,43-49,145-197,249-293`; `src/mind/codex-session.mjs:9-45,230-269,322-460`.
- Fire/name/persona: `src/mind/fire-orchestrator.mjs:134-154,333-367,455-465`; `src/mind/fire-scheduler.mjs:183-218`; `src/ears/whisper-inference.mjs:40-50`.
- Transcript/wire/current brain: `src/ears/transcript-buffer.mjs:29-47,70-92,147-180`; `src/mind/fire-injection.mjs:43-58,73-123`; `src/cockpit/cockpit-server.mjs:530-582,1283-1331`.
- Memory: `src/mind/memory.mjs:20-34,83-140,144-178,181-253`; `scripts/cockpit.mjs:780-887,1000-1016`; `apps/soul/agent/.gitignore:37-41`.
- TTS/recording: `src/voice/tts-client.mjs:25-27,94-110,120-167`; `src/voice/speak.mjs:31-51,74-125`; `src/voice/audio-player.mjs:165-184,221-230,299-328`; `.gitignore:18-25`.
- Existing decisions/history: `discussion/ai-cohost/soul/brain-swap.md:7-18`; `discussion/ai-cohost/soul/stream-memory.md:14-25`; `discussion/ai-cohost/implementation/orchestration/brain-swap-wave-plan.md:7-20`; `stream-memory-wave-plan.md:7-19`; historical README `apps/soul/README.md:394-416,469-497`.

### Limitations

- 実 provider への送信、Codex rollout の本文、実配信 memory の内容は開かず、source/test と accepted artifact の構造だけを確認した。Codex rollout の本文に含まれる provider 内部 metadata の詳細は repo fact ではない。
- local ignored settings/ledger の存在は read-only で確認したが、秘密値はこの report に再掲しない。`memories/` と `recordings/` の実データは調査時点で存在しなかった。
- ここでは identity mapping の採用・実装順序・法務判断・外部 provider の retention policy を決めていない。
