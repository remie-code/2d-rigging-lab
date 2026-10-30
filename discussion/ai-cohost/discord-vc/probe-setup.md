# 受信の試しの準備: Bot を作って鍵を置く(ユーザーの作業、Undine 2026-10-30)

> 状態: 手順のたたき台。ユーザーがこれに沿って作業する。Developer Portal の画面の名前は、うちの知識と調査([research/discord-voice-bot-2026-10.md](research/discord-voice-bot-2026-10.md))からで、2026-10 の実画面では確かめていない。
> 決まりごと: 鍵(Bot token)はチャットにもログにも出さない。エージェントは鍵のファイルの中身を読まない。

## 1. 試す場所を決める

- 推奨: 試し専用の Discord サーバーを新しく作る(自分だけがいるサーバー)。仲間の声を試しに巻き込まないため。
- 調べたい不具合(すでに VC にいた人が、Bot が入った直後にしゃべると受け取れない)は、あなた 1 人で再現できる。先に VC に入っておき、Bot が入ったらすぐしゃべればよい。

## 2. アプリと Bot を作る(Developer Portal)

1. https://discord.com/developers/applications を開き、New Application。名前は例えば「チャッピー」。
2. Bot の画面で:
   - **Public Bot を OFF**(あなた以外がサーバーに招待できないようにする)。
   - **Requires OAuth2 Code Grant は OFF のまま。**
   - **Privileged Gateway Intents(Presence / Server Members / Message Content)は 3 つとも OFF のまま。** 要るのは GUILDS と GUILD_VOICE_STATES だけで、どちらも特権ではない。
   - Reset Token で鍵を出す。**表示は 1 回きり**なので、そのまま次の 3 のファイルに貼る。

## 3. 鍵のファイルを置く

- 置き場: `apps/soul/agent/.env.discord.local`(`apps/soul/agent/.gitignore` の `.env*.local` で git に入らないことを確かめ済み)。
- 中身は 1 行: `DISCORD_BOT_TOKEN=<貼った鍵>`
- エディタで作る。シェルの echo などで作ると、履歴に鍵が残る。
- 鍵が漏れたと思ったら、Portal で Reset Token すれば古い鍵は使えなくなる。

## 4. Bot をサーバーに招待する

1. Portal の OAuth2 → URL Generator で、スコープは **`bot`** だけを選ぶ。
2. 権限は **View Channels・Connect・Speak** の 3 つだけ(Administrator は付けない)。
3. 出てきた URL をブラウザで開き、1 で作ったサーバーを選んで認可する。

## 5. 試しに渡す ID を控える(秘密ではない)

- Discord の設定 → 詳細設定 → 開発者モードを ON。
- サーバー名を右クリック → ID をコピー(guild id)、試す VC を右クリック → ID をコピー(channel id)。
- この 2 つは鍵ではないので、チャットで伝えてよい。

## 6. 試しの前に決めておくこと(試しの計画のときに扱う)

- 開発者規約のプライバシーポリシーの義務: 自分だけのサーバーでの試しでどこまで要るか【未確認】。仲間を入れる前には必ず扱う。
