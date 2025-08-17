# Image Editor MCP Server

画像編集機能を提供するMCP (Model Context Protocol) サーバーです。AIアシスタントが画像ファイルの編集操作を実行できるようにします。

## 機能

- **明るさ調整**: 画像を明るくしたり暗くしたりできます
- **トリミング**: 指定した範囲で画像を切り取ります
- **圧縮**: JPG、PNG、WebP形式の画像を圧縮してファイルサイズを削減します

## インストール

```bash
cd image-editor-mcp
npm install
npm run build
```

## 使い方

### 開発

```bash
# ビルド
npm run build
```

### サーバーの起動

画像ファイルが格納されているディレクトリを指定して起動します：

```bash
npm start -- /path/to/images
```

### MCP クライアントでの設定

MCP対応のAIアシスタント（Claudeデスクトップアプリ）の設定ファイルに以下を追加：

```json
{
  "mcpServers": {
    "image-editor": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/PROJECT/image-editor-mcp/build/index.js",
        "/ABSOLUTE/PATH/TO/YOUR/IMAGE_FOLDER"
      ]
    }
  }
}
```

## 提供されるツール

### adjust_brightness
画像の明るさを調整します。

パラメータ:
- `fileName`: 編集する画像ファイル名
- `level`: "brighter" (明るく) または "darker" (暗く)

### crop_image
画像を指定範囲でトリミングします。

パラメータ:
- `fileName`: トリミングする画像ファイル名
- `left`: 左上のX座標
- `top`: 左上のY座標
- `width`: 切り取る幅
- `height`: 切り取る高さ

### compress_image
画像を圧縮してファイルサイズを削減します。

パラメータ:
- `fileName`: 圧縮する画像ファイル名
- `quality`: 品質（1-100、低いほど高圧縮）

## 技術スタック

- TypeScript
- Node.js
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - MCP実装
- [Sharp](https://sharp.pixelplumbing.com/) - 高性能画像処理
- [Zod](https://zod.dev/) - スキーマ検証

## セキュリティ

- 指定されたディレクトリ外のファイルへのアクセスを防ぐディレクトリトラバーサル対策を実装
- 安全なファイルパス検証

## ライセンス

ISC



## 要件

- Node.js 18以上
- npm または yarn
