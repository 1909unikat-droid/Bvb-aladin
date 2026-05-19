import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CurtainReveal } from "@/components/CurtainReveal";

export const metadata: Metadata = {
  title: {
    default: "BVB Hub — Alle News der Borussia",
    template: "%s · BVB Hub"
  },
  description:
    "Der Premium-Hub für alle BVB-News: Transfers, Insider, Spieltag, Verletzungen, Podcasts und Videos — gebündelt aus 40+ Quellen.",
  applicationName: "BVB Hub",
  keywords: ["BVB", "Borussia Dortmund", "Transfers", "Bundesliga", "Schwarz-Gelb"],
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "BVB Hub",
    description: "Alle BVB-News, kuratiert und live.",
    type: "website",
    locale: "de_DE"
  }
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className="min-h-screen bg-asphalt-950 text-neutral-100 antialiased">
        <CurtainReveal />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-bvb-yellow focus:text-black focus:px-3 focus:py-2 focus:rounded"
        >
          Zum Inhalt springen
        </a>
        <Header />
        <main id="main" className="pb-24 md:pb-12">
          {children}
        </main>
        <BottomNav />
        <footer className="border-t border-asphalt-700 mt-12 py-6 text-xs text-neutral-500 text-center">
          BVB Hub · Fan-Projekt · Keine offizielle Borussia-Dortmund-Seite ·{" "}
          <a href="/impressum" className="hover:text-bvb-yellow">Impressum</a> ·{" "}
          <a href="/datenschutz" className="hover:text-bvb-yellow">Datenschutz</a>
        </footer>
      </body>
    </html>
  );
}
