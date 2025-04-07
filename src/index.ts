import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";

// 環境変数の読み込み
const API_KEY = process.env.MICROCMS_API_KEY;
const BASE_URL = process.env.MICROCMS_BASE_URL || "https://your-service.microcms.io";

if (!API_KEY) {
  console.error("MICROCMS_API_KEY is not set in .env.local file");
  process.exit(1);
}

// microCMSのAPIクライアントクラス
class MicroCMSClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * コンテンツ一覧を取得する
   * @param endpoint APIのエンドポイント (例: "blog")
   * @param params クエリパラメータ
   * @returns 取得結果のJSONオブジェクト
   */
  async getList(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    // クエリパラメータの構築
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, value);
    });

    const queryString = queryParams.toString();
    const url = `${this.baseUrl}/api/v1/${endpoint}${queryString ? `?${queryString}` : ''}`;

    // API呼び出し
    const response = await fetch(url, {
      headers: {
        "X-MICROCMS-API-KEY": this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from microCMS: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 特定のコンテンツを取得する
   * @param endpoint APIのエンドポイント (例: "blog")
   * @param contentId コンテンツID
   * @param params クエリパラメータ
   * @returns 取得結果のJSONオブジェクト
   */
  async getContent(endpoint: string, contentId: string, params: Record<string, string> = {}): Promise<any> {
    // クエリパラメータの構築
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, value);
    });

    const queryString = queryParams.toString();
    const url = `${this.baseUrl}/api/v1/${endpoint}/${contentId}${queryString ? `?${queryString}` : ''}`;

    // API呼び出し
    const response = await fetch(url, {
      headers: {
        "X-MICROCMS-API-KEY": this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch content from microCMS: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

// microCMSクライアントのインスタンス作成
const microCMS = new MicroCMSClient(API_KEY, BASE_URL);

// MCPサーバーの作成
const server = new McpServer({
  name: "microCMS-MCP-Server",
  version: "1.0.0"
});

// コンテンツ一覧取得のツール
server.tool("get_contents",
  {
    endpoint: z.string().describe("取得したいmicroCMSのAPIエンドポイント (例: 'blog')"),
    limit: z.number().optional().describe("取得する件数 (デフォルト: 10, 最大: 100)"),
    offset: z.number().optional().describe("取得開始位置のオフセット"),
    orders: z.string().optional().describe("並び替え (例: 'publishedAt' or '-publishedAt')"),
    q: z.string().optional().describe("全文検索クエリ"),
    filters: z.string().optional().describe("フィルタ条件 (例: 'title[contains]テスト')"),
    fields: z.string().optional().describe("取得フィールド (例: 'id,title,publishedAt')"),
    depth: z.number().optional().describe("参照の深さ (1-3)"),
  },
  async (params: any) => {
    try {
      // パラメータをStringに変換
      const queryParams: Record<string, string> = {};
      if (params.limit !== undefined) queryParams.limit = params.limit.toString();
      if (params.offset !== undefined) queryParams.offset = params.offset.toString();
      if (params.orders) queryParams.orders = params.orders;
      if (params.q) queryParams.q = params.q;
      if (params.filters) queryParams.filters = params.filters;
      if (params.fields) queryParams.fields = params.fields;
      if (params.depth !== undefined) queryParams.depth = params.depth.toString();

      const data = await microCMS.getList(params.endpoint, queryParams);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `エラー: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// 特定コンテンツ取得のツール
server.tool("get_content",
  {
    endpoint: z.string().describe("取得したいmicroCMSのAPIエンドポイント (例: 'blog')"),
    contentId: z.string().describe("取得したいコンテンツのID"),
    fields: z.string().optional().describe("取得フィールド (例: 'id,title,publishedAt')"),
    depth: z.number().optional().describe("参照の深さ (1-3)"),
    draftKey: z.string().optional().describe("下書きコンテンツを取得するためのキー"),
  },
  async (params: any) => {
    try {
      // パラメータをStringに変換
      const queryParams: Record<string, string> = {};
      if (params.fields) queryParams.fields = params.fields;
      if (params.depth !== undefined) queryParams.depth = params.depth.toString();
      if (params.draftKey) queryParams.draftKey = params.draftKey;

      const data = await microCMS.getContent(params.endpoint, params.contentId, queryParams);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `エラー: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// コンテンツ検索のツール
server.tool("search_contents",
  {
    endpoint: z.string().describe("検索対象のmicroCMSのAPIエンドポイント (例: 'blog')"),
    q: z.string().describe("検索キーワード"),
    limit: z.number().optional().describe("取得する件数 (デフォルト: 10, 最大: 100)"),
    offset: z.number().optional().describe("取得開始位置のオフセット"),
    fields: z.string().optional().describe("取得フィールド (例: 'id,title,publishedAt')"),
    depth: z.number().optional().describe("参照の深さ (1-3)"),
  },
  async (params: any) => {
    try {
      // パラメータをStringに変換
      const queryParams: Record<string, string> = {
        q: params.q
      };
      if (params.limit !== undefined) queryParams.limit = params.limit.toString();
      if (params.offset !== undefined) queryParams.offset = params.offset.toString();
      if (params.fields) queryParams.fields = params.fields;
      if (params.depth !== undefined) queryParams.depth = params.depth.toString();

      const data = await microCMS.getList(params.endpoint, queryParams);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `エラー: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// フィルター検索用のツール
server.tool("filter_contents",
  {
    endpoint: z.string().describe("検索対象のmicroCMSのAPIエンドポイント (例: 'blog')"),
    filters: z.string().describe("フィルター条件 (例: 'category[equals]news[and]createdAt[greater_than]2023-01-01')"),
    limit: z.number().optional().describe("取得する件数 (デフォルト: 10, 最大: 100)"),
    offset: z.number().optional().describe("取得開始位置のオフセット"),
    fields: z.string().optional().describe("取得フィールド (例: 'id,title,publishedAt')"),
    depth: z.number().optional().describe("参照の深さ (1-3)"),
  },
  async (params: any) => {
    try {
      // パラメータをStringに変換
      const queryParams: Record<string, string> = {
        filters: params.filters
      };
      if (params.limit !== undefined) queryParams.limit = params.limit.toString();
      if (params.offset !== undefined) queryParams.offset = params.offset.toString();
      if (params.fields) queryParams.fields = params.fields;
      if (params.depth !== undefined) queryParams.depth = params.depth.toString();

      const data = await microCMS.getList(params.endpoint, queryParams);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `エラー: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// 特定IDのコンテンツを取得するリソース
server.resource(
  "content",
  new ResourceTemplate("microcms://{endpoint}/{contentId}", { list: undefined }),
  async (uri, variables) => {
    const endpoint = variables.endpoint as string;
    const contentId = variables.contentId as string;
    try {
      const data = await microCMS.getContent(endpoint, contentId);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `エラー: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

// コンテンツ一覧を取得するリソース
server.resource(
  "contents",
  new ResourceTemplate("microcms://{endpoint}", { list: undefined }),
  async (uri, variables) => {
    const endpoint = variables.endpoint as string;
    try {
      const data = await microCMS.getList(endpoint);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `エラー: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

async function main() {
  // MCPサーバーの開始
  console.error("Starting microCMS MCP Server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
