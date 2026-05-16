import { invoke } from "@tauri-apps/api/core";
import { buildUserHeaders } from "./clientUser";

function isApiUrl(url: string): boolean {
  return typeof url === "string" && url.startsWith("/api/");
}

function isTauri(): boolean {
  const tauriGlobal = globalThis as typeof globalThis & {
    __TAURI_INTERNALS__?: { invoke?: unknown };
  };
  return typeof tauriGlobal.__TAURI_INTERNALS__?.invoke === "function";
}

function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    const q = url.indexOf("?");
    return q >= 0 ? url.substring(0, q) : url;
  }
}

function extractQuery(url: string): URLSearchParams | null {
  try {
    return new URL(url).searchParams;
  } catch {
    const q = url.indexOf("?");
    return q >= 0 ? new URLSearchParams(url.substring(q + 1)) : null;
  }
}

function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const pp = pattern.split("/").filter(Boolean);
  const pa = path.split("/").filter(Boolean);
  if (pp.length !== pa.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(":")) {
      params[pp[i].substring(1)] = pa[i];
    } else if (pp[i] !== pa[i]) {
      return null;
    }
  }
  return params;
}

type ParamExtractor = (path: string, query: URLSearchParams | null, body: unknown) => Record<string, unknown>;

interface TauriCommandEntry {
  pattern: string;
  method: string;
  command: string;
  extractParams: ParamExtractor;
}

function parseBody(init?: RequestInit): unknown {
  if (init?.body && typeof init.body === "string") {
    try { return JSON.parse(init.body); } catch {}
  }
  return null;
}

const TAURI_COMMANDS: TauriCommandEntry[] = [
  { pattern: "/api/projects", method: "GET", command: "list_projects", extractParams: () => ({}) },
  { pattern: "/api/projects", method: "POST", command: "create_project", extractParams: (_, __, body) => {
    const b = body as { name?: string; description?: string; goals?: string; color?: string } | null;
    return { params: { name: b?.name || "", description: b?.description || null, goals: b?.goals || null, color: b?.color || null } };
  }},
  { pattern: "/api/projects/:projectId", method: "DELETE", command: "delete_project", extractParams: (p) => ({ projectId: matchRoute("/api/projects/:projectId", p)?.projectId || "" }) },
  { pattern: "/api/meetings", method: "GET", command: "list_meetings", extractParams: (_, q) => {
    const params: Record<string, unknown> = {};
    const pid = q?.get("project_id");
    if (pid) params.projectId = pid;
    return params;
  }},
  { pattern: "/api/meetings/:id", method: "GET", command: "get_meeting", extractParams: (p) => ({ meetingId: matchRoute("/api/meetings/:id", p)?.id || "" }) },
  { pattern: "/api/meetings/:id/metadata", method: "GET", command: "get_meeting_metadata", extractParams: (p) => ({ meetingId: matchRoute("/api/meetings/:id/metadata", p)?.id || "" }) },
  { pattern: "/api/meetings/:id/extract", method: "GET", command: "get_meeting_notes", extractParams: (p, q) => {
    const m = matchRoute("/api/meetings/:id/extract", p);
    return { meetingId: m?.id || "", language: q?.get("language") || "en" };
  }},
  { pattern: "/api/meetings/:id/extract", method: "POST", command: "extract_meeting_notes", extractParams: (p) => ({ meetingId: matchRoute("/api/meetings/:id/extract", p)?.id || "", language: "en" }) },
  { pattern: "/api/meetings/:id/regenerate-notes", method: "GET", command: "get_meeting_notes", extractParams: (p, q) => {
    const m = matchRoute("/api/meetings/:id/regenerate-notes", p);
    return { meetingId: m?.id || "", language: q?.get("language") || "en" };
  }},
  { pattern: "/api/meetings/:id/regenerate-notes", method: "POST", command: "regenerate_meeting_notes", extractParams: (p, _, body) => {
    const m = matchRoute("/api/meetings/:id/regenerate-notes", p);
    return { meetingId: m?.id || "", language: (body as { language?: string })?.language || "en" };
  }},
  { pattern: "/api/settings/gemini-key", method: "GET", command: "get_gemini_key_status", extractParams: () => ({}) },
  { pattern: "/api/settings/gemini-key", method: "POST", command: "save_gemini_key", extractParams: (_, __, body) => ({ apiKey: (body as { apiKey?: string })?.apiKey || "" }) },
  { pattern: "/api/settings/gemini-key", method: "DELETE", command: "delete_gemini_key", extractParams: () => ({}) },
];

class ApiResponse {
  constructor(public ok: boolean, public status: number, private data: unknown) {}
  async json(): Promise<unknown> { return this.data; }
}

async function tauriRoute(url: string, method: string, init?: RequestInit): Promise<ApiResponse> {
  const path = extractPath(url);
  const query = extractQuery(url);
  const body = parseBody(init);

  // Direct match
  for (const entry of TAURI_COMMANDS) {
    if (entry.pattern === path && entry.method === method) {
      try {
        const params = entry.extractParams(path, query, body);
        const result = await invoke(entry.command, params);
        return new ApiResponse(true, 200, result);
      } catch (error) {
        console.error(`Tauri invoke [${entry.command}]:`, error);
        return new ApiResponse(false, 500, { error: String(error) });
      }
    }
  }

  // Parametric match
  for (const entry of TAURI_COMMANDS) {
    if (entry.method === method) {
      const routeParams = matchRoute(entry.pattern, path);
      if (routeParams && Object.keys(routeParams).length > 0) {
        try {
          const extraParams = entry.extractParams(path, query, body);
          const result = await invoke(entry.command, { ...routeParams, ...extraParams });
          return new ApiResponse(true, 200, result);
        } catch (error) {
          console.error(`Tauri invoke [${entry.command}]:`, error);
          return new ApiResponse(false, 500, { error: String(error) });
        }
      }
    }
  }

  return callWebApi(path, method, init);
}

async function callWebApi(path: string, method: string, init?: RequestInit): Promise<ApiResponse> {
  const url = `/api${path.startsWith("/api") ? path.substring(4) : path}`;
  const userHeaders = buildUserHeaders();
  const existingHeaders = (init?.headers as Record<string, string>) || {};
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(userHeaders || {})) headers[k] = v as string;
  for (const [k, v] of Object.entries(existingHeaders)) headers[k] = v;
  const response = await fetch(url, { ...init, method, headers });
  return new ApiResponse(response.ok, response.status, await response.json().catch(() => ({})));
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url: string;
  const finalInit: RequestInit = init ? { ...init } : {};
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    url = input.url;
    if (input.method && !finalInit.method) finalInit.method = input.method;
  }

  if (isTauri() && isApiUrl(url)) {
    const method = finalInit.method || "GET";
    const response = await tauriRoute(url, method, finalInit);
    return new Response(JSON.stringify(await response.json()), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userHeaders = buildUserHeaders();
  if (userHeaders) {
    finalInit.headers = { ...finalInit.headers, ...userHeaders };
  }
  return fetch(url, finalInit);
}
