export type AppAccessLevel = "public" | "auth" | "admin";

export type AppDetailKind = "section" | "action";

export type AppDetailNode = {
  path: string;
  label: string;
  description: string;
  kind: AppDetailKind;
  access: AppAccessLevel;
  aliases?: string[];
  children: string[];
  source: Array<"app-routes" | "sidebar" | "tutorial" | "enriched-actions">;
};

export type ApplicationDetailRequest = {
  path?: string;
  depth?: number;
};

export type ApplicationDetailResponse = {
  requestedPath: string;
  resolvedPath: string;
  depth: number;
  node: AppDetailNode;
  children: AppDetailNode[];
};
