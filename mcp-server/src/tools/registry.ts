/**
 * Registre des outils MCP exposés à l'IA (lecture boîte, déclencher actions, etc.).
 * Chaque outil : nom, schéma JSON, handler appelant l'API Next ou la base.
 */
export type ToolDefinitionPlaceholder = {
  name: string;
  description: string;
};

export const toolRegistryPlaceholder: ToolDefinitionPlaceholder[] = [];
