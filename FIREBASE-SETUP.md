# 端末間の同期（Firebase）セットアップ

1. https://console.firebase.google.com で「プロジェクトを追加」（Googleアナリティクスは不要）。
2. **Authentication** → 「始める」→ ログイン方法で **メール/パスワード** を有効化。
3. **Firestore Database** → 「データベースを作成」→ 本番環境モード → ロケーションは asia-northeast1（東京）など。
4. Firestore の「ルール」タブに下を貼って公開（自分のデータは自分だけが読み書きできます）:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

5. プロジェクトの設定 → 「マイアプリ」→ ウェブ(</>)を追加 → 表示される設定値を、`firebase-config.js` に貼る:

```js
window.WN_FIREBASE = {
  apiKey: "...",
  authDomain: "xxxx.firebaseapp.com",
  projectId: "xxxx",
  appId: "..."
};
```
（apiKey は公開されても問題ありません。守っているのは上のルールです）

6. 5つのファイルを GitHub Pages に上げる。
7. アプリの レイヤー → 「同期」 → 新規登録（初回）／ログイン。他の端末でも同じアカウントでログイン。

- クラウドに保存するのは「この端末の内容でクラウドを上書き」を押した時だけです。
- 「今すぐ同期」はクラウドを書き換えず、この端末を最後に上書き保存した内容に置き換えます（この端末の方が作業が進んでいても同じです）。
- この端末に保存していない内容がある場合は、置き換える前に確認が出ます。
- 自動では保存も同期もしません。
- 圏外では今まで通り使えます。保存や同期は、つながってから行ってください（圏外で開いた場合は、つながってから開き直してください）。

---

## Gemini AI（世界統計の自動入力）

APIキーを `index.html` / `app.js` や GitHub 公開ファイルに書かないでください。

### 方法A（簡単・ローカル用）
`firebase-config.js` に次を追加（このファイルは公開リポジトリに上げない）:

```js
window.WN_GEMINI = {
  apiKey: "あなたのGemini APIキー",
  model: "gemini-2.0-flash"
};
```

APIキーは https://aistudio.google.com/apikey で取得できます。

### 方法B（推奨・本番）
Cloud Functions などでプロキシを用意し:

```js
window.WN_GEMINI = {
  proxyUrl: "https://YOUR_REGION-world-notes-321ad.cloudfunctions.net/geminiStats",
  model: "gemini-2.0-flash"
};
```

プロキシ側で Gemini API を呼び、クライアントにはキーを渡さない構成にしてください。

Firebase AI Logic / App Check を使う場合も、キーはサーバー側に置いてください。
