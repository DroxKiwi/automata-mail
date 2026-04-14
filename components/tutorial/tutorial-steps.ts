export type TutorialStepConfig = {
  id: string;
  targetSelector: string;
  bubbleTitle: string;
  bubbleText: string;
  /**
   * Si défini, l’étape n’est active que sur les URL dont le chemin commence par cette valeur
   * (ex. `/boite` couvre `/boite` et `/boite/123`).
   */
  pathPrefix?: string;
  /**
   * Si true avec `pathPrefix: "/boite"`, seule la liste `/boite` compte (pas le détail `/boite/123`).
   */
  boiteListOnly?: boolean;
  /** Navigation au clic « Suivant » avant de passer à l’étape suivante (intro d’onglet). */
  navigateOnNext?: string;
  /** Bulle positionnée comme pour un lien de la barre latérale. */
  sidebarBubble?: boolean;
  /** Classes d’arrondi du halo (ex. `rounded-full` pour un bouton circulaire). */
  spotlightRoundedClass?: string;
  /** `circle` : zone dégagée ronde (masque SVG) au lieu du trou rectangulaire à 4 panneaux. */
  spotlightHoleShape?: "rect" | "circle";
};

const SECTION_LABEL: Record<string, string> = {
  "/boite": "la boîte de réception",
  "/transfere": "l’onglet Traité",
  "/historique": "l’onglet Historique",
  "/filtres": "l’onglet Filtres",
  "/automate": "l’onglet Automate",
  "/reglages": "l’onglet Réglages",
};

export const TUTORIAL_STEPS: TutorialStepConfig[] = [
  {
    id: "sidebar-boite",
    targetSelector: '[data-tutorial-target="boite"]',
    bubbleTitle: "Boîte de réception",
    bubbleText:
      "C’est l’onglet de réception : il regroupe les messages liés à la boîte connectée à l’application, qui ne sont pas encore traités. Appuyez sur Suivant pour ouvrir la boîte et poursuivre le tutoriel.",
    navigateOnNext: "/boite",
    sidebarBubble: true,
  },
  {
    id: "boite-toolbar",
    pathPrefix: "/boite",
    boiteListOnly: true,
    targetSelector: '[data-tutorial-target="tutoriel-boite-toolbar"]',
    bubbleTitle: "Filtres et pagination",
    bubbleText:
      "Ici vous voyez combien de messages sont affichés, vous pouvez filtrer (par exemple les non lus) et changer de page ou le nombre de messages par page.",
  },
  {
    id: "boite-sync",
    pathPrefix: "/boite",
    boiteListOnly: true,
    targetSelector: '[data-tutorial-target="tutoriel-boite-sync"]',
    bubbleTitle: "Synchronisation cloud",
    bubbleText:
      "Cette zone résume la connexion Gmail ou Microsoft 365 : import des messages et fréquence de synchronisation selon vos réglages.",
  },
  {
    id: "boite-liste",
    pathPrefix: "/boite",
    boiteListOnly: true,
    targetSelector: '[data-tutorial-target="tutoriel-boite-liste"]',
    bubbleTitle: "Liste des messages",
    bubbleText:
      "Chaque ligne est un message reçu : ouvrez-le pour le lire, utilisez le menu pour transférer via un raccourci ou archiver. Les messages déjà traités disparaissent d’ici (voir l’onglet Traité).",
  },
  {
    id: "boite-compose",
    pathPrefix: "/boite",
    boiteListOnly: true,
    targetSelector: '[data-tutorial-target="tutoriel-boite-compose"]',
    spotlightRoundedClass: "rounded-full",
    spotlightHoleShape: "circle",
    bubbleTitle: "Nouveau message",
    bubbleText:
      "Le bouton flottant ouvre la rédaction d’un nouvel e-mail (destinataire, sujet, pièces jointes) envoyé avec la même chaîne que vos transferts.",
  },
  {
    id: "sidebar-transfere",
    targetSelector: '[data-tutorial-target="transfere"]',
    bubbleTitle: "Traité",
    bubbleText:
      "Les messages traités (transfert, règle, archivage, etc.) quittent la boîte et se retrouvent ici. Appuyez sur Suivant pour ouvrir l’onglet Traité.",
    navigateOnNext: "/transfere",
    sidebarBubble: true,
  },
  {
    id: "transfere-intro",
    pathPrefix: "/transfere",
    targetSelector: '[data-tutorial-target="tutoriel-transfere-intro"]',
    bubbleTitle: "À propos du Traité",
    bubbleText:
      "Ce texte résume la logique : la boîte ne montre que le non traité ; vous pouvez masquer une ligne ou désarchiver vers la boîte si besoin. Les raccourcis se configurent dans Réglages.",
  },
  {
    id: "transfere-liste",
    pathPrefix: "/transfere",
    targetSelector: '[data-tutorial-target="tutoriel-transfere-liste"]',
    bubbleTitle: "Liste des messages traités",
    bubbleText:
      "Même présentation que la boîte : ouvrez un message, utilisez le menu. Le bouton à droite retire la ligne de l’affichage sans supprimer le message ; Désarchiver peut le renvoyer en réception.",
  },
  {
    id: "sidebar-historique",
    targetSelector: '[data-tutorial-target="historique"]',
    bubbleTitle: "Historique",
    bubbleText:
      "L’historique journalise réception, transferts, règles, synchro cloud, etc. Appuyez sur Suivant pour ouvrir cette vue.",
    navigateOnNext: "/historique",
    sidebarBubble: true,
  },
  {
    id: "historique-toolbar",
    pathPrefix: "/historique",
    targetSelector: '[data-tutorial-target="tutoriel-historique-toolbar"]',
    bubbleTitle: "Filtres et pagination",
    bubbleText:
      "Filtrez par type d’événement ou par automatisation, changez le nombre d’entrées par page et parcourez les pages : les critères sont conservés dans l’URL.",
  },
  {
    id: "historique-intro",
    pathPrefix: "/historique",
    targetSelector: '[data-tutorial-target="tutoriel-historique-intro"]',
    bubbleTitle: "Journal d’activité",
    bubbleText:
      "Chaque ligne résume une action système ou utilisateur avec l’heure, l’acteur et souvent un lien vers le message concerné dans la boîte.",
  },
  {
    id: "historique-liste",
    pathPrefix: "/historique",
    targetSelector: '[data-tutorial-target="tutoriel-historique-liste"]',
    bubbleTitle: "Détail des événements",
    bubbleText:
      "Les badges indiquent la catégorie ; vous pouvez déplier les détails techniques pour le débogage. Une liste vide se remplit au fil du trafic et des actions dans l’app.",
  },
  {
    id: "sidebar-filtres",
    targetSelector: '[data-tutorial-target="filtres"]',
    bubbleTitle: "Filtres",
    bubbleText:
      "Les filtres définissent quels messages entrent dans quelles automatisations (conditions sur expéditeur, sujet, etc.). Appuyez sur Suivant pour ouvrir l’éditeur.",
    navigateOnNext: "/filtres",
    sidebarBubble: true,
  },
  {
    id: "filtres-editeur",
    pathPrefix: "/filtres",
    targetSelector: '[data-tutorial-target="tutoriel-filtres-editeur"]',
    bubbleTitle: "Création et édition",
    bubbleText:
      "Créez ou modifiez un filtre : adresse d’entrée, conditions, priorité. Les filtres actifs peuvent être liés à des règles dans l’onglet Automate.",
  },
  {
    id: "filtres-liste",
    pathPrefix: "/filtres",
    targetSelector: '[data-tutorial-target="tutoriel-filtres-liste"]',
    bubbleTitle: "Filtres enregistrés",
    bubbleText:
      "Vue d’ensemble de tous les filtres, leur ordre de priorité, l’état activé/désactivé et les liens vers les automatisations.",
  },
  {
    id: "sidebar-automate",
    targetSelector: '[data-tutorial-target="automate"]',
    bubbleTitle: "Automate",
    bubbleText:
      "Les automatisations enchaînent filtres et actions (transfert, tags, etc.) selon des règles ordonnées. Appuyez sur Suivant pour ouvrir l’onglet.",
    navigateOnNext: "/automate",
    sidebarBubble: true,
  },
  {
    id: "automate-editeur",
    pathPrefix: "/automate",
    targetSelector: '[data-tutorial-target="tutoriel-automate-editeur"]',
    bubbleTitle: "Automatisations",
    bubbleText:
      "Créez une automatisation, associez-y des filtres et des règles d’action. La priorité détermine l’ordre d’évaluation avec les autres blocs.",
  },
  {
    id: "automate-regles",
    pathPrefix: "/automate",
    targetSelector: '[data-tutorial-target="tutoriel-automate-regles"]',
    bubbleTitle: "Règles et aperçu",
    bubbleText:
      "Résumé des règles existantes : conditions, actions, lien vers l’automatisation. Utile pour vérifier ce qui s’applique avant de tester en réception.",
  },
  {
    id: "sidebar-reglages",
    targetSelector: '[data-tutorial-target="reglages"]',
    bubbleTitle: "Réglages",
    bubbleText:
      "Raccourcis de transfert et boîte cloud (Gmail / Microsoft) se configurent ici. Appuyez sur Suivant pour ouvrir la page.",
    navigateOnNext: "/reglages",
    sidebarBubble: true,
  },
  {
    id: "reglages-raccourcis",
    pathPrefix: "/reglages",
    targetSelector: '[data-tutorial-target="tutoriel-reglages-raccourcis"]',
    bubbleTitle: "Raccourcis de transfert",
    bubbleText:
      "Destinations en un clic depuis le menu de chaque message en boîte. Ouvrez « Gérer les raccourcis » pour ajouter, modifier ou supprimer des cibles.",
  },
  {
    id: "reglages-cloud",
    pathPrefix: "/reglages",
    targetSelector: '[data-tutorial-target="tutoriel-reglages-cloud"]',
    bubbleTitle: "Boîte mail cloud",
    bubbleText:
      "Choix du fournisseur (Google ou Microsoft), connexion OAuth et options de synchro. Une seule boîte cloud active à la fois selon la configuration.",
  },
];

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;

export function getTutorialStep(stepIndex: number): TutorialStepConfig | undefined {
  if (stepIndex < 0 || stepIndex >= TUTORIAL_STEPS.length) {
    return undefined;
  }
  return TUTORIAL_STEPS[stepIndex];
}

export function pathMatchesTutorialPrefix(
  pathname: string,
  prefix: string | undefined,
): boolean {
  if (!prefix) {
    return true;
  }
  if (pathname === prefix) {
    return true;
  }
  return pathname.startsWith(`${prefix}/`);
}

/** Liste boîte uniquement (`/boite`), pas la fiche message. */
export function isBoiteListPath(pathname: string): boolean {
  return pathname === "/boite" || pathname === "/boite/";
}

export function stepPathAllowed(pathname: string, step: TutorialStepConfig): boolean {
  if (!step.pathPrefix) {
    return true;
  }
  if (!pathMatchesTutorialPrefix(pathname, step.pathPrefix)) {
    return false;
  }
  if (step.boiteListOnly) {
    return isBoiteListPath(pathname);
  }
  return true;
}

export function isSidebarTutorialStep(step: TutorialStepConfig): boolean {
  return step.sidebarBubble === true;
}

export type WrongPathHelp = {
  panelTitle: string;
  hint: string;
  href: string;
  linkLabel: string;
};

export function getWrongPathHelp(
  pathname: string,
  step: TutorialStepConfig,
): WrongPathHelp {
  if (step.boiteListOnly && pathMatchesTutorialPrefix(pathname, "/boite") && !isBoiteListPath(pathname)) {
    return {
      panelTitle: "Retour à la liste des messages",
      hint: "Revenez à la liste des messages (sans ouvrir un message) pour poursuivre cette étape.",
      href: "/boite",
      linkLabel: "Voir la liste",
    };
  }

  const prefix = step.pathPrefix;
  if (prefix) {
    const label = SECTION_LABEL[prefix] ?? prefix;
    return {
      panelTitle: `Étape — ${step.bubbleTitle}`,
      hint: `Ouvrez ${label} pour poursuivre le tutoriel.`,
      href: step.boiteListOnly ? "/boite" : prefix,
      linkLabel: "Ouvrir la page",
    };
  }

  return {
    panelTitle: "Autre page requise",
    hint: "Revenez sur la section indiquée par le tutoriel pour continuer.",
    href: "/boite",
    linkLabel: "Ouvrir la boîte",
  };
}
