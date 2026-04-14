import { NextResponse } from "next/server";

const MIN_SECRET_LEN = 16;

/**
 * Auth machine pour les routes `/api/internal/worker/*`.
 * Variable d’environnement : `WORKER_TRIGGER_SECRET` (≥ 16 caractères).
 */
export function workerAuthErrorResponse(): NextResponse | null {
  const secret = process.env.WORKER_TRIGGER_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LEN) {
    return NextResponse.json(
      {
        error:
          "WORKER_TRIGGER_SECRET manquant ou trop court (minimum 16 caracteres).",
      },
      { status: 503 }
    );
  }
  return null;
}

export function assertWorkerBearer(request: Request): NextResponse | null {
  const cfgErr = workerAuthErrorResponse();
  if (cfgErr) {
    return cfgErr;
  }
  const secret = process.env.WORKER_TRIGGER_SECRET!.trim();
  const auth = request.headers.get("authorization");
  const token =
    auth?.startsWith("Bearer ") || auth?.startsWith("bearer ")
      ? auth.slice(7).trim()
      : null;
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }
  return null;
}
