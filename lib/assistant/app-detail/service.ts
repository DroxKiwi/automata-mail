import { actionParentMap, buildActionNodes } from "@/lib/assistant/app-detail/enrich-actions";
import { normalizeDetailPath, toAssistantPath, toCanonicalPath } from "@/lib/assistant/app-detail/alias-map";
import { extractRouteNodes } from "@/lib/assistant/app-detail/extract-routes";
import type {
  AppDetailNode,
  ApplicationDetailRequest,
  ApplicationDetailResponse,
} from "@/lib/assistant/app-detail/types";
import type { AssistantSessionContext } from "@/lib/assistant/session-types";

const DEFAULT_DEPTH = 1;
const MAX_DEPTH = 4;

const ROOT_SECTIONS_ORDER = [
  "/bdr",
  "/trt",
  "/hist",
  "/flt",
  "/auto",
  "/reg",
  "/doc",
  "/users",
  "/login",
  "/setup",
];

function cloneNode(node: AppDetailNode): AppDetailNode {
  return {
    ...node,
    aliases: [...(node.aliases ?? [])],
    children: [...node.children],
    source: [...node.source],
  };
}

function clampDepth(depth: number | undefined): number {
  if (depth == null || !Number.isFinite(depth)) {
    return DEFAULT_DEPTH;
  }
  return Math.min(MAX_DEPTH, Math.max(0, Math.trunc(depth)));
}

function buildFallbackRoot(): AppDetailNode {
  return {
    path: "/",
    label: "Application",
    description: "Vue d'ensemble des sections fonctionnelles de l'application.",
    kind: "section",
    access: "auth",
    aliases: [],
    children: [],
    source: ["enriched-actions"],
  };
}

function isVisibleForUser(node: AppDetailNode, ctx: AssistantSessionContext): boolean {
  if (node.access === "admin" && !ctx.isAdmin) {
    return false;
  }
  return true;
}

function collectChildren(
  map: Map<string, AppDetailNode>,
  startPath: string,
  depth: number,
): AppDetailNode[] {
  if (depth <= 0) {
    return [];
  }
  const visited = new Set<string>();
  const out: AppDetailNode[] = [];
  let frontier: string[] = [startPath];
  for (let d = 0; d < depth; d += 1) {
    const next: string[] = [];
    for (const path of frontier) {
      const node = map.get(path);
      if (!node) continue;
      for (const childPath of node.children) {
        if (visited.has(childPath)) continue;
        const child = map.get(childPath);
        if (!child) continue;
        visited.add(childPath);
        out.push(cloneNode(child));
        next.push(childPath);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return out;
}

let cachedTree: { at: number; nodes: AppDetailNode[] } | null = null;
const CACHE_TTL_MS = 20_000;

async function loadTreeNodes(): Promise<AppDetailNode[]> {
  const now = Date.now();
  if (cachedTree && now - cachedTree.at < CACHE_TTL_MS) {
    return cachedTree.nodes.map(cloneNode);
  }
  const extracted = await extractRouteNodes();
  const byPath = new Map<string, AppDetailNode>();

  for (const node of extracted) {
    byPath.set(node.path, node);
  }
  if (!byPath.has("/")) {
    byPath.set("/", buildFallbackRoot());
  }

  const actionNodes = buildActionNodes();
  for (const action of actionNodes) {
    byPath.set(action.path, action);
  }

  const parentByAction = actionParentMap();
  for (const [actionPath, parentPath] of Object.entries(parentByAction)) {
    const parent = byPath.get(parentPath);
    if (!parent) continue;
    if (!parent.children.includes(actionPath)) {
      parent.children.push(actionPath);
    }
  }

  const inbox = byPath.get("/bdr");
  if (inbox && byPath.has("/bdr/:id") && !inbox.children.includes("/bdr/:id")) {
    inbox.children.push("/bdr/:id");
  }

  const root = byPath.get("/") ?? buildFallbackRoot();
  root.children = ROOT_SECTIONS_ORDER.filter((p) => byPath.has(p));
  byPath.set("/", root);

  const finalized = Array.from(byPath.values()).map((n) => ({
    ...n,
    children: [...n.children].sort((a, b) => a.localeCompare(b)),
  }));

  cachedTree = { at: now, nodes: finalized };
  return finalized.map(cloneNode);
}

export async function resolveApplicationDetail(
  request: ApplicationDetailRequest,
  ctx: AssistantSessionContext,
): Promise<ApplicationDetailResponse> {
  const requestedPath = normalizeDetailPath(request.path);
  const depth = clampDepth(request.depth);

  const allNodes = await loadTreeNodes();
  const visibleNodes = allNodes.filter((node) => isVisibleForUser(node, ctx));
  const visibleMap = new Map(visibleNodes.map((node) => [node.path, node]));

  const canonicalCandidate = toAssistantPath(toCanonicalPath(requestedPath));
  const resolvedPath = visibleMap.has(requestedPath)
    ? requestedPath
    : visibleMap.has(canonicalCandidate)
      ? canonicalCandidate
      : "/";

  const node = cloneNode(visibleMap.get(resolvedPath) ?? buildFallbackRoot());
  node.children = node.children.filter((childPath) => visibleMap.has(childPath));

  const children = collectChildren(visibleMap, resolvedPath, depth);

  return {
    requestedPath,
    resolvedPath,
    depth,
    node,
    children,
  };
}
