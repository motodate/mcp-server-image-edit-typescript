# 画像編集MCPサーバー（image-editor-mcp）作成ガイド

指定された要件に基づき、画像を編集するMCPサーバー `image-editor-mcp` をTypeScriptで作成します。画像編集ライブラリ `sharp` を利用し、「明るさ調整」「トリミング」「圧縮」の3つの機能を持つToolsを実装します。

## 1. プロジェクトのセットアップ

まず、MCPサーバーを開発するための環境を構築します。

### a. ディレクトリの作成と初期化

ターミナルを開き、以下のコマンドを実行してプロジェクトを作成します。

```
# プロジェクトディレクトリを作成して移動
mkdir image-editor-mcp
cd image-editor-mcp

# npmプロジェクトを初期化
npm init -y

# ソースコード用のディレクトリを作成
mkdir src

```

### b. 必要なライブラリのインストール

MCP SDK、画像編集ライブラリ`sharp`、スキーマ定義ライブラリ`zod`などをインストールします。

```
# 本番環境で必要なライブラリ
npm install @modelcontextprotocol/sdk sharp zod

# 開発環境で必要なライブラリ（TypeScript関連）
npm install -D typescript @types/node

```

### c. TypeScriptの設定

プロジェクトのルートディレクトリに `tsconfig.json` ファイルを作成し、以下の内容を記述します。これにより、TypeScriptのコンパイル設定が行われます。

```
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}

```

### d. package.jsonの編集

`package.json` ファイルを開き、`"type": "module"` の追加と、ビルド用のスクリプトを追記します。ご自身の環境に合わせて依存関係のバージョンは調整してください。

```
{
  "name": "image-editor-mcp",
  "version": "1.0.0",
  "description": "An MCP server to edit images.",
  "main": "build/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node build/index.js"
  },
  "keywords": [
    "mcp",
    "ai",
    "image-editing"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.3",
    "sharp": "^0.34.3",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/node": "^24.3.0",
    "typescript": "^5.9.2"
  }
}

```

## 2. MCPサーバーのコード作成

`src/index.ts` ファイルを作成し、以下のコードを記述します。これがMCPサーバー本体のコードです。

```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sharp from "sharp";
import path from "path";
import fs from "fs";

// --- サーバーの初期化 ---
const server = new McpServer({
  name: "image-editor-mcp",
  version: "1.0.0",
});

// --- コマンドライン引数から画像フォルダのパスを取得 ---
// 最初の2つの引数 (node, index.js) を除いたものが実際の引数
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("エラー: 画像フォルダのパスを引数で指定してください。");
  process.exit(1);
}
const imageDirectory = path.resolve(args[0]);

// 指定されたディレクトリが存在するか確認
if (!fs.existsSync(imageDirectory) || !fs.lstatSync(imageDirectory).isDirectory()) {
  console.error(`エラー: 指定されたディレクトリが見つかりません: ${imageDirectory}`);
  process.exit(1);
}

console.error(`画像フォルダとして ${imageDirectory} を使用します。`);

// --- ヘルパー関数: 安全なファイルパスを生成 ---
const getSafeImagePath = (fileName: string): string | null => {
  const resolvedPath = path.resolve(imageDirectory, fileName);
  // パスが指定されたディレクトリ内にあることを確認 (ディレクトリトラバーサル対策)
  if (!resolvedPath.startsWith(imageDirectory)) {
    return null;
  }
  return resolvedPath;
};

// --- Toolの実装 ---

// 1. 画像の明るさを調整するTool
server.registerTool(
  "adjust_brightness",
  {
    title: "画像の明るさ調整",
    description: "画像の明るさを調整します（明るく、または暗く）。",
    inputSchema: {
      fileName: z.string().describe("編集したい画像ファイル名。例: 'photo.jpg'"),
      level: z.enum(["brighter", "darker"]).describe("明るさのレベル。'brighter' (明るく) または 'darker' (暗く) を指定。")
    }
  },
  async ({ fileName, level }) => {
    const filePath = getSafeImagePath(fileName);
    if (!filePath) {
      return { content: [{ type: "text", text: "エラー: 安全でないファイルパスです。" }], isError: true };
    }

    try {
      const brightnessValue = level === 'brighter' ? 1.5 : 0.7;
      const tempPath = `${filePath}.tmp`;

      await sharp(filePath)
        .modulate({ brightness: brightnessValue })
        .toFile(tempPath);

      // 元のファイルを置き換え
      fs.renameSync(tempPath, filePath);

      return { content: [{ type: "text", text: `${fileName} の明るさを調整しました (${level})。` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `エラー: ${error.message}` }], isError: true };
    }
  }
);

// 2. 画像をトリミングするTool
server.registerTool(
  "crop_image",
  {
    title: "画像のトリミング",
    description: "指定された範囲で画像をトリミングします。",
    inputSchema: {
      fileName: z.string().describe("トリミングしたい画像ファイル名。例: 'portrait.png'"),
      left: z.number().int().describe("トリミング領域の左上のX座標。"),
      top: z.number().int().describe("トリミング領域の左上のY座標。"),
      width: z.number().int().positive().describe("トリミング領域の幅。"),
      height: z.number().int().positive().describe("トリミング領域の高さ。")
    }
  },
  async ({ fileName, left, top, width, height }) => {
    const filePath = getSafeImagePath(fileName);
    if (!filePath) {
      return { content: [{ type: "text", text: "エラー: 安全でないファイルパスです。" }], isError: true };
    }

    try {
      const tempPath = `${filePath}.tmp`;

      await sharp(filePath)
        .extract({ left, top, width, height })
        .toFile(tempPath);

      fs.renameSync(tempPath, filePath);

      return { content: [{ type: "text", text: `${fileName} を指定された範囲でトリミングしました。` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `エラー: ${error.message}` }], isError: true };
    }
  }
);

// 3. 画像を圧縮するTool
server.registerTool(
  "compress_image",
  {
    title: "画像の圧縮",
    description: "画像のファイルサイズを小さくするために圧縮します。",
    inputSchema: {
      fileName: z.string().describe("圧縮したい画像ファイル名。例: 'background.jpg'"),
      quality: z.number().int().min(1).max(100).describe("圧縮品質（1から100の整数）。数値が低いほど圧縮率が高くなります。")
    }
  },
  async ({ fileName, quality }) => {
    const filePath = getSafeImagePath(fileName);
    if (!filePath) {
      return { content: [{ type: "text", text: "エラー: 安全でないファイルパスです。" }], isError: true };
    }

    try {
      const extension = path.extname(fileName).toLowerCase();
      const tempPath = `${filePath}.tmp`;
      let sharpInstance = sharp(filePath);

      if (extension === '.jpeg' || extension === '.jpg') {
        sharpInstance = sharpInstance.jpeg({ quality });
      } else if (extension === '.png') {
        sharpInstance = sharpInstance.png({ quality });
      } else if (extension === '.webp') {
        sharpInstance = sharpInstance.webp({ quality });
      } else {
        return { content: [{ type: "text", text: `エラー: サポートされていない画像形式です: ${extension}` }], isError: true };
      }

      await sharpInstance.toFile(tempPath);
      fs.renameSync(tempPath, filePath);

      return { content: [{ type: "text", text: `${fileName} を品質 ${quality} で圧縮しました。` }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `エラー: ${error.message}` }], isError: true };
    }
  }
);

// --- サーバーの起動 ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Image Editor MCP Serverがstdioで起動しました。");
}

main().catch((error) => {
  console.error("致命的なエラー:", error);
  process.exit(1);
});

```

## 3. サーバーのビルド

TypeScriptコードをJavaScriptにコンパイル（ビルド）します。

```
npm run build

```

成功すると、`build` ディレクトリに `index.js` が生成されます。

## 4. MCPクライアントへの設定方法

ここでは、`Claude for Desktop` をクライアントとして使用する場合の設定方法を説明します。

1. **設定ファイルを開く**
お使いのOSに応じて、以下のパスにある設定ファイル `claude_desktop_config.json` をテキストエディタで開きます。（ファイルが存在しない場合は新規作成してください）
    - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
    - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
2. **設定を記述する**
以下のJSONをファイルに記述します。**必ず、2つの `ABSOLUTE/PATH/TO/...` をあなたの環境の絶対パスに書き換えてください。**
    
    ```
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
    
    > パスの書き換えについて:
    > 
    
    > 1つ目のパスは、先ほどビルドして生成された index.js への絶対パスです。
    > 
    
    > 2つ目のパスは、編集したい画像が保存されているフォルダへの絶対パスです。
    > 
    
    > パスの確認方法:
    > 
    
    > macOS/Linux: ターミナルで対象のディレクトリに移動し pwd コマンドを実行します。
    > 
    
    > Windows: コマンドプロンプトで対象のディレクトリに移動し cd コマンドを実行するか、エクスプローラーのアドレスバーからパスをコピーします。
    > 
    
    > Windowsでの注意点: JSONファイル内でパスを記述する際は、バックスラッシュ \ を2つ重ねて \\ とするか、スラッシュ / を使用してください。
    > 
3. **Claude for Desktopを再起動する**
設定ファイルを保存した後、`Claude for Desktop` を完全に終了し、再起動してください。正しく設定されていれば、チャット入力欄の右下にツールアイコンが表示されます。

## 5. 使用方法

`Claude for Desktop` を起動し、設定した画像フォルダ内のファイルに対して、自然言語で編集を指示します。

**指示の例:**

- **明るさ調整:**
    
    > photo-01.jpg を明るくして。
    > 
- **トリミング:**
    
    > cat.png を左上(100, 50)から幅400、高さ300でトリミングして。
    > 
- **圧縮:**
    
    > wallpaper.jpg を品質80で圧縮してください。
    > 

ClaudeがToolの実行を提案してくるので、許可すると画像ファイルが実際に編集されます。
