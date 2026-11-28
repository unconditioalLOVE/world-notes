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

- 同期は「今すぐ同期」か「この端末の内容でクラウドを上書き」を押した時だけ行います。自動では送受信しません。
- 編集した端末で「今すぐ同期」を押し、次に受け取る端末でも「今すぐ同期」を押すと反映されます。
- 初めてログインした端末にデータがあり、クラウドにもデータがある場合は、どちらを採用するか確認が出ます。
- 圏外では今まで通り使えます。つながってから「今すぐ同期」を押してください（圏外で開いた場合は、つながってから開き直してください）。
- 複数の端末でそれぞれ編集してから同期すると、どちらを残すか確認が出ます（世界ランキングは両方残ります）。
