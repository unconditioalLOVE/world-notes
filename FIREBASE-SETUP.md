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

- 変更は約2秒後に送信され、他の端末へほぼリアルタイムで反映されます。
- 初めてログインした端末にデータがあり、クラウドにもデータがある場合は、どちらを採用するか確認が出ます。
- 圏外では今まで通り使え、つながると自動で同期します。
- 同時に別々の端末で編集すると、後から保存した方が採用されます。
