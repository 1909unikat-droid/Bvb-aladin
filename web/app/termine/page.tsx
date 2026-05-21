import type { Metadata } from "next";
import { getAllFixtures } from "@/lib/fixtures";
import { TermineClient } from "./TermineClient";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Termine | BVB Hub",
  description: "Alle Spiele und Termine von Borussia Dortmund — Bundesliga, Champions League, DFB-Pokal.",
};

export default async function TerminePage() {
  const fixtures = await getAllFixtures();
  return <TermineClient fixtures={fixtures} />;
}
