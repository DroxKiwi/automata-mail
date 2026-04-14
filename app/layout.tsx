import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TutorialWrapper } from "@/components/tutorial";
import { cn } from "@/lib/utils";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Exparta Automata Mail",
  description:
    "Exparta Automata Mail — redirection, automatisation et suivi du courrier entrant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={cn("h-full", plusJakarta.variable, geistMono.variable, "font-sans")}
    >
      <body className="flex min-h-full flex-col">
        <TutorialWrapper>{children}</TutorialWrapper>
      </body>
    </html>
  );
}
