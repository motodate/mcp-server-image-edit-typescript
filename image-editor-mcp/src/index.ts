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

