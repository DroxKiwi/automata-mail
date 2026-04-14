export function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    return null;
  }
  return v as Record<string, unknown>;
}

export function asPositiveInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= 1 ? n : null;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (/^[1-9]\d*$/.test(t)) {
      return Number.parseInt(t, 10);
    }
  }
  return null;
}
