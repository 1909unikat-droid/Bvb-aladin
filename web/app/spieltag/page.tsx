import { FilteredPage } from "@/components/FilteredPage";
export const revalidate = 60;
export const metadata = { title: "Spieltag" };
export default function Page() {
  return (
    <FilteredPage
      eyebrow="Matchday"
      title="Spieltag"
      description="Aufstellungen, Spielberichte, Stimmen und Pressekonferenzen."
      filter={{ category: "matchday" }}
      emptyTitle="Kein Spiel auf der Uhr"
    />
  );
}
