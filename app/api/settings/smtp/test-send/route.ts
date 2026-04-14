import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOutboundSmtpConfig } from "@/lib/smtp/smtp-config";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const cfg = await getOutboundSmtpConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "SMTP sortant non configure : renseigne l'hote, le port et l'expediteur dans Reglages.",
      },
      { status: 400 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
    });

    await transporter.sendMail({
      from: cfg.from,
      to: user.email,
      subject: "[Exparta Automata Mail] Test d'envoi SMTP",
      text: `Ceci est un message de test envoye depuis les reglages (configuration SMTP en base).`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Echec envoi : ${msg}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Message de test envoye a ${user.email}`,
  });
}
