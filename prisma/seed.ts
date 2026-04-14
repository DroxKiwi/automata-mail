import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

/** Supprime et recrée les messages de démo (adresses inchangées). */
const SEED_CORRELATION_PREFIX = "seed-inbox-v1-";

function buildRawMime(input: {
  mailFrom: string;
  rcpt: string;
  subject: string;
  messageId: string;
  body: string;
  date: Date;
}): string {
  const dateStr = input.date.toUTCString();
  return [
    `From: ${input.mailFrom}`,
    `To: ${input.rcpt}`,
    `Subject: ${input.subject}`,
    `Message-ID: ${input.messageId}`,
    `Date: ${dateStr}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.body.replace(/\r?\n/g, "\r\n"),
    "",
  ].join("\r\n");
}

async function main() {
  const passwordHash = await hash("SeedDemo!2026", 12);

  const seedUser = await prisma.user.upsert({
    where: { email: "demo.seed@exparta.test" },
    create: {
      email: "demo.seed@exparta.test",
      username: "demo_seed",
      name: "Compte demonstration seed",
      passwordHash,
    },
    update: { name: "Compte demonstration seed" },
  });

  const addressDefs = [
    { localPart: "coco.test", domain: "mon-dns.seed" },
    { localPart: "boutique", domain: "mail-demo.seed" },
    { localPart: "support", domain: "inbox.seed" },
    { localPart: "alerts", domain: "mon-dns.seed" },
    { localPart: "newsletter", domain: "news.seed" },
  ] as const;

  const addrByKey: Record<string, number> = {};

  for (const a of addressDefs) {
    const row = await prisma.inboundAddress.upsert({
      where: {
        userId_localPart_domain: {
          userId: seedUser.id,
          localPart: a.localPart,
          domain: a.domain,
        },
      },
      create: {
        userId: seedUser.id,
        localPart: a.localPart,
        domain: a.domain,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });
    addrByKey[`${a.localPart}@${a.domain}`] = row.id;
  }

  await prisma.inboundMessage.deleteMany({
    where: { userId: seedUser.id, correlationId: { startsWith: SEED_CORRELATION_PREFIX } },
  });

  type SeedMsg = {
    rcptKey: string;
    mailFrom: string;
    subject: string;
    body: string;
    read: boolean;
    attachments?: Array<{
      filename: string | null;
      contentType: string | null;
      sizeBytes: number;
      contentId: string | null;
      disposition: string | null;
    }>;
  };

  const now = Date.now();
  const seeds: SeedMsg[] = [
    {
      rcptKey: "coco.test@mon-dns.seed",
      mailFrom: "Alice Martin <alice@client-exemple.fr>",
      subject: "Re: Devis site vitrine",
      body: "Bonjour,\n\nMerci pour le devis. On valide la variante B pour mise en ligne debut mai.\n\nCordialement,\nAlice",
      read: true,
    },
    {
      rcptKey: "boutique@mail-demo.seed",
      mailFrom: "noreply@paiement.secure",
      subject: "Paiement recu commande #48291",
      body: "Votre paiement a ete accepte. Montant : 49,90 EUR. Expedition sous 48h.",
      read: false,
    },
    {
      rcptKey: "support@inbox.seed",
      mailFrom: "Bob Dupont <bob@startup.io>",
      subject: "Bug export CSV",
      body: "L'export plante quand plus de 500 lignes. Navigateur : Firefox 128. Piece jointe : capture d'ecran (simulee en seed).",
      read: false,
      attachments: [
        {
          filename: "capture-export.png",
          contentType: "image/png",
          sizeBytes: 128_400,
          contentId: null,
          disposition: "attachment",
        },
      ],
    },
    {
      rcptKey: "alerts@mon-dns.seed",
      mailFrom: "monitoring@infra.local",
      subject: "[WARN] CPU > 80% sur worker-3",
      body: "Seuil depasse pendant 12 minutes. Pic a 91% a 14h32 UTC.",
      read: true,
    },
    {
      rcptKey: "newsletter@news.seed",
      mailFrom: "\"Actu Tech Weekly\" <hello@actutech.io>",
      subject: "Cette semaine : SMTP, DNS et bonnes pratiques",
      body: "Resume : MX, SPF, DKIM, et pourquoi le port 25 pose souvent question en hebergement cloud.",
      read: false,
    },
    {
      rcptKey: "coco.test@mon-dns.seed",
      mailFrom: "Carole <carole@agence-partenaire.net>",
      subject: "Point logo — fichiers sources",
      body: "Voici le lien vers le dossier Figma (fictif en seed). Dis-moi si les declinaisons suffisent.",
      read: false,
      attachments: [
        {
          filename: "readme.txt",
          contentType: "text/plain",
          sizeBytes: 512,
          contentId: null,
          disposition: "attachment",
        },
        {
          filename: "logo.svg",
          contentType: "image/svg+xml",
          sizeBytes: 2_048,
          contentId: null,
          disposition: "attachment",
        },
      ],
    },
    {
      rcptKey: "boutique@mail-demo.seed",
      mailFrom: "transport@colis-express.fr",
      subject: "Livraison prevue demain avant 18h",
      body: "Votre colis est en agence de tri. Suivi : SEED-TRACK-001 (donnee fictive).",
      read: true,
    },
    {
      rcptKey: "support@inbox.seed",
      mailFrom: "security@notifications.bank",
      subject: "Alerte connexion inhabituelle",
      body: "Une connexion depuis une nouvelle region a ete detectee. Si ce n'est pas vous, contactez le support.",
      read: false,
    },
    {
      rcptKey: "alerts@mon-dns.seed",
      mailFrom: "cron@serveur-interne",
      subject: "Sauvegarde Postgres OK",
      body: "Job nightly termine. Taille dump : 1,2 Go. Duree : 6 min 12 s.",
      read: true,
    },
    {
      rcptKey: "newsletter@news.seed",
      mailFrom: "meetups@devcommunity.eu",
      subject: "Invitation : apero infra jeudi",
      body: "Inscription sur le site de l'asso. Places limitees a 40 personnes.",
      read: false,
    },
  ];

  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const inboundAddressId = addrByKey[s.rcptKey];
    if (inboundAddressId == null) {
      throw new Error(`Adresse seed inconnue: ${s.rcptKey}`);
    }

    const correlationId = `${SEED_CORRELATION_PREFIX}${String(i + 1).padStart(2, "0")}`;
    const messageIdHeader = `<${correlationId}@exparta.seed>`;
    const receivedAt = new Date(now - (seeds.length - i) * 45 * 60_000);

    const rawMime = buildRawMime({
      mailFrom: s.mailFrom,
      rcpt: s.rcptKey,
      subject: s.subject,
      messageId: messageIdHeader,
      body: s.body,
      date: receivedAt,
    });

    const headersJson = {
      from: s.mailFrom,
      to: s.rcptKey,
      subject: s.subject,
      "message-id": messageIdHeader,
      date: receivedAt.toISOString(),
    };

    const msg = await prisma.inboundMessage.create({
      data: {
        userId: seedUser.id,
        inboundAddressId,
        correlationId,
        messageIdHeader,
        mailFrom: s.mailFrom,
        rcptTo: [s.rcptKey],
        subject: s.subject,
        rawMime,
        textBody: s.body,
        htmlBody: null,
        headers: headersJson,
        receivedAt,
        readAt: s.read ? new Date(receivedAt.getTime() + 60_000) : null,
      },
    });

    if (s.attachments?.length) {
      await prisma.inboundAttachment.createMany({
        data: s.attachments.map((a) => ({
          inboundMessageId: msg.id,
          filename: a.filename,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
          contentId: a.contentId,
          disposition: a.disposition,
        })),
      });
    }
  }

  console.log(
    `[seed] Compte demo : username demo_seed / email demo.seed@exparta.test — mdp SeedDemo!2026 — ${seeds.length} messages, ${addressDefs.length} adresses (.seed).`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
