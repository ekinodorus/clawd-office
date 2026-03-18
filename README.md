# clawd-office

複数の AI エージェント（Claude Code SDK）がオフィスで働く様子をリアルタイムに可視化するローカルツール。

ブラウザ UI からエージェントの作成・プロンプト送信・状態監視・権限管理を行える。

## 主な機能

- **マルチエージェント管理** — 複数エージェントの同時作成・削除・リネーム
- **PixiJS オフィス可視化** — ピクセルアートでエージェントの状態をリアルタイム表示
- **チャット UI** — エージェントごとのプロンプト送信・ストリーミング応答表示
- **権限制御** — `default` / `acceptEdits` / `plan` / `bypassPermissions` の 4 モード切替
- **サブエージェント** — 親エージェントが生成した子エージェントをミニスプライトで可視化
- **作業ディレクトリ & Git** — ディレクトリ指定・ブランチ名の自動検出

## 前提条件

- Python 3.11+
- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) の認証設定済み

## セットアップ

```bash
git clone https://github.com/ekinodorus/clawd-office.git
cd clawd-office

# クライアント
cd client
npm install
npx vite build
cd ..

# サーバー
cd server
pip install -r requirements.txt
cd ..
```

## 起動

```bash
cd server
python -m src.main
```

ブラウザが `http://localhost:8000` で自動的に開く。

### 開発モード

フロントエンドの HMR（ホットリロード）を使いたい場合:

```bash
# ターミナル 1
cd server && python -m src.main --dev

# ターミナル 2
cd client && npm run dev
```

`http://localhost:5173` にアクセス。

## アーキテクチャ

```
Browser (localhost:8000)
  │
  │  Socket.IO (WebSocket)
  │
  ▼
FastAPI + Socket.IO
  ├── client/dist/ を静的配信
  │
  └── claude_code_sdk.query()
      → Claude Code SDK（ローカル認証情報を使用）
```

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | React 19 + TypeScript + PixiJS 8 |
| リアルタイム通信 | Socket.IO |
| バックエンド | Python FastAPI + Uvicorn |
| AI 実行 | Claude Code SDK |
| ビルドツール | Vite 6 |

## テスト

```bash
# サーバー
cd server && python -m pytest

# クライアント
cd client && npx vitest run
```

## セキュリティ

- サーバーは `127.0.0.1` にのみバインド（外部アクセス不可）
- CORS を localhost に制限
- Python 依存パッケージはバージョン固定
- エージェントごとに権限モードを設定可能

## ライセンス

MIT
