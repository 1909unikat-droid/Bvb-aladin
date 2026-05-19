import { FilteredPage } from "@/components/FilteredPage";
export const revalidate = 60;
export const metadata = { title: "Verletzungen" };
export default function Page() {
  return (
    <FilteredPage
      eyebrow="Lazarett"
      title="Verletzungen"
      description="Aktuelle Ausfälle, Reha-Status und Comebacks."
      filter={{ category: "injury" }}
      emptyTitle="Aktuell keine Ausfälle gemeldet"
      emptyText="Gute Nachrichten — der Kader ist gesund."
    />
  );
}
