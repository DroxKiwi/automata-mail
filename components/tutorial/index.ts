/** API publique du module tutoriel (le reste s’importe en chemin direct si besoin). */
export { TutorialWrapper } from "@/components/tutorial/tutorial-wrapper";
export { TutorialStartButton } from "@/components/tutorial/tutorial-start-button";
export { TutorialProvider, useTutorial } from "@/components/tutorial/tutorial-context";
export type { TutorialContextValue, TutorialState } from "@/components/tutorial/tutorial-context";
