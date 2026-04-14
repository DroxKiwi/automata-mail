import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * Simule la passerelle : POST vers /api/inbound/mail avec un petit MIME (meme secret que la prod).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const secret = process.env.INBOUND_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "INBOUND_SECRET non configure sur le serveur." },
      { status: 503 }
    );
  }

  const addr = await prisma.inboundAddress.findFirst({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });

  if (!addr) {
    return NextResponse.json(
      {
        error:
          "Aucune adresse d'entree active. Cree une InboundAddress avant de tester la reception.",
      },
      { status: 400 }
    );
  }

  const rcpt = `${addr.localPart}@${addr.domain}`;
  const traceId = randomUUID();
  const msgId = randomUUID();
  const raw = [
    `From: mail-proxy-test@invalid.local`,
    `To: ${rcpt}`,
    `Subject: [Exparta Automata Mail] Test reception`,
    `Message-ID: <${msgId}@mail-proxy.test>`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    `Message de test genere depuis les reglages (simulation passerelle SMTP).`,
    ``,
  ].join("\r\n");

  const url = new URL(request.url);
  const origin = url.origin;

  let res: Response;
  try {
    res = await fetch(`${origin}/api/inbound/mail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inbound-Secret": secret,
      },
      body: JSON.stringify({
        traceId,
        mailFrom: "mail-proxy-test@invalid.local",
        rcptTo: [rcpt],
        remoteIp: "127.0.0.1",
        raw,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Appel interne echoue : ${msg}` },
      { status: 502 }
    );
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          typeof data.error === "string"
            ? data.error
            : `API inbound a repondu ${res.status}`,
        traceId,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    traceId,
    matchedRecipients: data.matchedRecipients,
    results: data.results,
    message: `Requete envoyee vers /api/inbound/mail pour ${rcpt}. Verifie l'historique ou les messages en base.`,
  });
}
