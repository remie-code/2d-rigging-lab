; fire-hotkey.ahk — 魂の発火グローバルホットキー（S3・AutoHotkey v2）
;
; ゲーム中（操縦席タブが非フォーカスでも）グローバルキー 1 発で魂を発火させる。
; 押すと操縦席サーバの POST http://127.0.0.1:<port>/api/fire を叩くだけの最小スクリプト。
; **127.0.0.1（自分の PC の中）以外へは何も送らない。**
;
; ── 導入手順（任意・人間ゲートは操縦席の Fire ボタンだけで成立する）──────────────
;   1. AutoHotkey v2 をインストールする（https://www.autohotkey.com/ → v2.0）。
;   2. 操縦席を fire 有効で起動しておく:
;        npm run cockpit --prefix apps/soul/agent -- --channel "ws://127.0.0.1:<port>/channel?token=..."
;   3. このファイルをダブルクリック（または右クリック → Run script）。
;   4. 下のホットキー（既定 Ctrl+Alt+F）を押す → 魂が直前の会話を踏まえて喋る。
;      busy 中（思考中/発話中）の発火はサーバ側で無視される（連打しても安全）。
;
; ── カスタマイズ ─────────────────────────────────────────────────────
;   ポート: 操縦席を --port で変えたら下の CockpitPort を合わせる。
;   キー:   下の Hotkey 行を編集する（AHK v2 記法: ^=Ctrl, !=Alt, +=Shift, #=Win。
;           例: "F13::" 単独キー / "^!f::" Ctrl+Alt+F / "+F9::" Shift+F9）。
;           Stream Deck 等に割り当てる場合は F13〜F24 の未使用キーを送らせるのが衝突しにくい。

#Requires AutoHotkey v2.0
#SingleInstance Force

CockpitPort := 8181  ; 操縦席のポート（--port を変えたらここも変える）。

; 既定ホットキー: Ctrl+Alt+F（編集しやすいように 1 行 1 キー）。
^!f:: FireSoul()
; F13 単独でも発火したい場合は次の行のコメントを外す（Stream Deck 向け）:
; F13:: FireSoul()

FireSoul() {
    global CockpitPort
    try {
        req := ComObject("WinHttp.WinHttpRequest.5.1")
        ; 第 3 引数 true = 非同期送信（ゲームを一瞬も止めない・応答は読まない）。
        req.Open("POST", "http://127.0.0.1:" CockpitPort "/api/fire", true)
        req.SetRequestHeader("Content-Type", "application/json")
        req.Send("{}")
    } catch {
        ; 操縦席が立っていない等。ゲーム中に邪魔しない（通知なしで握る）。
    }
}
