import type { AppDetailNode } from "@/lib/assistant/app-detail/types";

type ActionSeed = Omit<AppDetailNode, "kind" | "children" | "source"> & {
  parent: string;
};

const ACTION_SEEDS: ActionSeed[] = [
  {
    parent: "/bdr",
    path: "/bdr/sendmail",
    label: "Envoyer un mail",
    description:
      "Depuis Boîte de réception, cliquer sur le bouton flottant rond en bas à droite (icône stylo). Dans 'Nouveau message', remplir Destinataires, Objet, Message (et pièces jointes si besoin), puis cliquer sur 'Envoyer'. Vérification: la fenêtre se ferme sans erreur.",
    access: "auth",
  },
  {
    parent: "/bdr",
    path: "/bdr/archivemail",
    label: "Archiver un mail",
    description:
      "Dans la liste Boîte de réception, ouvrir le menu d'actions d'un message puis cliquer sur 'Archiver'. Vérification: le message disparaît de Boîte et apparaît dans Traité.",
    access: "auth",
  },
  {
    parent: "/bdr",
    path: "/bdr/transfermail",
    label: "Transférer un mail",
    description:
      "Dans Boîte de réception, ouvrir le menu d'actions du message puis choisir un raccourci de transfert. Vérification: le message passe dans Traité et l'historique contient l'action d'envoi.",
    access: "auth",
  },
  {
    parent: "/trt",
    path: "/trt/unarchive",
    label: "Désarchiver un mail",
    description:
      "Dans l'onglet Traité, ouvrir le menu d'actions du message puis cliquer sur 'Désarchiver'. Vérification: le message revient dans Boîte s'il n'a pas d'autre blocage de traitement.",
    access: "auth",
  },
  {
    parent: "/reg",
    path: "/reg/cloudmailbox",
    label: "Configurer la boîte cloud",
    description:
      "Choisir Google ou Outlook, connecter OAuth et régler la synchro. Pour Google: créer un projet dans Google Cloud Console, activer Gmail API, configurer l'écran de consentement OAuth, créer un OAuth Client ID, puis renseigner Client ID / Client Secret / Redirect URI dans l'app.",
    access: "auth",
  },
  {
    parent: "/reg/cloudmailbox",
    path: "/reg/cloudmailbox/google-oauth",
    label: "Connecter Gmail OAuth",
    description:
      "Étapes externes: Google Cloud Console -> créer projet -> activer Gmail API -> OAuth consent screen -> Create credentials / OAuth Client ID (Web). Dans l'app: coller Client ID, Client Secret, Redirect URI dans Réglages, enregistrer, puis cliquer 'Connecter Gmail'. Vérification: état connecté et test ping Gmail OK.",
    access: "auth",
  },
  {
    parent: "/reg/cloudmailbox/google-oauth",
    path: "/reg/cloudmailbox/google-oauth/fields",
    label: "Champs Gmail à renseigner",
    description:
      "Client ID = champ 'Client ID' de Google; Client Secret = champ 'Client Secret'; Redirect URI = URI autorisée côté Google, identique au champ de l'app. Erreur fréquente: URI différente entre Google et l'app.",
    access: "auth",
  },
  {
    parent: "/reg/cloudmailbox",
    path: "/reg/cloudmailbox/outlook-oauth",
    label: "Connecter Outlook OAuth",
    description:
      "Étapes externes: Azure Portal -> App registrations -> New registration -> Authentication (Redirect URI web) -> API permissions Mail.ReadWrite/Mail.Send/User.Read + offline_access -> Client secret. Dans l'app: renseigner Tenant ID, Client ID, Client Secret, Redirect URI, enregistrer, puis cliquer 'Connecter Outlook'. Vérification: état connecté et ping Outlook OK.",
    access: "auth",
  },
  {
    parent: "/reg/cloudmailbox/outlook-oauth",
    path: "/reg/cloudmailbox/outlook-oauth/fields",
    label: "Champs Outlook à renseigner",
    description:
      "Tenant ID = Directory (tenant) ID (ou 'common'); Client ID = Application (client) ID; Client Secret = secret généré; Redirect URI = même URI dans Azure et dans l'app. Erreur fréquente: redirect URI non autorisée.",
    access: "auth",
  },
  {
    parent: "/reg",
    path: "/reg/shortcuts",
    label: "Configurer les raccourcis",
    description:
      "Dans Réglages, section raccourcis de transfert, ouvrir la gestion puis ajouter/modifier/supprimer les destinataires rapides.",
    access: "auth",
  },
  {
    parent: "/reg/shortcuts",
    path: "/reg/shortcuts/create",
    label: "Créer un raccourci",
    description:
      "Ouvrir 'Gérer les raccourcis', saisir une ou plusieurs adresses (virgule ou point-virgule), enregistrer. Vérification: le raccourci apparaît dans la liste.",
    access: "auth",
  },
  {
    parent: "/reg/shortcuts",
    path: "/reg/shortcuts/use-from-inbox",
    label: "Utiliser un raccourci depuis la boîte",
    description:
      "Dans Boîte, menu d'actions d'un message -> choisir le raccourci créé. Vérification: envoi effectué et message visible dans Traité/Historique.",
    access: "auth",
  },
  {
    parent: "/auto",
    path: "/auto/create",
    label: "Créer une automatisation",
    description:
      "Dans Automate, créer une automatisation puis sélectionner des filtres d'entrée, définir les actions et la priorité.",
    access: "auth",
  },
  {
    parent: "/auto",
    path: "/auto/link-filters-actions",
    label: "Lier filtres et actions",
    description:
      "Une automatisation combine filtres + actions. Vérifier que les filtres existent, puis configurer les actions (transfert, archivage, etc.). Vérification: la règle matérialisée apparaît et s'exécute sur les nouveaux messages.",
    access: "auth",
  },
  {
    parent: "/flt",
    path: "/flt/create",
    label: "Créer un filtre",
    description:
      "Dans Filtres, créer un filtre avec portée d'adresse, conditions (expéditeur, sujet, corps, en-tête), priorité et activation.",
    access: "auth",
  },
  {
    parent: "/hist",
    path: "/hist/read-events",
    label: "Lire l'historique des événements",
    description:
      "Dans Historique, utiliser les filtres de catégorie et d'automatisation, ouvrir les détails techniques et suivre le lien vers le message concerné. Vérification: vous retrouvez la trace d'une action récente (transfert, archive, synchro).",
    access: "auth",
  },
];

export function buildActionNodes(): AppDetailNode[] {
  return ACTION_SEEDS.map((item) => ({
    path: item.path,
    label: item.label,
    description: item.description,
    kind: "action",
    access: item.access,
    children: [],
    aliases: [],
    source: ["enriched-actions"],
  }));
}

export function actionParentMap(): Record<string, string> {
  return ACTION_SEEDS.reduce<Record<string, string>>((acc, item) => {
    acc[item.path] = item.parent;
    return acc;
  }, {});
}
