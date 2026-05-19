import { FilteredPage } from "@/components/FilteredPage";
export const revalidate = 60;
export const metadata = { title: "Transfers" };
export default function Page() {
  return (
    <FilteredPage
      eyebrow="Geschäfte"
      title="Transfers"
      description="Alle Wechsel, Gerüchte und Vertragsthemen — sortiert nach Insider-Score."
      filter={{ category: "transfers" }}
      emptyTitle="Stille auf dem Transfermarkt"
      emptyText="Keine aktuellen Transfer-Meldungen — vielleicht ein gutes Zeichen."
    />
  );
}
