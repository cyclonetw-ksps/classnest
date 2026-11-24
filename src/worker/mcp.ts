// agent 入口（MCP，Streamable HTTP，不開串流）：每個 JSON-RPC 請求一個 POST，回 application/json。
// 金鑰用 Authorization: Bearer 帶；金鑰驗證與每個工具的權限都在 Durable Object 裡（ClassroomDO.agentTool）。
// 工具只有組別名稱、面板與卡片；學生、分數、獎勵、老師、設定都不在這裡。
import { LIMITS } from "../shared/types";

export interface AgentPort {
  auth(key: string): Promise<boolean>;
  tool(key: string, name: string, args: Record<string, unknown>): Promise<{ status: number; json: string }>;
}

// 認得的協定版本；用戶端要的在裡面就照它，不然回最新的
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY = 64 * 1024;

const instructions = (origin: string) => `班級布告欄（${origin}）：老師的公布欄，由多個面板組成，每個面板是一欄便條卡。
- 面板可以標組別（groupIds，空白代表全班），可以設成分享（shared: true）讓代課老師、學生、家長從分享連結看到。
- 卡片有三種：text（文字）、link（連結，一定要有 url）、homework（回家作業，url 與 dueDate 可空白，dueDate 格式 YYYY-MM-DD）。
- 連結與作業卡在網頁上可以放大成 QR Code，所以網址請給學生能直接打開的那一個。
- 先用 list_groups 查組別代號，再建立面板或卡片。這個入口看不到也改不了學生、分數、獎勵與設定。`;

const id = { type: "string", description: "代號" };
const boardProps = {
  title: { type: "string", description: `面板名稱（最多 ${LIMITS.boardTitle} 字）` },
  groupIds: { type: "array", items: { type: "string" }, description: "組別代號（list_groups 查）；空陣列代表全班" },
  shared: { type: "boolean", description: "true＝出現在分享頁；false＝只有老師看得到（預設）" },
  position: { type: "integer", description: "排第幾個（0 是最前面）" },
};
const cardProps = {
  kind: { type: "string", enum: ["text", "link", "homework"], description: "text 文字、link 連結、homework 回家作業" },
  title: { type: "string", description: `標題（最多 ${LIMITS.cardTitle} 字）；連結卡與作業卡必填` },
  body: { type: "string", description: `內容（最多 ${LIMITS.cardBody} 字，純文字，可換行）` },
  url: { type: "string", description: "網址（http 或 https）；連結卡必填" },
  dueDate: { type: ["string", "null"], description: "作業繳交日期 YYYY-MM-DD，可空白" },
  position: { type: "integer", description: "在面板裡排第幾張（0 是最上面）" },
};

const TOOLS = [
  { name: "list_groups", title: "列出組別", description: "列出目前使用中的組別（代號與名稱）。", inputSchema: { type: "object", properties: {} } },
  {
    name: "list_boards",
    title: "列出面板",
    description: "列出所有面板（含私人與分享）與每個面板的卡片，依顯示順序。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_board",
    title: "建立面板",
    description: `建立一個面板，放在最後面。最多 ${LIMITS.boards} 個面板。`,
    inputSchema: { type: "object", properties: { title: boardProps.title, groupIds: boardProps.groupIds, shared: boardProps.shared }, required: ["title"] },
  },
  {
    name: "update_board",
    title: "修改面板",
    description: "修改面板名稱、組別、分享或順序；沒給的欄位不變。",
    inputSchema: { type: "object", properties: { id, ...boardProps }, required: ["id"] },
  },
  { name: "delete_board", title: "刪除面板", description: "刪除面板與裡面所有卡片，無法復原。", inputSchema: { type: "object", properties: { id }, required: ["id"] } },
  {
    name: "create_card",
    title: "建立卡片",
    description: `在面板最下面加一張卡片；會記下是這把金鑰建立的。一個面板最多 ${LIMITS.cardsPerBoard} 張。`,
    inputSchema: {
      type: "object",
      properties: { boardId: { type: "string", description: "面板代號" }, kind: cardProps.kind, title: cardProps.title, body: cardProps.body, url: cardProps.url, dueDate: cardProps.dueDate },
      required: ["boardId", "kind"],
    },
  },
  {
    name: "update_card",
    title: "修改卡片",
    description: "修改卡片內容或順序；沒給的欄位不變。",
    inputSchema: { type: "object", properties: { id, ...cardProps }, required: ["id"] },
  },
  { name: "delete_card", title: "刪除卡片", description: "刪除一張卡片，無法復原。", inputSchema: { type: "object", properties: { id }, required: ["id"] } },
];

type Id = string | number | null;

function send(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
const result = (rid: Id, value: unknown) => send({ jsonrpc: "2.0", id: rid, result: value });
const rpcError = (rid: Id, code: number, message: string, status = 200) => send({ jsonrpc: "2.0", id: rid, error: { code, message } }, status);

function bearer(request: Request): string {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
}

export async function handleMcp(request: Request, port: AgentPort): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const key = bearer(request);
  if (!(await port.auth(key))) {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "金鑰無效或已停用" } }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8", "www-authenticate": 'Bearer realm="classnest"', "cache-control": "no-store" },
    });
  }

  let msg: { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return rpcError(null, -32600, "內容太大", 413);
    msg = JSON.parse(raw);
  } catch {
    return rpcError(null, -32700, "看不懂的 JSON", 400);
  }
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0") return rpcError(null, -32600, "不是 JSON-RPC 2.0 請求", 400);
  const rid = (typeof msg.id === "string" || typeof msg.id === "number" ? msg.id : null) as Id;
  if (typeof msg.method !== "string") {
    // 用戶端回給伺服器的結果：收下，不回內容
    if (msg.id !== undefined && ("result" in msg || "error" in msg)) return new Response(null, { status: 202 });
    return rpcError(rid, -32600, "不是 JSON-RPC 2.0 請求", 400);
  }
  // 沒有 id 的是通知：收下，不回內容
  if (msg.id === undefined) return new Response(null, { status: 202 });
  const params = (msg.params && typeof msg.params === "object" ? msg.params : {}) as Record<string, unknown>;

  switch (msg.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return result(rid, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "classnest", title: "班級布告欄", version: "1.0.0" },
        instructions: instructions(new URL(request.url).origin),
      });
    }
    case "ping":
      return result(rid, {});
    case "tools/list":
      return result(rid, { tools: TOOLS });
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      if (!TOOLS.some((t) => t.name === name)) return rpcError(rid, -32602, `沒有這個工具：${name}`);
      const args = (params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments) ? params.arguments : {}) as Record<
        string,
        unknown
      >;
      const r = await port.tool(key, name, args);
      if (r.status === 401) return rpcError(rid, -32001, "金鑰無效或已停用", 401);
      if (r.status !== 200) {
        const message = (JSON.parse(r.json) as { error?: string }).error ?? "操作失敗";
        return result(rid, { content: [{ type: "text", text: message }], isError: true });
      }
      return result(rid, { content: [{ type: "text", text: r.json }] });
    }
    default:
      return rpcError(rid, -32601, `不支援的方法：${msg.method}`);
  }
}
