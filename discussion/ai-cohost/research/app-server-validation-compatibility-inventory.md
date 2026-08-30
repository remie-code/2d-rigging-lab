# Codex App Server validation compatibility inventory

- 調査日: 2026-08-30（Asia/Tokyo）
- 対象: `apps/soul/agent/src/mind/codex-session.mjs` の App Server stdio transport と、その fake/test
- 性格: Wave 1A 限定是正ループへ渡す bounded inventory。製品コード・テスト・設定の変更は行わない
- 情報区分: **Repository fact / Observed runtime fact / Generated-schema fact / Inference / Recommendation**

## Executive verdict

**現在の fatal 境界は広すぎ、実 App Server 0.144.5 の正常な wire message を最初の `initialize` response で拒否している。build 不足ではない。**

直接原因は、adapter が全受信 object に `message.jsonrpc === "2.0"` を要求する一方、実 0.144.5 の bounded 観測では initialize response が `{"id":1,"result":...}` で `jsonrpc` を省略することにある（`apps/soul/agent/src/mind/codex-session.mjs:269-286`）。さらに、同梱 0.144.5 自身が生成した JSON Schema も `JSONRPCResponse` を `id,result`、error response を `error,id`、notification を `method`、request を `id,method` で定義し、`jsonrpc` field を properties に含めない。したがって `jsonrpc` の存在・値を transport 正常性の条件にする根拠はなく、これは分類 **(d) 根拠のない過剰検査**である。

是正は単なる optional 化に留めず、fatal を「connection を失った、または line framing/JSON decode の破損により相関対象を復元できない」場合へ限定するべきである。known request の RPC error・必要 result field の欠落・active turn に属する relevant event の不整合・delta/final 不一致・非成功 terminal status は **(b) 当該 request/turn の失敗**に留める。unknown response、unknown notification、別 thread/turn・old generation の message、未利用 field の欠落は **(c) 診断して無視**を基本にする。

既存 fake は response・RPC error・notification の全てへ人工的に `jsonrpc:"2.0"` を付けており、実 wire contract ではなく実装側の想定を自己証明していた（`apps/soul/agent/src/mind/codex-session.test.mjs:36-40`; `apps/soul/agent/src/mind/brains.test.mjs:79-100`）。実 protocol を構造だけ保存した fixture と、是正直後の product path smoke が必要である。

## Scope and classification rule

本稿の四分類は次の意味で使う。

| class | 意味 | 推奨される状態影響 |
|---|---|---|
| (a) | transport/session 安全性・liveness のため connection fatal が必要 | active ask reject、connection/thread を無効化、child を確実に reap。次 ask は新 process/thread |
| (b) | 当該 request/turn だけ失敗させる必要がある | request または active turn を reject。会話状態が不確かな場合は owned thread を終了して新 thread とするが、message 一件だけを理由に process 全体を壊さない |
| (c) | 診断して無視できる | active request/turn と connection state を変更しない。本文を残さない bounded diagnostic のみ |
| (d) | 根拠のない過剰検査 | fatal 条件から除去。必要なら consumer が実際に使う field の地点別検査へ置換 |

この分類は protocol の形式純度ではなく、通常利用で安全に体験へ到達できることを基準にする。

## Evidence basis

### Repository facts

- installed dependency は `@openai/codex-sdk` 0.144.5 で、lock は `@openai/codex` と win32-x64 binary を 0.144.5 に固定する（`apps/soul/agent/package.json:13`; `apps/soul/agent/package-lock.json:230-247,318-325,348-350`）。
- adapter は `StringDecoder("utf8")` と line buffer で fragmented UTF-8/JSONL を復元し、LF ごとに `JSON.parse` する（`codex-session.mjs:195-197,251-274`）。
- parse/validation callback の `fail()` は session の `onFatal` に渡り、current connection/thread/first-turn state を消去して child close を reset barrier に入れ、active ask も reject する（`:325-350,406-430,528-532`）。notification handler 内の `failTurn()` も同じ connection invalidation を行う（`:421-430,511-512`）。つまり現在の `protocolError` の大半は、名称にかかわらず process/thread 全廃棄である。
- request 単体の reject は connection を直接閉じないが、`initialize`、`thread/start`、`turn/start` の呼出側は最終的に connection を invalidate する（`:244-248,535-552,588-613`）。dispose 中の interrupt/delete failure だけは best-effort として握りつぶす（`:631-638`）。
- Wave 1A 完了記録は「unknown well-formed notifications は無視」「failed/interrupted、malformed message、stderr drain、truncated EOF 等を扱う」としているが、実 LLM turn は実装 wave では行わず fake/probe-shaped tests のみだった（`discussion/ai-cohost/implementation/waves/codex-progressive-speech/wave1a-app-server-transport.md:25-28,126-147`）。

### Observed runtime facts

- 既存 probe は同梱 `codex.exe` 0.144.5 を `app-server --stdio` で起動し、`initialize` → `initialized` を成功させた（`discussion/ai-cohost/experiments/codex-app-server-streaming-probe.md:4-6,19-25`）。
- 既存 lossless collector は `turn/started` → user item start/completion → agent item start → delta 群 → agent item completion → `turn/completed` を観測し、450 delta の順序 append と完成 text の一致を確認した（同 `:43-55,67-92`）。
- 既存 collector は raw stdout、prompt、delta/response 本文を外へ保存していないため、notification envelope の全 key や `thread/start` / `turn/start` response envelope は repository evidence だけでは復元できない（同 `:7,69-71,103-107`）。
- 今回の発火原因として共有された bounded 実機観測では、initialize response は `{"id":1,"result":...}` で `jsonrpc` field を含まなかった。この観測は本文を含まない envelope fact である。

### Generated-schema facts

本 inventory 中、installed 0.144.5 binary の read-only tooling `codex app-server generate-json-schema --out <OS temp>` を実行した。出力は確認後に OS temp から削除し、repository へ保存していない。

- `JSONRPCResponse`: required/properties は `id,result`。
- `JSONRPCError`: required/properties は `error,id`。
- `JSONRPCRequest`: required は `id,method`、properties は `id,method,params,trace`。
- `JSONRPCNotification`: required は `method`、properties は `method,params`。
- `RequestId`: string または integer。
- `ServerNotification` の各 variant は `method,params` を要求するが `jsonrpc` は持たない。
- `ServerRequest` の各 variant は `id,method,params` を要求するが `jsonrpc` は持たない。
- payload schema の required fields は、`ThreadStartResponse` が少なくとも `thread`、`TurnStartResponse` が `turn`、delta が `delta,itemId,threadId,turnId`、item start/completion が `item,threadId,turnId` と時刻、error notification が `error,threadId,turnId,willRetry`、turn completion が `threadId,turn`。`TurnStatus` enum は `completed`, `interrupted`, `failed`, `inProgress`。

**Inference:** schema は serializer の全 runtime 挙動を単独では証明しないが、実 initialize line の `jsonrpc` 省略と一致する。また、`jsonrpc:"1.0"` 等を拒否すべきという product/session-safety 根拠は schema、runtime 観測、consumer needs のいずれにもない。

## Current receive and state flow

```text
stdout bytes
  -> UTF-8 StringDecoder + LF buffer
  -> JSON.parse(line)
  -> global jsonrpc==2.0 gate
  -> id without method: response correlation
     id + string method: unsupported server-request reply
     string method without id: notification dispatch
  -> generation/active guard
  -> recognized turn-scoped method guard
  -> thread/turn correlation
  -> item/delta/error/terminal validation
  -> turn resolve OR failTurn
```

現在は global gate または notification validation の一箇所でも throw すると、当該 turn だけでなく connection/thread が破棄される（`codex-session.mjs:260-276,325-350,406-430,511-512`）。この広がりが、今回の正常 initialize response を Fire 到達前に止めた。

## Validation matrix

| Receive point / validation | Current behavior and evidence | Recommended class | Reason / required state effect |
|---|---|---|---|
| spawn throw / piped stdio missing | start failure（`:205-214`） | (a) | 通信路が成立しない。ask を失敗させ、process/thread を作り直すしかない |
| child `error` / unexpected `exit` / stdout `error` | connection fatal（`:216-231`） | (a) | pending response/terminal eventを受け取れず、session liveness を失う |
| clean unexpected stdout EOF | connection fatal（`:233-243`） | (a) | server transport が閉じた。active turn を成功扱いできない |
| EOF with buffered nonblank tail | `truncated JSONL` fatal（`:233-243`） | (a) | 最終 line の相関対象を復元できない。完全な JSON でも LF がなければ JSONL record として未完了扱いでよい |
| fragmented bytes / multibyte UTF-8 / CRLF / blank lines | buffer して復元、blank 無視（`:251-267`） | (c) | 現処理は互換的。fragment 自体を malformed としない |
| newline-terminated invalid JSON | global fatal（`:269-275`） | (a) | response/terminal event が壊れた可能性を区別できず、無視すると request/turn が無期限化し得る |
| valid JSON primitive/null/array | `expected JSON-RPC object` fatal（`:276`） | (c) | line framing は維持され、相関可能な message ではない。本文なしで診断し無視できる |
| every object must have `jsonrpc:"2.0"` | global fatal（`:276`） | **(d)** | 実 0.144.5 と generated schema の正常 envelope に反する。存在時の値も consumer state に使わない |
| known response ID + RPC `error` | pending request reject（`:277-285`） | (b) | 対象 request の server-declared failure。initialize/thread/turn startならcallerがその lifecycle を中止する |
| known response ID + `result` | arbitrary result を resolve（`:285`） | consumer pointで(b) | global schema validation不要。実際に使う field を lifecycle consumer で検査する |
| known response with neither result nor error | pending request reject（`:285-286`） | (b) | 対象 request を完了できない。connection 全体のdecodeは壊れていない |
| response has both result and error | truthy errorを優先（`:282-285`） | (b) + diagnostic | schema外だが対象 request failureとして閉じられる。process fatalの根拠はない |
| pending request timeout | pending mapから削除しrequest reject（`:297-305`） | (b) | 対象requestのliveness failure。lifecycle callerが必要なthread/turn recoveryを行う。遅延responseは次行のとおり無視 |
| unknown / duplicate / timeout後late response ID | global fatal（`:278-280`; timeout deletion `:297-305`） | (c) | current pending stateを変更できない。late responseは正常なtimeout raceでも発生する。IDとkindだけ診断し無視 |
| response ID type | Map exact matchのみ、明示type checkなし（`:277-280`） | (c) unless known | schemaはstring/integer。known keyなら処理、unknownなら上記のとおり無視で足りる |
| server request (`id` + string `method`) | `-32601` を返して継続（`:289-291`） | (c) | approval `never` / read-only pathで未対応requestを明示拒否する現在の方針はnonfatal。method/ID/paramsのみ診断可能 |
| unsupported server-request reply write failure | accept pathからglobal fatal（`:289-290,320-323,260-264`） | (a) | stdinが書けず双方向connectionが成立しない |
| object missing/non-string method and not a usable response | global fatal（`:293-295`） | (c), known IDなら(b) | id/result/errorでknown requestへ結び付くならそのrequestを失敗。それ以外は相関不能な一行として診断・無視 |
| unknown well-formed notification | 無言でignore（`:433-440`） | (c) | additive protocol compatibilityに必要。methodだけのbounded diagnosticは任意 |
| no active ask / settled ask / generation mismatch | ignore（`:433-435`） | (c) | late/stale generationがcurrent stateを変更しない正しい境界 |
| recognized notification before turn/start response | FIFO queue、turn ID確定後replay（`:441-443,597-605`） | (c) until correlated | 実fakeもこのorderingを使う。到着順だけでrejectしないのは正しい |
| recognized notification for different thread/turn | current turnをfailしconnection invalidation（`:445-448`） | (c) | unowned/stale/別turn eventはcurrent active stateへ適用せず無視すればよい。current turnを壊す根拠がない |
| recognized notification missing required thread/turn ID | mismatchとしてconnection invalidation（`:355-358,445-448`） | (b) if relevant current event, otherwise(c) | relevant eventをcurrent turnへ安全に適用できない場合だけturn failure。process全体fatalではない |
| `turn/started` payload | correlation以外は検査せずstate不変（`:437,445-450`） | (c) | terminal判定に使わない informational event。追加 strictness は不要 |
| `item/started` missing item identity | 全item typeでturn/connection failure（`:451-459`） | (b) for identifiable agentMessage; otherwise(c)/(d) | consumerはagentMessageだけ追跡する。非agent/判別不能itemへ一律fatal identity checkを掛ける必要はない |
| duplicate agent item start | turn/connection failure（`:454-456`） | (b) | deltaの帰属が曖昧。active turn output contractを安全に続けられない |
| delta missing `itemId`/string `delta` | turn/connection failure（`:461-465`） | (b) |発話候補textを安全に帰属・appendできない。対象turnを成功扱いしない |
| delta before agent start / after completion | turn/connection failure（`:464-465`） | (b) | item lifetime / append-only contract違反。対象turnだけ失敗 |
| `onTextDelta` consumer callback throws | notification failureからconnection invalidation（`:450-469,511-512`） | (b) | local consumerの当該turn失敗であり、server transport corruptionではない |
| `item/completed` missing generic item identity | 全item typeでturn/connection failure（`:472-478`） | (b) for identifiable agentMessage; otherwise(c)/(d) | agentMessage completionに必要なfieldだけ検査する。unused item typeを形式純度でfatalにしない |
| agent completed missing text / no matching live item / duplicate completion | turn/connection failure（`:475-480`） | (b) | final replyを構成できない、またはlifecycleが曖昧。対象turn failure |
| per-item delta concat != completed text | turn/connection failure（`:481`） | (b) |既に公開したappend-only deltaとauthoritative snapshotが不一致。successful streamed turnにはできない |
| usage payload missing/malformed | `usage=null` またはuntyped default（`:163-172,485-487`） | (c) | reply成立に不要。欠測を正直にnullとする現在の方向が妥当。数値型sanitizationは非fatalでよい |
| error notification invalid shape | turn/connection failure（`:489-493`） | (b) | retry/terminal意味を安全に解釈できない。対象turnを失敗させるがprocess fatalではない |
| error `willRetry:true` | ignore（`:494-495`） | (c) | serverが継続を宣言。terminal eventを待つ |
| error `willRetry:false` | turn/connection failure（`:494`） | (b) | server-declared turn failure。messageを本文診断へ保存しない既存方針を維持 |
| `turn/completed` missing/nonstring status | turn/connection failure（`:497-500`） | (b) | terminal successを判断できない。対象turnだけ失敗 |
| terminal `failed` / `interrupted` / unknown non-completed | turn/connection failure（`:500`） | (b) | completedだけを成功扱いするのは妥当。enumであることをconnection fatal条件にはしない |
| completed turn has no agent item / incomplete tracked item | turn/connection failure（`:501-505`） | (b) | final replyを構成できない。対象turn failure |
| all delta concat != joined final reply | turn/connection failure（`:506`） | (b) | streamed outputとfinal outputの整合がない。対象turn failure |
| no terminal notification | timeoutなしで無期限pending（`:579-581,608`） | missing guard; timeoutは(b) | bounded terminal timeout→best-effort interrupt→turn/thread終了が必要。interrupt/write/reapが不能なら(a)へ昇格 |
| initialize result shape | result property以外は未検査（`:244-248,285`） | (c) |現在consumerが使わないfieldを検査しないのは正しい |
| thread/start `result.thread.id` missing/empty | protocol error→connection invalidation（`:537-552`） | (b) |session threadを所有・相関できないためこのstartを失敗しfresh threadへ。ただしdecode層fatalではない |
| turn/start `result.turn.id` missing/empty | active reject→connection invalidation（`:588-613`） | (b) |notificationを安全に相関できないため当該turnを失敗。process fatalではない |
| stderr data | drainのみ、保持なし（`:227-229`） | (c) |stderr noiseはJSONL stdout contractと別。backpressureを防ぎ、本文・secretを保持しない |
| stderr stream error | listenerなし | (c), child failure時(a) |stderr diagnostics消失だけではturnを壊さない。child/stdout failureが伴えば既存(a)へ |
| TERM/KILL後もchildをreapできない | closeがerror（`:336-350`） | (a) | stale processとreplacementを並存させないreset barrierはsession safetyに必要 |

## Fake and validation-test compatibility gaps

### Repository facts

- 共通 fake の `response`、`rpcError`、`notification` は全て `jsonrpc:"2.0"` を自動付与する（`apps/soul/agent/src/mind/codex-session.test.mjs:36-40`）。`brains.test.mjs` の別 fake も同じ想定を複製する（`:79-100`）。省略形、別値、非objectのtestはない。
- fake の正常 result は initialize `{serverInfo:{name,version}}`、thread/start `{thread:{id}}`、turn/start `{turn:{id,status:"inProgress",items:[]}}` に固定される（`codex-session.test.mjs:74-86,98-106`）。実raw responseの採取fixtureではない。
- fake は turn/start handler 内で正常 notifications を同期送信してから response を返すため、happy testsの大半は `active.turnId === null` のqueue/replay pathを通る（`:97-106`; product path `codex-session.mjs:441-443,597-605`）。turn ID確定後に時間差で届く通常streamの専用testはない。
- `successfulTurn()` はagent itemだけを送り、実probeで観測されたuser item start/completionを省略する（test `:74-86`; probe `:43-55,88`）。
- fragmented JSONL / multibyte UTF-8とinvalid JSONはtest済みだが（test `:46-58,155-165,270-284`）、truncated EOF、clean stdout end、stdout error、stderr noiseは未test。child exitのみtestがある（`:254-267`）。
- unknown/duplicate/late response ID、server request、unknown notification、method欠落、string response ID、response result/error両欠落は未test。
- terminal statusはcompleted/failedだけ。interrupted、unknown status、error notificationのretry true/false/malformedは未test（`:74-86,236-250`）。
- result-shape missing/empty ID、RPC timeout/error、delta-before-start/after-complete、duplicate item lifecycle、複数agentMessage、unknown/user/reasoning/tool item、stale generation notificationは未test。dispose後late delta suppressionと`thread/delete` DB error containmentはtest済み（`:335-356,375-389`）。

**Inference:** 現在のpass数は、実 App Server compatibilityではなく、adapterと同じ仮定を持つfakeに対する内部整合性を示す。特にglobal `jsonrpc` gateについてはnegative evidenceを全く持たない。

## Minimum correction scope

### Recommendation: code boundary

変更対象は `apps/soul/agent/src/mind/codex-session.mjs` と `codex-session.test.mjs` を主とし、`brains.test.mjs` のduplicate fake envelopeだけ同期する。progressive speech全体の再設計へ広げない。

1. inbound routeを、実schemaどおり `id + result/error`、`id + string method`、`string method without id` のconsumer-needed shapeで判定し、`jsonrpc` presence/value gateを除去する。
2. unknown response ID、unknown notification、別thread/turn、old generationはcurrent active stateへ適用せず、本文なしでdiagnose/ignoreする。
3. malformed relevant active-turn event、non-success terminal、delta/final mismatch、required consumer ID欠落はturn failureとする。transport process fatalとは分ける。
4. process/stdout loss、stdin write failure、truncated/invalid JSONで相関recordを復元できない場合だけconnection fatalにする。
5. terminal waitへbounded timeoutを設ける。timeout時はbest-effort interrupt後にowned turn/threadを失敗として閉じ、transportをreapできない場合だけconnection fatalとする。
6. non-agent itemは利用しないfieldのstrict validationを避ける。agentMessageと、そのdelta/finalを構成するfieldだけを必要地点で検査する。

Connection processを再利用するかまでの実装詳細は、(b) failure後のthread会話状態に依存する。安全側の最小是正は「processは必ずしもfatalにしないが、failed/ambiguous owned turnのthreadは継続せずfresh threadへ」である。

### Required real-protocol fixture

fixtureは本文やsecretを含むraw JSONLではなく、0.144.5の各lineを受信直後に次へ構造redactしたものにする。

```json
{
  "direction": "server-to-client",
  "kind": "response|notification|serverRequest",
  "method": "item/agentMessage/delta",
  "idType": "integer",
  "topLevelKeys": ["method", "params"],
  "jsonrpc": { "present": false },
  "paramsOrResultKeys": ["delta", "itemId", "threadId", "turnId"],
  "fieldTypes": { "delta": "string", "itemId": "string", "threadId": "string", "turnId": "string" }
}
```

delta/prompt/response text、path、account ID、token、quota値はfixtureへ保存しない。text fieldはtypeだけを残す。最低限、initialize response、thread/start response、turn/start response、turn/started、user item start/completion、agent item start、agent delta、agent item completion、token usage（発生時）、turn/completedを含める。server requestは発生時だけ同形式で記録し、発生させるためのtool/approval実験は追加しない。

### Focused tests

最低限のfocused acceptanceは次である。

1. 実fixtureと同じ `jsonrpc` 省略response/notificationで initialize→thread/start→turn/start→completed が成功する。
2. `jsonrpc:"2.0"` が付いていても additive extra field として成功する。別値があっても、それだけではturn/connectionを失敗させない。
3. fragmented UTF-8/JSONLは従来どおり復元し、invalid/truncated JSONLとstdout/process lossだけがconnection fatalになる。
4. unknown/duplicate/late response ID、unknown notification、別thread/turn、old generationはcurrent turnを壊さない。
5. server requestへunsupported errorを返してもconnectionを維持し、reply write failureだけfatalになる。
6. missing method/params/IDsを、known request failure、relevant current-turn failure、unowned diagnostic ignoreへ分ける。
7. agent delta lifetime、duplicate lifecycle、delta/item/final mismatch、missing final textは当該turn failure。user/unknown non-agent itemは無害に通過する。
8. error retry trueは継続、retry false・failed/interrupted/unknown terminalは当該turn failure。terminal欠落はbounded timeoutする。
9. thread/start/turn/start missing/empty IDsは当該lifecycle失敗し、次askがfresh threadで回復する。
10. stderr noiseはdrainされ、本文保存・turn failureを起こさない。

既存の広い回帰laneはfocused testと実機smokeの後に一度だけ実行すればよい。今回のcompatibilityを証明しないfake-only pass数を、実機確認より先のgateにしない。

### Minimum real smoke and acceptance evidence

是正直後、通常 product args/path で一回だけ次を行う。

1. bundled 0.144.5を起動し、initialize→initialized→thread/startを通過する。
2. `gpt-5.6-sol` / `low` / vision一枚 / read-only / network false / approval neverで一回のFireを行う。
3. agent deltaがcompleted前に到着し、item concatとcompleted text、全agent concatと返却replyが一致する。
4. `turn/completed.status === "completed"` でFireがerrorではなくreplyへ到達する。
5. structural collectorが上記fixture用のkey/typeだけを採取し、prompt・response・delta本文、account情報、secretを保存していないことを確認する。
6. disposeでactive resourceを閉じ、既知の0.144.5 `thread/delete` DB errorが起きてもchildをreapし、推測によるDB mutationを行わない（既存観測 `codex-app-server-streaming-probe.md:97-109`; current containment `codex-session.mjs:631-651`）。

この一回を「human smoke + structural contract capture」と兼用し、envelope確認だけの別LLM probeは増やさない。

## Explicit non-scope

- progressive speech全体、sentence splitting/TTS/partial transcript/NG-tag policyは非対象。
- Claude経路は非対象。
- 4096-byte上限はこのstdio App Server initialize errorと無関係。
- Runtime Player buildはこのerrorと無関係。`codex-session.mjs` は直接実行されるため、是正反映に必要なのはSoul/Cockpit process再起動であり、このerrorを直すためのRuntime Player buildではない。

## Wave 1A是正ループへ渡す確定入力

1. 実0.144.5 initialize responseは`jsonrpc`を省略し、current global gateで必ず拒否される。
2. installed 0.144.5 generated schemaもresponse/request/notification envelopeに`jsonrpc`を定義しない。
3. fakeは全messageへ`jsonrpc:"2.0"`を人工付与し、実wire差を隠した。
4. current validation failureの多くは当該turnではなくprocess/thread全廃棄へ拡大する。
5. fatal境界はprocess/stdio loss、write failure、復元不能なJSONL破損へ限定する。
6. relevant current-turn semantic failureはturn failure、unknown/unowned/stale/additive messageはdiagnose/ignoreとする。
7. 実protocol structural fixture、focused compatibility tests、是正直後の一回のSol/low/vision Fireがacceptance evidenceである。

## 未解決だがユーザー判断不要の技術事項

- 実notification、thread/start、turn/startの全top-level key setは既存repo evidenceへ保存されていない。是正後smokeのstructural captureで閉じる。
- (b) failure後に同processでfresh threadを作る実装が、current close/reset barrierを崩さず最小変更で可能か。focused lifecycle testで閉じる。
- terminal timeout値とinterrupt/reap順序。既存RPC/shutdown timeoutと一回のsmoke timingを基にbounded testで閉じる。
- stderr stream自体のerror listener追加が必要か。child/stdout lifecycle testで閉じる。

## ユーザー判断が本当に必要な事項

none。今回の限定是正は、既に合意された「protocol純度より安全な体験到達を優先し、根拠のないdefensive validationで実験を止めない」の範囲で技術的に閉じられる。

## Inventory operations and hygiene

- repository/source/test/reportをread-only調査した。
- installed 0.144.5のJSON Schema生成だけをOS tempで実施し、確認後にその一時directoryを削除した。
- App Server processのinitialize probe、thread作成、実LLM turn、web/tool/file-change turnは実行していない。
- prompt・response・delta本文、secret、account identifier、quota値は取得・保存していない。
- 製品コード・テスト・設定・既存レポートは変更していない。本inventoryが作成したrepository fileは本レポートだけである。
